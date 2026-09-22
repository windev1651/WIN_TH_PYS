import type { WebClient } from "@slack/web-api";

import { slackLists } from "../config/slack/lists.js";
import { slackColumns } from "../config/slack/columns.js";
import {
  createListItem,
  dateCell,
  linkCell,
  numberCell,
  selectCell,
  textCell,
  updateListItem,
  userCell,
} from "../services/slack-list-write.service.js";

import { getSelectOptionId } from "../services/slack-list-schema.service.js";

export type CreateEvidenceInput = {
  evidenceId: string;
  procesoId: string;
  taskId: string;
  slackFileId: string;
  nombreOriginal: string;
  tipoArchivoOptionId: string;
  tamanoBytes: number;
  autorId: string;
  fechaCarga: string;
  estadoOptionId: string;
  slackPermalink: string;
};

export async function createEvidence(
  client: WebClient,
  input: CreateEvidenceInput,
): Promise<string> {
  return createListItem(client, slackLists.evidencias.id, [
    textCell(slackColumns.evidencias.evidenceId, input.evidenceId),
    textCell(slackColumns.evidencias.procesoId, input.procesoId),
    textCell(slackColumns.evidencias.taskId, input.taskId),
    textCell(slackColumns.evidencias.slackFileId, input.slackFileId),
    textCell(slackColumns.evidencias.nombreOriginal, input.nombreOriginal),
    selectCell(slackColumns.evidencias.tipoArchivo, input.tipoArchivoOptionId),
    numberCell(slackColumns.evidencias.tamanoBytes, input.tamanoBytes),
    userCell(slackColumns.evidencias.autor, input.autorId),
    dateCell(slackColumns.evidencias.fechaCarga, input.fechaCarga),
    selectCell(slackColumns.evidencias.estado, input.estadoOptionId),
    linkCell(
      slackColumns.evidencias.slackPermalink,
      input.slackPermalink,
      input.nombreOriginal,
    ),
  ]);
}

export async function updateEvidenceReview(
  client: WebClient,
  input: {
    slackItemId: string;
    estado: "Aceptada" | "Rechazada";
    revisorFuncionalId: string;
    fechaRevision: string;
    comentarioRevision?: string;
  },
): Promise<void> {
  const estadoOptionId = await getSelectOptionId(
    client,
    slackLists.evidencias.id,
    slackColumns.evidencias.estado,
    input.estado,
  );

  const fields = [
    selectCell(slackColumns.evidencias.estado, estadoOptionId),

    userCell(
      slackColumns.evidencias.revisorFuncional,
      input.revisorFuncionalId,
    ),

    dateCell(slackColumns.evidencias.fechaRevision, input.fechaRevision),
  ];

  if (input.comentarioRevision?.trim()) {
    fields.push(
      textCell(
        slackColumns.evidencias.comentarioRevision,
        input.comentarioRevision.trim(),
      ),
    );
  }

  await updateListItem(
    client,
    slackLists.evidencias.id,
    input.slackItemId,
    fields,
  );
}
