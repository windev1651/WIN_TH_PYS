import type { App } from "@slack/bolt";

import { canAdministerPys } from "../services/authorization.service.js";
import {
  searchHistoricalProcesses,
  type HistoricalProcessFilters,
} from "../services/historical-process.service.js";
import { correlationId, logger } from "../utils/logger.js";
import {
  buildHistoricalErrorView,
  buildHistoricalLoadingView,
  buildHistoricalResultsView,
  buildHistoricalSearchView,
} from "../views/process-history.view.js";

export function registerProcessHistoryListeners(app: App): void {
  app.action("pys_open_history", async ({ ack, body, client }) => {
    await ack();

    const cid = correlationId("history");
    const userId = body.user.id;

    if (!("trigger_id" in body)) {
      logger.error(
        {
          cid,
          userId,
          action: "history_open_without_trigger",
        },
        "Interacción de histórico sin trigger_id",
      );

      return;
    }

    if (!(await canAdministerPys(client, userId))) {
      logger.warn(
        {
          cid,
          userId,
          action: "history_open_unauthorized",
        },
        "Usuario no autorizado intentó abrir el histórico",
      );

      return;
    }

    await client.views.open({
      trigger_id: body.trigger_id,
      view: buildHistoricalSearchView(cid),
    });

    logger.info(
      {
        cid,
        userId,
        action: "history_search_opened",
      },
      "Consulta histórica abierta",
    );
  });

  app.view("pys_history_search_submit", async ({ ack, body, view, client }) => {
    const metadata = JSON.parse(view.private_metadata || "{}") as {
      cid?: string;
    };

    const cid = metadata.cid ?? correlationId("history");
    const userId = body.user.id;
    const externalId = view.external_id ?? `pys_history_${cid}`;

    const filters: HistoricalProcessFilters = {
      employeeId:
        view.state.values.employee?.employee_id?.selected_user ?? undefined,
      dateFrom:
        view.state.values.date_from?.date_from_value?.selected_date ?? undefined,
      dateTo:
        view.state.values.date_to?.date_to_value?.selected_date ?? undefined,
      status:
        view.state.values.status?.status_value?.selected_option?.value ??
        undefined,
    };

    if (
      filters.dateFrom &&
      filters.dateTo &&
      filters.dateFrom > filters.dateTo
    ) {
      await ack({
        response_action: "errors",
        errors: {
          date_to: "La fecha hasta debe ser igual o posterior a la fecha desde.",
        },
      });

      return;
    }

    await ack({
      response_action: "update",
      view: buildHistoricalLoadingView(cid, externalId),
    });

    try {
      if (!(await canAdministerPys(client, userId))) {
        logger.warn(
          {
            cid,
            userId,
            action: "history_search_unauthorized",
          },
          "Usuario no autorizado intentó consultar el histórico",
        );

        await client.views.update({
          external_id: externalId,
          view: buildHistoricalErrorView(cid, externalId),
        });

        return;
      }

      const results = await searchHistoricalProcesses(client, filters);

      await client.views.update({
        external_id: externalId,
        view: buildHistoricalResultsView(cid, externalId, filters, results),
      });

      logger.info(
        {
          cid,
          userId,
          results: results.length,
          action: "history_search_completed",
        },
        "Consulta histórica completada",
      );
    } catch (err) {
      logger.error(
        {
          cid,
          userId,
          err,
          action: "history_search_failed",
        },
        "Error consultando histórico",
      );

      try {
        await client.views.update({
          external_id: externalId,
          view: buildHistoricalErrorView(cid, externalId),
        });
      } catch (updateErr) {
        logger.warn(
          {
            cid,
            userId,
            err: updateErr,
            action: "history_error_view_failed",
          },
          "No fue posible mostrar el error de histórico",
        );
      }
    }
  });
}
