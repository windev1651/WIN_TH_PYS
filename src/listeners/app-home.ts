import type { App } from "@slack/bolt";

import { correlationId, logger } from "../utils/logger.js";
import { publishHome } from "../services/home-publish.service.js";

export function registerAppHomeListeners(app: App): void {
  const recentHomeOpens = new Map<string, number>();
  const HOME_THROTTLE_MS = 2_000;

  app.event("app_home_opened", async ({ event, client }) => {
    const now = Date.now();

    const previous = recentHomeOpens.get(event.user);

    if (previous && now - previous < HOME_THROTTLE_MS) {
      logger.info(
        {
          action: "app_home_opened_skipped",
        },
        "App Home duplicado omitido",
      );

      return;
    }

    recentHomeOpens.set(event.user, now);
    const cid = correlationId("home");

    logger.info(
      {
        cid,
        userId: event.user,
        action: "app_home_opened",
      },
      "App Home abierto",
    );

    try {
      await publishHome(client, event.user);

      logger.info(
        {
          cid,
          userId: event.user,
          action: "app_home_published",
        },
        "App Home publicado correctamente",
      );
    } catch (err) {
      logger.error(
        {
          cid,
          userId: event.user,
          err,
          action: "app_home_publish_failed",
        },
        "Error publicando App Home",
      );
    }
  });
}
