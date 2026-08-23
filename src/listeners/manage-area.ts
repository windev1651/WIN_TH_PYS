import type { App } from "@slack/bolt";

import {
  getAreasProceso,
  getAllAreasProceso,
} from "../repositories/areas-proceso-read.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { getTareasProceso } from "../repositories/tareas-proceso-read.repository.js";
import { correlationId, logger } from "../utils/logger.js";
import { buildManageAreaView } from "../views/manage-area.view.js";
import { approveArea } from "../services/area-management.service.js";
import { publishHome } from "../services/home-publish.service.js";

export function registerManageAreaListeners(app: App): void {
  app.action("pys_manage_area", async ({ ack, action, body, client }) => {
    await ack();

    const cid = correlationId("area");

    if (action.type !== "button") {
      return;
    }

    const areaProcesoId = action.value;

    if (!areaProcesoId) {
      return;
    }

    if (!("trigger_id" in body)) {
      logger.error(
        {
          cid,
          areaProcesoId,
          userId: body.user.id,
          action: "open_manage_area",
        },
        "Interacción sin trigger_id",
      );

      return;
    }

    try {
      const [procesos, todasLasAreas] = await Promise.all([
        getProcesos(client),
        getAllAreasProceso(client),
      ]);

      const targetArea = todasLasAreas.find(
        (area) => area.areaProcesoId === areaProcesoId,
      );

      if (!targetArea) {
        throw new Error(`Área no encontrada: ${areaProcesoId}`);
      }

      if (targetArea.responsableFuncionalId !== body.user.id) {
        throw new Error("El usuario no es responsable funcional de esta área");
      }

      const proceso = procesos.find(
        (item) => item.procesoId === targetArea.procesoId,
      );

      if (!proceso) {
        throw new Error(`Proceso no encontrado: ${targetArea.procesoId}`);
      }

      const tareas = await getTareasProceso(client, targetArea.procesoId);

      const tareasArea = tareas
        .filter((tarea) => tarea.areaProcesoId === targetArea.areaProcesoId)
        .sort((a, b) => a.ordenTarea - b.ordenTarea);

      await client.views.open({
        trigger_id: body.trigger_id,

        view: buildManageAreaView(
          {
            area: targetArea,
            empleadoId: proceso.empleadoId,
            fechaLimite: proceso.fechaLimite,
            tareas: tareasArea,
          },
          cid,
        ),
      });

      logger.info(
        {
          cid,
          procesoId: targetArea.procesoId,
          areaProcesoId,
          userId: body.user.id,
          tareas: tareasArea.length,
          action: "manage_area_opened",
        },
        "Modal de gestión de área abierto",
      );
    } catch (err) {
      logger.error(
        {
          cid,
          areaProcesoId,
          userId: body.user.id,
          err,
          action: "manage_area_open_failed",
        },
        "Error abriendo gestión de área",
      );
    }
  });

  app.view("pys_manage_area_submit", async ({ ack, body, view, client }) => {
    const metadata = JSON.parse(view.private_metadata || "{}") as {
      cid?: string;
      areaProcesoId?: string;
    };

    const cid = metadata.cid ?? correlationId("area");

    const areaProcesoId = metadata.areaProcesoId;

    if (!areaProcesoId) {
      await ack();
      return;
    }

    const commentBlock = view.state.values.approval_comment;

    const comentario = commentBlock?.approval_comment_value?.value ?? "";

    /*
     * Cerramos el modal rápidamente.
     * La validación real ocurre después.
     */
    await ack();

    try {
      const result = await approveArea(client, {
        areaProcesoId,
        usuarioId: body.user.id,
        comentario,
        cid,
      });

      /*
       * Área aprobada ya no debe aparecer
       * en "Mis áreas pendientes".
       */
      await publishHome(client, body.user.id);

      logger.info(
        {
          cid,
          procesoId: result.procesoId,
          areaProcesoId: result.areaProcesoId,
          userId: body.user.id,
          auditEvent: true,
          action: "area_approved",
        },
        "Área aprobada correctamente",
      );

      await client.chat.postMessage({
        channel: body.user.id,
        text:
          "✅ *Área aprobada correctamente*\n\n" +
          `*Área:* ${result.areaNombre}\n` +
          `*Proceso:* ${result.procesoId}` +
          (result.comentario ? `\n*Comentario:* ${result.comentario}` : ""),
      });
    } catch (err) {
      logger.error(
        {
          cid,
          areaProcesoId,
          userId: body.user.id,
          err,
          action: "area_approval_failed",
        },
        "Error aprobando área",
      );

      await client.chat.postMessage({
        channel: body.user.id,

        text: `No fue posible aprobar el área. Referencia: ${cid}`,
      });

      /*
       * También refrescamos por si el estado
       * cambió mientras el modal estaba abierto.
       */
      await publishHome(client, body.user.id);
    }
  });
}
