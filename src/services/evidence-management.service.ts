// src/services/evidence-management.service.ts

import type { WebClient } from "@slack/web-api";

import {
  createEvidence,
  updateEvidenceReview,
} from "../repositories/evidencias.repository.js";
import { getSelectOptionId } from "./slack-list-schema.service.js";
import { slackLists } from "../config/slack/lists.js";
import { slackColumns } from "../config/slack/columns.js";
import { getMaxTamanoEvidenciaMB } from "./runtime-config.service.js";
import { getTareasProceso } from "../repositories/tareas-proceso-read.repository.js";
import { updateTareaEstado } from "../repositories/tareas-proceso.repository.js";
import { createAuditEvent } from "../repositories/auditoria.repository.js";
import { eventId, evidenceId } from "../utils/entity-id.js";
import { getEvidenciasByTask } from "../repositories/evidencias-read.repository.js";
import { EVIDENCE_STATUS, TASK_STATUS } from "../constants/status.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { getAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { updateProgressAfterTaskManagement } from "./task-progress.service.js";
import {
  completeAreaFromApprovedTasks,
  shouldAutoApproveArea,
} from "./area-management.service.js";

import { approveEvidence } from "./evidence-review.service.js";

export type SlackEvidenceFile = {
  id: string;
  name?: string;
  filetype?: string;
  mimetype?: string;
  size?: number;
  user?: string;
  permalink?: string;
};

type RegisterEvidenceInput = {
  procesoId: string;
  taskId: string;
  usuarioId: string;
  archivo: SlackEvidenceFile;
  comentario?: string;
  cid: string;
};

export type RegisterEvidenceResult = {
  evidenceId: string;
  procesoId: string;
  taskId: string;

  slackFileId: string;
  nombreOriginal: string;
};

