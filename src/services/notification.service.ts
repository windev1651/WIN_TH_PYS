import type { KnownBlock } from "@slack/types";
import type { WebClient } from "@slack/web-api";

import { logger } from "../utils/logger.js";
import { getCanalNotificacionesTH } from "./runtime-config.service.js";
import type { InactiveResponsibleIssue } from "./inactive-responsibles.service.js";

import {
  getModoNotificaciones,
  getNotificacionesTestChannel,
} from "./runtime-config.service.js";

import {
  createNotification,
  markNotificationError,
  markNotificationSent,
  notificationAlreadySent,
} from "../repositories/notificaciones.repository.js";

import { getProcessDetail } from "../services/process-detail.service.js";
import { getPysAppHomeUrl } from "../utils/slack-links.js";
import { notiticationId } from "../utils/entity-id.js";

type NotifyInactiveResponsiblesInput = {
  cid: string;
  issues: InactiveResponsibleIssue[];
};

type NotifyProcessCreatedInput = {
  cid: string;
  procesoId: string;
  createdByUserId: string;
  directMessage: string;
  channelMessage: string;
};

type NotifyTaskReassignedInput = {
  cid: string;
  procesoId: string;
  taskId: string;
  tarea: string;

  responsableAnteriorId: string;
  responsableNuevoId: string;
  responsableFuncionalId: string;

  ejecutadoPorId: string;
  motivo: string;
};

type NotifyFunctionalReassignedInput = {
  cid: string;
  procesoId: string;
  areaProcesoId: string;
  areaNombre: string;

  responsableAnteriorId: string;
  responsableNuevoId: string;

  ejecutadoPorId: string;
  motivo: string;
};

type NotifyMasterResponsibleChangedInput = {
  cid: string;

  tipo: "operativo" | "funcional";

  responsableAnteriorId: string;
  nuevoResponsableId: string;

  ejecutadoPorId: string;
  motivo: string;

  responsabilidades: Array<{
    areaNombre: string;
    tarea?: string;
  }>;
};

type ControlledNotificationInput = {
  cid: string;

  recipientUserId: string;

  tipo:
    | "Inicial"
    | "Recordatorio diario"
    | "Vencido"
    | "Reasignación"
    | "Evidencia"
    | "Rechazada"
    | "Cierre excepcional"
    | "Resumen TH";

  idempotencyKey: string;

  procesoId?: string;
  areaProcesoId?: string;
  taskId?: string;

  fechaProgramada?: string;

  text: string;
  blocks?: KnownBlock[];
};

type InitialAssignment = {
  operativo: Array<{
    tarea: string;
    areaNombre: string;
    requiereEvidencia: boolean;
  }>;

  funcional: Array<{
    areaProcesoId: string;
    areaNombre: string;
    tareas: number;
  }>;
};

