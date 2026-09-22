import type { KnownBlock, View } from "@slack/types";

import type { TareaProcesoDetail } from "../types/process-detail.js";

export type ManageTaskItem = TareaProcesoDetail & {
  empleadoId: string;
};

export function buildManageTasksView(
  tareas: ManageTaskItem[],
  cid: string,
  maxTareasVista: number,
  page: number,
): View {
  const totalPages = Math.max(1, Math.ceil(tareas.length / maxTareasVista));

  const safePage = Math.min(Math.max(page, 0), totalPages - 1);

  const start = safePage * maxTareasVista;

  const visibleTasks = tareas.slice(start, start + maxTareasVista);

  const firstTask = visibleTasks[0];

  if (!firstTask) {
    throw new Error("No hay tareas disponibles para mostrar");
  }

  const procesoId = firstTask.procesoId;

  const visibilityMessage =
    tareas.length > maxTareasVista
      ? `Tienes ${tareas.length} tareas pendientes en este proceso. Se muestran ${visibleTasks.length}.`
      : `Tienes ${tareas.length} tareas pendientes en este proceso.`;

  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*Gestiona tus tareas pendientes.*\n" +
          `${visibilityMessage}\n\n` +
          "Marca las actividades terminadas y agrega un comentario cuando corresponda.",
      },
    },
    {
      type: "divider",
    },
  ];

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Proceso: ${procesoId} / ` + `<@${firstTask.empleadoId}>*`,
    },
  });

  for (const tarea of visibleTasks) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Tarea:* ${tarea.tarea}\n` +
          `*Estado:* ${tarea.estado}\n` +
          `*Vence:* ${tarea.fechaLimite}\n` +
          `*Evidencia requerida:* ${tarea.requiereEvidencia ? "📎 Sí" : "No"}`,
      },
    });

    if (tarea.comentarioRechazo?.trim()) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "⚠️ *Motivo de devolución*\n" + tarea.comentarioRechazo.trim(),
        },
      });
    }

    if (!tarea.requiereEvidencia) {
      blocks.push({
        type: "section",
        block_id: `complete_${tarea.taskId}`,

        text: {
          type: "mrkdwn",
          text: "*Acción*",
        },

        accessory: {
          type: "checkboxes",
          action_id: "pys_task_complete_checkbox",
          options: [
            {
              text: {
                type: "plain_text",
                text: "Marcar como completada",
              },

              value: "complete",
            },
          ],
        },
      });
    } else {
      blocks.push({
        type: "input",

        block_id: `evidence_${tarea.taskId}`,
        optional: true,

        label: {
          type: "plain_text",
          text: "Evidencia",
        },

        element: {
          type: "file_input",
          action_id: "evidence_file",
          filetypes: ["pdf", "jpg", "jpeg", "png"],
          max_files: 1,
        },
      });

      blocks.push({
        type: "context",

        elements: [
          {
            type: "mrkdwn",

            text:
              "📎 Adjunta la evidencia requerida. " +
              "La tarea quedará pendiente de revisión por el Responsable Funcional.",
          },
        ],
      });
    }

    blocks.push({
      type: "input",
      block_id: `comment_${tarea.taskId}`,
      optional: true,
      label: {
        type: "plain_text",
        text: "Comentario",
      },
      element: {
        type: "plain_text_input",
        action_id: "comment",
        multiline: true,

        // initial_value:
        //   tarea.comentario && tarea.comentario.trim() !== ""
        //     ? tarea.comentario
        //     : undefined,
      },
    });

    blocks.push({
      type: "divider",
    });
  }

  if (totalPages > 1) {
    blocks.push({
      type: "context",

      elements: [
        {
          type: "mrkdwn",

          text:
            `Página *${safePage + 1} de ${totalPages}* · ` +
            `${tareas.length} tareas pendientes`,
        },
      ],
    });
  }

  return {
    type: "modal",

    callback_id: "pys_manage_tasks_submit",

    private_metadata: JSON.stringify({
      cid,
      procesoId,
      page: safePage,
    }),

    title: {
      type: "plain_text",
      text: "Gestionar tareas",
    },

    submit: {
      type: "plain_text",
      text: "Guardar cambios",
    },

    close: {
      type: "plain_text",
      text: "Cancelar",
    },

    blocks,
  };
}

export function buildLoadingManageTasksView(cid: string): View {
  return {
    type: "modal",

    callback_id: "pys_manage_tasks_loading",

    private_metadata: JSON.stringify({
      cid,
    }),

    title: {
      type: "plain_text",
      text: "Gestionar tareas",
    },

    // close: {
    //   type: "plain_text",
    //   text: "Cerrar",
    // },

    blocks: [
      {
        type: "section",

        text: {
          type: "mrkdwn",

          text:
            "*Cargando tus tareas pendientes...*\n\n" + "Espera un momento.",
        },
      },
    ],
  };
}
