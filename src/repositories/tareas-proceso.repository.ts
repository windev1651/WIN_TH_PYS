import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import type { TareaProcesoSnapshot } from "../types/process.js";
import {
  checkboxCell,
  createListItem,
  dateCell,
  numberCell,
  selectCell,
  textCell,
  userCell,
} from "../services/slack-list-write.service.js";
import { getSelectOptionId } from "../services/slack-list-schema.service.js";
import { updateListItem } from "../services/slack-list-write.service.js";

export async function createTareaProceso(
  client: WebClient,
  tarea: TareaProcesoSnapshot,
): Promise<string> {
  const estadoOption = await getSelectOptionId(
    client,
    slackLists.tareasProceso.id,
    slackColumns.tareasProceso.estado,
    tarea.estado,
  );

  const fields = [
    textCell(slackColumns.tareasProceso.taskId, tarea.taskId),
    textCell(slackColumns.tareasProceso.procesoId, tarea.procesoId),
    textCell(slackColumns.tareasProceso.areaProcesoId, tarea.areaProcesoId),
    textCell(
      slackColumns.tareasProceso.configTareaIdOrigen,
      tarea.configTareaIdOrigen,
    ),
    textCell(slackColumns.tareasProceso.tareaSnapshot, tarea.tareaSnapshot),
    userCell(
      slackColumns.tareasProceso.responsableOperativoSnapshot,
      tarea.responsableOperativoSnapshot,
    ),
    checkboxCell(slackColumns.tareasProceso.obligatoria, tarea.obligatoria),
    checkboxCell(
      slackColumns.tareasProceso.requiereEvidencia,
      tarea.requiereEvidencia,
    ),
    selectCell(slackColumns.tareasProceso.estado, estadoOption),
    dateCell(slackColumns.tareasProceso.fechaLimite, tarea.fechaLimite),
    numberCell(slackColumns.tareasProceso.ordenTarea, tarea.ordenTarea),
  ];

  if (tarea.comentario.trim() !== "") {
    fields.push(
      textCell(slackColumns.tareasProceso.comentario, tarea.comentario),
    );
  }

  return createListItem(client, slackLists.tareasProceso.id, fields);
}

export async function updateTareaEstado(
  client: WebClient,
  slackItemId: string,
  estado: string,
  usuarioId: string,
  comentario?: string,
): Promise<void> {
  const estadoOption = await getSelectOptionId(
    client,
    slackLists.tareasProceso.id,
    slackColumns.tareasProceso.estado,
    estado,
  );

  const fields = [selectCell(slackColumns.tareasProceso.estado, estadoOption)];

  if (comentario !== undefined && comentario.trim() !== "") {
    fields.push(textCell(slackColumns.tareasProceso.comentario, comentario));
  }

  if (estado === "Completada") {
    const fechaCompletado = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    fields.push(
      dateCell(slackColumns.tareasProceso.fechaCompletado, fechaCompletado),
    );

    fields.push(userCell(slackColumns.tareasProceso.completadoPor, usuarioId));
  }

  await updateListItem(
    client,
    slackLists.tareasProceso.id,
    slackItemId,
    fields,
  );
}
