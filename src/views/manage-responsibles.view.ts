import type { KnownBlock, View } from "@slack/types";

type OperativeAssignment = {
  configId: string;
  areaId: string;
  areaNombre: string;
  tarea: string;
};

type ManageOperativeAssignmentsInput = {
  cid: string;
  responsableActualId: string;
  nuevoResponsableId: string;
  motivo: string;
  configuraciones: OperativeAssignment[];
};

type FunctionalAssignment = {
  areaId: string;
  areaNombre: string;
};

type ManageFunctionalAssignmentsInput = {
  cid: string;
  responsableActualId: string;
  nuevoResponsableId: string;
  motivo: string;
  areas: FunctionalAssignment[];
};

export function buildManageResponsiblesView(cid: string): View {
  return {
    type: "modal",

    callback_id: "pys_manage_responsibles_submit",

    private_metadata: JSON.stringify({
      cid,
    }),

    title: {
      type: "plain_text",
      text: "Administrar responsables",
    },

    submit: {
      type: "plain_text",
      text: "Continuar",
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
            "Esta opción modifica la *configuración maestra* para procesos futuros.\n\n" +
            "*No modifica Paz y Salvos ya creados.*",
        },
      },

      {
        type: "input",
        block_id: "responsible_type",

        label: {
          type: "plain_text",
          text: "Tipo de responsable",
        },

        element: {
          type: "radio_buttons",
          action_id: "responsible_type_value",

          options: [
            {
              text: {
                type: "plain_text",
                text: "Responsable operativo",
              },
              value: "operativo",
            },
            {
              text: {
                type: "plain_text",
                text: "Responsable funcional",
              },
              value: "funcional",
            },
          ],
        },
      },

      {
        type: "input",
        block_id: "current_responsible",

        label: {
          type: "plain_text",
          text: "Responsable actual",
        },

        element: {
          type: "users_select",
          action_id: "current_responsible_id",

          placeholder: {
            type: "plain_text",
            text: "Selecciona el responsable actual",
          },
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
            text: "Selecciona el nuevo responsable",
          },
        },
      },

      {
        type: "input",
        block_id: "reason",

        label: {
          type: "plain_text",
          text: "Motivo del cambio",
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

export function buildManageOperativeAssignmentsView(
  input: ManageOperativeAssignmentsInput,
): View {
  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*Cambio permanente de Responsable Operativo*\n\n" +
          `Actual: <@${input.responsableActualId}>\n` +
          `Nuevo: <@${input.nuevoResponsableId}>\n\n` +
          "Selecciona las tareas cuya configuración maestra deseas actualizar.",
      },
    },
    {
      type: "divider",
    },
  ];

  for (const config of input.configuraciones) {
    blocks.push({
      type: "section",

      block_id: `config_${config.configId}`,

      text: {
        type: "mrkdwn",
        text: `*${config.areaNombre}*\n` + `${config.tarea}`,
      },

      accessory: {
        type: "checkboxes",

        action_id: "pys_responsible_config_select",

        options: [
          {
            text: {
              type: "plain_text",

              text: "Actualizar responsable",
            },

            value: config.configId,
          },
        ],

        /*
         * En esta pantalla yo dejaría
         * todos seleccionados por defecto.
         */
        initial_options: [
          {
            text: {
              type: "plain_text",

              text: "Actualizar responsable",
            },

            value: config.configId,
          },
        ],
      },
    });
  }

  return {
    type: "modal",

    callback_id: "pys_manage_operative_assignments_submit",

    private_metadata: JSON.stringify({
      cid: input.cid,

      responsableActualId: input.responsableActualId,

      nuevoResponsableId: input.nuevoResponsableId,

      motivo: input.motivo,
    }),

    title: {
      type: "plain_text",
      text: "Actualizar responsable",
    },

    submit: {
      type: "plain_text",
      text: "Aplicar cambio",
    },

    close: {
      type: "plain_text",
      text: "Cancelar",
    },

    blocks,
  };
}

export function buildManageFunctionalAssignmentsView(
  input: ManageFunctionalAssignmentsInput,
): View {
  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*Cambio permanente de Responsable Funcional*\n\n" +
          `Actual: <@${input.responsableActualId}>\n` +
          `Nuevo: <@${input.nuevoResponsableId}>\n\n` +
          "Selecciona las áreas cuya configuración maestra deseas actualizar.",
      },
    },
    {
      type: "divider",
    },
  ];

  for (const area of input.areas) {
    blocks.push({
      type: "section",

      block_id: `area_${area.areaId}`,

      text: {
        type: "mrkdwn",
        text: `*${area.areaNombre}*`,
      },

      accessory: {
        type: "checkboxes",

        action_id: "pys_responsible_area_select",

        options: [
          {
            text: {
              type: "plain_text",

              text: "Actualizar responsable",
            },

            value: area.areaId,
          },
        ],

        initial_options: [
          {
            text: {
              type: "plain_text",

              text: "Actualizar responsable",
            },

            value: area.areaId,
          },
        ],
      },
    });
  }

  return {
    type: "modal",

    callback_id: "pys_manage_functional_assignments_submit",

    private_metadata: JSON.stringify({
      cid: input.cid,

      responsableActualId: input.responsableActualId,

      nuevoResponsableId: input.nuevoResponsableId,

      motivo: input.motivo,
    }),

    title: {
      type: "plain_text",
      text: "Actualizar responsable",
    },

    submit: {
      type: "plain_text",
      text: "Aplicar cambio",
    },

    close: {
      type: "plain_text",
      text: "Cancelar",
    },

    blocks,
  };
}

export function buildNoResponsibleAssignmentsView(
  cid: string,
  tipo: "operativo" | "funcional",
  responsableActualId: string,
): View {
  const tipoTexto =
    tipo === "operativo" ? "Responsable Operativo" : "Responsable Funcional";

  return {
    type: "modal",

    callback_id: "pys_manage_responsibles_no_assignments",

    private_metadata: JSON.stringify({
      cid,
    }),

    title: {
      type: "plain_text",
      text: "Administrar responsables",
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
            `No se encontraron configuraciones activas para <@${responsableActualId}> como *${tipoTexto}*.\n\n` +
            "No se realizó ningún cambio.",
        },
      },
    ],
  };
}

export function buildManageResponsibleErrorView(cid: string): View {
  return {
    type: "modal",

    callback_id: "pys_manage_responsibles_error",

    private_metadata: JSON.stringify({
      cid,
    }),

    title: {
      type: "plain_text",
      text: "Administrar responsables",
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
            "⚠️ No fue posible consultar la configuración de responsables.\n\n" +
            `Referencia: \`${cid}\``,
        },
      },
    ],
  };
}
