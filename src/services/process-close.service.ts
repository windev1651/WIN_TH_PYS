import type { WebClient } from "@slack/web-api";

import { createAuditEvent } from "../repositories/auditoria.repository.js";
import { getAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { closeProcesoItem } from "../repositories/procesos.repository.js";
import { eventId } from "../utils/entity-id.js";

type CloseProcessInput = {
  procesoId: string;
  usuarioId: string;
  comentario?: string;
  cid: string;
};

export async function closeProcess(
  client: WebClient,
  input: CloseProcessInput,
) {
  const [procesos, areas] = await Promise.all([
    getProcesos(client),
    getAreasProceso(client, input.procesoId),
  ]);

  const proceso = procesos.find((item) => item.procesoId === input.procesoId);

  if (!proceso) {
    throw new Error(`Proceso no encontrado: ${input.procesoId}`);
  }

  /*
   * Idempotencia.
   */
  if (proceso.estado === "Finalizado") {
    return {
      procesoId: proceso.procesoId,
      empleadoId: proceso.empleadoId,
      alreadyClosed: true,
    };
  }

  /*
   * Solo permitimos cierre ordinario
   * cuando el proceso llegó al estado
   * generado por todas las áreas aprobadas.
   */
  if (proceso.estado !== "Pendiente de aprobación") {
    throw new Error(
      `El proceso no está listo para cierre. Estado actual: ${proceso.estado}`,
    );
  }

  if (areas.length === 0) {
    throw new Error(`El proceso ${input.procesoId} no tiene áreas`);
  }

  const areasPendientes = areas.filter((area) => area.estado !== "Completada");

  if (areasPendientes.length > 0) {
    throw new Error(
      `El proceso aún tiene ${areasPendientes.length} área(s) pendiente(s)`,
    );
  }

  await closeProcesoItem(
    client,
    proceso.slackItemId,
    input.usuarioId,
    input.comentario,
  );

  await createAuditEvent(client, {
    eventId: eventId(),
    correlationId: input.cid,

    procesoId: proceso.procesoId,

    entidadTipo: "Proceso",

    entidadId: proceso.procesoId,

    accion: "CERRAR_PROCESO",

    usuarioId: input.usuarioId,

    fechaHoraUtc: new Date().toISOString(),

    estadoAnterior: proceso.estado,

    estadoNuevo: "Finalizado",

    detalle: input.comentario?.trim()
      ? input.comentario.trim()
      : "Proceso cerrado por Talento Humano",
  });

  return {
    procesoId: proceso.procesoId,

    empleadoId: proceso.empleadoId,

    alreadyClosed: false,
  };
}
