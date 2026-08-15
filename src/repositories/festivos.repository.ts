import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import {
  getCheckboxField,
  getDateField,
  getNumberField,
  getSelectField,
  getTextField,
  type SlackListItem,
} from "./list-helpers.js";
import { getSelectOptionMap } from "../services/slack-list-schema.service.js";

export type Festivo = {
  llave: string;
  fecha: string;
  nombre: string;
  anio: number;
  activo: boolean;
  tipo: string;
};

export async function getFestivos(client: WebClient): Promise<Festivo[]> {
  const response = await client.apiCall("slackLists.items.list", {
    list_id: slackLists.festivos.id,
    limit: 100,
  });

  const items =
    (
      response as {
        items?: SlackListItem[];
      }
    ).items ?? [];

  const tipoOptionMap = await getSelectOptionMap(
    client,
    slackLists.festivos.id,
    slackColumns.festivos.tipoFestivo,
  );

  return items
    .map((item): Festivo | null => {
      const llave = getTextField(item, slackColumns.festivos.llave);

      const fecha = getDateField(item, slackColumns.festivos.fechaFestivo);

      const nombre = getTextField(item, slackColumns.festivos.nombreFestivo);

      const anio = getNumberField(item, slackColumns.festivos.anio);

      const tipoOptionId = getSelectField(
        item,
        slackColumns.festivos.tipoFestivo,
      );

      const tipo = tipoOptionId
        ? (tipoOptionMap.get(tipoOptionId) ?? null)
        : null;

      if (!llave || !fecha || !nombre || anio === null || !tipo) {
        return null;
      }

      return {
        llave,
        fecha,
        nombre,
        anio,
        activo: getCheckboxField(item, slackColumns.festivos.activo),
        tipo,
      };
    })
    .filter((item): item is Festivo => item !== null);
}