export async function notifyInitialProcessAssignments(
  client: WebClient,
  input: {
    cid: string;
    procesoId: string;
  },
): Promise<void> {
  const detail = await getProcessDetail(client, input.procesoId);

  const assignments = new Map<string, InitialAssignment>();

  for (const area of detail.areas) {
    /*
     * Responsable funcional.
     */
    const functional = assignments.get(area.responsableFuncionalId) ?? {
      operativo: [],
      funcional: [],
    };

    functional.funcional.push({
      areaProcesoId: area.areaProcesoId,
      areaNombre: area.areaNombre,
      tareas: area.tareas.length,
    });

    assignments.set(area.responsableFuncionalId, functional);

    /*
     * Responsables operativos.
     */
    for (const tarea of area.tareas) {
      const operative = assignments.get(tarea.responsableOperativoId) ?? {
        operativo: [],
        funcional: [],
      };

      operative.operativo.push({
        tarea: tarea.tarea,
        areaNombre: area.areaNombre,
        requiereEvidencia: tarea.requiereEvidencia,
      });

      assignments.set(tarea.responsableOperativoId, operative);
    }
  }

  for (const [userId, assignment] of assignments) {
    const sections: string[] = [];

    if (assignment.operativo.length > 0) {
      const tareas = assignment.operativo
        .map((item) => {
          const evidencia = item.requiereEvidencia
            ? " · requiere evidencia"
            : "";

          return `• *${item.tarea}*` + ` — ${item.areaNombre}` + evidencia;
        })
        .join("\n");

      sections.push(
        `*Tus actividades asignadas (${assignment.operativo.length}):*\n` +
          tareas,
      );
    }

    if (assignment.funcional.length > 0) {
      const areas = assignment.funcional
        .map((item) => `• *${item.areaNombre}*` + ` — ${item.tareas} tarea(s)`)
        .join("\n");

      sections.push(
        `*Áreas bajo tu responsabilidad funcional (${assignment.funcional.length}):*\n` +
          areas,
      );
    }

    const appHomeUrl = getPysAppHomeUrl();
    if (!appHomeUrl) {
      logger.warn(
        {
          cid: input.cid,
          procesoId: detail.procesoId,
          action: "app_home_link_missing",
        },
        "SLACK_TEAM_ID o SLACK_APP_ID no están configurados",
      );
    }

    const appHomeText = appHomeUrl
      ? `Revisa la app <${appHomeUrl}|Paz y Salvo> para gestionar tus responsabilidades.`
      : "Revisa la app *Paz y Salvo* para gestionar tus responsabilidades.";

    const text =
      "📋 *Nuevo Paz y Salvo asignado*\n\n" +
      `*Proceso:* ${detail.procesoId}\n` +
      `*Empleado:* <@${detail.empleadoId}>\n` +
      `*Fecha límite:* ${detail.fechaLimite}\n\n` +
      sections.join("\n\n") +
      "\n\n" +
      appHomeText;

    const blocks: KnownBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "📋 *Nuevo Paz y Salvo asignado*\n\n" +
            `*Proceso:* ${detail.procesoId}\n` +
            `*Empleado:* <@${detail.empleadoId}>\n` +
            `*Fecha límite:* ${detail.fechaLimite}`,
        },
      },
      {
        type: "divider",
      },
    ];

    if (assignment.operativo.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*Tus actividades asignadas (${assignment.operativo.length}):*\n` +
            assignment.operativo
              .map((item) => {
                const evidencia = item.requiereEvidencia
                  ? " · requiere evidencia"
                  : "";

                return (
                  `• *${item.tarea}*` + ` — ${item.areaNombre}` + evidencia
                );
              })
              .join("\n"),
        },
      });
    }

    if (assignment.funcional.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*Áreas bajo tu responsabilidad funcional (${assignment.funcional.length}):*\n` +
            assignment.funcional
              .map(
                (item) =>
                  `• *${item.areaNombre}*` + ` — ${item.tareas} tarea(s)`,
              )
              .join("\n"),
        },
      });
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: appHomeText,
        },
      ],
    });

    await sendControlledNotification(client, {
      cid: input.cid,

      recipientUserId: userId,

      tipo: "Inicial",

      idempotencyKey: `INITIAL:${detail.procesoId}:${userId}`,

      procesoId: detail.procesoId,

      text,
      blocks,
    });
  }

  logger.info(
    {
      cid: input.cid,
      procesoId: detail.procesoId,
      destinatarios: assignments.size,
      action: "initial_process_notifications_completed",
    },
    "Notificaciones iniciales de Paz y Salvo procesadas",
  );
}

