import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import {
  createListItem,
  selectCell,
  textCell,
  userCell,
} from "../services/slack-list-write.service.js";
import { getSelectOptionId } from "../services/slack-list-schema.service.js";

export type AuditEvent = {
  eventId: string;
  correlationId: string;
  procesoId: string;
  entidadTipo:
    | "Proceso"
    | "AreaProceso"
    | "Tarea"
    | "Evidencia"
    | "Notificacion"
    | "Configuracion";
  entidadId: string;
  accion: string;
  usuarioId: string;
  fechaHoraUtc: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
  detalle?: string;
  tipoAprobacion?: "Manual" | "Automatica";
};

export async function createAuditEvent(
  client: WebClient,
  event: AuditEvent,
): Promise<string> {
  const entidadTipoOption = await getSelectOptionId(
    client,
    slackLists.auditoria.id,
    slackColumns.auditoria.entidadTipo,
    event.entidadTipo,
  );

  const fields = [
    textCell(slackColumns.auditoria.eventId, event.eventId),
    textCell(slackColumns.auditoria.correlationId, event.correlationId),
    textCell(slackColumns.auditoria.procesoId, event.procesoId),
    selectCell(slackColumns.auditoria.entidadTipo, entidadTipoOption),
    textCell(slackColumns.auditoria.entidadId, event.entidadId),
    textCell(slackColumns.auditoria.accion, event.accion),
    userCell(slackColumns.auditoria.usuario, event.usuarioId),
    textCell(slackColumns.auditoria.fechaHoraUtc, event.fechaHoraUtc),
  ];

  if (event.estadoAnterior?.trim()) {
    fields.push(
      textCell(slackColumns.auditoria.estadoAnterior, event.estadoAnterior),
    );
  }

  if (event.estadoNuevo?.trim()) {
    fields.push(
      textCell(slackColumns.auditoria.estadoNuevo, event.estadoNuevo),
    );
  }

  if (event.detalle?.trim()) {
    fields.push(textCell(slackColumns.auditoria.detalle, event.detalle));
  }

  if (event.tipoAprobacion) {
    const tipoAprobacionOption = await getSelectOptionId(
      client,
      slackLists.auditoria.id,
      slackColumns.auditoria.tipoAprobacion,
      event.tipoAprobacion,
    );

    fields.push(
      selectCell(slackColumns.auditoria.tipoAprobacion, tipoAprobacionOption),
    );
  }

  return createListItem(client, slackLists.auditoria.id, fields);
}
