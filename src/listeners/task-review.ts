import type { App } from "@slack/bolt";

import { approveTask, rejectTask } from "../services/task-review.service.js";
import { buildRejectTaskView } from "../views/reject-task.view.js";
import { correlationId, logger } from "../utils/logger.js";
import {
  releaseOperationLock,
  tryAcquireOperationLock,
} from "../services/interaction-lock.service.js";
import { loadManageAreaView } from "../services/manage-area-view.service.js";

function buildTaskReviewProcessingView(
  areaProcesoId: string,
  cid: string,
  message: string,
) {
  return {
    type: "modal" as const,

    callback_id: "pys_task_review_processing",

    private_metadata: JSON.stringify({
      areaProcesoId,
      cid,
    }),

    title: {
      type: "plain_text" as const,
      text: "Gestionar área",
    },

    blocks: [
      {
        type: "section" as const,
        text: {
          type: "mrkdwn" as const,

          text:
            `⏳ *${message}*\n\n` +
            "Estamos actualizando la información. " +
            "Espera hasta que termine el proceso.",
        },
      },
    ],
  };
}

function buildTaskReviewSuccessView(
  areaProcesoId: string,
  cid: string,
  message: string,
) {
  return {
    type: "modal" as const,

    callback_id: "pys_task_review_success",

    private_metadata: JSON.stringify({
      areaProcesoId,
      cid,
    }),

    title: {
      type: "plain_text" as const,
      text: "Gestionar tarea",
    },

    close: {
      type: "plain_text" as const,
      text: "Cerrar",
    },

    blocks: [
      {
        type: "section" as const,

        text: {
          type: "mrkdwn" as const,
          text: `✅ *${message}*`,
        },
      },
    ],
  };
}

