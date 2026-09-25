import type { KnownBlock, View } from "@slack/types";

import type { ProcessDetail } from "../types/process-detail.js";
import {
  AREA_STATUS,
  CLOSED_PROCESS_STATUSES,
  PROCESS_STATUS,
  TASK_STATUS,
} from "../constants/status.js";

type ProcessDetailViewOptions = {
  puedeAdministrar: boolean;
  cid: string;
};

function taskEmoji(estado: string): string {
  switch (estado) {
    case TASK_STATUS.COMPLETED:
      return "✅";

    case TASK_STATUS.PENDING_APPROVAL:
      return "🟡";

    case TASK_STATUS.NOT_APPLICABLE:
      return "➖";

    default:
      return "⚪";
  }
}

export function buildProcessDetailView(
  detail: ProcessDetail,
  options: ProcessDetailViewOptions,
): View {
  const blocks: KnownBlock[] = [
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Empleado*\n<@${detail.empleadoId}>`,
        },
        {
          type: "mrkdwn",
          text: `*Tipo*\n${detail.tipoSolicitudId}`,
        },
        {
          type: "mrkdwn",
          text: `*Estado*\n${detail.estado}`,
        },
        {
          type: "mrkdwn",
          text: `*Avance operativo*\n${detail.porcentajeAvance}%`,
        },
        {
          type: "mrkdwn",
          text: `*Fecha creación*\n${detail.fechaInicio}`,
        },
        {
          type: "mrkdwn",
          text: `*Fecha salida*\n${detail.fechaSalida}`,
        },
        {
          type: "mrkdwn",
          text: `*Fecha límite*\n${detail.fechaLimite}`,
        },
      ],
    },

    {
      type: "divider",
    },
  ];

  const puedeGenerarPdf =
    options.puedeAdministrar &&
    [PROCESS_STATUS.COMPLETED, PROCESS_STATUS.COMPLETED_WITH_EXCEPTION].some(
      (status) => status === detail.estado,
    );

  if (puedeGenerarPdf) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Generar PDF",
          },
          action_id: "pys_generate_process_pdf",
          value: detail.procesoId,
        },
      ],
    });

    blocks.push({
      type: "divider",
    });
  }

  if (detail.comentarioTH) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Comentario TH*\n${detail.comentarioTH}`,
      },
    });

    blocks.push({
      type: "divider",
    });
  }

  for (const area of detail.areas) {
    const procesoEditable = !CLOSED_PROCESS_STATUSES.some(
      (status) => status === detail.estado,
    );

    blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: area.areaNombre,
      },
    });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Responsable funcional:* <@${area.responsableFuncionalId}>\n` +
          `*Estado del área:* ${area.estado}`,
      },
    });

    if (
      options.puedeAdministrar &&
      procesoEditable &&
      area.estado !== AREA_STATUS.COMPLETED
    ) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Reasignar responsable funcional",
            },
            action_id: "pys_reassign_functional",
            value: area.areaProcesoId,
          },
        ],
      });
    }

    for (const tarea of area.tareas) {
      const evidencia = tarea.requiereEvidencia ? "Sí" : "No";

      const obligatoria = tarea.obligatoria ? "Sí" : "No";

      const comentario = tarea.comentario?.trim();

      blocks.push({
        type: "section",

        text: {
          type: "mrkdwn",
          text:
            `${taskEmoji(tarea.estado)} *${tarea.tarea}*\n` +
            `Responsable: <@${tarea.responsableOperativoId}>\n` +
            `Estado: ${tarea.estado} · Obligatoria: ${obligatoria} · Evidencia: ${evidencia}` +
            (comentario ? `\n*Comentario:* ${comentario}` : ""),
        },

        ...(options.puedeAdministrar &&
        procesoEditable &&
        ![TASK_STATUS.COMPLETED, TASK_STATUS.NOT_APPLICABLE].some(
          (status) => status === tarea.estado,
        )
          ? {
              accessory: {
                type: "button" as const,

                text: {
                  type: "plain_text" as const,
                  text: "Reasignar",
                },

                action_id: "pys_reassign_task",

                /*
                 * El taskId es suficiente.
                 * El backend volverá a
                 * resolver y validar todo.
                 */
                value: tarea.taskId,
              },
            }
          : {}),
      });
    }

    blocks.push({
      type: "divider",
    });
  }

  return {
    type: "modal",

    callback_id: "pys_process_detail",

    private_metadata: JSON.stringify({
      procesoId: detail.procesoId,

      cid: options.cid,
    }),

    title: {
      type: "plain_text",
      text: "Detalle Paz y Salvo",
    },

    close: {
      type: "plain_text",
      text: "Cerrar",
    },

    blocks,
  };
}

export function buildLoadingProcessDetailView(procesoId: string): View {
  return {
    type: "modal",

    callback_id: "pys_process_detail_loading",

    private_metadata: JSON.stringify({
      procesoId,
    }),

    title: {
      type: "plain_text",
      text: "Detalle Paz y Salvo",
    },

    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `Cargando información de *${procesoId}*...\n\n` +
            "Espera un momento.",
        },
      },
    ],
  };
}
