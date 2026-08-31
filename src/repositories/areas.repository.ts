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
import { getAllListItems } from "../services/slack-list-read.service.js";

import {
  updateListItem,
  userCell,
} from "../services/slack-list-write.service.js";

export async function getAreas(client: WebClient): Promise<Area[]> {
  const items = await getAllListItems(client, slackLists.areas.id);
  return items
    .map((item): Area | null => {
      const id = getTextField(item, slackColumns.areas.areaId);

      const nombre = getTextField(item, slackColumns.areas.nombre);

      const responsableFuncional = getUserField(
        item,
        slackColumns.areas.responsableFuncional,
      );

      if (!item.id || !id || !nombre || !responsableFuncional) {
        return null;
      }

      return {
        slackItemId: item.id,
        id,
        nombre,
        responsableFuncional,
        activo: getCheckboxField(item, slackColumns.areas.activa),
        orden: getNumberField(item, slackColumns.areas.orden) ?? 0,
      };
    })
    .filter((item): item is Area => item !== null)
    .sort((a, b) => a.orden - b.orden);
}

export async function updateAreaResponsableFuncional(
  client: WebClient,
  slackItemId: string,
  nuevoResponsableId: string,
): Promise<void> {
  await updateListItem(client, slackLists.areas.id, slackItemId, [
    userCell(slackColumns.areas.responsableFuncional, nuevoResponsableId),
  ]);
}
