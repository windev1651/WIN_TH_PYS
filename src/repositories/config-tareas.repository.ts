import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import type { ConfigTarea } from "../types/master-data.js";
import {
  getCheckboxField,
  getNumberField,
  getSelectField,
  getTextField,
  getUserField,
  type SlackListItem,
} from "./list-helpers.js";
import { getSelectOptionMap } from "../services/slack-list-schema.service.js";
import { getAllListItems } from "../services/slack-list-read.service.js";
import {
  updateListItem,
  userCell,
} from "../services/slack-list-write.service.js";

export async function getConfigTareas(
  client: WebClient,
): Promise<ConfigTarea[]> {
  const items = await getAllListItems(client, slackLists.configTareas.id);
  const areaOptionMap = await getSelectOptionMap(
    client,
    slackLists.configTareas.id,
    slackColumns.configTareas.areaId,
  );

  return items
    .map((item): ConfigTarea | null => {
      const id = getTextField(item, slackColumns.configTareas.configTareaId);

      const tipoSolicitudId = getTextField(
        item,
        slackColumns.configTareas.tipoSolicitudId,
      );

      const areaOptionId = getSelectField(
        item,
        slackColumns.configTareas.areaId,
      );

      const areaId = areaOptionId
        ? (areaOptionMap.get(areaOptionId) ?? null)
        : null;

      const tarea = getTextField(item, slackColumns.configTareas.tarea);

      const responsableOperativo = getUserField(
        item,
        slackColumns.configTareas.responsableOperativo,
      );

      if (
        !item.id ||
        !id ||
        !tipoSolicitudId ||
        !areaId ||
        !tarea ||
        !responsableOperativo
      ) {
        return null;
      }

      return {
        slackItemId: item.id,
        id,
        tipoSolicitudId,
        areaId,
        tarea,
        responsableOperativo,
        obligatoria: getCheckboxField(
          item,
          slackColumns.configTareas.obligatoria,
        ),
        requiereEvidencia: getCheckboxField(
          item,
          slackColumns.configTareas.requiereEvidencia,
        ),
        activo: getCheckboxField(item, slackColumns.configTareas.activa),
        ordenArea:
          getNumberField(item, slackColumns.configTareas.ordenArea) ?? 0,
        ordenTarea:
          getNumberField(item, slackColumns.configTareas.ordenTarea) ?? 0,
        observacion: getTextField(item, slackColumns.configTareas.observacion),
      };
    })
    .filter((item): item is ConfigTarea => item !== null)
    .sort((a, b) => {
      if (a.ordenArea !== b.ordenArea) {
        return a.ordenArea - b.ordenArea;
      }

      return a.ordenTarea - b.ordenTarea;
    });
}

export async function updateConfigTareaResponsableOperativo(
  client: WebClient,
  slackItemId: string,
  nuevoResponsableId: string,
): Promise<void> {
  await updateListItem(client, slackLists.configTareas.id, slackItemId, [
    userCell(
      slackColumns.configTareas.responsableOperativo,
      nuevoResponsableId,
    ),
  ]);
}
