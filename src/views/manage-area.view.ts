import type { KnownBlock, View } from "@slack/types";

import type {
  AreaProcesoDetail,
  TareaProcesoDetail,
} from "../types/process-detail.js";
import type { EvidenciaDetail } from "../repositories/evidencias-read.repository.js";
import { TASK_STATUS } from "../constants/status.js";

export type ManageAreaTask = TareaProcesoDetail & {
  evidencias: EvidenciaDetail[];
};

export type ManageAreaData = {
  area: AreaProcesoDetail;
  empleadoId: string;
  fechaLimite: string;
  tareas: ManageAreaTask[];
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

// function canApproveArea(tareas: TareaProcesoDetail[]): boolean {
//   const obligatorias = tareas.filter(
//     (tarea) => tarea.obligatoria && tarea.estado !== TASK_STATUS.NOT_APPLICABLE,
//   );

//   if (obligatorias.length === 0) {
//     return true;
//   }

//   return obligatorias.every((tarea) => tarea.estado === TASK_STATUS.COMPLETED);
// }

export function buildManageAreaView(data: ManageAreaData, cid: string): View {
  const { area, tareas } = data;

  // const puedeAprobar = canApproveArea(tareas) && area.estado === AREA_STATUS.READY_FOR_APPROVAL;

  const blocks: KnownBlock[] = [
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Proceso*\n${area.procesoId}`,
        },
        {
          type: "mrkdwn",
          text: `*Empleado*\n<@${data.empleadoId}>`,
        },
        {
          type: "mrkdwn",
          text: `*Área*\n${area.areaNombre}`,
        },
        {
          type: "mrkdwn",
          text: `*Estado*\n${area.estado}`,
        },
        {
          type: "mrkdwn",
          text: `*Fecha límite*\n${data.fechaLimite}`,
        },
      ],
    },
    {
      type: "divider",
    },
  ];

  for (const tarea of tareas) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `${taskEmoji(tarea.estado)} *${tarea.tarea}*\n` +
          `*Responsable:* <@${tarea.responsableOperativoId}>\n` +
          `*Estado tarea:* ${tarea.estado}\n` +
          `*Obligatoria:* ${tarea.obligatoria ? "Sí" : "No"} · ` +
          `*Evidencia:* ${tarea.requiereEvidencia ? "Sí" : "No"}\n` +
          `*Comentario:* ${tarea.comentario?.trim() ? tarea.comentario : "—"}`,
      },
    });

    if (
      tarea.comentarioRechazo?.trim() &&
      tarea.estado !== TASK_STATUS.COMPLETED
    ) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text:
              `↩️ *Motivo del último rechazo:* ` +
              `${tarea.comentarioRechazo.trim()}`,
          },
        ],
      });
    }

    /*
     * Evidencias asociadas a la tarea.
     */
    for (const evidencia of tarea.evidencias) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*Archivo:* ${evidencia.nombreOriginal}\n` +
            `*Estado evidencia:* ${evidencia.estado}\n` +
            `*Cargada por:* ${
              evidencia.autorId ? `<@${evidencia.autorId}>` : "—"
            }\n` +
            `*Fecha:* ${evidencia.fechaCarga ?? "—"}`,
        },
      });

      if (evidencia.slackPermalink) {
        blocks.push({
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Ver evidencia",
              },
              url: evidencia.slackPermalink,
            },
          ],
        });
      }
    }

    /*
     * La aprobación pertenece a la tarea,
     * no a la evidencia.
     */
    if (tarea.estado === TASK_STATUS.PENDING_APPROVAL) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Aprobar tarea",
            },
            style: "primary",
            action_id: "pys_task_approve",
            value: JSON.stringify({
              taskId: tarea.taskId,
              procesoId: tarea.procesoId,
              areaProcesoId: tarea.areaProcesoId,
            }),
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Rechazar tarea",
            },
            style: "danger",
            action_id: "pys_task_reject",
            value: JSON.stringify({
              taskId: tarea.taskId,
              tarea: tarea.tarea,
              procesoId: tarea.procesoId,
              areaProcesoId: tarea.areaProcesoId,
            }),
          },
        ],
      });
    }

    blocks.push({
      type: "divider",
    });
  }

  return {
    type: "modal",

    callback_id: "pys_manage_area_submit",
    notify_on_close: true,

    private_metadata: JSON.stringify({
      cid,
      areaProcesoId: area.areaProcesoId,
    }),

    title: {
      type: "plain_text",
      text: "Gestionar área",
    },

    close: {
      type: "plain_text",
      text: "Cerrar",
    },

    blocks,
  };
}
