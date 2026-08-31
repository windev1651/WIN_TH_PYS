import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import type { AreaProcesoSnapshot } from "../types/process.js";
import {
  dateCell,
  createListItem,
  numberCell,
  selectCell,
  textCell,
  userCell,
  updateListItem,
} from "../services/slack-list-write.service.js";
import { getSelectOptionId } from "../services/slack-list-schema.service.js";

export async function approveAreaItem(
  client: WebClient,
  slackItemId: string,
  userId: string,
  comentario?: string,
): Promise<void> {
  const estadoOption = await getSelectOptionId(
    client,
    slackLists.areasProceso.id,
    slackColumns.areasProceso.estado,
    "Completada",
  );

  const fechaAprobacion = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const fields = [
    selectCell(slackColumns.areasProceso.estado, estadoOption),

    dateCell(slackColumns.areasProceso.fechaAprobacion, fechaAprobacion),

    userCell(slackColumns.areasProceso.aprobadoPor, userId),
  ];

  if (comentario !== undefined && comentario.trim() !== "") {
    fields.push(
      textCell(slackColumns.areasProceso.comentario, comentario.trim()),
    );
  }

  await updateListItem(client, slackLists.areasProceso.id, slackItemId, fields);
}

export async function createAreaProceso(
  client: WebClient,
  area: AreaProcesoSnapshot,
): Promise<string> {
  const estadoOption = await getSelectOptionId(
    client,
    slackLists.areasProceso.id,
    slackColumns.areasProceso.estado,
    area.estado,
  );

  return createListItem(client, slackLists.areasProceso.id, [
    textCell(slackColumns.areasProceso.areaProcesoId, area.areaProcesoId),
    textCell(slackColumns.areasProceso.procesoId, area.procesoId),
    textCell(slackColumns.areasProceso.areaIdSnapshot, area.areaIdSnapshot),
    textCell(
      slackColumns.areasProceso.areaNombreSnapshot,
      area.areaNombreSnapshot,
    ),
    userCell(
      slackColumns.areasProceso.responsableFuncionalSnapshot,
      area.responsableFuncionalSnapshot,
    ),
    selectCell(slackColumns.areasProceso.estado, estadoOption),
    numberCell(slackColumns.areasProceso.ordenArea, area.ordenArea),
  ]);
}

export async function updateAreaEstado(
  client: WebClient,
  slackItemId: string,
  estado: string,
): Promise<void> {
  const estadoOption = await getSelectOptionId(
    client,
    slackLists.areasProceso.id,
    slackColumns.areasProceso.estado,
    estado,
  );

  await updateListItem(client, slackLists.areasProceso.id, slackItemId, [
    selectCell(slackColumns.areasProceso.estado, estadoOption),
  ]);
}

export async function updateAreaResponsableFuncional(
  client: WebClient,
  slackItemId: string,
  nuevoResponsableId: string,
): Promise<void> {
  await updateListItem(client, slackLists.areasProceso.id, slackItemId, [
    userCell(
      slackColumns.areasProceso.responsableFuncionalSnapshot,
      nuevoResponsableId,
    ),
  ]);
}
