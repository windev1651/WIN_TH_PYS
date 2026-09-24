import type { WebClient } from "@slack/web-api";

import {
  CLOSED_PROCESS_STATUSES,
  PROCESS_STATUS,
  TASK_STATUS,
} from "../constants/status.js";
import { createAuditEvent } from "../repositories/auditoria.repository.js";
import { getAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { closeProcesoItem } from "../repositories/procesos.repository.js";
import { getTareasProceso } from "../repositories/tareas-proceso-read.repository.js";
import { eventId } from "../utils/entity-id.js";
import { logger } from "../utils/logger.js";
import { sendControlledNotification } from "./notification.service.js";

type CloseProcessInput = {
  procesoId: string;
  usuarioId: string;
  comentario?: string;
  cid: string;
};

export async function closeProcess(
  client: WebClient,
  input: CloseProcessInput,
) {
  const [procesos, areas, tareas] = await Promise.all([
    getProcesos(client, { bypassCache: true }),
    getAreasProceso(client, input.procesoId, { bypassCache: true }),
    getTareasProceso(client, input.procesoId, { bypassCache: true }),
  ]);

  const proceso = procesos.find((item) => item.procesoId === input.procesoId);

  if (!proceso) {
    throw new Error(`Proceso no encontrado: ${input.procesoId}`);
  }

  /*
   * Idempotencia para cualquier estado cerrado.
   */
  if (CLOSED_PROCESS_STATUSES.some((status) => status === proceso.estado)) {
    return {
      procesoId: proceso.procesoId,
      empleadoId: proceso.empleadoId,
      alreadyClosed: true,
      cierreExcepcion:
        proceso.estado === PROCESS_STATUS.COMPLETED_WITH_EXCEPTION,
      destinatariosNotificados: 0,
    };
  }

  if (areas.length === 0) {
    throw new Error(`El proceso ${input.procesoId} no tiene áreas`);
  }

  const areasPendientes = areas.filter((area) => area.estado !== "Completada");

  const cierreNormal =
    proceso.estado === PROCESS_STATUS.PENDING_APPROVAL &&
    areasPendientes.length === 0;

  const cierreExcepcion = !cierreNormal;
  const comentario = input.comentario?.trim() ?? "";

  if (cierreExcepcion && !comentario) {
    throw new Error("El motivo del cierre con excepción es obligatorio");
  }

  await closeProcesoItem(
    client,
    proceso.slackItemId,
    input.usuarioId,
    comentario,
    cierreExcepcion,
  );

  const estadoFinal = cierreExcepcion
    ? PROCESS_STATUS.COMPLETED_WITH_EXCEPTION
    : PROCESS_STATUS.COMPLETED;

  await createAuditEvent(client, {
    eventId: eventId(),
    correlationId: input.cid,
    procesoId: proceso.procesoId,
    entidadTipo: "Proceso",
    entidadId: proceso.procesoId,
    accion: cierreExcepcion ? "CERRAR_PROCESO_EXCEPCION" : "CERRAR_PROCESO",
    usuarioId: input.usuarioId,
    fechaHoraUtc: new Date().toISOString(),
    estadoAnterior: proceso.estado,
    estadoNuevo: estadoFinal,
    detalle: cierreExcepcion
      ? comentario
      : comentario || "Proceso cerrado por Talento Humano",
  });

  let destinatariosNotificados = 0;

  if (cierreExcepcion) {
    const areasById = new Map(areas.map((area) => [area.areaProcesoId, area]));

    const tareasPendientes = tareas.filter(
      (tarea) =>
        ![TASK_STATUS.COMPLETED, TASK_STATUS.NOT_APPLICABLE].some(
          (status) => status === tarea.estado,
        ),
    );

    const responsabilidades = new Map<
      string,
      { operativas: string[]; funcionales: string[] }
    >();

    for (const tarea of tareasPendientes) {
      const area = areasById.get(tarea.areaProcesoId);

      const operativo = responsabilidades.get(tarea.responsableOperativoId) ?? {
        operativas: [],
        funcionales: [],
      };

      operativo.operativas.push(
        area ? `${area.areaNombre} — ${tarea.tarea}` : tarea.tarea,
      );

      responsabilidades.set(tarea.responsableOperativoId, operativo);

      if (area) {
        const funcional = responsabilidades.get(
          area.responsableFuncionalId,
        ) ?? {
          operativas: [],
          funcionales: [],
        };

        if (!funcional.funcionales.includes(area.areaNombre)) {
          funcional.funcionales.push(area.areaNombre);
        }

        responsabilidades.set(area.responsableFuncionalId, funcional);
      }
    }

    /*
     * Si un área sigue pendiente pero no tiene tareas computables pendientes
     * (caso de inconsistencia), el Responsable Funcional también debe conocer
     * que TH cerró el proceso con excepción.
     */
    for (const area of areasPendientes) {
      const funcional = responsabilidades.get(area.responsableFuncionalId) ?? {
        operativas: [],
        funcionales: [],
      };

      if (!funcional.funcionales.includes(area.areaNombre)) {
        funcional.funcionales.push(area.areaNombre);
      }

      responsabilidades.set(area.responsableFuncionalId, funcional);
    }

    for (const [userId, pendientes] of responsabilidades) {
      const secciones: string[] = [];

      if (pendientes.operativas.length > 0) {
        secciones.push(
          "*Actividades que quedaron pendientes:*\n" +
            pendientes.operativas.map((item) => `• ${item}`).join("\n"),
        );
      }

      if (pendientes.funcionales.length > 0) {
        secciones.push(
          "*Áreas bajo tu responsabilidad funcional afectadas:*\n" +
            pendientes.funcionales.map((item) => `• ${item}`).join("\n"),
        );
      }

      const text =
        "⚠️ *Paz y Salvo finalizado con excepción*\n\n" +
        `*Proceso:* ${proceso.procesoId}\n` +
        `*Empleado:* <@${proceso.empleadoId}>\n` +
        `*Comentario de cierre de Talento Humano:* ${comentario}\n\n` +
        secciones.join("\n\n");

      try {
        await sendControlledNotification(client, {
          cid: input.cid,
          recipientUserId: userId,
          tipo: "Cierre excepcional",
          idempotencyKey: `EXCEPTION_CLOSE:${proceso.procesoId}:${userId}`,
          procesoId: proceso.procesoId,
          text,
        });

        destinatariosNotificados += 1;
      } catch (err) {
        /*
         * El cierre ya fue persistido. Una falla de notificación no debe
         * convertir un cierre correcto en una operación fallida.
         */
        logger.warn(
          {
            cid: input.cid,
            procesoId: proceso.procesoId,
            recipientUserId: userId,
            err,
            action: "exception_close_notification_failed",
          },
          "Proceso cerrado con excepción pero falló una notificación",
        );
      }
    }
  }

  return {
    procesoId: proceso.procesoId,
    empleadoId: proceso.empleadoId,
    alreadyClosed: false,
    cierreExcepcion,
    destinatariosNotificados,
  };
}