export async function registerEvidence(
  client: WebClient,
  input: RegisterEvidenceInput,
): Promise<RegisterEvidenceResult> {
  const archivo = input.archivo;

  if (!archivo.id) {
    throw new Error("La evidencia no contiene Slack File ID");
  }

  if (archivo.user && archivo.user !== input.usuarioId) {
    throw new Error(
      "El archivo de evidencia fue cargado por un usuario distinto",
    );
  }

  const comentario = input.comentario?.trim();

  if (!comentario) {
    throw new Error("El comentario de la tarea es obligatorio");
  }

  const id = evidenceId();
  const estadoPendienteOptionId = await getSelectOptionId(
    client,
    slackLists.evidencias.id,
    slackColumns.evidencias.estado,
    EVIDENCE_STATUS.PENDING_REVIEW,
  );

  const tipoArchivo = archivo.filetype?.toLowerCase();

  if (!tipoArchivo) {
    throw new Error(
      "No fue posible determinar el tipo del archivo de evidencia",
    );
  }

  const tipoArchivoOptionId = await getSelectOptionId(
    client,
    slackLists.evidencias.id,
    slackColumns.evidencias.tipoArchivo,
    tipoArchivo,
  );

  //validación de tamaño del archivo
  const maxTamanoMB = await getMaxTamanoEvidenciaMB(client);
  const maxTamanoBytes = maxTamanoMB * 1024 * 1024;
  const tamanoBytes = archivo.size ?? 0;

  if (tamanoBytes <= 0) {
    throw new Error("No fue posible determinar el tamaño del archivo");
  }

  if (tamanoBytes > maxTamanoBytes) {
    throw new Error(
      `La evidencia supera el tamaño máximo permitido de ${maxTamanoMB} MB`,
    );
  }

  //validación de tareas
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

  const area = areas.find((item) => item.areaProcesoId === tarea.areaProcesoId);

  if (!area) {
    throw new Error(`Área del proceso no encontrada: ${tarea.areaProcesoId}`);
  }

  const tareasArea = tareas.filter(
    (item) => item.areaProcesoId === area.areaProcesoId,
  );

  const autoAprobacion = shouldAutoApproveArea(area, tareasArea);

  if (tarea.responsableOperativoId !== input.usuarioId) {
    throw new Error("El usuario no es responsable de esta tarea");
  }

  if (!tarea.requiereEvidencia) {
    throw new Error("La tarea no requiere evidencia");
  }

  if (
    [
      TASK_STATUS.COMPLETED,
      TASK_STATUS.NOT_APPLICABLE,
      TASK_STATUS.PENDING_APPROVAL,
    ].some((status) => status === tarea.estado)
  ) {
    throw new Error(
      `La tarea no admite nuevas evidencias en estado "${tarea.estado}"`,
    );
  }
  const evidenciasExistentes = await getEvidenciasByTask(client, input.taskId);

  const evidenciaPendiente = evidenciasExistentes.find(
    (evidencia) => evidencia.estado === EVIDENCE_STATUS.PENDING_REVIEW,
  );

  if (evidenciaPendiente) {
    /*
     * Si ya existe evidencia pendiente pero la tarea no quedó
     * en Pendiente aprobación, reconciliamos el estado.
     */
    if (tarea.estado !== TASK_STATUS.PENDING_APPROVAL) {
      await updateTareaEstado(
        client,
        tarea.slackItemId,
        TASK_STATUS.PENDING_APPROVAL,
        input.usuarioId,
        comentario,
      );

      const tareasActualizadas = tareas.map((item) =>
        item.taskId === tarea.taskId
          ? {
              ...item,
              estado: TASK_STATUS.PENDING_APPROVAL,
            }
          : item,
      );

      const area = areas.find(
        (item) => item.areaProcesoId === tarea.areaProcesoId,
      );

      if (!area) {
        throw new Error(
          `Área del proceso no encontrada: ${tarea.areaProcesoId}`,
        );
      }

      await updateProgressAfterTaskManagement(client, {
        procesoSlackItemId: proceso.slackItemId,
        area,
        tareas: tareasActualizadas,
      });

      await createAuditEvent(client, {
        eventId: eventId(),
        correlationId: input.cid,
        procesoId: input.procesoId,
        entidadTipo: "Tarea",
        entidadId: tarea.taskId,
        accion: "RECONCILIAR_TAREA_EVIDENCIA",
        usuarioId: input.usuarioId,
        fechaHoraUtc: new Date().toISOString(),
        estadoAnterior: tarea.estado,
        estadoNuevo: TASK_STATUS.PENDING_APPROVAL,
        detalle: `La tarea ${tarea.tarea} fue reconciliada a Pendiente aprobación al detectarse una evidencia pendiente de revisión.`,
      });
    }

    return {
      evidenceId: evidenciaPendiente.evidenceId,
      procesoId: input.procesoId,
      taskId: input.taskId,
      slackFileId: evidenciaPendiente.slackFileId,
      nombreOriginal: evidenciaPendiente.nombreOriginal,
    };
  }

  const evidenceSlackItemId = await createEvidence(client, {
    evidenceId: id,
    procesoId: input.procesoId,
    taskId: input.taskId,
    slackFileId: archivo.id,
    nombreOriginal: archivo.name ?? archivo.id,
    tipoArchivoOptionId,
    tamanoBytes: archivo.size ?? 0,
    autorId: input.usuarioId,
    fechaCarga: new Date().toISOString().slice(0, 10),
    estadoOptionId: estadoPendienteOptionId,
    slackPermalink: archivo.permalink ?? "",
  });

  const nuevoEstadoTarea = autoAprobacion
    ? TASK_STATUS.COMPLETED
    : TASK_STATUS.PENDING_APPROVAL;

  if (autoAprobacion) {
    await updateEvidenceReview(client, {
      slackItemId: evidenceSlackItemId,
      estado: "Aceptada",
      revisorFuncionalId: input.usuarioId,
      fechaRevision: new Date().toISOString().slice(0, 10),
    });
  }

  await updateTareaEstado(
    client,
    tarea.slackItemId,
    nuevoEstadoTarea,
    input.usuarioId,
    comentario,
  );

  const tareasActualizadas = tareas.map((item) =>
    item.taskId === tarea.taskId
      ? {
          ...item,
          estado: nuevoEstadoTarea,
        }
      : item,
  );

  if (autoAprobacion) {
    const tareasAreaActualizadas = tareasActualizadas.filter(
      (item) => item.areaProcesoId === area.areaProcesoId,
    );

    const obligatoriasCompletas = tareasAreaActualizadas
      .filter(
        (item) =>
          item.obligatoria && item.estado !== TASK_STATUS.NOT_APPLICABLE,
      )
      .every((item) => item.estado === TASK_STATUS.COMPLETED);

    if (obligatoriasCompletas) {
      await completeAreaFromApprovedTasks(client, {
        area,
        areasProceso: areas,
        usuarioId: input.usuarioId,
        cid: input.cid,
      });
    }
  }

  await updateProgressAfterTaskManagement(client, {
    procesoSlackItemId: proceso.slackItemId,
    area,
    tareas: tareasActualizadas,
  });

  await createAuditEvent(client, {
    eventId: eventId(),
    correlationId: input.cid,
    procesoId: input.procesoId,
    entidadTipo: "Evidencia",
    entidadId: id,

    accion: autoAprobacion
      ? "CARGAR_EVIDENCIA_AUTOAPROBADA"
      : "CARGAR_EVIDENCIA",

    usuarioId: input.usuarioId,
    fechaHoraUtc: new Date().toISOString(),
    estadoAnterior: tarea.estado,
    estadoNuevo: nuevoEstadoTarea,

    detalle: autoAprobacion
      ? `Evidencia ${archivo.name ?? archivo.id} asociada a la tarea ${tarea.tarea}. Tarea autoaprobada.`
      : `Evidencia ${archivo.name ?? archivo.id} asociada a la tarea ${tarea.tarea}`,
  });

  return {
    evidenceId: id,
    procesoId: input.procesoId,
    taskId: input.taskId,
    slackFileId: archivo.id,
    nombreOriginal: archivo.name ?? archivo.id,
  };
}
