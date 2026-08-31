import type { KnownBlock, View } from "@slack/types";

import type { ProcessDetail } from "../types/process-detail.js";

type ProcessDetailViewOptions = {
  puedeAdministrar: boolean;
  cid: string;
};

function taskEmoji(estado: string): string {
  switch (estado) {
    case "Completada":
      return "✅";

    case "Rechazada":
      return "🔴";

    case "Pendiente de evidencia":
    case "Pendiente aprobación evidencia":
      return "🟡";

    case "No aplica":
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
          text: `*Avance*\n${detail.porcentajeAvance}%`,
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
    const procesoEditable = ![
      "Finalizado",
      "Finalizado con excepción",
      "Cancelado",
    ].includes(detail.estado);

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
      area.estado !== "Completada"
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

      blocks.push({
        type: "section",

        text: {
          type: "mrkdwn",
          text:
            `${taskEmoji(tarea.estado)} *${tarea.tarea}*\n` +
            `Responsable: <@${tarea.responsableOperativoId}>\n` +
            `Estado: ${tarea.estado} · Obligatoria: ${obligatoria} · Evidencia: ${evidencia}`,
        },

        ...(options.puedeAdministrar &&
        procesoEditable &&
        !["Completada", "No aplica"].includes(tarea.estado)
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
            `Cargando información de *${procesoId}*...\n\n` +
            "Espera un momento.",
        },
      },
    ],
  };
}
