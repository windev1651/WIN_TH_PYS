import type { WebClient } from "@slack/web-api";

import { findInactiveResponsibles } from "../services/inactive-responsibles.service.js";
import { notifyInactiveResponsibles } from "../services/notification.service.js";
import { correlationId, logger } from "../utils/logger.js";

export async function runInactiveResponsiblesJob(
  client: WebClient,
): Promise<void> {
  const cid = correlationId("inactive-users");

  try {
    const issues = await findInactiveResponsibles(client, cid);

    if (issues.length === 0) {
      logger.info(
        {
          cid,
          action: "inactive_responsibles_job_no_issues",
        },
        "No se encontraron responsables inactivos",
      );

      return;
    }

    await notifyInactiveResponsibles(client, {
      cid,
      issues,
    });

    logger.info(
      {
        cid,
        responsablesInactivos: issues.length,
        action: "inactive_responsibles_job_completed",
      },
      "Revisión de responsables inactivos completada",
    );
  } catch (err) {
    logger.error(
      {
        cid,
        err,
        action: "inactive_responsibles_job_failed",
      },
      "Error ejecutando revisión de responsables inactivos",
    );
  }
}
