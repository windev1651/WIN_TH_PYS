import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import { getSelectOptionMap } from "../services/slack-list-schema.service.js";
import type { AreaProcesoDetail } from "../types/process-detail.js";
import {
  getNumberField,
  getSelectField,
  getTextField,
  getUserField,
  type SlackListItem,
} from "./list-helpers.js";

export async function getAreasProceso(
  client: WebClient,
  procesoId: string,
): Promise<AreaProcesoDetail[]> {
  const response = await client.apiCall("slackLists.items.list", {
    list_id: slackLists.areasProceso.id,
    limit: 100,
  });

  const items =
    (
      response as {
        items?: SlackListItem[];
      }
    ).items ?? [];

  const estadoMap = await getSelectOptionMap(
    client,
    slackLists.areasProceso.id,
    slackColumns.areasProceso.estado,
  );

  return items
    .map((item): AreaProcesoDetail | null => {
      const rowProcesoId = getTextField(
        item,
        slackColumns.areasProceso.procesoId,
      );

      if (!item.id || rowProcesoId !== procesoId) {
        return null;
      }

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
      };
    })
    .filter((item): item is AreaProcesoDetail => item !== null)
    .sort((a, b) => a.ordenArea - b.ordenArea);
}
