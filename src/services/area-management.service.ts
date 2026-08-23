import type { WebClient } from "@slack/web-api";

import { createAuditEvent } from "../repositories/auditoria.repository.js";
import { getAllAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { approveAreaItem } from "../repositories/areas-proceso.repository.js";
import { getTareasProceso } from "../repositories/tareas-proceso-read.repository.js";
import { eventId } from "../utils/entity-id.js";
import {
  AreaProcesoDetail,
  TareaProcesoDetail,
} from "../types/process-detail.js";

export type ApproveAreaInput = {
  areaProcesoId: string;
  usuarioId: string;
  comentario?: string;
  cid: string;
  origen?: "manual" | "automatica";
};

export async function approveArea(
  client: WebClient,
  input: ApproveAreaInput,
): Promise<{
  procesoId: string;
  areaProcesoId: string;
  areaNombre: string;
  comentario: string | null;
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
        : input.comentario?.trim()
          ? input.comentario.trim()
          : "Área aprobada por Responsable Funcional",
  });

  return {
    procesoId: area.procesoId,
    areaProcesoId: area.areaProcesoId,
    areaNombre: area.areaNombre,
    comentario: input.comentario?.trim() ? input.comentario.trim() : null,
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
