import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import { getAllListItems } from "../services/slack-list-read.service.js";
import { getSelectOptionMap } from "../services/slack-list-schema.service.js";
import {
  getCheckboxField,
  getSelectField,
  getTextField,
  getUserField,
  type SlackListItem,
} from "./list-helpers.js";

export type UsuarioAutorizado = {
  slackItemId: string;
  userId: string;
  rol: string;
  activo: boolean;
  observacion: string | null;
};

async function parseUsuariosAutorizados(
  client: WebClient,
  items: SlackListItem[],
): Promise<UsuarioAutorizado[]> {
  const rolMap = await getSelectOptionMap(
    client,
    slackLists.usuariosAutorizados.id,
    slackColumns.usuariosAutorizados.rol,
  );

  return items
    .map((item): UsuarioAutorizado | null => {
      if (!item.id) {
        return null;
      }

      const userId = getUserField(
        item,
        slackColumns.usuariosAutorizados.usuario,
      );

      const rolOptionId = getSelectField(
        item,
        slackColumns.usuariosAutorizados.rol,
      );

      const rol = rolOptionId ? rolMap.get(rolOptionId) : null;

      if (!userId || !rol) {
        return null;
      }

      return {
        slackItemId: item.id,
        userId,
        rol,

        activo: getCheckboxField(item, slackColumns.usuariosAutorizados.activo),

        observacion: getTextField(
          item,
          slackColumns.usuariosAutorizados.observacion,
        ),
      };
    })
    .filter((item): item is UsuarioAutorizado => item !== null);
}

export async function getUsuariosAutorizados(
  client: WebClient,
): Promise<UsuarioAutorizado[]> {
  const items = await getAllListItems(
    client,
    slackLists.usuariosAutorizados.id,
  );

  return parseUsuariosAutorizados(client, items);
}
