import type { App } from "@slack/bolt";

import { correlationId, logger } from "../utils/logger.js";
import { publishHome } from "../services/home-publish.service.js";
import {
  releaseOperationLock,
  tryAcquireOperationLock,
} from "../services/interaction-lock.service.js";

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

  app.action("pys_refresh_home", async ({ ack, body, client }) => {
    await ack();

    const cid = correlationId("home-refresh");
    const userId = body.user.id;

    const lockKey = `home-refresh:${userId}`;

    const lockAcquired = tryAcquireOperationLock(lockKey, userId);

    if (!lockAcquired) {
      logger.info(
        {
          cid,
          userId,
          action: "home_refresh_ignored_busy",
        },
        "Actualización de Home ignorada porque el usuario tiene una operación en curso",
      );

      return;
    }

    try {
      await publishHome(client, userId);

      logger.info(
        {
          cid,
          userId,
          action: "home_refreshed_manually",
        },
        "Home actualizado manualmente",
      );
    } catch (err) {
      logger.error(
        {
          cid,
          userId,
          err,
          action: "home_manual_refresh_failed",
        },
        "Error actualizando Home manualmente",
      );
    } finally {
      releaseOperationLock(lockKey, userId);
    }
  });
}
