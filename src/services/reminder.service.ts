import type { KnownBlock } from "@slack/types";
import type { WebClient } from "@slack/web-api";

import { CLOSED_PROCESS_STATUSES, TASK_STATUS } from "../constants/status.js";

import { getProcesos } from "../repositories/procesos-read.repository.js";
import { getAllAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { getAllTareasProceso } from "../repositories/tareas-proceso-read.repository.js";

import { sendControlledNotification } from "./notification.service.js";
import { getPysAppHomeUrl } from "../utils/slack-links.js";
import { logger } from "../utils/logger.js";

type OperativeReminderTask = {
  procesoId: string;
  empleadoId: string;
  fechaLimite: string;
  tarea: string;
  estado: string;
};

type FunctionalReminderProcess = {
  procesoId: string;
  empleadoId: string;
  fechaLimite: string;

  requiereRevision: boolean;
  pendientesOperativos: number;
};

function todayBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dueLabel(fechaLimite: string, today: string): string {
  if (fechaLimite < today) {
    return "🔴 Vencido";
  }

  if (fechaLimite === today) {
    return "🟠 Vence hoy";
  }

  return `📅 Vence ${fechaLimite}`;
}

function isClosedProcess(estado: string): boolean {
  return CLOSED_PROCESS_STATUSES.some((status) => status === estado);
}

function isOperativeActionable(estado: string): boolean {
  return ![
    TASK_STATUS.COMPLETED,
    TASK_STATUS.NOT_APPLICABLE,
    TASK_STATUS.PENDING_APPROVAL,
  ].some((status) => status === estado);
}

function isPendingFunctionalReview(estado: string): boolean {
  return estado === TASK_STATUS.PENDING_APPROVAL;
}

export async function sendDailyReminders(
  client: WebClient,
  cid: string,
): Promise<{
  operativos: number;
  funcionales: number;
}> {
  /*
   * Una sola lectura por lista.
   */
  const [procesos, areas, tareas] = await Promise.all([
    getProcesos(client),
    getAllAreasProceso(client),
    getAllTareasProceso(client),
  ]);

  const today = todayBogota();

  const procesosActivos = procesos.filter(
    (proceso) => !isClosedProcess(proceso.estado),
  );

  const procesosActivosMap = new Map(
    procesosActivos.map((proceso) => [proceso.procesoId, proceso]),
  );

  /*
   * =====================================================
   * OPERATIVOS
   * =====================================================
   */

  const operativeMap = new Map<string, OperativeReminderTask[]>();

  for (const tarea of tareas) {
    const proceso = procesosActivosMap.get(tarea.procesoId);

    if (!proceso) {
      continue;
    }

    if (!isOperativeActionable(tarea.estado)) {
      continue;
    }

    const items = operativeMap.get(tarea.responsableOperativoId) ?? [];

    items.push({
      procesoId: tarea.procesoId,
      empleadoId: proceso.empleadoId,
      fechaLimite: proceso.fechaLimite,
      tarea: tarea.tarea,
      estado: tarea.estado,
    });

    operativeMap.set(tarea.responsableOperativoId, items);
  }

  /*
   * =====================================================
   * FUNCIONALES
   * =====================================================
   */

  const functionalMap = new Map<
    string,
    Map<string, FunctionalReminderProcess>
  >();

  for (const area of areas) {
    const proceso = procesosActivosMap.get(area.procesoId);

    if (!proceso) {
      continue;
    }

    const tareasArea = tareas.filter(
      (tarea) => tarea.areaProcesoId === area.areaProcesoId,
    );

    const requiereRevision = tareasArea.some((tarea) =>
      isPendingFunctionalReview(tarea.estado),
    );

    const pendientesOperativos = tareasArea.filter((tarea) =>
      isOperativeActionable(tarea.estado),
    ).length;

    /*
     * Si no requiere acción funcional
     * ni tiene operativos pendientes,
     * no aporta al recordatorio.
     */
    if (!requiereRevision && pendientesOperativos === 0) {
      continue;
    }

    let userProcesses = functionalMap.get(area.responsableFuncionalId);

    if (!userProcesses) {
      userProcesses = new Map();

      functionalMap.set(area.responsableFuncionalId, userProcesses);
    }

    const existing = userProcesses.get(area.procesoId);

    if (existing) {
      existing.requiereRevision = existing.requiereRevision || requiereRevision;

      existing.pendientesOperativos += pendientesOperativos;
    } else {
      userProcesses.set(area.procesoId, {
        procesoId: area.procesoId,
        empleadoId: proceso.empleadoId,
        fechaLimite: proceso.fechaLimite,
        requiereRevision,
        pendientesOperativos,
      });
    }
  }

  /*
   * =====================================================
   * ENVÍO OPERATIVOS
   * =====================================================
   */

  for (const [userId, userTasks] of operativeMap) {
    const grouped = new Map<string, OperativeReminderTask[]>();

    for (const task of userTasks) {
      const group = grouped.get(task.procesoId) ?? [];

      group.push(task);
      grouped.set(task.procesoId, group);
    }

    const blocks: KnownBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "⏰ *Recordatorio diario · Paz y Salvo*\n\n" +
            `Tienes *${userTasks.length} actividad(es) pendiente(s)* ` +
            `en *${grouped.size} proceso(s)*.`,
        },
      },
      {
        type: "divider",
      },
    ];

    for (const [procesoId, processTasks] of grouped) {
      const first = processTasks[0];
      if (!first) {
        continue;
      }

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*${procesoId}* · <@${first.empleadoId}>\n` +
            `${dueLabel(first.fechaLimite, today)}\n\n` +
            processTasks
              .map((task) => `• ${task.tarea} — ${task.estado}`)
              .join("\n"),
        },
      });
    }

    const appHomeUrl = getPysAppHomeUrl();

    if (appHomeUrl) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text:
              `Revisa <${appHomeUrl}|Paz y Salvo> ` +
              "para gestionar tus actividades.",
          },
        ],
      });
    }

    await sendControlledNotification(client, {
      cid,
      recipientUserId: userId,
      tipo: "Recordatorio diario",

      idempotencyKey: `DAILY_OPERATIVE:${today}:${userId}`,

      fechaProgramada: today,

      text:
        `Recordatorio Paz y Salvo: ` +
        `${userTasks.length} actividad(es) ` +
        `pendiente(s) en ${grouped.size} proceso(s).`,

      blocks,
    });
  }

  /*
   * =====================================================
   * ENVÍO FUNCIONALES
   * =====================================================
   */

  for (const [userId, processMap] of functionalMap) {
    const userProcesses = [...processMap.values()];

    const revisionCount = userProcesses.filter(
      (item) => item.requiereRevision,
    ).length;

    const waitingCount = userProcesses.filter(
      (item) => item.pendientesOperativos > 0,
    ).length;

    const blocks: KnownBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "📊 *Resumen diario · Paz y Salvo*\n\n" +
            `Tienes *${userProcesses.length} proceso(s) activo(s)* ` +
            "en tus áreas.\n\n" +
            `🟡 *${revisionCount}* requieren tu revisión\n` +
            `⏳ *${waitingCount}* tienen actividades pendientes de operativos`,
        },
      },
      {
        type: "divider",
      },
    ];

    for (const item of userProcesses) {
      const estados: string[] = [];

      if (item.requiereRevision) {
        estados.push("🟡 Requiere tu revisión");
      }

      if (item.pendientesOperativos > 0) {
        estados.push(
          `⏳ ${item.pendientesOperativos} actividad(es) operativa(s) pendiente(s)`,
        );
      }

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*${item.procesoId}* · <@${item.empleadoId}>\n` +
            `${dueLabel(item.fechaLimite, today)}\n` +
            estados.join("\n"),
        },
      });
    }

    const appHomeUrl = getPysAppHomeUrl();

    if (appHomeUrl) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text:
              `Revisa <${appHomeUrl}|Paz y Salvo> ` +
              "para gestionar tus áreas.",
          },
        ],
      });
    }

    await sendControlledNotification(client, {
      cid,
      recipientUserId: userId,
      tipo: "Recordatorio diario",

      idempotencyKey: `DAILY_FUNCTIONAL:${today}:${userId}`,

      fechaProgramada: today,

      text:
        `Resumen Paz y Salvo: ` +
        `${userProcesses.length} proceso(s), ` +
        `${revisionCount} requieren revisión y ` +
        `${waitingCount} esperan gestión operativa.`,

      blocks,
    });
  }

  logger.info(
    {
      cid,
      fecha: today,
      operativos: operativeMap.size,
      funcionales: functionalMap.size,
      action: "daily_reminders_completed",
    },
    "Recordatorios diarios procesados",
  );

  return {
    operativos: operativeMap.size,
    funcionales: functionalMap.size,
  };
}
