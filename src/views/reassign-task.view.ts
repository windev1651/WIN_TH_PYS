import type { View } from "@slack/types";

type ReassignTaskViewInput = {
  procesoId: string;
  taskId: string;
  tarea: string;
  responsableActualId: string;
  cid: string;
  parentViewId: string;
};

export function buildReassignTaskView(input: ReassignTaskViewInput): View {
  return {
    type: "modal",

    callback_id: "pys_reassign_task_submit",

    private_metadata: JSON.stringify({
      procesoId: input.procesoId,
      taskId: input.taskId,
      cid: input.cid,
      parentViewId: input.parentViewId,
    }),

    title: {
      type: "plain_text",
      text: "Reasignar tarea",
    },

    submit: {
      type: "plain_text",
      text: "Reasignar",
    },

    close: {
      type: "plain_text",
      text: "Cancelar",
    },

    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*Proceso:* ${input.procesoId}\n` +
            `*Tarea:* ${input.tarea}\n` +
            `*Responsable actual:* <@${input.responsableActualId}>`,
        },
      },

      {
        type: "input",
        block_id: "new_responsible",
        label: {
          type: "plain_text",
          text: "Nuevo responsable",
        },
        element: {
          type: "users_select",
          action_id: "new_responsible_id",
          placeholder: {
            type: "plain_text",
            text: "Selecciona un usuario",
          },
        },
      },

      {
        type: "input",
        block_id: "reason",
        label: {
          type: "plain_text",
          text: "Motivo de la reasignación",
        },
        element: {
          type: "plain_text_input",
          action_id: "reason_value",
          multiline: true,
        },
      },
    ],
  };
}
