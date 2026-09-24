import type { KnownBlock, View } from "@slack/types";

import {
  PROCESS_STATUS,
} from "../constants/status.js";
import {
  formatBogotaDateTime,
  type HistoricalProcessFilters,
  type HistoricalProcessItem,
} from "../services/historical-process.service.js";

const MAX_RESULTS = 20;

export function buildHistoricalSearchView(cid: string): View {
  return {
    type: "modal",
    callback_id: "pys_history_search_submit",
    external_id: `pys_history_${cid}`,
    private_metadata: JSON.stringify({ cid }),
    title: {
      type: "plain_text",
      text: "Histórico Paz y Salvo",
    },
    submit: {
      type: "plain_text",
      text: "Buscar",
    },
    close: {
      type: "plain_text",
      text: "Cancelar",
    },
    blocks: [
      {
        type: "input",
        block_id: "employee",
        optional: true,
        label: {
          type: "plain_text",
          text: "Persona",
        },
        element: {
          type: "users_select",
          action_id: "employee_id",
          placeholder: {
            type: "plain_text",
            text: "Cualquier persona",
          },
        },
      },
      {
        type: "input",
        block_id: "date_from",
        optional: true,
        label: {
          type: "plain_text",
          text: "Fecha de cierre desde",
        },
        element: {
          type: "datepicker",
          action_id: "date_from_value",
        },
      },
      {
        type: "input",
        block_id: "date_to",
        optional: true,
        label: {
          type: "plain_text",
          text: "Fecha de cierre hasta",
        },
        element: {
          type: "datepicker",
          action_id: "date_to_value",
        },
      },
      {
        type: "input",
        block_id: "status",
        optional: true,
        label: {
          type: "plain_text",
          text: "Estado",
        },
        element: {
          type: "static_select",
          action_id: "status_value",
          placeholder: {
            type: "plain_text",
            text: "Todos los finalizados",
          },
          options: [
            {
              text: {
                type: "plain_text",
                text: PROCESS_STATUS.COMPLETED,
              },
              value: PROCESS_STATUS.COMPLETED,
            },
            {
              text: {
                type: "plain_text",
                text: PROCESS_STATUS.COMPLETED_WITH_EXCEPTION,
              },
              value: PROCESS_STATUS.COMPLETED_WITH_EXCEPTION,
            },
          ],
        },
      },
    ],
  };
}

export function buildHistoricalLoadingView(
  cid: string,
  externalId: string,
): View {
  return {
    type: "modal",
    callback_id: "pys_history_loading",
    external_id: externalId,
    private_metadata: JSON.stringify({ cid }),
    title: {
      type: "plain_text",
      text: "Histórico Paz y Salvo",
    },
    close: {
      type: "plain_text",
      text: "Cerrar",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "⏳ *Consultando histórico...*\n\nEspera un momento.",
        },
      },
    ],
  };
}

export function buildHistoricalResultsView(
  cid: string,
  externalId: string,
  filters: HistoricalProcessFilters,
  results: HistoricalProcessItem[],
): View {
  const visible = results.slice(0, MAX_RESULTS);
  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Resultados encontrados:* ${results.length}` +
          (results.length > MAX_RESULTS
            ? `\nMostrando los primeros ${MAX_RESULTS}. Ajusta los filtros para reducir la búsqueda.`
            : ""),
      },
    },
    {
      type: "divider",
    },
  ];

  if (visible.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "No se encontraron procesos con los filtros seleccionados.",
      },
    });
  }

  for (const proceso of visible) {
    const icon = proceso.cierreExcepcion ? "⚠️" : "✅";

    blocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `${icon} *${proceso.procesoId}*\n` +
            `Empleado: <@${proceso.empleadoId}>\n` +
            `Estado: *${proceso.estado}*\n` +
            `Fecha salida: ${proceso.fechaSalida}\n` +
            `Cierre: ${formatBogotaDateTime(proceso.closedAtUtc)}`,
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Ver detalle",
          },
          action_id: "pys_view_process",
          value: proceso.procesoId,
        },
      },
      {
        type: "divider",
      },
    );
  }

  return {
    type: "modal",
    callback_id: "pys_history_results",
    external_id: externalId,
    private_metadata: JSON.stringify({ cid, filters }),
    title: {
      type: "plain_text",
      text: "Histórico Paz y Salvo",
    },
    close: {
      type: "plain_text",
      text: "Cerrar",
    },
    blocks,
  };
}

export function buildHistoricalErrorView(
  cid: string,
  externalId: string,
): View {
  return {
    type: "modal",
    callback_id: "pys_history_error",
    external_id: externalId,
    private_metadata: JSON.stringify({ cid }),
    title: {
      type: "plain_text",
      text: "Histórico Paz y Salvo",
    },
    close: {
      type: "plain_text",
      text: "Cerrar",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "⚠️ *No fue posible consultar el histórico.*\n\n" +
            `Referencia: \`${cid}\``,
        },
      },
    ],
  };
}
