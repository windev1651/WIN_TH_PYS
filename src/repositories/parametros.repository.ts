import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import type { Parametro } from "../types/master-data.js";
import {
  getCheckboxField,
  getSelectField,
  getTextField,
  type SlackListItem,
} from "./list-helpers.js";
import { getSelectOptionMap } from "../services/slack-list-schema.service.js";
import { getAllListItems } from "../services/slack-list-read.service.js";

export async function getParametros(client: WebClient): Promise<Parametro[]> {
  const items = await getAllListItems(client, slackLists.parametros.id);
  const tipoDatoOptionMap = await getSelectOptionMap(
    client,
    slackLists.parametros.id,
    slackColumns.parametros.tipoDato,
  );

  return items
    .map((item): Parametro | null => {
      const clave = getTextField(item, slackColumns.parametros.clave);

      const valor = getTextField(item, slackColumns.parametros.valor);

      const tipoDatoOptionId = getSelectField(
        item,
        slackColumns.parametros.tipoDato,
      );

      const tipoDato = tipoDatoOptionId
        ? tipoDatoOptionMap.get(tipoDatoOptionId)
        : null;

      if (
        !clave ||
        valor === null ||
        !tipoDato ||
        !["NUMBER", "TEXT", "BOOLEAN"].includes(tipoDato)
      ) {
        return null;
      }

      return {
        clave,
        valor,
        tipoDato: tipoDato as Parametro["tipoDato"],
        descripcion: getTextField(item, slackColumns.parametros.descripcion),
        activo: getCheckboxField(item, slackColumns.parametros.activo),
      };
    })
    .filter((item): item is Parametro => item !== null);
}
