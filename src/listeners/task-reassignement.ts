import type { App } from "@slack/bolt";

import {
  getTareasProceso,
  getTareaByTaskId,
} from "../repositories/tareas-proceso-read.repository.js";
import { getAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { canAdministerPys } from "../services/authorization.service.js";
import { reassignTask } from "../services/task-reassignment.service.js";
import { publishHome } from "../services/home-publish.service.js";
import { correlationId, logger } from "../utils/logger.js";
import { buildReassignTaskView } from "../views/reassign-task.view.js";
import { notifyTaskReassigned } from "../services/notification.service.js";
import { getProcessDetail } from "../services/process-detail.service.js";

import { buildProcessDetailView } from "../views/process-detail.view.js";
export function registerTaskReassignmentListeners(app: App): void {
  app.action("pys_reassign_task", async ({ ack, action, body, client }) => {
    await ack();

    const cid = correlationId("reassign");

    if (action.type !== "button") {
      return;
    }

    const taskId = action.value;

    if (!taskId) {
      return;
    }

    if (!("trigger_id" in body)) {
      return;
    }

    try {
      const autorizado = await canAdministerPys(client, body.user.id);

      if (!autorizado) {
        throw new Error("Usuario no autorizado para reasignar tareas");
      }

      /*
       * Como el botón solo trae taskId,
       * buscamos la tarea real.
       *
       * Si ya tienes un helper tipo
       * getTareaByTaskId(), úsalo aquí
       * en lugar de leer todas.
       */
      const tarea = await getTareaByTaskId(client, taskId);

      if (!tarea) {
        throw new Error(`Tarea no encontrada: ${taskId}`);
      }
      if (!("view" in body) || !body.view) {
        logger.error(
          {
            cid,
            taskId,
            userId: body.user.id,
            action: "task_reassignment_missing_parent_view",
          },
          "La reasignación no provino de una vista",
        );

        return;
      }

      const parentViewId = body.view.id;

      await client.views.push({
        trigger_id: body.trigger_id,

        view: buildReassignTaskView({
          procesoId: tarea.procesoId,
          taskId: tarea.taskId,
          tarea: tarea.tarea,
          responsableActualId: tarea.responsableOperativoId,
          cid,
          parentViewId,
        }),
      });

      logger.info(
        {
          cid,
          procesoId: tarea.procesoId,
          taskId: tarea.taskId,
          userId: body.user.id,
          action: "task_reassignment_view_pushed",
        },
        "Vista de reasignación agregada al modal",
      );
    } catch (err) {
      logger.error(
        {
          cid,
          taskId,
          userId: body.user.id,
          err,
          action: "task_reassignment_modal_failed",
        },
        "Error abriendo reasignación de tarea",
      );

      await client.chat.postMessage({
        channel: body.user.id,

        text: `No fue posible abrir la reasignación. Referencia: ${cid}`,
      });
    }
  });

  app.view("pys_reassign_task_submit", async ({ ack, body, view, client }) => {
    const metadata = JSON.parse(view.private_metadata || "{}") as {
      procesoId?: string;
      taskId?: string;
      cid?: string;
      parentViewId?: string;
    };

    const procesoId = metadata.procesoId;
    const taskId = metadata.taskId;
    const cid = metadata.cid ?? correlationId("reassign");
    const newResponsibleBlock = view.state.values.new_responsible;
    const reasonBlock = view.state.values.reason;
    const nuevoResponsableId =
      newResponsibleBlock?.new_responsible_id?.selected_user;
    const motivo = reasonBlock?.reason_value?.value?.trim() ?? "";
    const errors: Record<string, string> = {};

    if (!nuevoResponsableId) {
      errors.new_responsible = "Selecciona un nuevo responsable.";
    }

    if (!motivo) {
      errors.reason = "El motivo de la reasignación es obligatorio.";
    }

    if (!procesoId || !taskId) {
      await ack();

      return;
    }

    if (Object.keys(errors).length > 0) {
      await ack({
        response_action: "errors",
        errors,
      });

      return;
    }

    if (!procesoId || !taskId || !nuevoResponsableId) {
      await ack();
      return;
    }

    await ack();

    try {
      const result = await reassignTask(client, {
        procesoId,
        taskId,
        usuarioEjecutorId: body.user.id,
        nuevoResponsableId,
        motivo,
        cid,
      });

      await notifyTaskReassigned(client, {
        cid,
        procesoId: result.procesoId,
        taskId: result.taskId,
        tarea: result.tarea,
        responsableAnteriorId: result.responsableAnteriorId,
        responsableNuevoId: result.responsableNuevoId,
        responsableFuncionalId: result.responsableFuncionalId,
        ejecutadoPorId: body.user.id,
        motivo: result.motivo,
      });

      await publishHome(client, body.user.id);

      await client.chat.postMessage({
        channel: body.user.id,

        text:
          "✅ *Tarea reasignada correctamente*\n\n" +
          `*Proceso:* ${result.procesoId}\n` +
          `*Tarea:* ${result.tarea}\n` +
          `*Responsable anterior:* <@${result.responsableAnteriorId}>\n` +
          `*Nuevo responsable:* <@${result.responsableNuevoId}>\n` +
          `*Motivo:* ${result.motivo}`,
      });

      const updatedDetail = await getProcessDetail(client, result.procesoId);

      const puedeAdministrar = await canAdministerPys(client, body.user.id);

      logger.info(
        {
          cid,
          parentViewId: metadata.parentViewId,
          action: "task_reassignment_parent_view_debug",
        },
        "Validando vista padre para refresco",
      );

      if (metadata.parentViewId) {
        await client.views.update({
          view_id: metadata.parentViewId,

          view: buildProcessDetailView(updatedDetail, {
            puedeAdministrar,
            cid,
          }),
        });
      }

      logger.info(
        {
          cid,
          procesoId: result.procesoId,
          taskId: result.taskId,
          userId: body.user.id,
          responsableAnteriorId: result.responsableAnteriorId,
          responsableNuevoId: result.responsableNuevoId,
          action: "task_reassigned",
        },
        "Tarea reasignada correctamente",
      );
    } catch (err) {
      logger.error(
        {
          cid,
          procesoId,
          taskId,
          userId: body.user.id,
          err,
          action: "task_reassignment_failed",
        },
        "Error reasignando tarea",
      );

      await client.chat.postMessage({
        channel: body.user.id,

        text: `No fue posible reasignar la tarea. Referencia: ${cid}`,
      });

      await publishHome(client, body.user.id);
    }
  });
}
