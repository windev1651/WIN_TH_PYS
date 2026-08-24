import type { View } from "@slack/types";

export function buildCloseProcessView(
  procesoId: string,
  empleadoId: string,
  cid: string,
): View {
  return {
    type: "modal",

    callback_id: "pys_close_process_submit",

    private_metadata: JSON.stringify({
      procesoId,
      cid,
    }),

    title: {
      type: "plain_text",
      text: "Cerrar Paz y Salvo",
    },

    submit: {
      type: "plain_text",
      text: "Cerrar proceso",
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
            "*Confirma el cierre del Paz y Salvo.*\n\n" +
            `*Proceso:* ${procesoId}\n` +
            `*Empleado:* <@${empleadoId}>\n\n` +
            "Al cerrar el proceso quedará marcado como *Finalizado*.",
        },
      },

      {
        type: "input",
        block_id: "close_comment",
        optional: true,
        label: {
          type: "plain_text",
          text: "Comentario de cierre",
        },
        element: {
          type: "plain_text_input",
          action_id: "close_comment_value",
          multiline: true,
        },
      },
    ],
  };
}
