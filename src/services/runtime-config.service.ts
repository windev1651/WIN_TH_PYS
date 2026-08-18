import type { WebClient } from "@slack/web-api";

import { getMasterData, getNumberParametro } from "./master-data.service.js";

export async function getMaxTareasVista(client: WebClient): Promise<number> {
  const masterData = await getMasterData(client);

  return getNumberParametro(masterData.parametros, "MaxTareasPorVista") ?? 6;
}
