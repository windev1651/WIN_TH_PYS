import type { WebClient } from "@slack/web-api";

import { getParametros } from "../repositories/parametros.repository.js";

export async function getMaxTareasVista(client: WebClient): Promise<number> {
  const parametros = await getParametros(client);

  const parametro = parametros.find(
    (item) => item.clave === "MaxTareasPorVista" && item.activo,
  );

  const value = Number(parametro?.valor);

  return Number.isFinite(value) && value > 0 ? value : 6;
}
