import type { WebClient } from "@slack/web-api";

import { getFestivos } from "../repositories/festivos.repository.js";
import { getNumberParametro, getMasterData } from "./master-data.service.js";
import { addBusinessDays } from "./business-days.service.js";
import { areaProcessId, processId, taskId } from "../utils/entity-id.js";
import type {
  AreaProcesoSnapshot,
  ProcessSnapshot,
  ProcessSnapshotInput,
  TareaProcesoSnapshot,
} from "../types/process.js";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function buildProcessSnapshot(
  client: WebClient,
  input: ProcessSnapshotInput,
): Promise<ProcessSnapshot> {
  const [masterData, festivos] = await Promise.all([
    getMasterData(client),
    getFestivos(client),
  ]);

  const tipoSolicitud = masterData.tiposSolicitud.find(
    (tipo) => tipo.id === input.tipoSolicitudId,
  );

  if (!tipoSolicitud) {
    throw new Error(
      `Tipo de solicitud inválido o inactivo: ${input.tipoSolicitudId}`,
    );
  }

  const configTareas = masterData.configTareas.filter(
    (tarea) => tarea.tipoSolicitudId === input.tipoSolicitudId,
  );

  if (configTareas.length === 0) {
    throw new Error(`No existen tareas activas para ${input.tipoSolicitudId}`);
  }

  const diasHabiles = getNumberParametro(
    masterData.parametros,
    "DiasHabilesProceso",
  );

  const fechaInicio = new Date(`${input.fechaInicio}T00:00:00Z`);

  const fechaLimite = formatDate(
    addBusinessDays(fechaInicio, diasHabiles, festivos),
  );

  const newProcessId = processId();

  const areaIds = [...new Set(configTareas.map((tarea) => tarea.areaId))];

  const areas: AreaProcesoSnapshot[] = [];

  const areaProcessIdMap = new Map<string, string>();

  for (const areaId of areaIds) {
    const area = masterData.areas.find((current) => current.id === areaId);

    if (!area) {
      throw new Error(`Área ${areaId} no existe o está inactiva`);
    }

    const newAreaProcessId = areaProcessId();

    areaProcessIdMap.set(areaId, newAreaProcessId);

    const tareasArea = configTareas.filter((tarea) => tarea.areaId === areaId);

    const ordenArea = Math.min(...tareasArea.map((tarea) => tarea.ordenArea));

    areas.push({
      areaProcesoId: newAreaProcessId,
      procesoId: newProcessId,
      areaIdSnapshot: area.id,
      areaNombreSnapshot: area.nombre,
      responsableFuncionalSnapshot: area.responsableFuncional,
      estado: "Pendiente",
      ordenArea,
    });
  }

  const tareas: TareaProcesoSnapshot[] = configTareas.map((config) => {
    const newAreaProcessId = areaProcessIdMap.get(config.areaId);

    if (!newAreaProcessId) {
      throw new Error(`No se pudo resolver AreaProceso para ${config.areaId}`);
    }

    return {
      taskId: taskId(),
      procesoId: newProcessId,
      areaProcesoId: newAreaProcessId,
      configTareaIdOrigen: config.id,
      tareaSnapshot: config.tarea,
      responsableOperativoSnapshot: config.responsableOperativo,
      obligatoria: config.obligatoria,
      requiereEvidencia: config.requiereEvidencia,
      estado: "Pendiente",
      fechaLimite,
      comentario: "",
      ordenTarea: config.ordenTarea,
    };
  });

  return {
    proceso: {
      procesoId: newProcessId,
      tipoSolicitudId: input.tipoSolicitudId,
      empleadoId: input.empleadoId,
      creadoPorId: input.creadoPorId,
      fechaInicio: input.fechaInicio,
      fechaSalida: input.fechaSalida,
      fechaLimite,
      estado: "En ejecución",
      porcentajeAvance: 0,
      cierreExcepcion: false,
      comentarioTH: input.comentarioTH ?? "",
    },
    areas: areas.sort((a, b) => a.ordenArea - b.ordenArea),
    tareas: tareas.sort((a, b) => {
      const areaA = areas.find(
        (area) => area.areaProcesoId === a.areaProcesoId,
      );

      const areaB = areas.find(
        (area) => area.areaProcesoId === b.areaProcesoId,
      );

      return (
        (areaA?.ordenArea ?? 0) - (areaB?.ordenArea ?? 0) ||
        a.ordenTarea - b.ordenTarea
      );
    }),
  };
}
