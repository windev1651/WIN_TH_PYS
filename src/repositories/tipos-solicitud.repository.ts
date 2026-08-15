import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import type { TipoSolicitud } from "../types/master-data.js";
import type { SlackListItem } from "./list-helpers.js";

import {
  getCheckboxField,
  getNumberField,
  getTextField,
} from "./list-helpers.js";

export async function getTiposSolicitud(
  client: WebClient,
): Promise<TipoSolicitud[]> {
  const response = await client.apiCall("slackLists.items.list", {
    list_id: slackLists.tiposSolicitud.id,
    limit: 100,
  });

  const items =
    (
      response as {
        items?: SlackListItem[];
      }
    ).items ?? [];

  return items
    .map((item): TipoSolicitud | null => {
      const id = getTextField(
        item,
        slackColumns.tiposSolicitud.tipoSolicitudId,
      );

      const nombre = getTextField(item, slackColumns.tiposSolicitud.nombre);

      if (!id || !nombre) {
        return null;
      }

      return {
        id,
        nombre,
        descripcion: getTextField(
          item,
          slackColumns.tiposSolicitud.descripcion,
        ),
        activo: getCheckboxField(item, slackColumns.tiposSolicitud.activo),
        orden: getNumberField(item, slackColumns.tiposSolicitud.orden) ?? 0,
      };
    })
    .filter((item): item is TipoSolicitud => item !== null)
    .sort((a, b) => a.orden - b.orden);
}
