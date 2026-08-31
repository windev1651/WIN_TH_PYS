import type { WebClient } from "@slack/web-api";

import { getAllAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { getAllTareasProceso } from "../repositories/tareas-proceso-read.repository.js";
import { logger } from "../utils/logger.js";

export type InactiveResponsibleAssignment =
  | {
      tipo: "Tarea";
      procesoId: string;
      taskId: string;
      nombre: string;
    }
  | {
      tipo: "Area";
      procesoId: string;
      areaProcesoId: string;
      nombre: string;
    };

export type InactiveResponsibleIssue = {
  userId: string;
  asignaciones: InactiveResponsibleAssignment[];
};

const CLOSED_PROCESS_STATES = new Set([
  "Finalizado",
  "Finalizado con excepción",
  "Cancelado",
]);

const CLOSED_TASK_STATES = new Set(["Completada", "No aplica"]);

const CLOSED_AREA_STATES = new Set(["Completada"]);

export async function findInactiveResponsibles(
  client: WebClient,
  cid: string,
): Promise<InactiveResponsibleIssue[]> {
  /*
   * Una única lectura de las tres fuentes
   * transaccionales necesarias.
   */
  const [procesos, areas, tareas] = await Promise.all([
    getProcesos(client),
    getAllAreasProceso(client),
    getAllTareasProceso(client),
  ]);

  /*
   * Trabajamos exclusivamente con
   * procesos todavía activos.
   */
  const procesosActivosIds = new Set(
    procesos
      .filter((proceso) => !CLOSED_PROCESS_STATES.has(proceso.estado))
      .map((proceso) => proceso.procesoId),
  );

  /*
   * userId -> responsabilidades
   *
   * Agrupamos primero, para luego consultar
   * users.info UNA sola vez por usuario.
   */
  const assignmentsByUser = new Map<string, InactiveResponsibleAssignment[]>();

  for (const tarea of tareas) {
    if (!procesosActivosIds.has(tarea.procesoId)) {
      continue;
    }

    if (CLOSED_TASK_STATES.has(tarea.estado)) {
      continue;
    }

    const userId = tarea.responsableOperativoId;

    if (!userId) {
      continue;
    }

    const asignaciones = assignmentsByUser.get(userId) ?? [];

    asignaciones.push({
      tipo: "Tarea",
      procesoId: tarea.procesoId,
      taskId: tarea.taskId,
      nombre: tarea.tarea,
    });

    assignmentsByUser.set(userId, asignaciones);
  }

  for (const area of areas) {
    if (!procesosActivosIds.has(area.procesoId)) {
      continue;
    }

    if (CLOSED_AREA_STATES.has(area.estado)) {
      continue;
    }

    const userId = area.responsableFuncionalId;

    if (!userId) {
      continue;
    }

    const asignaciones = assignmentsByUser.get(userId) ?? [];

    asignaciones.push({
      tipo: "Area",
      procesoId: area.procesoId,
      areaProcesoId: area.areaProcesoId,
      nombre: area.areaNombre,
    });

    assignmentsByUser.set(userId, asignaciones);
  }

  const issues: InactiveResponsibleIssue[] = [];

  /*
   * Importante:
   *
   * No usamos Promise.all aquí de forma
   * deliberada. Preferimos users.info
   * secuencial para no generar un burst
   * adicional contra Slack.
   *
   * assignmentsByUser ya eliminó todos
   * los usuarios duplicados.
   */
  for (const [userId, asignaciones] of assignmentsByUser) {
    try {
      const response = await client.users.info({
        user: userId,
      });

      /*
       * En Slack, una cuenta desactivada
       * aparece como deleted = true.
       */
      if (response.user?.deleted === true) {
        issues.push({
          userId,
          asignaciones,
        });
      }
    } catch (err) {
      /*
       * Un fallo consultando un usuario
       * no debe abortar toda la revisión.
       */
      logger.error(
        {
          cid,
          userId,
          err,
          action: "inactive_responsible_user_check_failed",
        },
        "No fue posible validar el estado de un responsable en Slack",
      );
    }
  }

  logger.info(
    {
      cid,

      procesosActivos: procesosActivosIds.size,

      responsablesEvaluados: assignmentsByUser.size,

      responsablesInactivos: issues.length,

      action: "inactive_responsibles_checked",
    },
    "Validación de responsables inactivos completada",
  );

  return issues;
}
