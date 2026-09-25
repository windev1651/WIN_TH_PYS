import type { App } from "@slack/bolt";

import { canAdministerPys } from "../services/authorization.service.js";
import {
  getHistoricalProcessDataset,
  searchHistoricalProcesses,
  type HistoricalProcessFilters,
} from "../services/historical-process.service.js";
import { generateHistoricalProcessPdf } from "../services/pdf-report.service.js";
import { correlationId, logger } from "../utils/logger.js";
import {
  buildHistoricalErrorView,
  buildHistoricalLoadingView,
  buildHistoricalPdfErrorView,
  buildHistoricalPdfLoadingView,
  buildHistoricalPdfSuccessView,
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
  app.action(
    "pys_generate_process_pdf",
    async ({ ack, action, body, client }) => {
      await ack();

      const cid = correlationId("history-pdf");
      const userId = body.user.id;

      if (action.type !== "button" || !action.value) {
        return;
      }

      const procesoId = action.value;

      if (!("trigger_id" in body)) {
        logger.error(
          {
            cid,
            procesoId,
            userId,
            action: "history_pdf_without_trigger",
          },
          "Interacción de PDF sin trigger_id",
        );

        return;
      }

      let openedViewId: string | undefined;

      try {
        const openResult =
          "view" in body && body.view?.type === "modal"
            ? await client.views.push({
                trigger_id: body.trigger_id,
                view: buildHistoricalPdfLoadingView(procesoId, cid),
              })
            : await client.views.open({
                trigger_id: body.trigger_id,
                view: buildHistoricalPdfLoadingView(procesoId, cid),
              });

        openedViewId = openResult.view?.id;

        if (!(await canAdministerPys(client, userId))) {
          throw new Error("Usuario no autorizado para generar históricos");
        }

        const dataset = await getHistoricalProcessDataset(client, procesoId);
        const pdf = await generateHistoricalProcessPdf(client, dataset);

        const dm = await client.conversations.open({
          users: userId,
        });

        const channelId = dm.channel?.id;

        if (!channelId) {
          throw new Error("Slack no devolvió el canal de conversación directa");
        }

        await client.filesUploadV2({
          channel_id: channelId,
          file: pdf,
          filename: `Paz_y_Salvo_${procesoId}.pdf`,
          title: `Paz y Salvo ${procesoId}`,
          initial_comment:
            `PDF histórico generado para el proceso *${procesoId}*.`,
        });

        if (openedViewId) {
          await client.views.update({
            view_id: openedViewId,
            view: buildHistoricalPdfSuccessView(procesoId, cid),
          });
        }

        logger.info(
          {
            cid,
            procesoId,
            userId,
            bytes: pdf.length,
            action: "history_pdf_generated",
          },
          "PDF histórico generado y enviado",
        );
      } catch (err) {
        logger.error(
          {
            cid,
            procesoId,
            userId,
            err,
            action: "history_pdf_failed",
          },
          "No fue posible generar el PDF histórico",
        );

        if (openedViewId) {
          try {
            await client.views.update({
              view_id: openedViewId,
              view: buildHistoricalPdfErrorView(procesoId, cid),
            });
          } catch (updateErr) {
            logger.warn(
              {
                cid,
                procesoId,
                userId,
                err: updateErr,
                action: "history_pdf_error_view_failed",
              },
              "No fue posible mostrar el error de generación PDF",
            );
          }
        }
      }
    },
  );
}
