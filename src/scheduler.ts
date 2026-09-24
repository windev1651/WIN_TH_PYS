import cron from "node-cron";
import type { WebClient } from "@slack/web-api";

import { runInactiveResponsiblesJob } from "./jobs/inactive-responsibles.job.js";
import { runDailyRemindersJob } from "./jobs/daily-reminders.job.js";

import {
  getCronNotificacionUsuariosInactivos,
  getCronRecordatoriosDiarios,
  getSchedulerTimezone,
} from "./services/runtime-config.service.js";

import { logger } from "./utils/logger.js";

export async function registerSchedulers(client: WebClient): Promise<void> {
  const [cronUsuariosInactivos, cronRecordatoriosDiarios, timezone] =
    await Promise.all([
      getCronNotificacionUsuariosInactivos(client),

      getCronRecordatoriosDiarios(client),

      getSchedulerTimezone(client),
    ]);

  /*
   * =====================================================
   * RESPONSABLES INACTIVOS
   * =====================================================
   */

  if (!cronUsuariosInactivos) {
    logger.warn(
      {
        action: "inactive_responsibles_scheduler_disabled",
      },
      "CronNotificacionUsuariosInactivos no está configurado",
    );
  } else if (!cron.validate(cronUsuariosInactivos)) {
    logger.error(
      {
        cron: cronUsuariosInactivos,
        action: "inactive_responsibles_scheduler_invalid",
      },
      "CronNotificacionUsuariosInactivos no tiene un formato válido",
    );
  } else {
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

  /*
   * =====================================================
   * RECORDATORIOS DIARIOS
   * =====================================================
   */

  if (!cronRecordatoriosDiarios) {
    logger.warn(
      {
        action: "daily_reminders_scheduler_disabled",
      },
      "CronRecordatoriosDiarios no está configurado",
    );
  } else if (!cron.validate(cronRecordatoriosDiarios)) {
    logger.error(
      {
        cron: cronRecordatoriosDiarios,
        action: "daily_reminders_scheduler_invalid",
      },
      "CronRecordatoriosDiarios no tiene un formato válido",
    );
  } else {
    cron.schedule(
      cronRecordatoriosDiarios,
      async () => {
        await runDailyRemindersJob(client);
      },
      {
        timezone,
      },
    );

    logger.info(
      {
        cron: cronRecordatoriosDiarios,
        timezone,
        action: "daily_reminders_scheduler_registered",
      },
      "Scheduler de recordatorios diarios registrado",
    );
  }
}
