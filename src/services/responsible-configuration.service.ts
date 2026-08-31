import type { WebClient } from "@slack/web-api";

import {
  getConfigTareas,
  updateConfigTareaResponsableOperativo,
} from "../repositories/config-tareas.repository.js";

import {
  getAreas,
  updateAreaResponsableFuncional,
} from "../repositories/areas.repository.js";

import { createAuditEvent } from "../repositories/auditoria.repository.js";

import { canAdministerPys } from "./authorization.service.js";

import { eventId } from "../utils/entity-id.js";

type ChangeMasterResponsibleInput = {
  ejecutadoPorId: string;
  responsableAnteriorId: string;
  nuevoResponsableId: string;
  motivo: string;
  idsSeleccionados: string[];
  cid: string;
};

export type MasterOperativeChangeResult = {
  actualizadas: number;

  responsabilidades: Array<{
    configId: string;
    areaNombre: string;
    tarea: string;
  }>;
};

export type MasterFunctionalChangeResult = {
  actualizadas: number;

  responsabilidades: Array<{
    areaId: string;
    areaNombre: string;
  }>;
};

export async function changeMasterOperativeResponsible(
  client: WebClient,
  input: ChangeMasterResponsibleInput,
): Promise<MasterOperativeChangeResult> {
  const autorizado = await canAdministerPys(client, input.ejecutadoPorId);

  if (!autorizado) {
    throw new Error(
      "Usuario no autorizado para modificar configuración maestra",
    );
  }

  const [configs, areas] = await Promise.all([
    getConfigTareas(client),
    getAreas(client),
  ]);

  const seleccionadas = configs.filter(
    (item) =>
      input.idsSeleccionados.includes(item.id) &&
      item.activo &&
      item.responsableOperativo === input.responsableAnteriorId,
  );

  if (seleccionadas.length !== input.idsSeleccionados.length) {
    throw new Error(
      "Una o más configuraciones cambiaron desde que se abrió el modal",
    );
  }

  for (const config of seleccionadas) {
    await updateConfigTareaResponsableOperativo(
      client,
      config.slackItemId,
      input.nuevoResponsableId,
    );

    await createAuditEvent(client, {
      eventId: eventId(),
      correlationId: input.cid,
      procesoId: "CAMBIO CONFI RESP OPE",
      entidadTipo: "Configuracion",
      entidadId: config.id,
      accion: "CAMBIAR_RESPONSABLE_OPERATIVO_CONFIG",
      usuarioId: input.ejecutadoPorId,
      fechaHoraUtc: new Date().toISOString(),
      estadoAnterior: input.responsableAnteriorId,
      estadoNuevo: input.nuevoResponsableId,
      detalle: `Tarea: ${config.tarea}. Motivo: ${input.motivo}`,
    });
  }

  return {
    actualizadas: seleccionadas.length,

    responsabilidades: seleccionadas.map((config) => {
      const area = areas.find((item) => item.id === config.areaId);

      return {
        configId: config.id,

        areaNombre: area?.nombre ?? config.areaId,

        tarea: config.tarea,
      };
    }),
  };
}

export async function changeMasterFunctionalResponsible(
  client: WebClient,
  input: ChangeMasterResponsibleInput,
): Promise<MasterFunctionalChangeResult> {
  const autorizado = await canAdministerPys(client, input.ejecutadoPorId);

  if (!autorizado) {
    throw new Error(
      "Usuario no autorizado para modificar configuración maestra",
    );
  }

  const areas = await getAreas(client);

  const seleccionadas = areas.filter(
    (area) =>
      input.idsSeleccionados.includes(area.id) &&
      area.activo &&
      area.responsableFuncional === input.responsableAnteriorId,
  );

  if (seleccionadas.length !== input.idsSeleccionados.length) {
    throw new Error("Una o más áreas cambiaron desde que se abrió el modal");
  }

  for (const area of seleccionadas) {
    await updateAreaResponsableFuncional(
      client,
      area.slackItemId,
      input.nuevoResponsableId,
    );

    await createAuditEvent(client, {
      eventId: eventId(),
      correlationId: input.cid,
      procesoId: "CAMBIO CONFI RESP FUNC",
      entidadTipo: "Configuracion",
      entidadId: area.id,
      accion: "CAMBIAR_RESPONSABLE_FUNCIONAL_CONFIG",
      usuarioId: input.ejecutadoPorId,
      fechaHoraUtc: new Date().toISOString(),
      estadoAnterior: input.responsableAnteriorId,
      estadoNuevo: input.nuevoResponsableId,
      detalle: `Área: ${area.nombre}. Motivo: ${input.motivo}`,
    });
  }

  return {
    actualizadas: seleccionadas.length,

    responsabilidades: seleccionadas.map((area) => ({
      areaId: area.id,

      areaNombre: area.nombre,
    })),
  };
}
