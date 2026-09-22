import type { App } from "@slack/bolt";
import type { View } from "@slack/types";

import { getProcessDetail } from "../services/process-detail.service.js";
import { correlationId, logger } from "../utils/logger.js";
import {
  buildLoadingProcessDetailView,
  buildProcessDetailView,
} from "../views/process-detail.view.js";
import { canAdministerPys } from "../services/authorization.service.js";

function buildProcessDetailErrorView(procesoId: string, cid: string): View {
  return {
    type: "modal",

    callback_id: "pys_process_detail_error",

    private_metadata: JSON.stringify({
      procesoId,
      cid,
    }),

    title: {
      type: "plain_text",
      text: "Detalle Paz y Salvo",
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
            "⚠️ *No fue posible cargar el detalle del proceso.*\n\n" +
            `Proceso: *${procesoId}*\n` +
            `Referencia: \`${cid}\``,
        },
      },
    ],
  };
}

export function registerProcessDetailListeners(app: App): void {
  app.action("pys_view_process", async ({ ack, action, body, client }) => {
    await ack();

    const cid = correlationId("detail");

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
          action: "open_process_detail",
        },
        "Interacción sin trigger_id",
      );

      return;
    }

    let openedViewId: string | undefined;

    try {
      /*
       * Consumimos el trigger_id inmediatamente.
       *
       * Ninguna lectura de Lists debe ocurrir
       * antes de este views.open().
       */
      const openResult = await client.views.open({
        trigger_id: body.trigger_id,

        view: buildLoadingProcessDetailView(procesoId),
      });

      openedViewId = openResult.view?.id;

      if (!openedViewId) {
        throw new Error("Slack no retornó el ID del modal de detalle");
      }

      /*
       * Ahora sí cargamos toda la información.
       *
       * Si Slack Lists entra en rate limit,
       * el usuario ya tiene un modal abierto.
       */
      const [detail, puedeAdministrar] = await Promise.all([
        getProcessDetail(client, procesoId),
        canAdministerPys(client, body.user.id),
      ]);

      await client.views.update({
        view_id: openedViewId,

        view: buildProcessDetailView(detail, {
          puedeAdministrar,
          cid,
        }),
      });

      logger.info(
        {
          cid,
          procesoId,
          userId: body.user.id,
          areas: detail.areas.length,
          action: "process_detail_opened",
        },
        "Detalle de Paz y Salvo abierto",
      );
    } catch (err) {
      logger.error(
        {
          cid,
          procesoId,
          userId: body.user.id,
          err,
          action: "process_detail_failed",
        },
        "Error cargando detalle de Paz y Salvo",
      );

      if (openedViewId) {
        try {
          await client.views.update({
            view_id: openedViewId,

            view: {
              type: "modal",

              callback_id: "pys_process_detail_error",

              title: {
                type: "plain_text",
                text: "Detalle Paz y Salvo",
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
                      "⚠️ *No fue posible cargar el detalle del Paz y Salvo.*\n\n" +
                      `Referencia: \`${cid}\``,
                  },
                },
              ],
            },
          });
        } catch (updateErr) {
          logger.warn(
            {
              cid,
              procesoId,
              userId: body.user.id,
              err: updateErr,
              action: "process_detail_error_view_failed",
            },
            "No fue posible actualizar el modal con el error",
          );
        }
      }
    }
  });
}
