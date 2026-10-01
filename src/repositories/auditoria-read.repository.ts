import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import { getAllListItems } from "../services/slack-list-read.service.js";
import {
  getTextField,
  getUserField,
  type SlackListItem,
} from "./list-helpers.js";

export type AuditEventRead = {
  slackItemId: string;
  eventId: string;
  correlationId: string;
  procesoId: string;
  entidadId: string;
  accion: string;
  usuarioId: string;
  fechaHoraUtc: string;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  detalle: string | null;
};

export async function getAuditEvents(
  client: WebClient,
  procesoId?: string,
): Promise<AuditEventRead[]> {
  const items = await getAllListItems(client, slackLists.auditoria.id);

  const events = parseAuditEvents(items);

  if (!procesoId) {
    return events;
  }

  return events.filter((event) => event.procesoId === procesoId);
}

function parseAuditEvents(items: SlackListItem[]): AuditEventRead[] {
  return items
    .map((item): AuditEventRead | null => {
      if (!item.id) {
        return null;
      }

      const eventId = getTextField(item, slackColumns.auditoria.eventId);
      const correlationId = getTextField(
        item,
        slackColumns.auditoria.correlationId,
      );
      const procesoId = getTextField(item, slackColumns.auditoria.procesoId);
      const entidadId = getTextField(item, slackColumns.auditoria.entidadId);
      const accion = getTextField(item, slackColumns.auditoria.accion);
      const usuarioId = getUserField(item, slackColumns.auditoria.usuario);
      const fechaHoraUtc = getTextField(
        item,
        slackColumns.auditoria.fechaHoraUtc,
      );

      if (
        !eventId ||
        !correlationId ||
        !procesoId ||
        !entidadId ||
        !accion ||
        !usuarioId ||
        !fechaHoraUtc
      ) {
        return null;
      }

      return {
        slackItemId: item.id,
        eventId,
        correlationId,
        procesoId,
        entidadId,
        accion,
        usuarioId,
        fechaHoraUtc,
        estadoAnterior: getTextField(
          item,
          slackColumns.auditoria.estadoAnterior,
        ),
        estadoNuevo: getTextField(item, slackColumns.auditoria.estadoNuevo),
        detalle: getTextField(item, slackColumns.auditoria.detalle),
      };
    })
    .filter((event): event is AuditEventRead => event !== null)
    .sort((a, b) => a.fechaHoraUtc.localeCompare(b.fechaHoraUtc));
}
