import type { App } from "@slack/bolt";

import { canAdministerPys } from "../services/authorization.service.js";
import { closeProcess } from "../services/process-close.service.js";
import { publishHome } from "../services/home-publish.service.js";
import { getAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { correlationId, logger } from "../utils/logger.js";
import { buildCloseProcessView } from "../views/close-process.view.js";
import {
  CLOSED_PROCESS_STATUSES,
  PROCESS_STATUS,
} from "../constants/status.js";

function buildLoadingCloseProcessView(procesoId: string, cid: string) {
  return {
    type: "modal" as const,

    callback_id: "pys_close_process_loading",

    private_metadata: JSON.stringify({
      procesoId,
      cid,
    }),

    title: {
      type: "plain_text" as const,
      text: "Cerrar Paz y Salvo",
    },

    blocks: [
      {
        type: "section" as const,
        text: {
          type: "mrkdwn" as const,
          text:
            "⏳ *Cargando información del proceso...*\n\n" +
            "Espera mientras validamos el Paz y Salvo.",
        },
      },
    ],
  };
}

export function registerProcessCloseListeners(app: App): void {
  app.action("pys_close_process", async ({ ack, action, body, client }) => {
    await ack();

    const cid = correlationId("close");

    if (action.type !== "button") {
      return;
    }

    const procesoId = action.value;

    if (!procesoId) {
      return;
    }

    if (!("trigger_id" in body)) {
      logger.error(
        {
          cid,
          procesoId,
          userId: body.user.id,
          action: "open_close_process",
        },
        "Interacción sin trigger_id",
      );

      return;
    }

    let openedViewId: string | undefined;

    try {
      /*
       * Consumimos inmediatamente el trigger_id.
       * No hacemos lecturas de Lists antes.
       */
      const openResult = await client.views.open({
        trigger_id: body.trigger_id,

        view: buildLoadingCloseProcessView(procesoId, cid),
      });

      openedViewId = openResult.view?.id;

      if (!openedViewId) {
        throw new Error("Slack no retornó el ID del modal de cierre");
      }

      /*
       * Ahora sí hacemos las validaciones
       * y lecturas necesarias.
       */
      const autorizado = await canAdministerPys(client, body.user.id);

      if (!autorizado) {
        throw new Error("Usuario no autorizado para cerrar procesos");
      }

      const [procesos, areas] = await Promise.all([
        getProcesos(client, { bypassCache: true }),
        getAreasProceso(client, procesoId, { bypassCache: true }),
      ]);

      const proceso = procesos.find((item) => item.procesoId === procesoId);

      if (!proceso) {
        throw new Error(`Proceso no encontrado: ${procesoId}`);
      }

      if (CLOSED_PROCESS_STATUSES.some((status) => status === proceso.estado)) {
        throw new Error(
          `El proceso ya se encuentra cerrado: ${proceso.estado}`,
        );
      }

      const cierreExcepcion =
        proceso.estado !== PROCESS_STATUS.PENDING_APPROVAL ||
        areas.some((area) => area.estado !== "Completada");

      await client.views.update({
        view_id: openedViewId,

        view: buildCloseProcessView(
          proceso.procesoId,
          proceso.empleadoId,
          cid,
          cierreExcepcion,
        ),
      });

      logger.info(
        {
          cid,
          procesoId,
          userId: body.user.id,
          action: "close_process_modal_opened",
        },
        "Modal de cierre abierto",
      );
    } catch (err) {
      logger.error(
        {
          cid,
          procesoId,
          userId: body.user.id,
          err,
          action: "close_process_modal_failed",
        },
        "Error abriendo modal de cierre",
      );

      if (openedViewId) {
        try {
          await client.views.update({
            view_id: openedViewId,

            view: {
              type: "modal",

              callback_id: "pys_close_process_error",

              title: {
                type: "plain_text",
                text: "Cerrar Paz y Salvo",
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
                      "⚠️ *No fue posible cargar el cierre del proceso.*\n\n" +
                      `Referencia: \`${cid}\``,
                  },
                },
              ],
            },
          });
        } catch (uiErr) {
          logger.warn(
            {
              cid,
              procesoId,
              userId: body.user.id,
              err: uiErr,
              action: "close_process_error_view_failed",
            },
            "No fue posible actualizar el modal de cierre con el error",
          );
        }
      }

      await client.chat.postMessage({
        channel: body.user.id,

        text:
          "No fue posible abrir el cierre del proceso. " + `Referencia: ${cid}`,
      });
    }
  });

  app.view("pys_close_process_submit", async ({ ack, body, view, client }) => {
    const metadata = JSON.parse(view.private_metadata || "{}") as {
      procesoId?: string;
      cid?: string;
      cierreExcepcion?: boolean;
    };

    const procesoId = metadata.procesoId;

    const cid = metadata.cid ?? correlationId("close");

    if (!procesoId) {
      await ack();
      return;
    }

    const commentBlock = view.state.values.close_comment;

    const comentario = commentBlock?.close_comment_value?.value ?? "";

    if (metadata.cierreExcepcion && !comentario.trim()) {
      await ack({
        response_action: "errors",
        errors: {
          close_comment: "El motivo del cierre con excepción es obligatorio.",
        },
      });
      return;
    }

    await ack();

    try {
      /*
       * Revalidamos autorización
       * en backend al momento real
       * del cierre.
       */
      const autorizado = await canAdministerPys(client, body.user.id);

      if (!autorizado) {
        throw new Error("Usuario no autorizado para cerrar procesos");
      }

      const result = await closeProcess(client, {
        procesoId,
        usuarioId: body.user.id,
        comentario,
        cid,
      });

      await publishHome(client, body.user.id);

      logger.info(
        {
          cid,
          procesoId: result.procesoId,
          userId: body.user.id,
          alreadyClosed: result.alreadyClosed,
          cierreExcepcion: result.cierreExcepcion,
          destinatariosNotificados: result.destinatariosNotificados,
          action: "process_closed",
        },
        "Paz y Salvo cerrado correctamente",
      );

      await client.chat.postMessage({
        channel: body.user.id,

        text:
          (result.cierreExcepcion
            ? "⚠️ *Paz y Salvo cerrado con excepción*\n\n"
            : "✅ *Paz y Salvo cerrado correctamente*\n\n") +
          `*Proceso:* ${result.procesoId}\n` +
          `*Empleado:* <@${result.empleadoId}>` +
          (comentario.trim() ? `\n*Comentario:* ${comentario.trim()}` : ""),
      });
    } catch (err) {
      logger.error(
        {
          cid,
          procesoId,
          userId: body.user.id,
          err,
          action: "process_close_failed",
        },
        "Error cerrando Paz y Salvo",
      );

      await client.chat.postMessage({
        channel: body.user.id,

        text: `No fue posible cerrar el Paz y Salvo. Referencia: ${cid}`,
      });

      await publishHome(client, body.user.id);
    }
  });
}
