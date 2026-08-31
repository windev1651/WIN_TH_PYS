import type { WebClient } from "@slack/web-api";

import { createAuditEvent } from "../repositories/auditoria.repository.js";
import { getAreaByAreaProcesoId } from "../repositories/areas-proceso-read.repository.js";
import { updateAreaResponsableFuncional } from "../repositories/areas-proceso.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { canAdministerPys } from "./authorization.service.js";
import { eventId } from "../utils/entity-id.js";

type ReassignFunctionalInput = {
  procesoId: string;
  areaProcesoId: string;

  usuarioEjecutorId: string;
  nuevoResponsableId: string;

  motivo: string;
  cid: string;
};

export type ReassignFunctionalResult = {
  procesoId: string;

  areaProcesoId: string;
  areaNombre: string;

  responsableAnteriorId: string;
  responsableNuevoId: string;

  motivo: string;
};

export async function reassignFunctional(
  client: WebClient,
  input: ReassignFunctionalInput,
): Promise<ReassignFunctionalResult> {
  const autorizado = await canAdministerPys(client, input.usuarioEjecutorId);

  if (!autorizado) {
    throw new Error(
      "Usuario no autorizado para reasignar responsables funcionales",
    );
  }

  if (!input.motivo.trim()) {
    throw new Error("El motivo de la reasignación es obligatorio");
  }

  const [procesos, area] = await Promise.all([
    getProcesos(client),

    getAreaByAreaProcesoId(client, input.areaProcesoId),
  ]);

  const proceso = procesos.find((item) => item.procesoId === input.procesoId);

  if (!proceso) {
    throw new Error(`Proceso no encontrado: ${input.procesoId}`);
  }

  if (!area) {
    throw new Error(`Área no encontrada: ${input.areaProcesoId}`);
  }

  /*
   * Protección contra manipulación
   * del metadata/payload.
   */
  if (area.procesoId !== input.procesoId) {
    throw new Error("El área no pertenece al proceso indicado");
  }

  if (
    ["Finalizado", "Finalizado con excepción", "Cancelado"].includes(
      proceso.estado,
    )
  ) {
    throw new Error("No se puede modificar un proceso cerrado");
  }

  if (area.estado === "Completada") {
    throw new Error("No se puede reasignar una área ya completada");
  }

  if (area.responsableFuncionalId === input.nuevoResponsableId) {
    throw new Error(
      "El nuevo responsable es el mismo responsable funcional actual",
    );
  }

  /*
   * Validamos que el nuevo usuario
   * esté activo en Slack.
   */
  const userInfo = await client.users.info({
    user: input.nuevoResponsableId,
  });

  if (!userInfo.user || userInfo.user.deleted) {
    throw new Error("El usuario seleccionado está desactivado en Slack");
  }

  const responsableAnteriorId = area.responsableFuncionalId;

  await updateAreaResponsableFuncional(
    client,
    area.slackItemId,
    input.nuevoResponsableId,
  );

  await createAuditEvent(client, {
    eventId: eventId(),
    correlationId: input.cid,
    procesoId: input.procesoId,
    entidadTipo: "AreaProceso",
    entidadId: area.areaProcesoId,
    accion: "REASIGNAR_RESPONSABLE_FUNCIONAL",
    usuarioId: input.usuarioEjecutorId,
    fechaHoraUtc: new Date().toISOString(),
    estadoAnterior: responsableAnteriorId,
    estadoNuevo: input.nuevoResponsableId,
    detalle: input.motivo.trim(),
  });

  return {
    procesoId: input.procesoId,
    areaProcesoId: area.areaProcesoId,
    areaNombre: area.areaNombre,
    responsableAnteriorId,
    responsableNuevoId: input.nuevoResponsableId,
    motivo: input.motivo.trim(),
  };
}
