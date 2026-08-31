import type { App } from "@slack/bolt";

import { getAreaByAreaProcesoId } from "../repositories/areas-proceso-read.repository.js";
import { canAdministerPys } from "../services/authorization.service.js";
import { reassignFunctional } from "../services/functional-reassignment.service.js";
import { publishHome } from "../services/home-publish.service.js";
import { notifyFunctionalReassigned } from "../services/notification.service.js";
import { getProcessDetail } from "../services/process-detail.service.js";
import { correlationId, logger } from "../utils/logger.js";
import { buildProcessDetailView } from "../views/process-detail.view.js";
import { buildReassignFunctionalView } from "../views/reassign-functional.view.js";

export function registerFunctionalReassignmentListeners(app: App): void {
  app.action(
    "pys_reassign_functional",
    async ({ ack, action, body, client }) => {
      await ack();

      const cid = correlationId("reassign-functional");

      if (action.type !== "button") {
        return;
      }

      const areaProcesoId = action.value;

      if (!areaProcesoId) {
        return;
      }

      if (!("trigger_id" in body)) {
        return;
      }

      /*
       * Este botón nace dentro del
       * modal de detalle.
       */
      if (!("view" in body) || !body.view) {
        logger.error(
          {
            cid,
            areaProcesoId,
            userId: body.user.id,
            action: "functional_reassignment_missing_parent_view",
          },
          "La reasignación funcional no provino de una vista",
        );

        return;
      }

      try {
        const autorizado = await canAdministerPys(client, body.user.id);

        if (!autorizado) {
          throw new Error(
            "Usuario no autorizado para reasignar responsables funcionales",
          );
        }

        const area = await getAreaByAreaProcesoId(client, areaProcesoId);

        if (!area) {
          throw new Error(`Área no encontrada: ${areaProcesoId}`);
        }

        const parentViewId = body.view.id;

        await client.views.push({
          trigger_id: body.trigger_id,

          view: buildReassignFunctionalView({
            procesoId: area.procesoId,

            areaProcesoId: area.areaProcesoId,

            areaNombre: area.areaNombre,

            responsableActualId: area.responsableFuncionalId,

            cid,

            parentViewId,
          }),
        });

        logger.info(
          {
            cid,
            procesoId: area.procesoId,
            areaProcesoId: area.areaProcesoId,
            userId: body.user.id,
            action: "functional_reassignment_view_pushed",
          },
          "Vista de reasignación funcional agregada al modal",
        );
      } catch (err) {
        logger.error(
          {
            cid,
            areaProcesoId,
            userId: body.user.id,
            err,
            action: "functional_reassignment_modal_failed",
          },
          "Error abriendo reasignación funcional",
        );

        await client.chat.postMessage({
          channel: body.user.id,

          text: `No fue posible abrir la reasignación del responsable funcional. Referencia: ${cid}`,
        });
      }
    },
  );

  app.view(
    "pys_reassign_functional_submit",
    async ({ ack, body, view, client }) => {
      const metadata = JSON.parse(view.private_metadata || "{}") as {
        procesoId?: string;
        areaProcesoId?: string;
        cid?: string;
        parentViewId?: string;
      };

      const procesoId = metadata.procesoId;
      const areaProcesoId = metadata.areaProcesoId;
      const cid = metadata.cid ?? correlationId("reassign-functional");
      const newFunctionalBlock = view.state.values.new_functional;
      const reasonBlock = view.state.values.reason;
      const nuevoResponsableId =
        newFunctionalBlock?.new_functional_id?.selected_user;
      const motivo = reasonBlock?.reason_value?.value?.trim() ?? "";
      const errors: Record<string, string> = {};

      if (!nuevoResponsableId) {
        errors.new_functional = "Selecciona un nuevo responsable funcional.";
      }

      if (!motivo) {
        errors.reason = "El motivo de la reasignación es obligatorio.";
      }

      if (!procesoId || !areaProcesoId) {
        await ack();
        return;
      }

      if (Object.keys(errors).length > 0) {
        await ack({
          response_action: "errors",
          errors,
        });

        return;
      }

      /*
       * Guarda extra para TypeScript.
       */
      if (!nuevoResponsableId) {
        await ack();
        return;
      }

      await ack();

      try {
        const result = await reassignFunctional(client, {
          procesoId,
          areaProcesoId,
          usuarioEjecutorId: body.user.id,
          nuevoResponsableId,
          motivo,
          cid,
        });

        await notifyFunctionalReassigned(client, {
          cid,
          procesoId: result.procesoId,
          areaProcesoId: result.areaProcesoId,
          areaNombre: result.areaNombre,
          responsableAnteriorId: result.responsableAnteriorId,
          responsableNuevoId: result.responsableNuevoId,
          ejecutadoPorId: body.user.id,
          motivo: result.motivo,
        });

        await publishHome(client, body.user.id);

        /*
         * Reconstruimos el detalle para
         * refrescar el modal que quedó
         * debajo del push.
         */
        const updatedDetail = await getProcessDetail(client, result.procesoId);

        const puedeAdministrar = await canAdministerPys(client, body.user.id);

        if (metadata.parentViewId) {
          await client.views.update({
            view_id: metadata.parentViewId,

            view: buildProcessDetailView(updatedDetail, {
              puedeAdministrar,
              cid,
            }),
          });
        }

        await client.chat.postMessage({
          channel: body.user.id,

          text:
            "✅ *Responsable funcional reasignado correctamente*\n\n" +
            `*Proceso:* ${result.procesoId}\n` +
            `*Área:* ${result.areaNombre}\n` +
            `*Responsable anterior:* <@${result.responsableAnteriorId}>\n` +
            `*Nuevo responsable:* <@${result.responsableNuevoId}>\n` +
            `*Motivo:* ${result.motivo}`,
        });

        logger.info(
          {
            cid,
            procesoId: result.procesoId,
            areaProcesoId: result.areaProcesoId,
            userId: body.user.id,
            responsableAnteriorId: result.responsableAnteriorId,
            responsableNuevoId: result.responsableNuevoId,
            action: "functional_reassigned",
          },
          "Responsable funcional reasignado correctamente",
        );
      } catch (err) {
        logger.error(
          {
            cid,
            procesoId,
            areaProcesoId,
            userId: body.user.id,
            err,
            action: "functional_reassignment_failed",
          },
          "Error reasignando responsable funcional",
        );

        await client.chat.postMessage({
          channel: body.user.id,

          text: `No fue posible reasignar el responsable funcional. Referencia: ${cid}`,
        });

        await publishHome(client, body.user.id);
      }
    },
  );
}
