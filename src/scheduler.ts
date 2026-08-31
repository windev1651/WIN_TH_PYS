import cron from "node-cron";
import type { WebClient } from "@slack/web-api";

import { runInactiveResponsiblesJob } from "./jobs/inactive-responsibles.job.js";
import {
  getCronNotificacionUsuariosInactivos,
  getSchedulerTimezone,
} from "./services/runtime-config.service.js";
import { logger } from "./utils/logger.js";

export async function registerSchedulers(client: WebClient): Promise<void> {
  const [cronUsuariosInactivos, timezone] = await Promise.all([
    getCronNotificacionUsuariosInactivos(client),
    getSchedulerTimezone(client),
  ]);

  if (!cronUsuariosInactivos) {
    logger.warn(
      {
        action: "inactive_responsibles_scheduler_disabled",
      },
      "CronNtificacionUsuariosInactivos no está configurado",
    );

    return;
  }

  if (!cron.validate(cronUsuariosInactivos)) {
    logger.error(
      {
        cron: cronUsuariosInactivos,
        action: "inactive_responsibles_scheduler_invalid",
      },
      "CronNtificacionUsuariosInactivos no tiene un formato válido",
    );

    return;
  }

  cron.schedule(
    cronUsuariosInactivos,
    async () => {
      await runInactiveResponsiblesJob(client);
    },
    {
      timezone,
    },
  );

  logger.info(
    {
      cron: cronUsuariosInactivos,
      timezone,
      action: "inactive_responsibles_scheduler_registered",
    },
    "Scheduler de responsables inactivos registrado",
  );
}
