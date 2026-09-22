import type { WebClient } from "@slack/web-api";

import { createAuditEvent } from "../repositories/auditoria.repository.js";
import { getAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { getTareasProceso } from "../repositories/tareas-proceso-read.repository.js";
import { updateTareaEstado } from "../repositories/tareas-proceso.repository.js";
import { updateProgressAfterTaskManagement } from "./task-progress.service.js";
import {
  reconcileAreaCompletion,
  shouldAutoApproveArea,
} from "./area-management.service.js";

import { eventId } from "../utils/entity-id.js";
import { TASK_STATUS } from "../constants/status.js";

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
  listoParaCierre: boolean;

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

  const comentario = input.comentario?.trim();

  if (!comentario) {
    throw new Error("El comentario de la tarea es obligatorio");
  }

  if (
    [TASK_STATUS.PENDING_APPROVAL, TASK_STATUS.COMPLETED].some(
      (status) => status === tarea.estado,
    )
  ) {
    return {
      procesoId: input.procesoId,
      taskId: tarea.taskId,
      tarea: tarea.tarea,
      comentario: tarea.comentario,
      autoAprobacion: false,
      listoParaCierre: false,
      areaProcesoId: tarea.areaProcesoId,
      areaNombre: "",
    };
  }
  if (tarea.requiereEvidencia) {
    throw new Error(
      "La tarea requiere evidencia antes de enviarse a aprobación",
    );
  }

  const area = areas.find((item) => item.areaProcesoId === tarea.areaProcesoId);

  if (!area) {
    throw new Error(`Área del proceso no encontrada: ${tarea.areaProcesoId}`);
  }

  const tareasArea = tareas.filter(
    (item) => item.areaProcesoId === area.areaProcesoId,
  );

  const autoAprobacion = shouldAutoApproveArea(area, tareasArea);

  const nuevoEstado = autoAprobacion
    ? TASK_STATUS.COMPLETED
    : TASK_STATUS.PENDING_APPROVAL;

  await updateTareaEstado(
    client,
    tarea.slackItemId,
    nuevoEstado,
    input.usuarioId,
    input.comentario,
  );

  await createAuditEvent(client, {
    eventId: eventId(),
    correlationId: input.cid,
    procesoId: input.procesoId,
    entidadTipo: "Tarea",
    entidadId: tarea.taskId,

    accion: autoAprobacion ? "AUTOAPROBAR_TAREA" : "ENVIAR_TAREA_APROBACION",

    usuarioId: input.usuarioId,
    fechaHoraUtc: new Date().toISOString(),
    estadoAnterior: tarea.estado,
    estadoNuevo: nuevoEstado,

    detalle: autoAprobacion
      ? `Tarea autoaprobada: ${tarea.tarea}. ${comentario}`
      : comentario,
  });

  const tareasActualizadas = tareas.map((item) =>
    item.taskId === tarea.taskId
      ? {
          ...item,
          estado: nuevoEstado,
        }
      : item,
  );

  /*
   * Primero actualizamos avance operativo.
   *
   * Si el área estaba Pendiente, aquí puede pasar
   * a En progreso.
   *
   * Esto debe ocurrir ANTES de reconciliar el cierre,
   * para no sobrescribir posteriormente un estado
   * Completada.
   */
  await updateProgressAfterTaskManagement(client, {
    procesoSlackItemId: proceso.slackItemId,
    area,
    tareas: tareasActualizadas,
  });

  let listoParaCierre = false;
  let areaAutoAprobada = false;

  if (autoAprobacion) {
    const reconciliation = await reconcileAreaCompletion(client, {
      procesoId: input.procesoId,
      areaProcesoId: area.areaProcesoId,
      usuarioId: input.usuarioId,
      cid: input.cid,
    });

    areaAutoAprobada = reconciliation.completed;
    listoParaCierre = reconciliation.listoParaCierre;
  }

  return {
    procesoId: input.procesoId,
    taskId: tarea.taskId,
    tarea: tarea.tarea,
    comentario,
    autoAprobacion: areaAutoAprobada,
    listoParaCierre,
    areaProcesoId: area.areaProcesoId,
    areaNombre: area.areaNombre,
  };
}
