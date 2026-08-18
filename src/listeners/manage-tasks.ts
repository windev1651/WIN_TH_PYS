import type { App } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";

import { getTareasUsuario } from "../repositories/tareas-proceso-read.repository.js";
import { completeTask } from "../services/task-management.service.js";
import { correlationId, logger } from "../utils/logger.js";
import { buildManageTasksView } from "../views/manage-tasks.view.js";
import { publishHome } from "../services/home-publish.service.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { getMaxTareasVista } from "../services/runtime-config.service.js";

export function registerManageTasksListeners(app: App): void {
  app.action("pys_manage_tasks", async ({ ack, body, client }) => {
    await ack();

    const cid = correlationId("tasks");

    if (!("trigger_id" in body)) {
      logger.error(
        {
          cid,
          userId: body.user.id,
          action: "open_manage_tasks",
        },
        "Interacción sin trigger_id",
      );

      return;
    }

    try {
      const [tareas, procesos, maxTareasVista] = await Promise.all([
        getTareasUsuario(client, body.user.id),
        getProcesos(client),
        getMaxTareasVista(client),
      ]);

      const tareasConProceso = tareas
        .map((tarea) => {
          const proceso = procesos.find(
            (item) => item.procesoId === tarea.procesoId,
          );

          if (!proceso) {
            return null;
          }

          return {
            ...tarea,
            empleadoId: proceso.empleadoId,
            fechaLimiteProceso: proceso.fechaLimite,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => {
          /*
           * Primero el proceso que vence antes.
           */
          const byFecha = a.fechaLimiteProceso.localeCompare(
            b.fechaLimiteProceso,
          );

          if (byFecha !== 0) {
            return byFecha;
          }

          /*
           * Después agrupamos por ProcesoID.
           */
          const byProceso = a.procesoId.localeCompare(b.procesoId);

          if (byProceso !== 0) {
            return byProceso;
          }

          /*
           * Finalmente respetamos el orden
           * de las tareas dentro del proceso.
           */
          return a.ordenTarea - b.ordenTarea;
        });

      if (tareas.length === 0) {
        await client.chat.postMessage({
          channel: body.user.id,
          text: "No tienes tareas pendientes para gestionar.",
        });

        return;
      }

      await client.views.open({
        trigger_id: body.trigger_id,

        view: buildManageTasksView(tareasConProceso, cid, maxTareasVista),
      });

      logger.info(
        {
          cid,
          userId: body.user.id,
          tareas: Math.min(tareas.length, 6),
          action: "manage_tasks_opened",
        },
        "Modal de gestión de tareas abierto",
      );
    } catch (err) {
      logger.error(
        {
          cid,
          userId: body.user.id,
          err,
          action: "manage_tasks_open_failed",
        },
        "Error abriendo gestión de tareas",
      );
    }
  });

  app.view("pys_manage_tasks_submit", async ({ ack, body, view, client }) => {
    const metadata = JSON.parse(view.private_metadata || "{}") as {
      cid?: string;
    };

    const cid = metadata.cid ?? correlationId("tasks");

    /*
     * ACK primero.
     * Las escrituras en Slack pueden tardar,
     * y no queremos exceder el timeout
     * de la interacción.
     */
    await ack();

    try {
      /*
       * Volvemos a consultar las tareas reales.
       *
       * No confiamos únicamente en lo que
       * venía en el modal: así volvemos a
       * validar responsable y estado.
       */
      const maxTareasVista = await getMaxTareasVista(client);
      const tareas = await getTareasUsuario(client, body.user.id);

      const tareasVisibles = tareas.slice(0, maxTareasVista);

      let completadas = 0;

      for (const tarea of tareasVisibles) {
        const completeBlock = view.state.values[`complete_${tarea.taskId}`];
        const commentBlock = view.state.values[`comment_${tarea.taskId}`];
        const selectedOptions = completeBlock?.complete?.selected_options;
        const shouldComplete =
          selectedOptions?.some((option) => option.value === "complete") ??
          false;

        const comentario = commentBlock?.comment?.value ?? "";

        if (!shouldComplete) {
          continue;
        }

        await completeTask(client, {
          procesoId: tarea.procesoId,
          taskId: tarea.taskId,
          usuarioId: body.user.id,
          comentario,
          cid,
        });

        completadas += 1;
      }

      logger.info(
        {
          cid,
          userId: body.user.id,
          completadas,
          action: "manage_tasks_saved",
        },
        "Cambios de tareas guardados",
      );

      if (completadas > 0) {
        await client.chat.postMessage({
          channel: body.user.id,

          text:
            completadas === 1
              ? "Se completó 1 tarea correctamente."
              : `Se completaron ${completadas} tareas correctamente.`,
        });
      } else {
        await client.chat.postMessage({
          channel: body.user.id,

          text: "No se seleccionaron tareas para completar.",
        });
      }

      await publishHome(client, body.user.id);
    } catch (err) {
      logger.error(
        {
          cid,
          userId: body.user.id,
          err,
          action: "manage_tasks_save_failed",
        },
        "Error guardando cambios de tareas",
      );

      await client.chat.postMessage({
        channel: body.user.id,

        text: `No fue posible guardar los cambios. Referencia: ${cid}`,
      });
    }
  });
}
