import type { WebClient } from "@slack/web-api";

import { sendDailyReminders } from "../services/reminder.service.js";
import { correlationId, logger } from "../utils/logger.js";

export async function runDailyRemindersJob(client: WebClient): Promise<void> {
  const cid = correlationId("daily-reminders");

  try {
    logger.info(
      {
        cid,
        action: "daily_reminders_job_started",
      },
      "Iniciando recordatorios diarios",
    );

    const result = await sendDailyReminders(client, cid);

    logger.info(
      {
        cid,
        operativos: result.operativos,
        funcionales: result.funcionales,
        action: "daily_reminders_job_completed",
      },
      "Recordatorios diarios completados",
    );
  } catch (err) {
    logger.error(
      {
        cid,
        err,
        action: "daily_reminders_job_failed",
      },
      "Error ejecutando recordatorios diarios",
    );
  }
}
