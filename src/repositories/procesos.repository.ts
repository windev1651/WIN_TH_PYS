import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import type { ProcessSnapshot } from "../types/process.js";
import {
  checkboxCell,
  createListItem,
  dateCell,
  numberCell,
  selectCell,
  textCell,
  userCell,
  updateListItem,
} from "../services/slack-list-write.service.js";
import { getSelectOptionId } from "../services/slack-list-schema.service.js";

export async function createProceso(
  client: WebClient,
  proceso: ProcessSnapshot["proceso"],
): Promise<string> {
  const tipoSolicitudOption = await getSelectOptionId(
    client,
    slackLists.procesos.id,
    slackColumns.procesos.tipoSolicitudId,
    proceso.tipoSolicitudId,
  );

  const estadoOption = await getSelectOptionId(
    client,
    slackLists.procesos.id,
    slackColumns.procesos.estado,
    proceso.estado,
  );

  const fields = [
    textCell(slackColumns.procesos.procesoId, proceso.procesoId),
    selectCell(slackColumns.procesos.tipoSolicitudId, tipoSolicitudOption),
    userCell(slackColumns.procesos.empleado, proceso.empleadoId),
    userCell(slackColumns.procesos.creadoPor, proceso.creadoPorId),
    dateCell(slackColumns.procesos.fechaInicio, proceso.fechaInicio),
    dateCell(slackColumns.procesos.fechaSalida, proceso.fechaSalida),
    dateCell(slackColumns.procesos.fechaLimite, proceso.fechaLimite),
    selectCell(slackColumns.procesos.estado, estadoOption),
    numberCell(
      slackColumns.procesos.porcentajeAvance,
      proceso.porcentajeAvance,
    ),
    checkboxCell(
      slackColumns.procesos.cierreExcepcion,
      proceso.cierreExcepcion,
    ),
  ];

  if (proceso.comentarioTH.trim() !== "") {
    fields.push(
      textCell(slackColumns.procesos.comentarioTh, proceso.comentarioTH),
    );
  }

  return createListItem(client, slackLists.procesos.id, fields);
}

export async function updateProcesoAvance(
  client: WebClient,
  slackItemId: string,
  porcentajeAvance: number,
): Promise<void> {
  await updateListItem(client, slackLists.procesos.id, slackItemId, [
    numberCell(slackColumns.procesos.porcentajeAvance, porcentajeAvance),
  ]);
}

export async function updateProcesoEstado(
  client: WebClient,
  slackItemId: string,
  estado: string,
): Promise<void> {
  const estadoOption = await getSelectOptionId(
    client,
    slackLists.procesos.id,
    slackColumns.procesos.estado,
    estado,
  );

  await updateListItem(client, slackLists.procesos.id, slackItemId, [
    selectCell(slackColumns.procesos.estado, estadoOption),
  ]);
}

export async function closeProcesoItem(
  client: WebClient,
  slackItemId: string,
  userId: string,
  comentario?: string,
  cierreExcepcion = false,
): Promise<void> {
  const estadoFinal = cierreExcepcion
    ? "Finalizado con excepción"
    : "Finalizado";

  const estadoOption = await getSelectOptionId(
    client,
    slackLists.procesos.id,
    slackColumns.procesos.estado,
    estadoFinal,
  );

  const fechaCierre = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const fields = [
    selectCell(slackColumns.procesos.estado, estadoOption),

    dateCell(slackColumns.procesos.fechaCierre, fechaCierre),

    userCell(slackColumns.procesos.cerradoPor, userId),

    checkboxCell(slackColumns.procesos.cierreExcepcion, cierreExcepcion),
  ];

  if (comentario !== undefined && comentario.trim() !== "") {
    fields.push(
      textCell(slackColumns.procesos.comentarioTh, comentario.trim()),
    );
  }

  await updateListItem(client, slackLists.procesos.id, slackItemId, fields);
}