export async function notifyMasterResponsibleChanged(
  client: WebClient,
  input: NotifyMasterResponsibleChangedInput,
): Promise<void> {
  const canalTH = await getCanalNotificacionesTH(client);

  if (!canalTH) {
    logger.warn(
      {
        cid: input.cid,

        action: "master_responsible_change_channel_missing",
      },
      "CanalNotificacionesTH no está configurado",
    );

    return;
  }

  const tipoTexto =
    input.tipo === "operativo"
      ? "Responsable Operativo"
      : "Responsable Funcional";

  const detalle = input.responsabilidades
    .map((item) => {
      if (input.tipo === "operativo" && item.tarea) {
        return `• *${item.areaNombre}* — ` + `${item.tarea}`;
      }

      return `• *${item.areaNombre}*`;
    })
    .join("\n");

  const text =
    "🔄 *Cambio permanente de responsable*\n\n" +
    `*Tipo:* ${tipoTexto}\n` +
    `*Responsable anterior:* <@${input.responsableAnteriorId}>\n` +
    `*Nuevo responsable:* <@${input.nuevoResponsableId}>\n` +
    `*Modificado por:* <@${input.ejecutadoPorId}>\n` +
    `*Motivo:* ${input.motivo}\n\n` +
    `*Responsabilidades modificadas (${input.responsabilidades.length}):*\n` +
    detalle +
    "\n\n" +
    "_Este cambio aplica a la configuración maestra y afectará únicamente los nuevos procesos de Paz y Salvo._";

  try {
    await client.chat.postMessage({
      channel: canalTH,

      text,
    });

    logger.info(
      {
        cid: input.cid,

        tipo: input.tipo,

        responsableAnteriorId: input.responsableAnteriorId,

        nuevoResponsableId: input.nuevoResponsableId,

        responsabilidades: input.responsabilidades.length,

        action: "master_responsible_change_channel_sent",
      },
      "Cambio permanente de responsable publicado en canal TH",
    );
  } catch (err) {
    logger.error(
      {
        cid: input.cid,

        err,

        action: "master_responsible_change_channel_failed",
      },
      "No fue posible publicar el cambio permanente de responsable",
    );
  }
}

export async function notifyProcessCreated(
  client: WebClient,
  input: NotifyProcessCreatedInput,
): Promise<void> {
  /*
   * Confirmación personal al creador.
   */
  await client.chat.postMessage({
    channel: input.createdByUserId,
    text: input.directMessage,
  });

  /*
   * Notificación compartida a TH.
   * Si falla, no debe invalidar la creación.
   */
  try {
    const canalNotificacionesTH = await getCanalNotificacionesTH(client);

    if (!canalNotificacionesTH) {
      logger.warn(
        {
          cid: input.cid,
          procesoId: input.procesoId,
          action: "th_notification_channel_missing",
        },
        "CanalNotificacionesTH no está configurado",
      );

      return;
    }

    await client.chat.postMessage({
      channel: canalNotificacionesTH,
      text: input.channelMessage,
    });

    logger.info(
      {
        cid: input.cid,
        procesoId: input.procesoId,
        canal: canalNotificacionesTH,
        action: "th_process_created_notification_sent",
      },
      "Notificación de creación publicada en canal TH",
    );
  } catch (err) {
    logger.error(
      {
        cid: input.cid,
        procesoId: input.procesoId,
        err,
        action: "th_process_created_notification_failed",
      },
      "No fue posible publicar la creación en el canal de TH",
    );
  }
}

export async function notifyTaskReassigned(
  client: WebClient,
  input: NotifyTaskReassignedInput,
): Promise<void> {
  const message =
    "🔄 *Tarea reasignada*\n\n" +
    `*Proceso:* ${input.procesoId}\n` +
    `*Tarea:* ${input.tarea}\n` +
    `*Responsable anterior:* <@${input.responsableAnteriorId}>\n` +
    `*Nuevo responsable:* <@${input.responsableNuevoId}>\n` +
    `*Motivo:* ${input.motivo}`;

  const recipients = new Set([
    input.responsableAnteriorId,
    input.responsableNuevoId,
    input.responsableFuncionalId,
  ]);

  for (const userId of recipients) {
    try {
      await client.chat.postMessage({
        channel: userId,
        text: message,
      });
    } catch (err) {
      logger.error(
        {
          cid: input.cid,
          procesoId: input.procesoId,
          taskId: input.taskId,
          userId,
          err,
          action: "task_reassignment_dm_failed",
        },
        "No fue posible enviar notificación de reasignación",
      );
    }
  }

  try {
    const canalTH = await getCanalNotificacionesTH(client);

    if (canalTH) {
      await client.chat.postMessage({
        channel: canalTH,

        text: message + "\n\n" + `*Reasignado por:* <@${input.ejecutadoPorId}>`,
      });
    }
  } catch (err) {
    logger.error(
      {
        cid: input.cid,
        procesoId: input.procesoId,
        taskId: input.taskId,
        err,
        action: "task_reassignment_channel_failed",
      },
      "No fue posible publicar reasignación en canal TH",
    );
  }
}

