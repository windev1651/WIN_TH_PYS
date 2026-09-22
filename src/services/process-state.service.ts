import type { WebClient } from "@slack/web-api";
import type { AreaProcesoDetail } from "../types/process-detail.js";

import { createAuditEvent } from "../repositories/auditoria.repository.js";
import { getAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { updateProcesoEstado } from "../repositories/procesos.repository.js";
import { eventId } from "../utils/entity-id.js";

import {
  AREA_STATUS,
  CLOSED_PROCESS_STATUSES,
  PROCESS_STATUS,
} from "../constants/status.js";

type ProcesoSnapshot = Awaited<ReturnType<typeof getProcesos>>[number];

type AreaSnapshot = Awaited<ReturnType<typeof getAreasProceso>>[number];

type RecalculateProcessStateInput = {
  procesoId: string;
  usuarioId: string;
  cid: string;

  proceso?: ProcesoSnapshot;
  areas?: AreaSnapshot[];
};

export type RecalculateProcessStateResult = {
  procesoId: string;
  estadoAnterior: string;
  estadoNuevo: string;
  cambioEstado: boolean;
  listoParaCierre: boolean;
};

export async function recalculateProcessState(
  client: WebClient,
  input: RecalculateProcessStateInput,
): Promise<RecalculateProcessStateResult> {
  const procesosPromise = getProcesos(client);

  const areasPromise = input.areas
    ? Promise.resolve(input.areas)
    : getAreasProceso(client, input.procesoId);

  const proceso =
    input.proceso ??
    (await getProcesos(client)).find(
      (item) => item.procesoId === input.procesoId,
    );

  const areas = input.areas ?? (await getAreasProceso(client, input.procesoId));

  if (!proceso) {
    throw new Error(`Proceso no encontrado: ${input.procesoId}`);
  }

  if (areas.length === 0) {
    throw new Error(`El proceso ${input.procesoId} no tiene áreas`);
  }

  const todasLasAreasCompletadas = areas.every(
    (area) => area.estado === AREA_STATUS.COMPLETED,
  );

  const estadoNuevo = todasLasAreasCompletadas
    ? PROCESS_STATUS.PENDING_APPROVAL
    : PROCESS_STATUS.IN_PROGRESS;

  /*
   * No devolvemos un proceso Finalizado
   * nuevamente a En ejecución.
   */
  if (CLOSED_PROCESS_STATUSES.some((status) => status === proceso.estado)) {
    return {
      procesoId: proceso.procesoId,
      estadoAnterior: proceso.estado,
      estadoNuevo: proceso.estado,
      cambioEstado: false,
      listoParaCierre: proceso.estado === PROCESS_STATUS.COMPLETED,
    };
  }

  if (proceso.estado === estadoNuevo) {
    return {
      procesoId: proceso.procesoId,
      estadoAnterior: proceso.estado,
      estadoNuevo: proceso.estado,
      cambioEstado: false,
      listoParaCierre: todasLasAreasCompletadas,
    };
  }

  await updateProcesoEstado(client, proceso.slackItemId, estadoNuevo);

  await createAuditEvent(client, {
    eventId: eventId(),
    correlationId: input.cid,
    procesoId: proceso.procesoId,
    entidadTipo: "Proceso",
    entidadId: proceso.procesoId,
    accion: "CAMBIAR_ESTADO_PROCESO",
    usuarioId: input.usuarioId,
    fechaHoraUtc: new Date().toISOString(),
    estadoAnterior: proceso.estado,
    estadoNuevo,
    detalle: todasLasAreasCompletadas
      ? "Todas las áreas fueron completadas. Proceso listo para cierre por Talento Humano."
      : "El proceso mantiene áreas pendientes.",
  });

  return {
    procesoId: proceso.procesoId,
    estadoAnterior: proceso.estado,
    estadoNuevo,
    cambioEstado: true,
    listoParaCierre: todasLasAreasCompletadas,
  };
}
