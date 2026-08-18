import type { App } from "@slack/bolt";

import { getHomeData } from "../services/home-data.service.js";
import { buildThHomeBlocks } from "../views/home-th.view.js";
import { correlationId, logger } from "../utils/logger.js";
import { publishHome } from "../services/home-publish.service.js";

export function registerAppHomeListeners(app: App): void {
  app.event("app_home_opened", async ({ event, client }) => {
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
