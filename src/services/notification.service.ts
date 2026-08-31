import type { KnownBlock } from "@slack/types";
import type { WebClient } from "@slack/web-api";

import { logger } from "../utils/logger.js";
import { getCanalNotificacionesTH } from "./runtime-config.service.js";
import type { InactiveResponsibleIssue } from "./inactive-responsibles.service.js";

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
