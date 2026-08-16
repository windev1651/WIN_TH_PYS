import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import type { AreaProcesoSnapshot } from "../types/process.js";
import {
  createListItem,
  numberCell,
  selectCell,
  textCell,
  userCell,
} from "../services/slack-list-write.service.js";
import { getSelectOptionId } from "../services/slack-list-schema.service.js";

export async function createAreaProceso(
  client: WebClient,
  area: AreaProcesoSnapshot,
): Promise<string> {
  const estadoOption = await getSelectOptionId(
    client,
    slackLists.areasProceso.id,
    slackColumns.areasProceso.estado,
    area.estado,
  );

  return createListItem(client, slackLists.areasProceso.id, [
    textCell(slackColumns.areasProceso.areaProcesoId, area.areaProcesoId),
    textCell(slackColumns.areasProceso.procesoId, area.procesoId),
    textCell(slackColumns.areasProceso.areaIdSnapshot, area.areaIdSnapshot),
    textCell(
      slackColumns.areasProceso.areaNombreSnapshot,
      area.areaNombreSnapshot,
    ),
    userCell(
      slackColumns.areasProceso.responsableFuncionalSnapshot,
      area.responsableFuncionalSnapshot,
    ),
    selectCell(slackColumns.areasProceso.estado, estadoOption),
    numberCell(slackColumns.areasProceso.ordenArea, area.ordenArea),
  ]);
}
