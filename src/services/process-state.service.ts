import type { WebClient } from "@slack/web-api";

import { createAuditEvent } from "../repositories/auditoria.repository.js";
import { getAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { updateProcesoEstado } from "../repositories/procesos.repository.js";
import { eventId } from "../utils/entity-id.js";

type RecalculateProcessStateInput = {
  procesoId: string;
  usuarioId: string;
  cid: string;
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
  const [procesos, areas] = await Promise.all([
    getProcesos(client),
    getAreasProceso(client, input.procesoId),
  ]);

  const proceso = procesos.find((item) => item.procesoId === input.procesoId);

  if (!proceso) {
    throw new Error(`Proceso no encontrado: ${input.procesoId}`);
  }

  if (areas.length === 0) {
    throw new Error(`El proceso ${input.procesoId} no tiene áreas`);
  }

  const todasLasAreasCompletadas = areas.every(
    (area) => area.estado === "Completada",
  );

  const estadoNuevo = todasLasAreasCompletadas
    ? "Pendiente de aprobación"
    : "En ejecución";

  /*
   * No devolvemos un proceso Finalizado
   * nuevamente a En ejecución.
   */
  if (proceso.estado === "Finalizado" || proceso.estado === "Cancelado") {
    return {
      procesoId: proceso.procesoId,
      estadoAnterior: proceso.estado,
      estadoNuevo: proceso.estado,
      cambioEstado: false,
      listoParaCierre: proceso.estado === "Finalizado",
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
