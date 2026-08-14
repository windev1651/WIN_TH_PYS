import type { App } from "@slack/bolt";
import { correlationId, logger } from "../utils/logger.js";

export function registerAppHomeListeners(app: App): void {
  app.event("app_home_opened", async ({ event, client }) => {
    const cid = correlationId("home");

    logger.info({ cid, userId: event.user }, "app_home_opened recibido");

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
                text: "*Fundacion tecnica activa*\nBolt + TypeScript + Socket Mode conectado correctamente.",
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

      logger.info({ cid, userId: event.user }, "App Home publicado");
    } catch (error) {
      logger.error(
        { cid, userId: event.user, error },
        "Error publicando App Home",
      );
      throw error;
    }
  });
}
