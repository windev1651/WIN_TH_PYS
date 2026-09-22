import type { View } from "@slack/types";

type RejectTaskViewInput = {
  taskId: string;
  tarea: string;
  procesoId: string;
  areaProcesoId: string;
  cid: string;
};

export function buildRejectTaskView(input: RejectTaskViewInput): View {
  return {
    type: "modal",

    callback_id: "pys_task_reject_submit",

    private_metadata: JSON.stringify({
      taskId: input.taskId,
      procesoId: input.procesoId,
      areaProcesoId: input.areaProcesoId,
      cid: input.cid,
    }),

    title: {
      type: "plain_text",
      text: "Rechazar tarea",
    },

    submit: {
      type: "plain_text",
      text: "Rechazar",
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
            "Vas a devolver esta tarea al " +
            "Responsable Operativo:\n\n" +
            `*${input.tarea}*`,
        },
      },

      {
        type: "input",
        block_id: "reject_comment",
        label: {
          type: "plain_text",
          text: "Motivo del rechazo",
        },
        element: {
          type: "plain_text_input",
          action_id: "reject_comment_value",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "Indica qué debe corregir " + "el Responsable Operativo.",
          },
        },
      },
    ],
  };
}
