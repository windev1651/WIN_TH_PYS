import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import {
  getCheckboxField,
  getDateField,
  getNumberField,
  getSelectField,
  getTextField,
  getUserField,
  type SlackListItem,
} from "./list-helpers.js";
import { getSelectOptionMap } from "../services/slack-list-schema.service.js";
import type { ProcesoListItem } from "../types/process-read.js";
import { getAllListItems } from "../services/slack-list-read.service.js";

type ReadOptions = {
  bypassCache?: boolean;
};

export async function getProcesos(
  client: WebClient,
  options: ReadOptions = {},
): Promise<ProcesoListItem[]> {
  const items = await getAllListItems(client, slackLists.procesos.id, options);
  const [tipoSolicitudMap, estadoMap] = await Promise.all([
    getSelectOptionMap(
      client,
      slackLists.procesos.id,
      slackColumns.procesos.tipoSolicitudId,
    ),

    getSelectOptionMap(
      client,
      slackLists.procesos.id,
      slackColumns.procesos.estado,
    ),
  ]);

  return items
    .map((item): ProcesoListItem | null => {
      const procesoId = getTextField(item, slackColumns.procesos.procesoId);

      const empleadoId = getUserField(item, slackColumns.procesos.empleado);

      const tipoSolicitudOptionId = getSelectField(
        item,
        slackColumns.procesos.tipoSolicitudId,
      );

      const estadoOptionId = getSelectField(item, slackColumns.procesos.estado);

      if (
        !item.id ||
        !procesoId ||
        !empleadoId ||
        !tipoSolicitudOptionId ||
        !estadoOptionId
      ) {
        return null;
      }

      const tipoSolicitudId = tipoSolicitudMap.get(tipoSolicitudOptionId);

      const estado = estadoMap.get(estadoOptionId);

      if (!tipoSolicitudId || !estado) {
        return null;
      }

      return {
        slackItemId: item.id,
        procesoId,
        tipoSolicitudId,
        empleadoId,

        creadoPorId: getUserField(item, slackColumns.procesos.creadoPor) ?? "",

        fechaInicio:
          getDateField(item, slackColumns.procesos.fechaInicio) ?? "",

        fechaSalida:
          getDateField(item, slackColumns.procesos.fechaSalida) ?? "",

        fechaLimite:
          getDateField(item, slackColumns.procesos.fechaLimite) ?? "",

        estado,

        porcentajeAvance:
          getNumberField(item, slackColumns.procesos.porcentajeAvance) ?? 0,

        fechaCierre: getDateField(item, slackColumns.procesos.fechaCierre),

        cerradoPorId: getUserField(item, slackColumns.procesos.cerradoPor),

        cierreExcepcion: getCheckboxField(
          item,
          slackColumns.procesos.cierreExcepcion,
        ),

        comentarioTH: getTextField(item, slackColumns.procesos.comentarioTh),
      };
    })
    .filter((item): item is ProcesoListItem => item !== null);
}