export async function notifyFunctionalReassigned(
  client: WebClient,
  input: NotifyFunctionalReassignedInput,
): Promise<void> {
  const message =
    "🔄 *Responsable funcional reasignado*\n\n" +
    `*Proceso:* ${input.procesoId}\n` +
    `*Área:* ${input.areaNombre}\n` +
    `*Responsable anterior:* <@${input.responsableAnteriorId}>\n` +
    `*Nuevo responsable:* <@${input.responsableNuevoId}>\n` +
    `*Motivo:* ${input.motivo}`;

  const recipients = new Set([
    input.responsableAnteriorId,
    input.responsableNuevoId,
  ]);

  for (const userId of recipients) {
    try {
      await client.chat.postMessage({
        channel: userId,
        text: message,
      });
    } catch (err) {
      logger.error(
        {
          cid: input.cid,
          procesoId: input.procesoId,
          areaProcesoId: input.areaProcesoId,
          userId,
          err,
          action: "functional_reassignment_dm_failed",
        },
        "No fue posible enviar DM de reasignación funcional",
      );
    }
  }

  try {
    const canalTH = await getCanalNotificacionesTH(client);

    if (canalTH) {
      await client.chat.postMessage({
        channel: canalTH,

        text: message + "\n\n" + `*Reasignado por:* <@${input.ejecutadoPorId}>`,
      });
    }
  } catch (err) {
    logger.error(
      {
        cid: input.cid,
        procesoId: input.procesoId,
        areaProcesoId: input.areaProcesoId,
        err,
        action: "functional_reassignment_channel_failed",
      },
      "No fue posible publicar reasignación funcional en canal TH",
    );
  }
}

export async function notifyInactiveResponsibles(
  client: WebClient,
  input: NotifyInactiveResponsiblesInput,
): Promise<void> {
  if (input.issues.length === 0) {
    return;
  }

  const canalTH = await getCanalNotificacionesTH(client);

  if (!canalTH) {
    logger.warn(
      {
        cid: input.cid,
        action: "inactive_responsibles_channel_missing",
      },
      "CanalNotificacionesTH no está configurado",
    );

    return;
  }

  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "⚠️ Responsables inactivos detectados",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Se encontraron usuarios desactivados en Slack con responsabilidades pendientes en procesos de Paz y Salvo.",
      },
    },
    {
      type: "divider",
    },
  ];

  for (const issue of input.issues) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Usuario:* <@${issue.userId}>`,
      },
    });

    const asignacionesPorProceso = new Map<string, typeof issue.asignaciones>();

    for (const asignacion of issue.asignaciones) {
      const actuales = asignacionesPorProceso.get(asignacion.procesoId) ?? [];

      actuales.push(asignacion);

      asignacionesPorProceso.set(asignacion.procesoId, actuales);
    }

    for (const [procesoId, asignaciones] of asignacionesPorProceso) {
      const detalle = asignaciones
        .map((asignacion) => {
          if (asignacion.tipo === "Tarea") {
            return `• Tarea: ${asignacion.nombre}`;
          }

          return `• Área: ${asignacion.nombre}`;
        })
        .join("\n");

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Proceso:* ${procesoId}\n` + detalle,
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Ver proceso",
          },
          action_id: "pys_view_process",
          value: procesoId,
        },
      });
    }

    blocks.push({
      type: "divider",
    });
  }

  try {
    await client.chat.postMessage({
      channel: canalTH,

      text: "Responsables inactivos detectados en procesos de Paz y Salvo.",

      blocks,
    });

    logger.info(
      {
        cid: input.cid,
        responsablesInactivos: input.issues.length,
        action: "inactive_responsibles_notification_sent",
      },
      "Notificación de responsables inactivos enviada a TH",
    );
  } catch (err) {
    logger.error(
      {
        cid: input.cid,
        err,
        action: "inactive_responsibles_notification_failed",
      },
      "No fue posible enviar la notificación de responsables inactivos",
    );
  }
}

