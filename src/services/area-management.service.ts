import type { WebClient } from "@slack/web-api";
import { logger } from "../utils/logger.js";

import { createAuditEvent } from "../repositories/auditoria.repository.js";
import { getAllAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { approveAreaItem } from "../repositories/areas-proceso.repository.js";
import { getTareasProceso } from "../repositories/tareas-proceso-read.repository.js";
import { recalculateProcessState } from "./process-state.service.js";
import { eventId } from "../utils/entity-id.js";
import {
  AreaProcesoDetail,
  TareaProcesoDetail,
} from "../types/process-detail.js";
import { AREA_STATUS, TASK_STATUS } from "../constants/status.js";
import { getAreasProceso } from "../repositories/areas-proceso-read.repository.js";

export type ApproveAreaInput = {
  areaProcesoId: string;
  usuarioId: string;
  comentario?: string;
  cid: string;
  origen?: "manual" | "automatica" | "tareas_aprobadas";
};

export type ReconcileAreaCompletionInput = {
  procesoId: string;
  areaProcesoId: string;
  usuarioId: string;
  cid: string;
};

export async function reconcileAreaCompletion(
  client: WebClient,
  input: ReconcileAreaCompletionInput,
): Promise<{
  completed: boolean;
  listoParaCierre: boolean;
}> {
  /*
   * IMPORTANTE:
   * Aquí sí hacemos una lectura fresca.
   *
   * Esta función existe precisamente para no depender
   * del snapshot que tenía approveTask() al iniciar.
   */
  const [areas, tareas] = await Promise.all([
    getAreasProceso(client, input.procesoId, { bypassCache: true }),

    getTareasProceso(client, input.procesoId, { bypassCache: true }),
  ]);

  const area = areas.find((item) => item.areaProcesoId === input.areaProcesoId);

  if (!area) {
    throw new Error(`Área no encontrada: ${input.areaProcesoId}`);
  }

  if (area.responsableFuncionalId !== input.usuarioId) {
    throw new Error("El usuario no es el Responsable Funcional del área");
  }

  /*
   * Idempotencia.
   *
   * Si otra ejecución concurrente ya completó el área,
   * no volvemos a escribirla.
   */
  if (area.estado === AREA_STATUS.COMPLETED) {
    const processState = await recalculateProcessState(client, {
      procesoId: input.procesoId,
      usuarioId: input.usuarioId,
      cid: input.cid,
      areas,
    });

    return {
      completed: true,
      listoParaCierre: processState.listoParaCierre,
    };
  }

  const tareasArea = tareas.filter(
    (item) => item.areaProcesoId === input.areaProcesoId,
  );

  const obligatorias = tareasArea.filter(
    (item) => item.obligatoria && item.estado !== TASK_STATUS.NOT_APPLICABLE,
  );

  logger.info(
    {
      cid: input.cid,
      procesoId: input.procesoId,
      areaProcesoId: input.areaProcesoId,
      obligatorias: obligatorias.length,
      completadas: obligatorias.filter(
        (item) => item.estado === TASK_STATUS.COMPLETED,
      ).length,
      action: "area_completion_reconciliation_checked",
    },
    "Reconciliación de cierre de área evaluada",
  );

  const obligatoriasCompletas =
    obligatorias.length > 0 &&
    obligatorias.every((item) => item.estado === TASK_STATUS.COMPLETED);

  if (!obligatoriasCompletas) {
    return {
      completed: false,
      listoParaCierre: false,
    };
  }

  /*
   * Llegados aquí, el estado REAL actual en Slack confirma
   * que todas las tareas obligatorias están completadas.
   */
  await approveAreaItem(client, area.slackItemId, input.usuarioId);

  await createAuditEvent(client, {
    eventId: eventId(),
    correlationId: input.cid,
    procesoId: input.procesoId,
    entidadTipo: "AreaProceso",
    entidadId: input.areaProcesoId,
    accion: "APROBAR_AREA",
    usuarioId: input.usuarioId,
    fechaHoraUtc: new Date().toISOString(),
    estadoAnterior: area.estado,
    estadoNuevo: AREA_STATUS.COMPLETED,
    detalle:
      "Área completada por reconciliación al confirmar todas las tareas obligatorias completadas",
  });

  const areasActualizadas = areas.map((item) =>
    item.areaProcesoId === input.areaProcesoId
      ? {
          ...item,
          estado: AREA_STATUS.COMPLETED,
        }
      : item,
  );

  const processState = await recalculateProcessState(client, {
    procesoId: input.procesoId,
    usuarioId: input.usuarioId,
    cid: input.cid,
    areas: areasActualizadas,
  });

  logger.info(
    {
      cid: input.cid,
      procesoId: input.procesoId,
      areaProcesoId: input.areaProcesoId,
      action: "area_completion_reconciled",
    },
    "Área completada por reconciliación",
  );

  return {
    completed: true,
    listoParaCierre: processState.listoParaCierre,
  };
}

export async function approveArea(
  client: WebClient,
  input: ApproveAreaInput,
): Promise<{
  procesoId: string;
  areaProcesoId: string;
  areaNombre: string;
  comentario: string | null;
  listoParaCierre: boolean;
}> {
  const origen = input.origen ?? "manual";
  const areas = await getAllAreasProceso(client);

  const area = areas.find((item) => item.areaProcesoId === input.areaProcesoId);

  if (!area) {
    throw new Error(`Área no encontrada: ${input.areaProcesoId}`);
  }

  /*
   * Autorización backend.
   */
  if (area.responsableFuncionalId !== input.usuarioId) {
    throw new Error("El usuario no es responsable funcional de esta área");
  }

  /*
   * Idempotencia.
   */
  if (area.estado === "Completada") {
    return {
      procesoId: area.procesoId,
      areaProcesoId: area.areaProcesoId,
      areaNombre: area.areaNombre,
      comentario: area.comentario ?? null,
      listoParaCierre: false,
    };
  }

  /*
   * No confiamos en el estado que tenía
   * el modal cuando se abrió.
   */
  if (origen === "manual" && area.estado !== "Lista para aprobación") {
    throw new Error(
      `El área no está lista para aprobación. Estado actual: ${area.estado}`,
    );
  }

  const tareas = await getTareasProceso(client, area.procesoId);

  const tareasArea = tareas.filter(
    (tarea) => tarea.areaProcesoId === area.areaProcesoId,
  );

  const obligatorias = tareasArea.filter(
    (tarea) => tarea.obligatoria && tarea.estado !== "No aplica",
  );

  const pendientes = obligatorias.filter(
    (tarea) => tarea.estado !== "Completada",
  );

  if (pendientes.length > 0) {
    throw new Error(
      `El área tiene ${pendientes.length} tarea(s) obligatoria(s) pendiente(s)`,
    );
  }

  await approveAreaItem(
    client,
    area.slackItemId,
    input.usuarioId,
    input.comentario,
  );

  const areasActualizadas = areas.map((item) =>
    item.areaProcesoId === area.areaProcesoId
      ? {
          ...item,
          estado: "Completada",
        }
      : item,
  );

  const processState = await recalculateProcessState(client, {
    procesoId: area.procesoId,
    usuarioId: input.usuarioId,
    cid: input.cid,
    areas: areasActualizadas,
  });

  await createAuditEvent(client, {
    eventId: eventId(),
    correlationId: input.cid,
    procesoId: area.procesoId,
    entidadTipo: "AreaProceso",
    entidadId: area.areaProcesoId,
    accion: "APROBAR_AREA",
    usuarioId: input.usuarioId,
    fechaHoraUtc: new Date().toISOString(),
    estadoAnterior: area.estado,
    estadoNuevo: "Completada",
    detalle:
      origen === "automatica"
        ? "Área aprobada automáticamente: el Responsable Funcional es el único Responsable Operativo del área"
        : origen === "tareas_aprobadas"
          ? "Área completada automáticamente al quedar aprobadas todas sus tareas obligatorias"
          : input.comentario?.trim()
            ? input.comentario.trim()
            : "Área aprobada por Responsable Funcional",
  });

  return {
    procesoId: area.procesoId,
    areaProcesoId: area.areaProcesoId,
    areaNombre: area.areaNombre,
    comentario: input.comentario?.trim() ? input.comentario.trim() : null,
    listoParaCierre: processState.listoParaCierre,
  };
}

export function shouldAutoApproveArea(
  area: AreaProcesoDetail,
  tareasArea: TareaProcesoDetail[],
): boolean {
  if (tareasArea.length === 0) {
    return false;
  }

  const responsablesOperativos = new Set(
    tareasArea
      .map((tarea) => tarea.responsableOperativoId)
      .filter((userId): userId is string => Boolean(userId)),
  );

  return (
    responsablesOperativos.size === 1 &&
    responsablesOperativos.has(area.responsableFuncionalId)
  );
}
