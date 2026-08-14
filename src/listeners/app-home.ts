import type { App } from "@slack/bolt";
import { correlationId, logger } from "../utils/logger.js";
import {
  isDevUserAllowed,
  logAccessDenied,
} from "../security/access-control.js";

export function registerAppHomeListeners(app: App): void {
  app.event("app_home_opened", async ({ event, client }) => {
    const cid = correlationId("home");

    const logContext = {
      cid,
      userId: event.user,
      action: "app_home_opened",
    };

    logger.info(logContext, "App Home abierto");

    if (!isDevUserAllowed(event.user)) {
      logAccessDenied(event.user, cid);

      await client.views.publish({
        user_id: event.user,
        view: {
          type: "home",
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "TH_PYS · Paz y Salvo",
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "🔒 *Aplicación en construcción*\nActualmente no tienes acceso a esta aplicación.",
              },
            },
          ],
        },
      });

      return;
    }

    try {
      await client.views.publish({
        user_id: event.user,
        view: {
          type: "home",
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "TH_PYS · Paz y Salvo",
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "*Fundación técnica activa*\nBolt + TypeScript + Socket Mode conectado correctamente.",
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Correlation ID: \`${cid}\``,
                },
              ],
            },
          ],
        },
      });

      logger.info(logContext, "App Home publicado correctamente");
    } catch (error) {
      logger.error(
        {
          ...logContext,
          error,
        },
        "Error publicando App Home",
      );

      throw error;
    }
  });
}
