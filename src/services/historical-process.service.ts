import type { WebClient } from "@slack/web-api";

import { PROCESS_STATUS } from "../constants/status.js";
import { getAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import {
  getAuditEvents,
  type AuditEventRead,
} from "../repositories/auditoria-read.repository.js";
import { getEvidenciasByProceso } from "../repositories/evidencias-read.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { getTareasProceso } from "../repositories/tareas-proceso-read.repository.js";

export type HistoricalProcessFilters = {
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
};

export type HistoricalProcessItem = {
  procesoId: string;
  empleadoId: string;
  tipoSolicitudId: string;
  estado: string;
  creadoPorId: string;
  fechaInicio: string;
  fechaSalida: string;
  fechaLimite: string;
  fechaCierre: string | null;
  cerradoPorId: string | null;
  cierreExcepcion: boolean;
  comentarioTH: string | null;
  closedAtUtc: string | null;
};

export type HistoricalTask = {
  taskId: string;
  tarea: string;
  estado: string;
  responsableOperativoId: string;
  gestionadoPorId: string | null;
  gestionadoEnUtc: string | null;
  aprobadoPorId: string | null;
  aprobadoEnUtc: string | null;
  comentario: string | null;
  requiereEvidencia: boolean;
};

export type HistoricalArea = {
  areaProcesoId: string;
  areaNombre: string;
  responsableFuncionalId: string;
  completadaPorId: string | null;
  completadaEnUtc: string | null;
  tareas: HistoricalTask[];
};

export type HistoricalProcessDataset = {
  proceso: HistoricalProcessItem;
  areas: HistoricalArea[];
};

const HISTORICAL_STATUSES = [
  PROCESS_STATUS.COMPLETED,
  PROCESS_STATUS.COMPLETED_WITH_EXCEPTION,
] as const;

function findLastEvent(
  events: AuditEventRead[],
  actions: string[],
  entityIds: Set<string>,
): AuditEventRead | null {
  const matches = events.filter(
    (event) => actions.includes(event.accion) && entityIds.has(event.entidadId),
  );

  return matches.length > 0 ? matches[matches.length - 1]! : null;
}

function getClosedEvent(
  events: AuditEventRead[],
  procesoId: string,
): AuditEventRead | null {
  return findLastEvent(
    events,
    ["CERRAR_PROCESO", "CERRAR_PROCESO_EXCEPCION"],
    new Set([procesoId]),
  );
}

export async function searchHistoricalProcesses(
  client: WebClient,
  filters: HistoricalProcessFilters,
): Promise<HistoricalProcessItem[]> {
  const [procesos, auditEvents] = await Promise.all([
    getProcesos(client),
    getAuditEvents(client),
  ]);

  return procesos
    .filter((proceso) =>
      HISTORICAL_STATUSES.some((status) => status === proceso.estado),
    )
    .filter(
      (proceso) => !filters.employeeId || proceso.empleadoId === filters.employeeId,
    )
    .filter(
      (proceso) => !filters.status || proceso.estado === filters.status,
    )
    .filter(
      (proceso) =>
        !filters.dateFrom ||
        Boolean(proceso.fechaCierre && proceso.fechaCierre >= filters.dateFrom),
    )
    .filter(
      (proceso) =>
        !filters.dateTo ||
        Boolean(proceso.fechaCierre && proceso.fechaCierre <= filters.dateTo),
    )
    .map((proceso) => {
      const closeEvent = getClosedEvent(auditEvents, proceso.procesoId);

      return {
        procesoId: proceso.procesoId,
        empleadoId: proceso.empleadoId,
        tipoSolicitudId: proceso.tipoSolicitudId,
        estado: proceso.estado,
        creadoPorId: proceso.creadoPorId,
        fechaInicio: proceso.fechaInicio,
        fechaSalida: proceso.fechaSalida,
        fechaLimite: proceso.fechaLimite,
        fechaCierre: proceso.fechaCierre,
        cerradoPorId: proceso.cerradoPorId,
        cierreExcepcion: proceso.cierreExcepcion,
        comentarioTH: proceso.comentarioTH,
        closedAtUtc: closeEvent?.fechaHoraUtc ?? null,
      };
    })
    .sort((a, b) => {
      const byCloseDate = (b.fechaCierre ?? "").localeCompare(
        a.fechaCierre ?? "",
      );

      if (byCloseDate !== 0) {
        return byCloseDate;
      }

      return b.procesoId.localeCompare(a.procesoId);
    });
}

export async function getHistoricalProcessDataset(
  client: WebClient,
  procesoId: string,
): Promise<HistoricalProcessDataset> {
  const [procesos, areas, tareas, evidencias, auditEvents] = await Promise.all([
    getProcesos(client),
    getAreasProceso(client, procesoId),
    getTareasProceso(client, procesoId),
    getEvidenciasByProceso(client, procesoId),
    getAuditEvents(client, procesoId),
  ]);

  const proceso = procesos.find((item) => item.procesoId === procesoId);

  if (!proceso) {
    throw new Error(`Proceso no encontrado: ${procesoId}`);
  }

  if (!HISTORICAL_STATUSES.some((status) => status === proceso.estado)) {
    throw new Error(`El proceso ${procesoId} no está finalizado`);
  }

  const closeEvent = getClosedEvent(auditEvents, procesoId);
  const evidenceIdsByTask = new Map<string, Set<string>>();

  for (const evidence of evidencias) {
    const ids = evidenceIdsByTask.get(evidence.taskId) ?? new Set<string>();
    ids.add(evidence.evidenceId);
    evidenceIdsByTask.set(evidence.taskId, ids);
  }

  const historicalAreas = areas.map((area): HistoricalArea => {
    const areaEvent = findLastEvent(
      auditEvents,
      ["APROBAR_AREA"],
      new Set([area.areaProcesoId]),
    );

    const historicalTasks = tareas
      .filter((tarea) => tarea.areaProcesoId === area.areaProcesoId)
      .map((tarea): HistoricalTask => {
        const taskEntityIds = new Set([tarea.taskId]);
        const evidenceEntityIds = evidenceIdsByTask.get(tarea.taskId) ?? new Set();

        const operationEvent =
          findLastEvent(
            auditEvents,
            ["ENVIAR_TAREA_APROBACION", "AUTOAPROBAR_TAREA"],
            taskEntityIds,
          ) ??
          findLastEvent(
            auditEvents,
            ["CARGAR_EVIDENCIA", "CARGAR_EVIDENCIA_AUTOAPROBADA"],
            evidenceEntityIds,
          );

        const approvalEvent =
          findLastEvent(
            auditEvents,
            ["APROBAR_TAREA", "AUTOAPROBAR_TAREA"],
            taskEntityIds,
          ) ??
          findLastEvent(
            auditEvents,
            ["CARGAR_EVIDENCIA_AUTOAPROBADA"],
            evidenceEntityIds,
          );

        return {
          taskId: tarea.taskId,
          tarea: tarea.tarea,
          estado: tarea.estado,
          responsableOperativoId: tarea.responsableOperativoId,
          gestionadoPorId: operationEvent?.usuarioId ?? null,
          gestionadoEnUtc: operationEvent?.fechaHoraUtc ?? null,
          aprobadoPorId: approvalEvent?.usuarioId ?? null,
          aprobadoEnUtc: approvalEvent?.fechaHoraUtc ?? null,
          comentario: tarea.comentario,
          requiereEvidencia: tarea.requiereEvidencia,
        };
      });

    return {
      areaProcesoId: area.areaProcesoId,
      areaNombre: area.areaNombre,
      responsableFuncionalId: area.responsableFuncionalId,
      completadaPorId: areaEvent?.usuarioId ?? area.aprobadoPorId,
      completadaEnUtc: areaEvent?.fechaHoraUtc ?? null,
      tareas: historicalTasks,
    };
  });

  return {
    proceso: {
      procesoId: proceso.procesoId,
      empleadoId: proceso.empleadoId,
      tipoSolicitudId: proceso.tipoSolicitudId,
      estado: proceso.estado,
      creadoPorId: proceso.creadoPorId,
      fechaInicio: proceso.fechaInicio,
      fechaSalida: proceso.fechaSalida,
      fechaLimite: proceso.fechaLimite,
      fechaCierre: proceso.fechaCierre,
      cerradoPorId: proceso.cerradoPorId,
      cierreExcepcion: proceso.cierreExcepcion,
      comentarioTH: proceso.comentarioTH,
      closedAtUtc: closeEvent?.fechaHoraUtc ?? null,
    },
    areas: historicalAreas,
  };
}

export function formatBogotaDateTime(isoUtc: string | null): string {
  if (!isoUtc) {
    return "No disponible";
  }

  const date = new Date(isoUtc);

  if (Number.isNaN(date.getTime())) {
    return isoUtc;
  }

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
