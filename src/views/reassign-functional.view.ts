import type { View } from "@slack/types";

type ReassignFunctionalViewInput = {
  procesoId: string;
  areaProcesoId: string;
  areaNombre: string;
  responsableActualId: string;
  cid: string;
  parentViewId: string;
};

export function buildReassignFunctionalView(
  input: ReassignFunctionalViewInput,
): View {
  return {
    type: "modal",

    callback_id: "pys_reassign_functional_submit",

    private_metadata: JSON.stringify({
      procesoId: input.procesoId,

      areaProcesoId: input.areaProcesoId,

      cid: input.cid,

      parentViewId: input.parentViewId,
    }),

    title: {
      type: "plain_text",
      text: "Reasignar área",
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
            `*Área:* ${input.areaNombre}\n` +
            `*Responsable funcional actual:* <@${input.responsableActualId}>`,
        },
      },

      {
        type: "input",
        block_id: "new_functional",
        label: {
          type: "plain_text",
          text: "Nuevo responsable funcional",
        },
        element: {
          type: "users_select",
          action_id: "new_functional_id",
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
