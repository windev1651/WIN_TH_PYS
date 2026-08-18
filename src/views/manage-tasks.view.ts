import type { KnownBlock, View } from "@slack/types";

import type { TareaProcesoDetail } from "../types/process-detail.js";

export type ManageTaskItem = TareaProcesoDetail & {
  empleadoId: string;
};

export function buildManageTasksView(
  tareas: ManageTaskItem[],
  cid: string,
  maxTareasVista: number,
): View {
  const visibleTasks = tareas.slice(0, maxTareasVista);

  const visibilityMessage =
    tareas.length > maxTareasVista
      ? `Tienes ${tareas.length} tareas pendientes. En esta vista se muestran ${visibleTasks.length}.`
      : `Tienes ${tareas.length} tareas pendientes.`;

  const processIds = [...new Set(visibleTasks.map((tarea) => tarea.procesoId))];

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

  for (const [processIndex, procesoId] of processIds.entries()) {
    const tareasProceso = visibleTasks.filter(
      (tarea) => tarea.procesoId === procesoId,
    );

    const firstTask = tareasProceso[0];

    if (!firstTask) {
      continue;
    }

    if (processIndex > 0) {
      blocks.push({
        type: "divider",
      });
    }

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Proceso: ${procesoId} / <@${firstTask.empleadoId}>*`,
      },
    });

    for (const tarea of tareasProceso) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*Tarea:* ${tarea.tarea}\n` +
            `*Estado:* ${tarea.estado}\n` +
            `*Vence:* ${tarea.fechaLimite}\n` +
            `*Evidencia requerida:* ${
              tarea.requiereEvidencia ? "📎 Sí" : "No"
            }`,
        },
      });

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
            action_id: "complete",
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
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text:
                "📎 Esta tarea requiere evidencia. " +
                "La carga de evidencia se habilitará en el siguiente flujo.",
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
          initial_value:
            tarea.comentario && tarea.comentario.trim() !== ""
              ? tarea.comentario
              : undefined,
        },
      });

      blocks.push({
        type: "divider",
      });
    }
  }

  return {
    type: "modal",

    callback_id: "pys_manage_tasks_submit",

    private_metadata: JSON.stringify({
      cid,
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
