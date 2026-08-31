import type { App } from "@slack/bolt";

import { getProcessDetail } from "../services/process-detail.service.js";
import { correlationId, logger } from "../utils/logger.js";
import {
  buildLoadingProcessDetailView,
  buildProcessDetailView,
} from "../views/process-detail.view.js";

import { canAdministerPys } from "../services/authorization.service.js";

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
          action: "open_process_detail",
        },
        "Interacción sin trigger_id",
      );

      return;
    }

    let openedViewId: string | undefined;

    try {
      /*
       * Abrimos inmediatamente el modal
       * para consumir el trigger_id antes
       * de realizar lecturas de Slack Lists.
       */
      const openResult = await client.views.open({
        trigger_id: body.trigger_id,

        view: buildLoadingProcessDetailView(procesoId),
      });

      openedViewId = openResult.view?.id;

      //const viewId = openResult.view?.id;

      if (!openedViewId) {
        throw new Error("Slack no retornó el ID de la vista de detalle");
      }

      /*
       * Una vez abierto el modal,
       * cargamos la información real.
       *
       * Si Slack Lists entra en retry,
       * el modal ya existe y no dependemos
       * del trigger_id.
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
                      "⚠️ No fue posible cargar el detalle del proceso.\n\n" +
                      `Referencia: \`${cid}\``,
                  },
                },
              ],
            },
          });
        } catch (updateErr) {
          logger.error(
            {
              cid,
              procesoId,
              updateErr,
              action: "process_detail_error_view_failed",
            },
            "No fue posible actualizar el modal con el error",
          );
        }
      }
      logger.error(
        {
          cid,
          procesoId,
          userId: body.user.id,
          err,
          action: "process_detail_failed",
        },
        "Error abriendo detalle de Paz y Salvo",
      );
    }
  });
}
