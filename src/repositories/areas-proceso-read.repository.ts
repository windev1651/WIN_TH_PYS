import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import { getSelectOptionMap } from "../services/slack-list-schema.service.js";
import { getAllListItems } from "../services/slack-list-read.service.js";
import type { AreaProcesoDetail } from "../types/process-detail.js";
import {
  getDateField,
  getNumberField,
  getSelectField,
  getTextField,
  getUserField,
  type SlackListItem,
} from "./list-helpers.js";

type ReadOptions = {
  bypassCache?: boolean;
};

export async function getAllAreasProceso(
  client: WebClient,
): Promise<AreaProcesoDetail[]> {
  const items = await getAllListItems(client, slackLists.areasProceso.id);

  return parseAreasProceso(client, items);
}

export async function getAreasProceso(
  client: WebClient,
  procesoId: string,
  options: ReadOptions = {},
): Promise<AreaProcesoDetail[]> {
  const items = await getAllListItems(
    client,
    slackLists.areasProceso.id,
    options,
  );

  const areas = await parseAreasProceso(client, items);

  return areas
    .filter((area) => area.procesoId === procesoId)
    .sort((a, b) => a.ordenArea - b.ordenArea);
}

export async function getAreaByAreaProcesoId(
  client: WebClient,
  areaProcesoId: string,
): Promise<AreaProcesoDetail | null> {
  const areas = await getAllAreasProceso(client);

  return areas.find((item) => item.areaProcesoId === areaProcesoId) ?? null;
}

export async function getAreasUsuario(
  client: WebClient,
  userId: string,
): Promise<AreaProcesoDetail[]> {
  const items = await getAllListItems(client, slackLists.areasProceso.id);

  const areas = await parseAreasProceso(client, items);

  return areas
    .filter(
      (area) =>
        area.responsableFuncionalId === userId && area.estado !== "Completada",
    )
    .sort((a, b) => {
      const byProcess = a.procesoId.localeCompare(b.procesoId);

      if (byProcess !== 0) {
        return byProcess;
      }

      return a.ordenArea - b.ordenArea;
    });
}

async function parseAreasProceso(
  client: WebClient,
  items: SlackListItem[],
): Promise<AreaProcesoDetail[]> {
  const estadoMap = await getSelectOptionMap(
    client,
    slackLists.areasProceso.id,
    slackColumns.areasProceso.estado,
  );

  return items
    .map((item): AreaProcesoDetail | null => {
      if (!item.id) {
        return null;
      }

      const procesoId = getTextField(item, slackColumns.areasProceso.procesoId);

      const areaProcesoId = getTextField(
        item,
        slackColumns.areasProceso.areaProcesoId,
      );

      const areaId = getTextField(
        item,
        slackColumns.areasProceso.areaIdSnapshot,
      );

      const areaNombre = getTextField(
        item,
        slackColumns.areasProceso.areaNombreSnapshot,
      );

      const responsableFuncionalId = getUserField(
        item,
        slackColumns.areasProceso.responsableFuncionalSnapshot,
      );

      const estadoOptionId = getSelectField(
        item,
        slackColumns.areasProceso.estado,
      );

      const estado = estadoOptionId ? estadoMap.get(estadoOptionId) : null;

      if (
        !procesoId ||
        !areaProcesoId ||
        !areaId ||
        !areaNombre ||
        !responsableFuncionalId ||
        !estado
      ) {
        return null;
      }

      return {
        slackItemId: item.id,
        areaProcesoId,
        procesoId,
        areaId,
        areaNombre,
        responsableFuncionalId,
        estado,

        ordenArea:
          getNumberField(item, slackColumns.areasProceso.ordenArea) ?? 0,

        fechaAprobacion: getDateField(
          item,
          slackColumns.areasProceso.fechaAprobacion,
        ),

        aprobadoPorId: getUserField(
          item,
          slackColumns.areasProceso.aprobadoPor,
        ),

        comentario: getTextField(item, slackColumns.areasProceso.comentario),
      };
    })
    .filter((item): item is AreaProcesoDetail => item !== null);
}
