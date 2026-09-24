import type { View } from "@slack/types";

export function buildCloseProcessView(
  procesoId: string,
  empleadoId: string,
  cid: string,
  cierreExcepcion = false,
): View {
  return {
    type: "modal",

    callback_id: "pys_close_process_submit",

    private_metadata: JSON.stringify({
      procesoId,
      cid,
      cierreExcepcion,
    }),

    title: {
      type: "plain_text",
      text: "Cerrar Paz y Salvo",
    },

    submit: {
      type: "plain_text",
      text: cierreExcepcion ? "Cerrar con excepción" : "Cerrar proceso",
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
            (cierreExcepcion
              ? "⚠️ El proceso todavía tiene pendientes. Al confirmar quedará marcado como *Finalizado con excepción* y se notificará a los responsables afectados."
              : "Al cerrar el proceso quedará marcado como *Finalizado*."),
        },
      },

      {
        type: "input",
        block_id: "close_comment",
        optional: !cierreExcepcion,
        label: {
          type: "plain_text",
          text: cierreExcepcion
            ? "Motivo del cierre con excepción"
            : "Comentario de cierre",
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
