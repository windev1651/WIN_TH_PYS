import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import {
  NOTIFICATION_RESULT,
  NOTIFICATION_TYPE,
} from "../constants/notifications.js";
import {
  createListItem,
  dateCell,
  selectCell,
  textCell,
  updateListItem,
  userCell,
} from "../services/slack-list-write.service.js";
import { getAllListItems } from "../services/slack-list-read.service.js";
import { getTextField, type SlackListItem } from "./list-helpers.js";

export type NotificationType =
  | "Inicial"
  | "Recordatorio diario"
  | "Vencido"
  | "Reasignación"
  | "Evidencia"
  | "Rechazada"
  | "Cierre excepcional"
  | "Resumen TH";

type CreateNotificationInput = {
  notificationId: string;

  procesoId?: string;
  areaProcesoId?: string;
  taskId?: string;

  destinatarioId: string;

  tipo: NotificationType;

  fechaProgramada?: string;

  idempotencyKey: string;
};

const TYPE_OPTION_BY_LABEL: Record<NotificationType, string> = {
  Inicial: NOTIFICATION_TYPE.INITIAL,
  "Recordatorio diario": NOTIFICATION_TYPE.DAILY_REMINDER,
  Vencido: NOTIFICATION_TYPE.OVERDUE,
  Reasignación: NOTIFICATION_TYPE.REASSIGNMENT,
  Evidencia: NOTIFICATION_TYPE.EVIDENCE,
  Rechazada: NOTIFICATION_TYPE.REJECTED,
  "Cierre excepcional": NOTIFICATION_TYPE.EXCEPTION_CLOSE,
  "Resumen TH": NOTIFICATION_TYPE.TH_SUMMARY,
};

export async function notificationAlreadySent(
  client: WebClient,
  idempotencyKey: string,
): Promise<boolean> {
  const items = await getAllListItems(client, slackLists.notificaciones.id);

  return items.some((item) => {
    const key = getTextField(item, slackColumns.notificaciones.idempotencyKey);

    const resultado = item.fields?.find(
      (field) => field.column_id === slackColumns.notificaciones.resultado,
    )?.select?.[0];

    return key === idempotencyKey && resultado === NOTIFICATION_RESULT.SENT;
  });
}

export async function createNotification(
  client: WebClient,
  input: CreateNotificationInput,
): Promise<string> {
  const fields = [
    textCell(slackColumns.notificaciones.notificationId, input.notificationId),

    userCell(slackColumns.notificaciones.destinatario, input.destinatarioId),

    selectCell(
      slackColumns.notificaciones.tipo,
      TYPE_OPTION_BY_LABEL[input.tipo],
    ),

    selectCell(
      slackColumns.notificaciones.resultado,
      NOTIFICATION_RESULT.PENDING,
    ),

    textCell(slackColumns.notificaciones.idempotencyKey, input.idempotencyKey),
  ];

  if (input.procesoId) {
    fields.push(
      textCell(slackColumns.notificaciones.procesoId, input.procesoId),
    );
  }

  if (input.areaProcesoId) {
    fields.push(
      textCell(slackColumns.notificaciones.areaProcesoId, input.areaProcesoId),
    );
  }

  if (input.taskId) {
    fields.push(textCell(slackColumns.notificaciones.taskId, input.taskId));
  }

  if (input.fechaProgramada) {
    fields.push(
      dateCell(
        slackColumns.notificaciones.fechaProgramada,
        input.fechaProgramada,
      ),
    );
  }

  return createListItem(client, slackLists.notificaciones.id, fields);
}

export async function markNotificationSent(
  client: WebClient,
  slackItemId: string,
  input: {
    fechaEnvioUtc: string;
    channelId: string;
    messageTs: string;
  },
): Promise<void> {
  await updateListItem(client, slackLists.notificaciones.id, slackItemId, [
    selectCell(slackColumns.notificaciones.resultado, NOTIFICATION_RESULT.SENT),

    textCell(slackColumns.notificaciones.fechaEnvioUtc, input.fechaEnvioUtc),

    textCell(slackColumns.notificaciones.dmChannelId, input.channelId),

    textCell(slackColumns.notificaciones.dmMessageTs, input.messageTs),
  ]);
}

export async function markNotificationError(
  client: WebClient,
  slackItemId: string,
  errorDetalle: string,
): Promise<void> {
  await updateListItem(client, slackLists.notificaciones.id, slackItemId, [
    selectCell(
      slackColumns.notificaciones.resultado,
      NOTIFICATION_RESULT.ERROR,
    ),

    textCell(
      slackColumns.notificaciones.errorDetalle,
      errorDetalle.slice(0, 2000),
    ),
  ]);
}
