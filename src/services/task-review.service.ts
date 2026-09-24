import type { WebClient } from "@slack/web-api";

import {
  AREA_STATUS,
  EVIDENCE_STATUS,
  TASK_STATUS,
} from "../constants/status.js";
import { getTareasProceso } from "../repositories/tareas-proceso-read.repository.js";

import {
  updateTareaEstado,
  returnTaskToPending,
} from "../repositories/tareas-proceso.repository.js";

import { getAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { updateAreaEstado } from "../repositories/areas-proceso.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { updateProgressAfterTaskManagement } from "./task-progress.service.js";
import { getEvidenciasByTask } from "../repositories/evidencias-read.repository.js";
import { createAuditEvent } from "../repositories/auditoria.repository.js";
import { reconcileAreaCompletion } from "./area-management.service.js";

import { eventId } from "../utils/entity-id.js";

import { approveEvidence, rejectEvidence } from "./evidence-review.service.js";

type ReviewTaskInput = {
  taskId: string;
  procesoId: string;
  areaProcesoId: string;
  usuarioId: string;
  cid: string;
};

type RejectTaskInput = ReviewTaskInput & {
  comentario: string;
};

export type TaskReviewResult = {
  procesoId: string;
  taskId: string;
  tarea: string;
  areaProcesoId: string;

  responsableOperativoId: string;
  requiereEvidencia: boolean;
  areaCompleted: boolean;
  listoParaCierre: boolean;
};

async function getReviewContext(client: WebClient, input: ReviewTaskInput) {
  const [tareas, areas, evidenciasTarea] = await Promise.all([
    getTareasProceso(client, input.procesoId),
    getAreasProceso(client, input.procesoId),
    getEvidenciasByTask(client, input.taskId),
  ]);

  const tarea = tareas.find((item) => item.taskId === input.taskId);

  if (!tarea) {
    throw new Error(`Tarea no encontrada: ${input.taskId}`);
  }

  if (tarea.procesoId !== input.procesoId) {
    throw new Error("La tarea no pertenece al proceso indicado");
  }

  if (tarea.areaProcesoId !== input.areaProcesoId) {
    throw new Error("La tarea no pertenece al área indicada");
  }

  if (tarea.estado !== TASK_STATUS.PENDING_APPROVAL) {
    throw new Error(
      `La tarea ya no está pendiente de aprobación. ` +
        `Estado actual: ${tarea.estado}`,
    );
  }

  const area = areas.find((item) => item.areaProcesoId === input.areaProcesoId);

  if (!area) {
    throw new Error(`Área no encontrada: ${input.areaProcesoId}`);
  }

  if (area.responsableFuncionalId !== input.usuarioId) {
    throw new Error("El usuario no es el Responsable Funcional del área");
  }

  return {
    tarea,
    area,
    evidenciasTarea,
    tareas,
    areas,
  };
}

export async function approveTask(
  client: WebClient,
  input: ReviewTaskInput,
): Promise<TaskReviewResult> {
  const { tarea, area, evidenciasTarea } = await getReviewContext(
    client,
    input,
  );

  const evidenciasPendientes = evidenciasTarea.filter(
    (evidencia) => evidencia.estado === EVIDENCE_STATUS.PENDING_REVIEW,
  );

  for (const evidencia of evidenciasPendientes) {
    await approveEvidence(client, {
      evidencia,
      usuarioId: input.usuarioId,
    });
  }

  await updateTareaEstado(
    client,
    tarea.slackItemId,
    TASK_STATUS.COMPLETED,
    input.usuarioId,
  );

  await createAuditEvent(client, {
    eventId: eventId(),
    correlationId: input.cid,
    procesoId: tarea.procesoId,
    entidadTipo: "Tarea",
    entidadId: tarea.taskId,
    accion: "APROBAR_TAREA",
    usuarioId: input.usuarioId,
    fechaHoraUtc: new Date().toISOString(),
    estadoAnterior: TASK_STATUS.PENDING_APPROVAL,
    estadoNuevo: TASK_STATUS.COMPLETED,
    detalle: `Tarea aprobada: ${tarea.tarea}`,
  });

  /*
   * Primero dejamos consistente el área desde el estado
   * real actual de Slack.
   */
  const reconciliation = await reconcileAreaCompletion(client, {
    procesoId: tarea.procesoId,
    areaProcesoId: area.areaProcesoId,
    usuarioId: input.usuarioId,
    cid: input.cid,
  });

  /*
   * Si todavía no está completa, por lo menos la dejamos
   * En progreso cuando corresponda.
   */
  if (!reconciliation.completed && area.estado === AREA_STATUS.PENDING) {
    await updateAreaEstado(client, area.slackItemId, AREA_STATUS.IN_PROGRESS);
  }

  return {
    procesoId: tarea.procesoId,
    taskId: tarea.taskId,
    tarea: tarea.tarea,
    areaProcesoId: area.areaProcesoId,
    responsableOperativoId: tarea.responsableOperativoId,
    requiereEvidencia: tarea.requiereEvidencia,
    areaCompleted: reconciliation.completed,
    listoParaCierre: reconciliation.listoParaCierre,
  };
}

export async function rejectTask(
  client: WebClient,
  input: RejectTaskInput,
): Promise<TaskReviewResult> {
  const comentario = input.comentario.trim();

  if (!comentario) {
    throw new Error("El comentario de rechazo es obligatorio");
  }

  const { tarea, area, evidenciasTarea, tareas } = await getReviewContext(
    client,
    input,
  );

  const evidenciasPendientes = evidenciasTarea.filter(
    (evidencia) => evidencia.estado === EVIDENCE_STATUS.PENDING_REVIEW,
  );

  for (const evidencia of evidenciasPendientes) {
    await rejectEvidence(client, {
      evidencia,
      usuarioId: input.usuarioId,
      comentario,
    });
  }

  await returnTaskToPending(client, tarea.slackItemId, comentario);

  const procesos = await getProcesos(client);
  const proceso = procesos.find((item) => item.procesoId === tarea.procesoId);
  if (!proceso) {
    throw new Error(`Proceso no encontrado: ${tarea.procesoId}`);
  }

  const tareasActualizadas = tareas.map((item) =>
    item.taskId === tarea.taskId
      ? {
          ...item,
          estado: TASK_STATUS.PENDING,
          comentarioRechazo: comentario,
        }
      : item,
  );
  await updateProgressAfterTaskManagement(client, {
    procesoSlackItemId: proceso.slackItemId,
    area,
    tareas: tareasActualizadas,
  });

  if (area.estado === AREA_STATUS.READY_FOR_APPROVAL) {
    await updateAreaEstado(client, area.slackItemId, AREA_STATUS.IN_PROGRESS);
  }

  await createAuditEvent(client, {
    eventId: eventId(),
    correlationId: input.cid,
    procesoId: tarea.procesoId,
    entidadTipo: "Tarea",
    entidadId: tarea.taskId,
    accion: "RECHAZAR_TAREA",
    usuarioId: input.usuarioId,
    fechaHoraUtc: new Date().toISOString(),
    estadoAnterior: TASK_STATUS.PENDING_APPROVAL,
    estadoNuevo: TASK_STATUS.PENDING,
    detalle: `Tarea rechazada: ${tarea.tarea}. ` + `Motivo: ${comentario}`,
  });

  return {
    procesoId: tarea.procesoId,
    taskId: tarea.taskId,
    tarea: tarea.tarea,
    areaProcesoId: area.areaProcesoId,

    responsableOperativoId: tarea.responsableOperativoId,
    requiereEvidencia: tarea.requiereEvidencia,
    areaCompleted: false,
    listoParaCierre: false,
  };
}
