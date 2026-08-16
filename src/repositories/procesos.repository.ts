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
