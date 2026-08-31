import type { App } from "@slack/bolt";

import { canAdministerPys } from "../services/authorization.service.js";
import { notifyMasterResponsibleChanged } from "../services/notification.service.js";
import { correlationId, logger } from "../utils/logger.js";
import { getConfigTareas } from "../repositories/config-tareas.repository.js";

import { getAreas } from "../repositories/areas.repository.js";

import {
  buildManageOperativeAssignmentsView,
  buildManageFunctionalAssignmentsView,
  buildNoResponsibleAssignmentsView,
  buildManageResponsiblesView,
  buildManageResponsibleErrorView,
} from "../views/manage-responsibles.view.js";

import {
  changeMasterFunctionalResponsible,
  changeMasterOperativeResponsible,
} from "../services/responsible-configuration.service.js";

export function registerManageResponsiblesListeners(app: App): void {
  app.action("pys_manage_responsibles", async ({ ack, body, client }) => {
    await ack();

    const cid = correlationId("manage-responsibles");

    if (!("trigger_id" in body)) {
      return;
    }

    try {
      const autorizado = await canAdministerPys(client, body.user.id);

      if (!autorizado) {
        throw new Error("Usuario no autorizado para administrar responsables");
      }

      await client.views.open({
        trigger_id: body.trigger_id,

        view: buildManageResponsiblesView(cid),
      });

      logger.info(
        {
          cid,
          userId: body.user.id,
          action: "manage_responsibles_opened",
        },
        "Modal de administración de responsables abierto",
      );
    } catch (err) {
      logger.error(
        {
          cid,
          userId: body.user.id,
          err,
          action: "manage_responsibles_open_failed",
        },
        "Error abriendo administración de responsables",
      );
    }
  });

  app.action("responsible_type_value", async ({ ack }) => {
    await ack();
  });

  app.action("current_responsible_id", async ({ ack }) => {
    await ack();
  });

  app.action("new_responsible_id", async ({ ack }) => {
    await ack();
  });

  app.view(
    "pys_manage_responsibles_submit",
    async ({ ack, body, view, client }) => {
      const metadata = JSON.parse(view.private_metadata || "{}") as {
        cid?: string;
      };

      const cid = metadata.cid ?? correlationId("manage-responsibles");

      const tipo =
        view.state.values.responsible_type?.responsible_type_value
          ?.selected_option?.value;

      const responsableActualId =
        view.state.values.current_responsible?.current_responsible_id
          ?.selected_user;

      const nuevoResponsableId =
        view.state.values.new_responsible?.new_responsible_id?.selected_user;

      const motivo =
        view.state.values.reason?.reason_value?.value?.trim() ?? "";

      const errors: Record<string, string> = {};

      if (tipo !== "operativo" && tipo !== "funcional") {
        errors.responsible_type = "Selecciona el tipo de responsable.";
      }

      if (!responsableActualId) {
        errors.current_responsible = "Selecciona el responsable actual.";
      }

      if (!nuevoResponsableId) {
        errors.new_responsible = "Selecciona el nuevo responsable.";
      }

      if (
        responsableActualId &&
        nuevoResponsableId &&
        responsableActualId === nuevoResponsableId
      ) {
        errors.new_responsible =
          "El nuevo responsable debe ser diferente al actual.";
      }

      if (!motivo) {
        errors.reason = "El motivo del cambio es obligatorio.";
      }

      if (Object.keys(errors).length > 0) {
        await ack({
          response_action: "errors",
          errors,
        });

        return;
      }

      /*
       * Guardas para TypeScript.
       */
      if (!tipo || !responsableActualId || !nuevoResponsableId) {
        await ack();
        return;
      }

      /*
       * Validamos autorización nuevamente.
       */
      const autorizado = await canAdministerPys(client, body.user.id);

      if (!autorizado) {
        await ack();

        logger.error(
          {
            cid,
            userId: body.user.id,
            action: "manage_responsibles_submit_unauthorized",
          },
          "Usuario no autorizado para administrar responsables",
        );

        return;
      }

      /*
       * Validamos que el NUEVO
       * responsable siga activo.
       */
      const userInfo = await client.users.info({
        user: nuevoResponsableId,
      });

      if (!userInfo.user || userInfo.user.deleted) {
        await ack({
          response_action: "errors",

          errors: {
            new_responsible: "El nuevo responsable está desactivado en Slack.",
          },
        });

        return;
      }

      try {
        if (tipo === "operativo") {
          const [configuraciones, areas] = await Promise.all([
            getConfigTareas(client),
            getAreas(client),
          ]);

          const afectadas = configuraciones.filter(
            (item) =>
              item.responsableOperativo === responsableActualId && item.activo,
          );

          if (afectadas.length === 0) {
            await ack({
              response_action: "update",

              view: buildNoResponsibleAssignmentsView(
                cid,
                "operativo",
                responsableActualId,
              ),
            });

            return;
          }

          const assignments = afectadas.map((item) => {
            const area = areas.find((area) => area.id === item.areaId); //r areaId por id

            return {
              configId: item.id, //r configTareaId por id
              areaId: item.areaId,
              areaNombre: area?.nombre ?? item.areaId,
              tarea: item.tarea,
            };
          });

          await ack({
            response_action: "update",

            view: buildManageOperativeAssignmentsView({
              cid,
              responsableActualId,
              nuevoResponsableId,
              motivo,
              configuraciones: assignments,
            }),
          });

          return;
        }

        /*
         * Responsable funcional
         */
        const areas = await getAreas(client);

        const afectadas = areas.filter(
          (area) =>
            area.responsableFuncional === responsableActualId && area.activo,
        );

        if (afectadas.length === 0) {
          await ack({
            response_action: "update",

            view: buildNoResponsibleAssignmentsView(
              cid,
              "funcional",
              responsableActualId,
            ),
          });

          return;
        }

        const assignments = afectadas.map((area) => ({
          areaId: area.id,
          areaNombre: area.nombre,
        }));

        await ack({
          response_action: "update",

          view: buildManageFunctionalAssignmentsView({
            cid,
            responsableActualId,
            nuevoResponsableId,
            motivo,
            areas: assignments,
          }),
        });
      } catch (err) {
        logger.error(
          {
            cid,
            userId: body.user.id,
            tipo,
            responsableActualId,
            nuevoResponsableId,
            err,
            action: "manage_responsibles_lookup_failed",
          },
          "Error consultando configuraciones de responsables",
        );

        await ack({
          response_action: "update",

          view: buildManageResponsibleErrorView(cid),
        });
      }
    },
  );

  app.action("pys_responsible_config_select", async ({ ack }) => {
    await ack();
  });

  app.action("pys_responsible_area_select", async ({ ack }) => {
    await ack();
  });

  app.view(
    "pys_manage_operative_assignments_submit",
    async ({ ack, body, view, client }) => {
      const metadata = JSON.parse(view.private_metadata || "{}") as {
        cid?: string;
        responsableActualId?: string;
        nuevoResponsableId?: string;
        motivo?: string;
      };

      const cid = metadata.cid ?? correlationId("manage-responsibles");

      const responsableActualId = metadata.responsableActualId;

      const nuevoResponsableId = metadata.nuevoResponsableId;

      const motivo = metadata.motivo?.trim() ?? "";

      /*
       * Obtenemos los ConfigTareaID
       * marcados en los checkboxes.
       */
      const idsSeleccionados = Object.values(view.state.values).flatMap(
        (block) => {
          const action = block.pys_responsible_config_select;

          return action?.selected_options?.map((option) => option.value) ?? [];
        },
      );

      if (!responsableActualId || !nuevoResponsableId || !motivo) {
        await ack();

        logger.error(
          {
            cid,
            userId: body.user.id,
            action: "master_operative_change_invalid_metadata",
          },
          "Metadata incompleta para cambio permanente de responsable operativo",
        );

        return;
      }

      if (idsSeleccionados.length === 0) {
        await ack();
        return;
      }

      //   if (idsSeleccionados.length === 0) {
      //     await ack({
      //       response_action: "errors",

      //       errors: {
      //         /*
      //          * No tenemos un block_id único
      //          * para error global.
      //          * Por eso sería mejor evitar
      //          * submit sin selección desde UI.
      //          */
      //       },
      //     });

      //     return;
      //   }

      /*
       * ACK inmediatamente.
       * A partir de aquí pueden existir
       * varias escrituras en Slack Lists.
       */
      await ack();

      try {
        const result = await changeMasterOperativeResponsible(client, {
          ejecutadoPorId: body.user.id,
          responsableAnteriorId: responsableActualId,
          nuevoResponsableId,
          motivo,
          idsSeleccionados,
          cid,
        });

        await notifyMasterResponsibleChanged(client, {
          cid,
          tipo: "operativo",
          responsableAnteriorId: responsableActualId,
          nuevoResponsableId,
          ejecutadoPorId: body.user.id,
          motivo,
          responsabilidades: result.responsabilidades.map((item) => ({
            areaNombre: item.areaNombre,
            tarea: item.tarea,
          })),
        });

        logger.info(
          {
            cid,
            userId: body.user.id,
            responsableAnteriorId: responsableActualId,
            nuevoResponsableId,
            configuraciones: result.actualizadas,
            action: "master_operative_responsible_changed",
          },
          "Responsable operativo maestro actualizado",
        );

        await client.chat.postMessage({
          channel: body.user.id,

          text:
            "✅ *Responsable operativo actualizado*\n\n" +
            `*Anterior:* <@${responsableActualId}>\n` +
            `*Nuevo:* <@${nuevoResponsableId}>\n` +
            `*Configuraciones actualizadas:* ${result.actualizadas}\n` +
            `*Motivo:* ${motivo}\n\n` +
            "_El cambio aplica únicamente a procesos que se creen en adelante._",
        });
      } catch (err) {
        logger.error(
          {
            cid,
            userId: body.user.id,
            err,
            action: "master_operative_responsible_change_failed",
          },
          "Error cambiando responsable operativo maestro",
        );

        await client.chat.postMessage({
          channel: body.user.id,

          text:
            "⚠️ No fue posible actualizar el responsable operativo.\n\n" +
            `Referencia: \`${cid}\``,
        });
      }
    },
  );

  app.view(
    "pys_manage_functional_assignments_submit",
    async ({ ack, body, view, client }) => {
      const metadata = JSON.parse(view.private_metadata || "{}") as {
        cid?: string;
        responsableActualId?: string;
        nuevoResponsableId?: string;
        motivo?: string;
      };

      const cid = metadata.cid ?? correlationId("manage-responsibles");

      const responsableActualId = metadata.responsableActualId;

      const nuevoResponsableId = metadata.nuevoResponsableId;

      const motivo = metadata.motivo?.trim() ?? "";

      const idsSeleccionados = Object.values(view.state.values).flatMap(
        (block) => {
          const action = block.pys_responsible_area_select;

          return action?.selected_options?.map((option) => option.value) ?? [];
        },
      );

      if (!responsableActualId || !nuevoResponsableId || !motivo) {
        await ack();

        logger.error(
          {
            cid,
            userId: body.user.id,
            action: "master_functional_change_invalid_metadata",
          },
          "Metadata incompleta para cambio permanente de responsable funcional",
        );

        return;
      }

      await ack();

      try {
        const result = await changeMasterFunctionalResponsible(client, {
          ejecutadoPorId: body.user.id,
          responsableAnteriorId: responsableActualId,
          nuevoResponsableId,
          motivo,
          idsSeleccionados,
          cid,
        });

        await notifyMasterResponsibleChanged(client, {
          cid,
          tipo: "funcional",
          responsableAnteriorId: responsableActualId,
          nuevoResponsableId,
          ejecutadoPorId: body.user.id,
          motivo,
          responsabilidades: result.responsabilidades.map((item) => ({
            areaNombre: item.areaNombre,
          })),
        });
        logger.info(
          {
            cid,
            userId: body.user.id,
            responsableAnteriorId: responsableActualId,
            nuevoResponsableId,
            areas: result.actualizadas,
            action: "master_functional_responsible_changed",
          },
          "Responsable funcional maestro actualizado",
        );

        await client.chat.postMessage({
          channel: body.user.id,

          text:
            "✅ *Responsable funcional actualizado*\n\n" +
            `*Anterior:* <@${responsableActualId}>\n` +
            `*Nuevo:* <@${nuevoResponsableId}>\n` +
            `*Áreas actualizadas:* ${result.actualizadas}\n` +
            `*Motivo:* ${motivo}\n\n` +
            "_El cambio aplica únicamente a procesos que se creen en adelante._",
        });
      } catch (err) {
        logger.error(
          {
            cid,
            userId: body.user.id,
            err,
            action: "master_functional_responsible_change_failed",
          },
          "Error cambiando responsable funcional maestro",
        );

        await client.chat.postMessage({
          channel: body.user.id,

          text:
            "⚠️ No fue posible actualizar el responsable funcional.\n\n" +
            `Referencia: \`${cid}\``,
        });
      }
    },
  );
}
