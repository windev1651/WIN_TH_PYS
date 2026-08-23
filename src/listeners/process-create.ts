import type { App } from "@slack/bolt";
import { WebClient } from "@slack/web-api";

import { getTiposSolicitud } from "../repositories/tipos-solicitud.repository.js";
import { correlationId, logger } from "../utils/logger.js";
import { createPazYSalvo } from "../services/process-create.service.js";
import { getCachedValue } from "../services/reference-data-cache.service.js";

export async function getCachedTiposSolicitud(client: WebClient) {
  return getCachedValue("tiposSolicitud", 60_000, () =>
    getTiposSolicitud(client),
  );
}
export function registerProcessCreateListeners(app: App): void {
  app.action("pys_create_process", async ({ ack, body, client }) => {
    await ack();

    const cid = correlationId("create");

    logger.info(
      {
        cid,
        userId: body.user.id,
        action: "open_create_process_modal",
      },
      "Abriendo modal de creación de Paz y Salvo",
    );

    if (!("trigger_id" in body)) {
      logger.error(
        {
          bodyType: body.type,
          action: "open_create_process_modal",
        },
        "Slack action sin trigger_id",
      );

      return;
    }

    const tiposSolicitud = await getCachedTiposSolicitud(client);

    const tiposActivos = tiposSolicitud.filter((tipo) => tipo.activo);

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "pys_create_process_submit",

        private_metadata: JSON.stringify({
          cid,
        }),

        title: {
          type: "plain_text",
          text: "Crear Paz y Salvo",
        },

        submit: {
          type: "plain_text",
          text: "Crear",
        },

        close: {
          type: "plain_text",
          text: "Cancelar",
        },

        blocks: [
          {
            type: "input",
            block_id: "employee",
            label: {
              type: "plain_text",
              text: "Empleado",
            },
            element: {
              type: "users_select",
              action_id: "employee_id",
              placeholder: {
                type: "plain_text",
                text: "Selecciona un empleado",
              },
            },
          },

          {
            type: "input",
            block_id: "request_type",
            label: {
              type: "plain_text",
              text: "Tipo de solicitud",
            },
            element: {
              type: "static_select",
              action_id: "request_type_id",
              placeholder: {
                type: "plain_text",
                text: "Selecciona el tipo",
              },
              options: tiposActivos.map((tipo) => ({
                text: {
                  type: "plain_text",
                  text: tipo.nombre,
                },
                value: tipo.id,
              })),
            },
          },

          {
            type: "input",
            block_id: "exit_date",
            label: {
              type: "plain_text",
              text: "Fecha de salida",
            },
            element: {
              type: "datepicker",
              action_id: "exit_date_value",
              placeholder: {
                type: "plain_text",
                text: "Selecciona una fecha",
              },
            },
          },

          {
            type: "input",
            block_id: "comment",
            optional: true,
            label: {
              type: "plain_text",
              text: "Comentario TH",
            },
            element: {
              type: "plain_text_input",
              action_id: "comment_value",
              multiline: true,
            },
          },
        ],
      },
    });
  });

  app.view("pys_create_process_submit", async ({ ack, body, view, client }) => {
    console.log("VIEW SUBMISSION RECIBIDO");

    logger.info(
      {
        userId: body.user.id,
        callbackId: view.callback_id,
        action: "process_create_modal_submit",
      },
      "Submit del modal recibido",
    );

    const metadata = JSON.parse(view.private_metadata || "{}") as {
      cid?: string;
    };

    const cid = metadata.cid ?? correlationId("create");

    const employeeBlock = view.state.values.employee;

    const requestTypeBlock = view.state.values.request_type;

    const exitDateBlock = view.state.values.exit_date;

    const commentBlock = view.state.values.comment;

    const employeeId = employeeBlock?.employee_id?.selected_user;

    const tipoSolicitudId =
      requestTypeBlock?.request_type_id?.selected_option?.value;

    const fechaSalida = exitDateBlock?.exit_date_value?.selected_date;

    const comentarioTH = commentBlock?.comment_value?.value ?? "";

    const errors: Record<string, string> = {};

    if (!employeeId) {
      errors.employee = "Selecciona un empleado.";
    }

    if (!tipoSolicitudId) {
      errors.request_type = "Selecciona un tipo de solicitud.";
    }

    if (!fechaSalida) {
      errors.exit_date = "Selecciona una fecha de salida.";
    }

    if (!employeeId || !tipoSolicitudId || !fechaSalida) {
      await ack({
        response_action: "errors",
        errors,
      });

      return;
    }

    logger.info(
      {
        cid,
        userId: body.user.id,
        action: "process_create_modal_submit",
      },
      "Submit de creación recibido",
    );

    await ack();

    try {
      const today = new Date().toISOString().slice(0, 10);

      const result = await createPazYSalvo(
        client,
        {
          tipoSolicitudId,
          empleadoId: employeeId,
          creadoPorId: body.user.id,
          fechaInicio: today,
          fechaSalida,
          comentarioTH,
        },
        cid,
      );

      await client.chat.postMessage({
        channel: body.user.id,
        text: `Paz y Salvo creado correctamente: ${result.proceso.procesoId}`,
      });

      logger.info(
        {
          cid,
          procesoId: result.proceso.procesoId,
          userId: body.user.id,
          auditEvent: true,
          action: "process_created_from_modal",
        },
        "Paz y Salvo creado desde App Home",
      );
    } catch (error) {
      logger.error(
        {
          cid,
          userId: body.user.id,
          err: error,
          action: "process_create_modal_failed",
        },
        "Error creando Paz y Salvo desde modal",
      );

      await client.chat.postMessage({
        channel: body.user.id,
        text: `No fue posible crear el Paz y Salvo. Referencia: ${cid}`,
      });
    }
  });
}
