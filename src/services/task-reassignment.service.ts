import type { WebClient } from "@slack/web-api";

import { createAuditEvent } from "../repositories/auditoria.repository.js";
import { getAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { getTareasProceso } from "../repositories/tareas-proceso-read.repository.js";
import { updateTareaResponsable } from "../repositories/tareas-proceso.repository.js";
import { canAdministerPys } from "./authorization.service.js";
import { eventId } from "../utils/entity-id.js";

type ReassignTaskInput = {
  procesoId: string;
  taskId: string;
  usuarioEjecutorId: string;
  nuevoResponsableId: string;
  motivo: string;
  cid: string;
};

export type ReassignTaskResult = {
  procesoId: string;
  taskId: string;
  tarea: string;

  responsableAnteriorId: string;
  responsableNuevoId: string;

  responsableFuncionalId: string;

  motivo: string;
};

export async function reassignTask(
  client: WebClient,
  input: ReassignTaskInput,
): Promise<ReassignTaskResult> {
  const autorizado = await canAdministerPys(client, input.usuarioEjecutorId);

  if (!autorizado) {
    throw new Error("Usuario no autorizado para reasignar tareas");
  }

  if (!input.motivo.trim()) {
    throw new Error("El motivo de la reasignación es obligatorio");
  }

  const [procesos, areas, tareas] = await Promise.all([
    getProcesos(client),

    getAreasProceso(client, input.procesoId),

    getTareasProceso(client, input.procesoId),
  ]);

  const proceso = procesos.find((item) => item.procesoId === input.procesoId);

  if (!proceso) {
    throw new Error(`Proceso no encontrado: ${input.procesoId}`);
  }

  if (
    ["Finalizado", "Finalizado con excepción", "Cancelado"].includes(
      proceso.estado,
    )
  ) {
    throw new Error("No se puede reasignar una tarea de un proceso cerrado");
  }

  const tarea = tareas.find((item) => item.taskId === input.taskId);

  if (!tarea) {
    throw new Error(`Tarea no encontrada: ${input.taskId}`);
  }

  if (["Completada", "No aplica"].includes(tarea.estado)) {
    throw new Error(`La tarea no puede reasignarse en estado ${tarea.estado}`);
  }

  if (tarea.responsableOperativoId === input.nuevoResponsableId) {
    throw new Error("El nuevo responsable es el mismo responsable actual");
  }

  /*
   * Validamos que el nuevo usuario
   * siga activo en Slack.
   */
  const userInfo = await client.users.info({
    user: input.nuevoResponsableId,
  });

  if (!userInfo.user || userInfo.user.deleted) {
    throw new Error("El usuario seleccionado está desactivado en Slack");
  }

  const area = areas.find((item) => item.areaProcesoId === tarea.areaProcesoId);

  if (!area) {
    throw new Error(`Área no encontrada: ${tarea.areaProcesoId}`);
  }

  const responsableAnteriorId = tarea.responsableOperativoId;

  await updateTareaResponsable(
    client,
    tarea.slackItemId,
    input.nuevoResponsableId,
  );

  await createAuditEvent(client, {
    eventId: eventId(),
    correlationId: input.cid,
    procesoId: input.procesoId,
    entidadTipo: "Tarea",
    entidadId: tarea.taskId,
    accion: "REASIGNAR_TAREA",
    usuarioId: input.usuarioEjecutorId,
    fechaHoraUtc: new Date().toISOString(),
    estadoAnterior: responsableAnteriorId,
    estadoNuevo: input.nuevoResponsableId,
    detalle: input.motivo.trim(),
  });

  return {
    procesoId: input.procesoId,
    taskId: tarea.taskId,
    tarea: tarea.tarea,
    responsableAnteriorId,
    responsableNuevoId: input.nuevoResponsableId,
    responsableFuncionalId: area.responsableFuncionalId,
    motivo: input.motivo.trim(),
  };
}
