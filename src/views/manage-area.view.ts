import type { KnownBlock, View } from "@slack/types";

import type {
  AreaProcesoDetail,
  TareaProcesoDetail,
} from "../types/process-detail.js";

export type ManageAreaData = {
  area: AreaProcesoDetail;
  empleadoId: string;
  fechaLimite: string;
  tareas: TareaProcesoDetail[];
};

function taskEmoji(estado: string): string {
  switch (estado) {
    case "Completada":
      return "✅";

    case "No aplica":
      return "➖";

    case "Rechazada":
      return "🔴";

    case "Pendiente de evidencia":
    case "Pendiente aprobación evidencia":
      return "📎";

    case "En progreso":
      return "🟡";

    default:
      return "⚪";
  }
}

function canApproveArea(tareas: TareaProcesoDetail[]): boolean {
  const obligatorias = tareas.filter(
    (tarea) => tarea.obligatoria && tarea.estado !== "No aplica",
  );

  if (obligatorias.length === 0) {
    return true;
  }

  return obligatorias.every((tarea) => tarea.estado === "Completada");
}

export function buildManageAreaView(data: ManageAreaData, cid: string): View {
  const { area, tareas } = data;

  const puedeAprobar =
    canApproveArea(tareas) && area.estado === "Lista para aprobación";

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
          `Responsable: <@${tarea.responsableOperativoId}>\n` +
          `Estado: *${tarea.estado}*\n` +
          `Obligatoria: ${tarea.obligatoria ? "Sí" : "No"} · ` +
          `Evidencia: ${tarea.requiereEvidencia ? "Sí" : "No"}`,
      },
    });
  }

  blocks.push({
    type: "divider",
  });

  if (puedeAprobar) {
    blocks.push({
      type: "input",
      block_id: "approval_comment",
      optional: true,
      label: {
        type: "plain_text",
        text: "Comentario de aprobación",
      },
      element: {
        type: "plain_text_input",
        action_id: "approval_comment_value",
        multiline: true,
      },
    });
  } else {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text:
            "El área todavía no está lista para aprobación. " +
            "Todas las tareas obligatorias deben estar completadas.",
        },
      ],
    });
  }

  return {
    type: "modal",

    callback_id: "pys_manage_area_submit",

    private_metadata: JSON.stringify({
      cid,
      areaProcesoId: area.areaProcesoId,
      puedeAprobar,
    }),

    title: {
      type: "plain_text",
      text: "Gestionar área",
    },

    close: {
      type: "plain_text",
      text: "Cerrar",
    },

    ...(puedeAprobar
      ? {
          submit: {
            type: "plain_text",
            text: "Aprobar área",
          },
        }
      : {}),

    blocks,
  };
}
