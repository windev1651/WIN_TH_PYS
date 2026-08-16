import type { App } from "@slack/bolt";

import { getProcessDetail } from "../services/process-detail.service.js";
import { correlationId, logger } from "../utils/logger.js";
import { buildProcessDetailView } from "../views/process-detail.view.js";

export function registerProcessDetailListeners(app: App): void {
  app.action("pys_view_process", async ({ ack, action, body, client }) => {
    await ack();

    const cid = correlationId("detail");

    if (action.type !== "button") {
      return;
    }

    const procesoId = action.value;

    if (!procesoId) {
      return;
    }

    if (!("trigger_id" in body)) {
      logger.error(
        {
          cid,
          procesoId,
          action: "open_process_detail",
        },
        "Interacción sin trigger_id",
      );

      return;
    }

    try {
      const detail = await getProcessDetail(client, procesoId);

      await client.views.open({
        trigger_id: body.trigger_id,

        view: buildProcessDetailView(detail),
      });

      logger.info(
        {
          cid,
          procesoId,
          userId: body.user.id,
          areas: detail.areas.length,
          action: "process_detail_opened",
        },
        "Detalle de Paz y Salvo abierto",
      );
    } catch (err) {
      logger.error(
        {
          cid,
          procesoId,
          userId: body.user.id,
          err,
          action: "process_detail_failed",
        },
        "Error abriendo detalle de Paz y Salvo",
      );
    }
  });
}
