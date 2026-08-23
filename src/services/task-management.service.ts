import type { WebClient } from "@slack/web-api";

import { createAuditEvent } from "../repositories/auditoria.repository.js";
import { updateAreaEstado } from "../repositories/areas-proceso.repository.js";
import { getAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { updateProcesoAvance } from "../repositories/procesos.repository.js";
import { getTareasProceso } from "../repositories/tareas-proceso-read.repository.js";
import { updateTareaEstado } from "../repositories/tareas-proceso.repository.js";
import { eventId } from "../utils/entity-id.js";
import {
  approveArea,
  shouldAutoApproveArea,
} from "./area-management.service.js";

type CompleteTaskInput = {
  procesoId: string;
  taskId: string;
  usuarioId: string;
  comentario?: string;
  cid: string;
};

export type CompleteTaskResult = {
  procesoId: string;

  taskId: string;
  tarea: string;

  comentario: string | null;

  autoAprobacion: boolean;

  areaProcesoId: string;
  areaNombre: string;
};

export async function completeTask(
  client: WebClient,
  input: CompleteTaskInput,
): Promise<CompleteTaskResult> {
  const [procesos, areas, tareas] = await Promise.all([
    getProcesos(client),
    getAreasProceso(client, input.procesoId),
    getTareasProceso(client, input.procesoId),
  ]);

  const proceso = procesos.find((item) => item.procesoId === input.procesoId);

  if (!proceso) {
    throw new Error(`Proceso no encontrado: ${input.procesoId}`);
  }

  const tarea = tareas.find((item) => item.taskId === input.taskId);

  if (!tarea) {
    throw new Error(`Tarea no encontrada: ${input.taskId}`);
  }

  if (tarea.responsableOperativoId !== input.usuarioId) {
    throw new Error("El usuario no es responsable de esta tarea");
  }

  if (tarea.estado === "Completada") {
    return {
      procesoId: input.procesoId,
      taskId: tarea.taskId,
      tarea: tarea.tarea,
      comentario: tarea.comentario,
      autoAprobacion: false,
      areaProcesoId: tarea.areaProcesoId,
      areaNombre: "",
    };
  }
  if (tarea.requiereEvidencia) {
    throw new Error("La tarea requiere evidencia antes de completarse");
  }

  await updateTareaEstado(
    client,
    tarea.slackItemId,
    "Completada",
    input.usuarioId,
    input.comentario,
  );

  await createAuditEvent(client, {
    eventId: eventId(),
    correlationId: input.cid,
    procesoId: input.procesoId,
    entidadTipo: "Tarea",
    entidadId: tarea.taskId,
    accion: "COMPLETAR_TAREA",
    usuarioId: input.usuarioId,
    fechaHoraUtc: new Date().toISOString(),
    estadoAnterior: tarea.estado,
    estadoNuevo: "Completada",
    detalle: input.comentario?.trim()
      ? input.comentario.trim()
      : "Tarea completada",
  });

  const tareasActualizadas = tareas.map((item) =>
    item.taskId === tarea.taskId
      ? {
          ...item,
          estado: "Completada",
        }
      : item,
  );

  const area = areas.find((item) => item.areaProcesoId === tarea.areaProcesoId);

  if (!area) {
    throw new Error(`Área del proceso no encontrada: ${tarea.areaProcesoId}`);
  }

  const tareasArea = tareasActualizadas.filter(
    (item) => item.areaProcesoId === area.areaProcesoId,
  );

  const obligatoriasCompletas = tareasArea
    .filter((item) => item.obligatoria)
    .every(
      (item) => item.estado === "Completada" || item.estado === "No aplica",
    );

  const autoAprobacion =
    obligatoriasCompletas && shouldAutoApproveArea(area, tareasArea);

  if (obligatoriasCompletas) {
    if (autoAprobacion) {
      /*
       * approveArea vuelve a consultar
       * las tareas desde Slack.
       *
       * Primero dejamos el área en
       * Lista para aprobación para
       * mantener una transición
       * consistente.
       */
      if (area.estado !== "Lista para aprobación") {
        await updateAreaEstado(
          client,
          area.slackItemId,
          "Lista para aprobación",
        );
      }

      await approveArea(client, {
        areaProcesoId: area.areaProcesoId,
        usuarioId: input.usuarioId,
        comentario: "Aprobación automática",
        cid: input.cid,
        origen: "automatica",
      });
    } else if (area.estado !== "Lista para aprobación") {
      await updateAreaEstado(client, area.slackItemId, "Lista para aprobación");
    }
  } else if (area.estado === "Pendiente") {
    await updateAreaEstado(client, area.slackItemId, "En progreso");
  }

  const tareasComputables = tareasActualizadas.filter(
    (item) => item.obligatoria && item.estado !== "No aplica",
  );

  const completadas = tareasComputables.filter(
    (item) => item.estado === "Completada",
  ).length;

  const porcentajeAvance =
    tareasComputables.length === 0
      ? 0
      : Math.round((completadas / tareasComputables.length) * 100);

  await updateProcesoAvance(client, proceso.slackItemId, porcentajeAvance);
  return {
    procesoId: input.procesoId,
    taskId: tarea.taskId,
    tarea: tarea.tarea,
    comentario: input.comentario?.trim() ? input.comentario.trim() : null,
    autoAprobacion,
    areaProcesoId: area.areaProcesoId,
    areaNombre: area.areaNombre,
  };
}