export async function sendControlledNotification(
  client: WebClient,
  input: ControlledNotificationInput,
): Promise<void> {
  const mode = await getModoNotificaciones(client);

  if (mode === "N") {
    logger.info(
      {
        cid: input.cid,
        recipientUserId: input.recipientUserId,
        tipo: input.tipo,
        action: "notification_skipped_disabled",
      },
      "Notificación omitida por configuración",
    );

    return;
  }

  const prefix = mode === "Test" ? "TEST" : "PROD";

  const effectiveIdempotencyKey = `${prefix}:${input.idempotencyKey}`;

  const alreadySent = await notificationAlreadySent(
    client,
    effectiveIdempotencyKey,
  );

  if (alreadySent) {
    logger.info(
      {
        cid: input.cid,
        recipientUserId: input.recipientUserId,
        idempotencyKey: effectiveIdempotencyKey,
        action: "notification_skipped_idempotent",
      },
      "Notificación ya enviada anteriormente",
    );

    return;
  }

  let destination = input.recipientUserId;

  if (mode === "Test") {
    const testChannel = await getNotificacionesTestChannel(client);

    if (!testChannel) {
      throw new Error(
        "ModoNotificaciones=Test pero " +
          "NotificacionesTestChannel no está configurado",
      );
    }

    destination = testChannel;
  }

  const notificationId = `NTF-${crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 12)
    .toUpperCase()}`;

  const slackItemId = await createNotification(client, {
    notificationId,

    procesoId: input.procesoId,
    areaProcesoId: input.areaProcesoId,
    taskId: input.taskId,

    destinatarioId: input.recipientUserId,

    tipo: input.tipo,

    fechaProgramada: input.fechaProgramada,

    idempotencyKey: effectiveIdempotencyKey,
  });

  try {
    const blocks: KnownBlock[] =
      mode === "Test"
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text:
                  "🧪 *TEST · Notificación redirigida*\n" +
                  `*Destinatario real:* <@${input.recipientUserId}>\n` +
                  `*Tipo:* ${input.tipo}`,
              },
            },
            {
              type: "divider",
            },
            ...(input.blocks && input.blocks.length > 0
              ? input.blocks
              : [
                  {
                    type: "section" as const,
                    text: {
                      type: "mrkdwn" as const,
                      text: input.text,
                    },
                  },
                ]),
          ]
        : (input.blocks ?? []);

    const finalText =
      mode === "Test"
        ? "🧪 TEST · " +
          `Destinatario real: <@${input.recipientUserId}>\n\n` +
          input.text
        : input.text;

    const response = await client.chat.postMessage({
      channel: destination,
      text: finalText,

      ...(blocks.length > 0 ? { blocks } : {}),
    });

    if (!response.ts || !response.channel) {
      throw new Error("Slack no retornó channel/ts para la notificación");
    }

    await markNotificationSent(client, slackItemId, {
      fechaEnvioUtc: new Date().toISOString(),

      channelId: response.channel,

      messageTs: response.ts,
    });

    logger.info(
      {
        cid: input.cid,
        mode,
        recipientUserId: input.recipientUserId,
        destination,
        tipo: input.tipo,
        idempotencyKey: effectiveIdempotencyKey,
        action: "controlled_notification_sent",
      },
      "Notificación controlada enviada",
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await markNotificationError(client, slackItemId, errorMessage);

    logger.error(
      {
        cid: input.cid,
        mode,
        recipientUserId: input.recipientUserId,
        destination,
        tipo: input.tipo,
        idempotencyKey: effectiveIdempotencyKey,
        err,
        action: "controlled_notification_failed",
      },
      "No fue posible enviar notificación controlada",
    );

    throw err;
  }
}
