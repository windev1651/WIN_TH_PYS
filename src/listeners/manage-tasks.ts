import type { App } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";

import { getTareasUsuario } from "../repositories/tareas-proceso-read.repository.js";
import {
  completeTask,
  CompleteTaskResult,
} from "../services/task-management.service.js";
import { correlationId, logger } from "../utils/logger.js";
import {
  buildManageTasksView,
  buildLoadingManageTasksView,
} from "../views/manage-tasks.view.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { getMaxTareasVista } from "../services/runtime-config.service.js";
import { registerEvidence } from "../services/evidence-management.service.js";
import { publishHome } from "../services/home-publish.service.js";

import {
  releaseOperationLock,
  tryAcquireOperationLock,
} from "../services/interaction-lock.service.js";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  return "Ocurrió un error inesperado.";
}

function buildManageTasksErrorView(
  procesoId: string,
  cid: string,
  errorMessage: string,
) {
  return {
    type: "modal" as const,

    callback_id: "pys_manage_tasks_error",

    private_metadata: JSON.stringify({
      procesoId,
      cid,
    }),

    title: {
      type: "plain_text" as const,
      text: "Gestionar tareas",
    },

    close: {
      type: "plain_text" as const,
      text: "Cerrar",
    },

    blocks: [
      {
        type: "section" as const,

        text: {
          type: "mrkdwn" as const,

          text:
            "⚠️ *No fue posible guardar todos los cambios.*\n\n" +
            `${errorMessage}\n\n` +
            `Referencia: \`${cid}\``,
        },
      },
    ],
  };
}

function buildManageTasksSuccessView(
  procesoId: string,
  cid: string,
  completadas: number,
  evidenciasRegistradas: number,
) {
  const resultados: string[] = [];

  if (completadas > 0) {
    resultados.push(`• Tareas gestionadas: *${completadas}*`);
  }

  if (evidenciasRegistradas > 0) {
    resultados.push(`• Evidencias registradas: *${evidenciasRegistradas}*`);
  }

  if (resultados.length === 0) {
    resultados.push("• No se seleccionaron cambios para guardar.");
  }

  return {
    type: "modal" as const,
    callback_id: "pys_manage_tasks_success",
    notify_on_close: true,
    private_metadata: JSON.stringify({
      procesoId,
      cid,
    }),
    title: {
      type: "plain_text" as const,
      text: "Gestionar tareas",
    },
    close: {
      type: "plain_text" as const,
      text: "Cerrar",
    },
    blocks: [
      {
        type: "section" as const,

        text: {
          type: "mrkdwn" as const,

          text:
            "✅ *Cambios guardados correctamente*\n\n" + resultados.join("\n"),
        },
      },
    ],
  };
}

function buildManageTasksProcessingView(procesoId: string, cid: string) {
  return {
    type: "modal" as const,

    callback_id: "pys_manage_tasks_processing",

    private_metadata: JSON.stringify({
      procesoId,
      cid,
    }),

    title: {
      type: "plain_text" as const,
      text: "Gestionar tareas",
    },

    blocks: [
      {
        type: "section" as const,

        text: {
          type: "mrkdwn" as const,

          text:
            "⏳ *Guardando cambios...*\n\n" +
            "Estamos actualizando tus tareas. " +
            "Espera hasta que termine el proceso.",
        },
      },
    ],
  };
}

