import type { WebClient } from "@slack/web-api";

import { EVIDENCE_STATUS } from "../constants/status.js";

import type { EvidenciaDetail } from "../repositories/evidencias-read.repository.js";

import { updateEvidenceReview } from "../repositories/evidencias.repository.js";

type ReviewEvidenceInput = {
  evidencia: EvidenciaDetail;
  usuarioId: string;
};

type RejectEvidenceInput = ReviewEvidenceInput & {
  comentario: string;
};

export async function approveEvidence(
  client: WebClient,
  input: ReviewEvidenceInput,
): Promise<void> {
  if (input.evidencia.estado !== EVIDENCE_STATUS.PENDING_REVIEW) {
    throw new Error(
      `La evidencia ya no está pendiente de revisión. ` +
        `Estado actual: ${input.evidencia.estado}`,
    );
  }

  await updateEvidenceReview(client, {
    slackItemId: input.evidencia.slackItemId,

    estado: EVIDENCE_STATUS.ACCEPTED,

    revisorFuncionalId: input.usuarioId,

    fechaRevision: new Date().toISOString().slice(0, 10),
  });
}

export async function rejectEvidence(
  client: WebClient,
  input: RejectEvidenceInput,
): Promise<void> {
  const comentario = input.comentario.trim();

  if (!comentario) {
    throw new Error("El comentario de rechazo es obligatorio");
  }

  if (input.evidencia.estado !== EVIDENCE_STATUS.PENDING_REVIEW) {
    throw new Error(
      `La evidencia ya no está pendiente de revisión. ` +
        `Estado actual: ${input.evidencia.estado}`,
    );
  }

  await updateEvidenceReview(client, {
    slackItemId: input.evidencia.slackItemId,

    estado: EVIDENCE_STATUS.REJECTED,

    revisorFuncionalId: input.usuarioId,

    fechaRevision: new Date().toISOString().slice(0, 10),

    comentarioRevision: comentario,
  });
}