export function registerTaskReviewListeners(app: App): void {
  app.action("pys_task_approve", async ({ ack, action, body, client }) => {
    await ack();

    if (action.type !== "button") {
      return;
    }

    if (!action.value) {
      return;
    }

    const cid = correlationId("task-approve");

    let taskId = "";
    let areaProcesoId = "";
    let lockKey = "";
    let lockAcquired = false;

    try {
      const value = JSON.parse(action.value) as {
        taskId?: string;
        procesoId?: string;
        areaProcesoId?: string;
      };

      if (!value.taskId || !value.procesoId || !value.areaProcesoId) {
        throw new Error("Información de tarea incompleta");
      }

      taskId = value.taskId;
      areaProcesoId = value.areaProcesoId;

      lockKey = `task-review:${body.user.id}:${areaProcesoId}`;

      lockAcquired = tryAcquireOperationLock(lockKey, body.user.id);

      if (!lockAcquired) {
        logger.info(
          {
            cid,
            procesoId: value.procesoId,
            taskId,
            areaProcesoId,
            userId: body.user.id,
            action: "task_review_ignored_busy",
          },
          "Acción ignorada porque el área ya tiene una operación en curso",
        );

        return;
      }

      if ("view" in body && body.view?.id) {
        await client.views.update({
          view_id: body.view.id,

          view: buildTaskReviewProcessingView(
            areaProcesoId,
            cid,
            "Aprobando tarea...",
          ),
        });
      }

      let result: Awaited<ReturnType<typeof approveTask>>;

      try {
        result = await approveTask(client, {
          taskId: value.taskId,
          procesoId: value.procesoId,
          areaProcesoId: value.areaProcesoId,
          usuarioId: body.user.id,
          cid,
        });
      } catch (err) {
        logger.error(
          {
            cid,
            taskId,
            areaProcesoId,
            userId: body.user.id,
            err,
            action: "task_approval_backend_failed",
          },
          "Error aprobando tarea",
        );

        await client.chat.postMessage({
          channel: body.user.id,

          text:
            "⚠️ No fue posible aprobar la tarea.\n\n" +
            `Referencia: \`${cid}\``,
        });

        return;
      }

      try {
        if ("view" in body && body.view?.id) {
          const manageAreaView = await loadManageAreaView(client, {
            areaProcesoId: result.areaProcesoId,
            usuarioId: body.user.id,
            cid,
          });

          await client.views.update({
            view_id: body.view.id,
            view: manageAreaView,
          });
        }
      } catch (uiErr) {
        logger.warn(
          {
            cid,
            procesoId: result.procesoId,
            taskId: result.taskId,
            areaProcesoId: result.areaProcesoId,
            userId: body.user.id,
            err: uiErr,
            action: "task_approval_ui_refresh_failed",
          },
          "Tarea aprobada pero no fue posible actualizar el modal",
        );
      }

      try {
        await client.chat.postMessage({
          channel: body.user.id,

          text:
            "✅ *Tarea aprobada*\n\n" +
            `*Proceso:* ${result.procesoId}\n` +
            `*Tarea:* ${result.tarea}`,
        });
      } catch (notificationErr) {
        logger.warn(
          {
            cid,
            taskId: result.taskId,
            userId: body.user.id,
            err: notificationErr,
            action: "task_approval_notification_failed",
          },
          "Tarea aprobada pero falló la notificación",
        );
      }

      logger.info(
        {
          cid,
          procesoId: result.procesoId,
          taskId: result.taskId,
          areaProcesoId: result.areaProcesoId,
          userId: body.user.id,
          action: "task_approved",
        },
        "Tarea aprobada",
      );
    } catch (err) {
      logger.error(
        {
          cid,
          taskId,
          areaProcesoId,
          userId: body.user.id,
          err,
          action: "task_approval_failed",
        },
        "Error aprobando tarea",
      );

      if (areaProcesoId && "view" in body && body.view?.id) {
        try {
          const manageAreaView = await loadManageAreaView(client, {
            areaProcesoId,
            usuarioId: body.user.id,
            cid,
          });

          await client.views.update({
            view_id: body.view.id,
            view: manageAreaView,
          });
        } catch (refreshErr) {
          logger.error(
            {
              cid,
              taskId,
              areaProcesoId,
              userId: body.user.id,
              err: refreshErr,
              action: "task_approval_view_restore_failed",
            },
            "No fue posible restaurar el modal después del error",
          );
        }
      }

      await client.chat.postMessage({
        channel: body.user.id,

        text:
          "⚠️ No fue posible aprobar la tarea.\n\n" + `Referencia: \`${cid}\``,
      });
    } finally {
      if (lockAcquired) {
        releaseOperationLock(lockKey, body.user.id);
      }
    }
  });

  app.action("pys_task_reject", async ({ ack, action, body, client }) => {
    await ack();

    if (action.type !== "button") {
      return;
    }

    if (!action.value || !("trigger_id" in body)) {
      return;
    }

    const cid = correlationId("task-reject");

    try {
      const value = JSON.parse(action.value) as {
        taskId?: string;
        tarea?: string;
        procesoId?: string;
        areaProcesoId?: string;
      };

      if (
        !value.taskId ||
        !value.tarea ||
        !value.procesoId ||
        !value.areaProcesoId
      ) {
        throw new Error("Información de tarea incompleta");
      }

      /*
       * IMPORTANTE:
       * No hacemos ninguna lectura de Lists
       * antes de consumir el trigger_id.
       */
      await client.views.push({
        trigger_id: body.trigger_id,

        view: buildRejectTaskView({
          taskId: value.taskId,
          tarea: value.tarea,
          procesoId: value.procesoId,
          areaProcesoId: value.areaProcesoId,
          cid,
        }),
      });

      logger.info(
        {
          cid,
          taskId: value.taskId,
          userId: body.user.id,
          action: "task_reject_modal_opened",
        },
        "Modal de rechazo de tarea abierto",
      );
    } catch (err) {
      logger.error(
        {
          cid,
          userId: body.user.id,
          err,
          action: "task_reject_modal_failed",
        },
        "Error abriendo rechazo de tarea",
      );

      await client.chat.postMessage({
        channel: body.user.id,

        text:
          "⚠️ No fue posible abrir " +
          "el rechazo de la tarea.\n\n" +
          `Referencia: \`${cid}\``,
      });
    }
  });

  app.view("pys_task_reject_submit", async ({ ack, body, view, client }) => {
    const metadata = JSON.parse(view.private_metadata || "{}") as {
      cid?: string;
      taskId?: string;
      procesoId?: string;
      areaProcesoId?: string;
    };

    const cid = metadata.cid ?? correlationId("task-reject");

    const taskId = metadata.taskId;
    const procesoId = metadata.procesoId;
    const areaProcesoId = metadata.areaProcesoId;

    if (!taskId || !procesoId || !areaProcesoId) {
      return;
    }

    const comentario =
      view.state.values.reject_comment?.reject_comment_value?.value?.trim() ??
      "";

    /*
     * Validación visual inmediata.
     */
    if (!comentario) {
      await ack({
        response_action: "errors",

        errors: {
          reject_comment: "Debes indicar el motivo del rechazo.",
        },
      });

      return;
    }

    await ack({
      response_action: "update",

      view: buildTaskReviewProcessingView(
        areaProcesoId,
        cid,
        "Rechazando tarea...",
      ),
    });

    if (!taskId) {
      return;
    }

    const lockKey = `task-review:${body.user.id}:${areaProcesoId}`;
    const lockAcquired = tryAcquireOperationLock(lockKey, body.user.id);

    if (!lockAcquired) {
      logger.info(
        {
          cid,
          procesoId,
          taskId,
          areaProcesoId,
          userId: body.user.id,
          action: "task_review_ignored_busy",
        },
        "Rechazo ignorado porque el área ya tiene una operación en curso",
      );

      return;
    }

    try {
      const result = await rejectTask(client, {
        taskId,
        procesoId,
        areaProcesoId,
        usuarioId: body.user.id,
        comentario,
        cid,
      });

      const parentViewId = view.previous_view_id;

      if (parentViewId) {
        const manageAreaView = await loadManageAreaView(client, {
          areaProcesoId: result.areaProcesoId,
          usuarioId: body.user.id,
          cid,
        });
        await client.views.update({
          view_id: parentViewId,
          view: manageAreaView,
        });
      }

      await client.views.update({
        view_id: view.id,

        view: buildTaskReviewSuccessView(
          result.areaProcesoId,
          cid,
          "Tarea rechazada correctamente",
        ),
      });

      await client.chat.postMessage({
        channel: body.user.id,

        text:
          "↩️ *Tarea rechazada*\n\n" +
          `*Proceso:* ${result.procesoId}\n` +
          `*Tarea:* ${result.tarea}\n` +
          `*Motivo:* ${comentario}\n\n` +
          "La tarea fue devuelta al " +
          "Responsable Operativo.",
      });

      if (result.responsableOperativoId !== body.user.id) {
        await client.chat.postMessage({
          channel: result.responsableOperativoId,

          text: "Una tarea fue devuelta para corrección.",

          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text:
                  "↩️ *Una tarea fue devuelta para corrección*\n\n" +
                  `*Proceso:* ${result.procesoId}\n` +
                  `*Tarea:* ${result.tarea}\n` +
                  `*Motivo:* ${comentario}\n\n` +
                  "La tarea volvió a aparecer en tus pendientes.",
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Revisar tarea",
                  },
                  action_id: "pys_manage_tasks",
                  value: result.procesoId,
                  style: "primary",
                },
              ],
            },
          ],
        });
      }

      logger.info(
        {
          cid,
          procesoId: result.procesoId,
          taskId: result.taskId,
          areaProcesoId: result.areaProcesoId,
          userId: body.user.id,
          action: "task_rejected",
        },
        "Tarea rechazada",
      );
    } catch (err) {
      await client.views.update({
        view_id: view.id,

        view: {
          type: "modal",

          callback_id: "pys_task_review_error",

          title: {
            type: "plain_text",
            text: "Gestionar tarea",
          },

          close: {
            type: "plain_text",
            text: "Cerrar",
          },

          blocks: [
            {
              type: "section",

              text: {
                type: "mrkdwn",

                text:
                  "⚠️ *No fue posible completar el rechazo.*\n\n" +
                  `Referencia: \`${cid}\``,
              },
            },
          ],
        },
      });

      logger.error(
        {
          cid,
          taskId,
          userId: body.user.id,
          err,
          action: "task_rejection_failed",
        },
        "Error rechazando tarea",
      );

      await client.chat.postMessage({
        channel: body.user.id,

        text:
          "⚠️ No fue posible rechazar la tarea.\n\n" + `Referencia: \`${cid}\``,
      });
    } finally {
      releaseOperationLock(lockKey, body.user.id);
    }
  });
}
