import type { App } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";

import { getTareasUsuario } from "../repositories/tareas-proceso-read.repository.js";
import {
  completeTask,
  CompleteTaskResult,
} from "../services/task-management.service.js";
import { correlationId, logger } from "../utils/logger.js";
import { buildManageTasksView } from "../views/manage-tasks.view.js";
import { publishHome } from "../services/home-publish.service.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { getMaxTareasVista } from "../services/runtime-config.service.js";

export function registerManageTasksListeners(app: App): void {
  app.action("pys_manage_tasks", async ({ ack, action, body, client }) => {
    await ack();

    const cid = correlationId("tasks");

    if (action.type !== "button") {
      return;
    }

    const procesoId = action.value;

    if (!procesoId) {
      return;
    }

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

      const tareasProceso = tareas.filter(
        (tarea) => tarea.procesoId === procesoId,
      );

      if (tareasProceso.length === 0) {
        await client.chat.postMessage({
          channel: body.user.id,
          text: "No tienes tareas pendientes para este proceso.",
        });

        return;
      }

      const tareasConProceso = tareasProceso
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
        .sort((a, b) => a.ordenTarea - b.ordenTarea);

      // if (tareas.length === 0) {
      //   await client.chat.postMessage({
      //     channel: body.user.id,
      //     text: "No tienes tareas pendientes para gestionar.",
      //   });

      //   return;
      // }

      await client.views.open({
        trigger_id: body.trigger_id,

        view: buildManageTasksView(tareasConProceso, cid, maxTareasVista, 0),
      });

      logger.info(
        {
          cid,
          userId: body.user.id,
          tareas: Math.min(tareasConProceso.length, maxTareasVista),
          procesoId,
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
      procesoId?: string;
      page?: number;
    };

    const cid = metadata.cid ?? correlationId("tasks");

    const procesoId = metadata.procesoId;

    const page = metadata.page ?? 0;

    if (!procesoId) {
      await ack();
      return;
    }
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

      const tareasProceso = tareas.filter(
        (tarea) => tarea.procesoId === procesoId,
      );

      const start = page * maxTareasVista;

      const tareasVisibles = tareasProceso.slice(start, start + maxTareasVista);

      let completadas = 0;
      const resultados: CompleteTaskResult[] = [];

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

        const resultado = await completeTask(client, {
          procesoId: tarea.procesoId,
          taskId: tarea.taskId,
          usuarioId: body.user.id,
          comentario,
          cid,
        });

        resultados.push(resultado);
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
        const detalleTareas = resultados
          .map((resultado) => {
            const comentario = resultado.comentario
              ? `\nComentario: ${resultado.comentario}`
              : "";

            return (
              `• *Tarea:* ${resultado.tarea}\n` +
              `  Proceso: ${resultado.procesoId}` +
              comentario
            );
          })
          .join("\n\n");

        await client.chat.postMessage({
          channel: body.user.id,

          text:
            resultados.length === 1
              ? `Se completó 1 tarea correctamente.\n\n${detalleTareas}`
              : `Se completaron ${resultados.length} tareas correctamente.\n\n${detalleTareas}`,
        });

        const areasAutoAprobadas = resultados.filter(
          (resultado) => resultado.autoAprobacion,
        );
        if (areasAutoAprobadas.length > 0) {
          const areasUnicas = Array.from(
            new Map(
              areasAutoAprobadas.map((resultado) => [
                resultado.areaProcesoId,
                resultado,
              ]),
            ).values(),
          );

          const detalleAreas = areasUnicas
            .map(
              (resultado) =>
                `• *${resultado.areaNombre}* · ${resultado.procesoId}`,
            )
            .join("\n");

          await client.chat.postMessage({
            channel: body.user.id,

            text:
              "✅ *Área aprobada automáticamente*\n\n" +
              `${detalleAreas}\n\n` +
              "La aprobación fue automática porque eres el Responsable Funcional y el único Responsable Operativo del área.",
          });

          const procesoListo = resultados.find(
            (resultado) => resultado.listoParaCierre,
          );

          if (procesoListo) {
            await client.chat.postMessage({
              channel: body.user.id,
              text:
                "✅ *Todas las áreas del proceso están completas.*\n\n" +
                `*Proceso:* ${procesoListo.procesoId}\n` +
                "El Paz y Salvo quedó pendiente de cierre por Talento Humano.",
            });
          }
        }
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
