import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import { getSelectOptionMap } from "../services/slack-list-schema.service.js";
import type { TareaProcesoDetail } from "../types/process-detail.js";
import {
  getCheckboxField,
  getDateField,
  getNumberField,
  getSelectField,
  getTextField,
  getUserField,
  type SlackListItem,
} from "./list-helpers.js";

export async function getTareasProceso(
  client: WebClient,
  procesoId: string,
): Promise<TareaProcesoDetail[]> {
  const response = await client.apiCall("slackLists.items.list", {
    list_id: slackLists.tareasProceso.id,
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
    slackLists.tareasProceso.id,
    slackColumns.tareasProceso.estado,
  );

  return items
    .map((item): TareaProcesoDetail | null => {
      const rowProcesoId = getTextField(
        item,
        slackColumns.tareasProceso.procesoId,
      );

      if (!item.id || rowProcesoId !== procesoId) {
        return null;
      }

      const taskId = getTextField(item, slackColumns.tareasProceso.taskId);

      const areaProcesoId = getTextField(
        item,
        slackColumns.tareasProceso.areaProcesoId,
      );

      const tarea = getTextField(
        item,
        slackColumns.tareasProceso.tareaSnapshot,
      );

      const responsableOperativoId = getUserField(
        item,
        slackColumns.tareasProceso.responsableOperativoSnapshot,
      );

      const estadoOptionId = getSelectField(
        item,
        slackColumns.tareasProceso.estado,
      );

      const estado = estadoOptionId ? estadoMap.get(estadoOptionId) : null;

      if (
        !taskId ||
        !areaProcesoId ||
        !tarea ||
        !responsableOperativoId ||
        !estado
      ) {
        return null;
      }

      return {
        slackItemId: item.id,
        taskId,
        procesoId,
        areaProcesoId,

        configTareaIdOrigen:
          getTextField(item, slackColumns.tareasProceso.configTareaIdOrigen) ??
          "",

        tarea,
        responsableOperativoId,

        obligatoria: getCheckboxField(
          item,
          slackColumns.tareasProceso.obligatoria,
        ),

        requiereEvidencia: getCheckboxField(
          item,
          slackColumns.tareasProceso.requiereEvidencia,
        ),

        estado,

        fechaLimite:
          getDateField(item, slackColumns.tareasProceso.fechaLimite) ?? "",

        comentario: getTextField(item, slackColumns.tareasProceso.comentario),

        ordenTarea:
          getNumberField(item, slackColumns.tareasProceso.ordenTarea) ?? 0,
      };
    })
    .filter((item): item is TareaProcesoDetail => item !== null)
    .sort((a, b) => a.ordenTarea - b.ordenTarea);
}
