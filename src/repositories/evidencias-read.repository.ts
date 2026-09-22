import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import { getSelectOptionMap } from "../services/slack-list-schema.service.js";
import { getAllListItems } from "../services/slack-list-read.service.js";
import {
  getDateField,
  getLinkField,
  getSelectField,
  getTextField,
  getUserField,
  type SlackListItem,
} from "./list-helpers.js";

export type EvidenciaDetail = {
  slackItemId: string;
  evidenceId: string;
  procesoId: string;
  taskId: string;

  slackFileId: string;
  nombreOriginal: string;

  autorId: string | null;
  fechaCarga: string | null;

  estado: string;

  slackPermalink: string | null;
};

export async function getEvidenciasByProceso(
  client: WebClient,
  procesoId: string,
): Promise<EvidenciaDetail[]> {
  const items = await getAllListItems(client, slackLists.evidencias.id);

  const evidencias = await parseEvidencias(client, items);

  return evidencias.filter((item) => item.procesoId === procesoId);
}

export async function getEvidenciaById(
  client: WebClient,
  evidenceId: string,
): Promise<EvidenciaDetail | null> {
  const items = await getAllListItems(client, slackLists.evidencias.id);

  const evidencias = await parseEvidencias(client, items);

  return evidencias.find((item) => item.evidenceId === evidenceId) ?? null;
}

export async function getEvidenciasByTask(
  client: WebClient,
  taskId: string,
): Promise<EvidenciaDetail[]> {
  const items = await getAllListItems(client, slackLists.evidencias.id);

  const evidencias = await parseEvidencias(client, items);

  return evidencias.filter((item) => item.taskId === taskId);
}

async function parseEvidencias(
  client: WebClient,
  items: SlackListItem[],
): Promise<EvidenciaDetail[]> {
  const estadoMap = await getSelectOptionMap(
    client,
    slackLists.evidencias.id,
    slackColumns.evidencias.estado,
  );

  return items
    .map((item): EvidenciaDetail | null => {
      if (!item.id) {
        return null;
      }

      const evidenceId = getTextField(item, slackColumns.evidencias.evidenceId);

      const procesoId = getTextField(item, slackColumns.evidencias.procesoId);

      const taskId = getTextField(item, slackColumns.evidencias.taskId);

      const estadoOptionId = getSelectField(
        item,
        slackColumns.evidencias.estado,
      );

      const estado = estadoOptionId ? estadoMap.get(estadoOptionId) : null;
      const slackFileId = getTextField(
        item,
        slackColumns.evidencias.slackFileId,
      );

      const nombreOriginal = getTextField(
        item,
        slackColumns.evidencias.nombreOriginal,
      );

      const autorId = getUserField(item, slackColumns.evidencias.autor);
      const fechaCarga = getDateField(item, slackColumns.evidencias.fechaCarga);
      const slackPermalink = getLinkField(
        item,
        slackColumns.evidencias.slackPermalink,
      );

      //tests
      // console.log("DEBUG EVIDENCIA LINK", {
      //   evidenceId,
      //   slackPermalink,
      // });
      // const permalinkField = item.fields?.find(
      //   (field) => field.column_id === slackColumns.evidencias.slackPermalink,
      // );

      // console.log(
      //   "DEBUG PERMALINK FIELD",
      //   JSON.stringify(permalinkField, null, 2),
      // );
      //tests permalink

      if (
        !evidenceId ||
        !procesoId ||
        !taskId ||
        !estado ||
        !slackFileId ||
        !nombreOriginal
      ) {
        return null;
      }

      return {
        slackItemId: item.id,

        evidenceId,
        procesoId,
        taskId,

        slackFileId,
        nombreOriginal,

        autorId,
        fechaCarga,

        estado,

        slackPermalink,
      };
    })
    .filter((item): item is EvidenciaDetail => item !== null);
}
