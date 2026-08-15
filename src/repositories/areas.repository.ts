import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import type { Area } from "../types/master-data.js";
import {
  getCheckboxField,
  getNumberField,
  getTextField,
  getUserField,
  type SlackListItem,
} from "./list-helpers.js";

export async function getAreas(client: WebClient): Promise<Area[]> {
  const response = await client.apiCall("slackLists.items.list", {
    list_id: slackLists.areas.id,
    limit: 100,
  });

  const items =
    (
      response as {
        items?: SlackListItem[];
      }
    ).items ?? [];

  return items
    .map((item): Area | null => {
      const id = getTextField(item, slackColumns.areas.areaId);

      const nombre = getTextField(item, slackColumns.areas.nombre);

      const responsableFuncional = getUserField(
        item,
        slackColumns.areas.responsableFuncional,
      );

      if (!id || !nombre || !responsableFuncional) {
        return null;
      }

      return {
        id,
        nombre,
        responsableFuncional,
        activa: getCheckboxField(item, slackColumns.areas.activa),
        orden: getNumberField(item, slackColumns.areas.orden) ?? 0,
      };
    })
    .filter((item): item is Area => item !== null)
    .sort((a, b) => a.orden - b.orden);
}
