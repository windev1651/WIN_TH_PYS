import type { WebClient } from "@slack/web-api";

import { getHomeData } from "./home-data.service.js";
import { buildThHomeBlocks } from "../views/home-th.view.js";

export async function publishHome(
  client: WebClient,
  userId: string,
): Promise<void> {
  const data = await getHomeData(client, userId);

  const blocks = buildThHomeBlocks(
    data.resumen,
    data.procesosActivos,
    data.misTareasPorProceso,
    data.misAreas,
    data.configuracion.maxTareasVista,
  );

  await client.views.publish({
    user_id: userId,
    view: {
      type: "home",
      blocks,
    },
  });
}
