import type { App } from "@slack/bolt";

import { correlationId, logger } from "../utils/logger.js";
import { publishHome } from "../services/home-publish.service.js";
import { loadManageAreaView } from "../services/manage-area-view.service.js";
import { isUserBusy } from "../services/interaction-lock.service.js";

function buildLoadingAreaView(areaProcesoId: string, cid: string) {
  return {
    type: "modal" as const,
    callback_id: "pys_manage_area_loading",

    private_metadata: JSON.stringify({
      areaProcesoId,
      cid,
    }),

    title: {
      type: "plain_text" as const,
      text: "Gestionar área",
    },

    // close: {
    //   type: "plain_text" as const,
    //   text: "Cerrar",
    // },

    blocks: [
      {
        type: "section" as const,
        text: {
          type: "mrkdwn" as const,
          text: "⏳ Cargando información del área...",
        },
      },
    ],
  };
}

export function registerManageAreaListeners(app: App): void {
  app.action("pys_manage_area", async ({ ack, action, body, client }) => {
    await ack();

    const cid = correlationId("area");

    if (action.type !== "button") {
      return;
    }

    const areaProcesoId = action.value;

    if (!areaProcesoId) {
      return;
    }

    if (isUserBusy(body.user.id)) {
      logger.info(
        {
          cid,
          areaProcesoId,
          userId: body.user.id,
          action: "manage_area_ignored_user_busy",
        },
        "Gestión de área ignorada porque el usuario tiene una operación en curso",
      );

      return;
    }

    if (!("trigger_id" in body)) {
      logger.error(
        {
          cid,
          areaProcesoId,
          userId: body.user.id,
          action: "open_manage_area",
        },
        "Interacción sin trigger_id",
      );

      return;
    }

    /*
     * Abrimos inmediatamente el modal para consumir
     * el trigger_id antes de realizar lecturas de Lists.
     */
    let viewId: string;

    try {
      const opened = await client.views.open({
        trigger_id: body.trigger_id,

        view: buildLoadingAreaView(areaProcesoId, cid),
      });

      if (!opened.view?.id) {
        throw new Error("Slack no retornó el ID del modal de gestión de área");
      }

      viewId = opened.view.id;
    } catch (err) {
      logger.error(
        {
          cid,
          areaProcesoId,
          userId: body.user.id,
          err,
          action: "manage_area_loading_open_failed",
        },
        "Error abriendo modal de carga de gestión de área",
      );

      return;
    }

    /*
     * A partir de aquí ya no dependemos del trigger_id.
     * Si Lists entra en rate limit, el modal puede esperar
     * y posteriormente actualizarse mediante view.id.
     */
    try {
      const manageAreaView = await loadManageAreaView(client, {
        areaProcesoId,
        usuarioId: body.user.id,
        cid,
      });

      await client.views.update({
        view_id: viewId,
        view: manageAreaView,
      });

      logger.info(
        {
          cid,
          areaProcesoId,
          userId: body.user.id,
          action: "manage_area_loaded",
        },
        "Modal de gestión de área cargado",
      );
    } catch (err) {
      logger.error(
        {
          cid,
          areaProcesoId,
          userId: body.user.id,
          err,
          action: "manage_area_load_failed",
        },
        "Error cargando gestión de área",
      );

      /*
       * El modal ya existe, por lo que mostramos
       * el error dentro del propio modal.
       */
      try {
        await client.views.update({
          view_id: viewId,

          view: {
            type: "modal",
            callback_id: "pys_manage_area_error",

            private_metadata: JSON.stringify({
              areaProcesoId,
              cid,
            }),

            title: {
              type: "plain_text",
              text: "Gestionar área",
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
                    "⚠️ No fue posible cargar " +
                    "la información del área.\n\n" +
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
            areaProcesoId,
            userId: body.user.id,
            err: updateErr,
            action: "manage_area_error_view_failed",
          },
          "Error actualizando modal con estado de error",
        );
      }
    }
  });

  app.view(
    {
      callback_id: "pys_manage_area_submit",
      type: "view_closed",
    },
    async ({ ack, body, client }) => {
      await ack();

      const cid = correlationId("area-close");

      try {
        if (isUserBusy(body.user.id)) {
          logger.info(
            {
              cid,
              userId: body.user.id,
              action: "manage_area_close_refresh_skipped_user_busy",
            },
            "Refresh de Home omitido porque el usuario tiene una operación en curso",
          );

          return;
        }

        await publishHome(client, body.user.id);

        logger.info(
          {
            cid,
            userId: body.user.id,
            action: "manage_area_closed_home_refreshed",
          },
          "Home actualizado al cerrar gestión de área",
        );
      } catch (err) {
        logger.error(
          {
            cid,
            userId: body.user.id,
            err,
            action: "manage_area_closed_home_refresh_failed",
          },
          "Error actualizando Home al cerrar gestión de área",
        );
      }
    },
  );
}