export function registerManageTasksListeners(app: App): void {
  app.action("pys_manage_tasks", async ({ ack, action, body, client }) => {
    await ack();

    const cid = correlationId("tasks");

    if (action.type !== "button") {
      return;
    }

    const procesoId = action.value;

    if (!procesoId) {
      logger.error(
        {
          cid,
          userId: body.user.id,
          action: "manage_tasks_missing_process_id",
        },
        "La gestión de tareas no recibió procesoId",
      );

      return;
    }

    if (!("trigger_id" in body)) {
      logger.error(
        {
          cid,
          procesoId,
          userId: body.user.id,
          action: "open_manage_tasks",
        },
        "Interacción sin trigger_id",
      );

      return;
    }

    let openedViewId: string | undefined;

    try {
      /*
       * Abrimos inmediatamente.
       */
      const openResult = await client.views.open({
        trigger_id: body.trigger_id,

        view: buildLoadingManageTasksView(cid),
      });

      openedViewId = openResult.view?.id;

      if (!openedViewId) {
        throw new Error(
          "Slack no retornó el ID del modal de gestión de tareas",
        );
      }

      /*
       * Ahora hacemos las lecturas.
       */
      const [tareas, procesos, maxTareasVista] = await Promise.all([
        getTareasUsuario(client, body.user.id),

        getProcesos(client),

        getMaxTareasVista(client),
      ]);

      /*
       * IMPORTANTE:
       * solo tareas del proceso
       * seleccionado.
       */
      const tareasProceso = tareas.filter(
        (tarea) => tarea.procesoId === procesoId,
      );

      const proceso = procesos.find((item) => item.procesoId === procesoId);

      if (!proceso) {
        throw new Error(`Proceso no encontrado: ${procesoId}`);
      }

      const tareasConProceso = tareasProceso
        .map((tarea) => ({
          ...tarea,

          empleadoId: proceso.empleadoId,

          fechaLimiteProceso: proceso.fechaLimite,
        }))
        .sort((a, b) => a.ordenTarea - b.ordenTarea);

      if (tareasConProceso.length === 0) {
        await client.views.update({
          view_id: openedViewId,

          view: {
            type: "modal",

            callback_id: "pys_manage_tasks_empty",

            title: {
              type: "plain_text",
              text: "Gestionar tareas",
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

                  text: `✅ No tienes tareas pendientes para gestionar en el proceso *${procesoId}*.`,
                },
              },
            ],
          },
        });

        return;
      }

      const initialPage = 0;

      await client.views.update({
        view_id: openedViewId,

        view: buildManageTasksView(
          tareasConProceso,
          cid,
          maxTareasVista,
          initialPage,
        ),
      });

      logger.info(
        {
          cid,
          procesoId,

          userId: body.user.id,

          tareas: Math.min(tareasConProceso.length, maxTareasVista),

          action: "manage_tasks_opened",
        },
        "Modal de gestión de tareas abierto",
      );
    } catch (err) {
      // Mantén aquí exactamente
      // el catch que ya tienes.
    }
  });

  /*
   * El checkbox genera una interacción
   * Block Kit al marcarse/desmarcarse.
   *
   * No actualizamos nada todavía:
   * solamente confirmamos la interacción.
   * El estado se procesará al pulsar
   * "Guardar cambios".
   */
  app.action("pys_task_complete_checkbox", async ({ ack }) => {
    await ack();
  });

  app.view("pys_manage_tasks_submit", async ({ ack, body, view, client }) => {
    const metadata = JSON.parse(view.private_metadata || "{}") as {
      cid?: string;
      procesoId?: string;
      page?: number;
    };

    // console.log("PRIVATE METADATA", metadata);

    const cid = metadata.cid ?? correlationId("tasks");
    const procesoId = metadata.procesoId;
    const page = metadata.page ?? 0;

    if (!procesoId) {
      await ack();
      return;
    }

    //
    /*
     * Validación inmediata del formulario.
     *
     * Solo utilizamos el state recibido desde Slack.
     * No hacemos llamadas API antes del ACK.
     */
    const validationErrors: Record<string, string> = {};

    for (const [blockId, blockState] of Object.entries(view.state.values)) {
      if (!blockId.startsWith("comment_")) {
        continue;
      }

      const taskId = blockId.replace("comment_", "");

      const comentario = blockState.comment?.value?.trim() ?? "";

      const completeBlock = view.state.values[`complete_${taskId}`];
      const selectedOptions =
        completeBlock?.pys_task_complete_checkbox?.selected_options;

      const marcado =
        selectedOptions?.some((option) => option.value === "complete") ?? false;

      const evidenceBlock = view.state.values[`evidence_${taskId}`];
      const archivo = evidenceBlock?.evidence_file?.files?.[0];

      const tieneAccion = marcado || Boolean(archivo);

      if (tieneAccion && !comentario) {
        validationErrors[blockId] =
          "Debes ingresar un comentario para gestionar esta tarea.";

        continue;
      }

      if (comentario && !tieneAccion) {
        validationErrors[blockId] =
          "Ingresaste un comentario, pero no marcaste la tarea como realizada o no cargaste una evidencia.";
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      await ack({
        response_action: "errors",
        errors: validationErrors,
      });

      return;
    }
    //

    /*
     * ACK primero.
     * Las escrituras en Slack pueden tardar,
     * y no queremos exceder el timeout
     * de la interacción.
     */
    const lockKey = `manage-tasks:${body.user.id}:${procesoId}`;

    const lockAcquired = tryAcquireOperationLock(lockKey, body.user.id);

    if (!lockAcquired) {
      await ack({
        response_action: "errors",
        errors: {},
      });

      logger.info(
        {
          cid,
          procesoId,
          userId: body.user.id,
          action: "manage_tasks_ignored_user_busy",
        },
        "Gestión de tareas ignorada porque el usuario tiene una operación en curso",
      );

      return;
    }

    await ack({
      response_action: "update",
      view: buildManageTasksProcessingView(procesoId, cid),
    });

    let evidenceErrorContext:
      | {
          procesoId: string;
          tarea: string;
          nombreArchivo: string;
        }
      | undefined;

    let completadas = 0;
    let evidenciasRegistradas = 0;

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

      const tareasProceso = tareas
        .filter((tarea) => tarea.procesoId === procesoId)
        .sort((a, b) => a.ordenTarea - b.ordenTarea);

      const start = page * maxTareasVista;
      const tareasVisibles = tareasProceso.slice(start, start + maxTareasVista);
      const resultados: CompleteTaskResult[] = [];

      const evidenciasDetalle: Array<{
        procesoId: string;
        tarea: string;
        nombreArchivo: string;
      }> = [];

      for (const tarea of tareasVisibles) {
        // console.log("PROCESANDO TAREA", {
        //   taskId: tarea.taskId,
        //   tarea: tarea.tarea,
        //   requiereEvidencia: tarea.requiereEvidencia,
        // });

        const completeBlock = view.state.values[`complete_${tarea.taskId}`];
        const commentBlock = view.state.values[`comment_${tarea.taskId}`];

        // console.log(
        //   "EVIDENCE BLOCK",
        //   tarea.taskId,
        //   JSON.stringify(evidenceBlock, null, 2),
        // );

        // if (tarea.requiereEvidencia) {
        //   logger.info(
        //     {
        //       cid,
        //       procesoId: tarea.procesoId,
        //       taskId: tarea.taskId,
        //       evidenceState: evidenceBlock,
        //     },
        //     "Estado recibido para evidencia",
        //   );
        // }

        const selectedOptions =
          completeBlock?.pys_task_complete_checkbox?.selected_options;
        const shouldComplete =
          selectedOptions?.some((option) => option.value === "complete") ??
          false;

        const comentario = commentBlock?.comment?.value ?? "";
        const evidenceBlock = view.state.values[`evidence_${tarea.taskId}`];

        const files = evidenceBlock?.evidence_file?.files;

        const archivo = files?.[0];

        const requiereComentario = shouldComplete || Boolean(archivo);

        if (requiereComentario && !comentario) {
          throw new Error(
            `Debes ingresar un comentario para la tarea "${tarea.tarea}"`,
          );
        }

        if (tarea.requiereEvidencia) {
          const evidenceBlock = view.state.values[`evidence_${tarea.taskId}`];
          const files = evidenceBlock?.evidence_file?.files;
          const archivo = files?.[0];

          if (!archivo) {
            continue;
          }
          if (!comentario) {
            throw new Error(
              `Debes ingresar un comentario para la tarea "${tarea.tarea}"`,
            );
          }

          evidenceErrorContext = {
            procesoId: tarea.procesoId,
            tarea: tarea.tarea,
            nombreArchivo: archivo.name ?? archivo.id,
          };

          const evidenceId = await registerEvidence(client, {
            procesoId: tarea.procesoId,
            taskId: tarea.taskId,
            usuarioId: body.user.id,
            archivo,
            comentario,
            cid,
          });

          evidenciasDetalle.push({
            procesoId: tarea.procesoId,
            tarea: tarea.tarea,
            nombreArchivo: archivo.name ?? archivo.id,
          });

          evidenciasRegistradas += 1;

          logger.info(
            {
              cid,
              procesoId: tarea.procesoId,
              taskId: tarea.taskId,
              evidenceId: evidenceId.evidenceId,
              slackFileId: archivo.id,
              action: "task_evidence_registered",
            },
            "Evidencia registrada",
          );

          continue;
        }

        /*
         * Flujo existente para tareas
         * sin evidencia.
         */
        if (!shouldComplete) {
          continue;
        }
        if (!comentario) {
          throw new Error(
            `Debes ingresar un comentario para la tarea "${tarea.tarea}"`,
          );
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

      /*
       * Evidencias registradas.
       */
      if (evidenciasRegistradas > 0) {
        const detalle = evidenciasDetalle
          .map(
            (item) =>
              `• *Proceso:* ${item.procesoId}\n` +
              `  *Tarea:* ${item.tarea}\n` +
              `  *Evidencia:* ${item.nombreArchivo}`,
          )
          .join("\n\n");

        await client.chat.postMessage({
          channel: body.user.id,

          text:
            evidenciasRegistradas === 1
              ? "📎 *Evidencia registrada correctamente*\n\n" +
                `${detalle}\n\n` +
                "Quedó pendiente de revisión por el Responsable Funcional."
              : `📎 *${evidenciasRegistradas} evidencias registradas correctamente*\n\n` +
                `${detalle}\n\n` +
                "Quedaron pendientes de revisión por los Responsables Funcionales.",
        });
      }

      /*
       * Tareas completadas sin evidencia.
       */
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
      }

      /*
       * No se hizo absolutamente nada.
       */
      if (completadas === 0 && evidenciasRegistradas === 0) {
        await client.chat.postMessage({
          channel: body.user.id,

          text: "No se seleccionaron tareas para completar ni se cargaron evidencias.",
        });
      }

      try {
        await client.views.update({
          view_id: view.id,

          view: buildManageTasksSuccessView(
            procesoId,
            cid,
            completadas,
            evidenciasRegistradas,
          ),
        });
      } catch (uiErr) {
        logger.warn(
          {
            cid,
            procesoId,
            userId: body.user.id,
            err: uiErr,
            action: "manage_tasks_success_view_failed",
          },
          "Cambios guardados, pero no fue posible actualizar el modal",
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Ocurrió un error inesperado.";

      try {
        await client.views.update({
          view_id: view.id,

          view: buildManageTasksErrorView(procesoId, cid, errorMessage),
        });
      } catch (uiErr) {
        logger.warn(
          {
            cid,
            procesoId,
            userId: body.user.id,
            err: uiErr,
            action: "manage_tasks_error_view_failed",
          },
          "No fue posible mostrar la vista de error de gestión de tareas",
        );
      }

      logger.error(
        {
          cid,
          userId: body.user.id,
          err,
          action: "manage_tasks_save_failed",
        },
        "Error guardando cambios de tareas",
      );

      if (evidenceErrorContext) {
        await client.chat.postMessage({
          channel: body.user.id,

          text:
            "⚠️ *No fue posible procesar la evidencia*\n\n" +
            `*Proceso:* ${evidenceErrorContext.procesoId}\n` +
            `*Tarea:* ${evidenceErrorContext.tarea}\n` +
            `*Archivo:* ${evidenceErrorContext.nombreArchivo}\n` +
            `*Motivo:* ${errorMessage}\n\n` +
            `Referencia: \`${cid}\``,
        });

        return;
      }

      await client.chat.postMessage({
        channel: body.user.id,

        text:
          "⚠️ No fue posible guardar los cambios.\n\n" +
          `*Motivo:* ${errorMessage}\n` +
          `Referencia: \`${cid}\``,
      });
    } finally {
      releaseOperationLock(lockKey, body.user.id);
    }
  });

  app.view(
    { callback_id: "pys_manage_tasks_success", type: "view_closed" },
    async ({ body, client }) => {
      const cid = correlationId("tasks-close");

      try {
        await publishHome(client, body.user.id);

        logger.info(
          {
            cid,
            userId: body.user.id,
            action: "manage_tasks_closed_home_refreshed",
          },
          "Home actualizado al cerrar gestión de tareas",
        );
      } catch (err) {
        logger.warn(
          {
            cid,
            userId: body.user.id,
            err,
            action: "manage_tasks_closed_home_refresh_failed",
          },
          "No fue posible actualizar Home al cerrar gestión de tareas",
        );
      }
    },
  );
}
