import type { WebClient } from "@slack/web-api";

import { CLOSED_PROCESS_STATUSES, TASK_STATUS } from "../constants/status.js";
import type { ProcesoListItem } from "../types/process-read.js";
import { getAllAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { getAllTareasProceso } from "../repositories/tareas-proceso-read.repository.js";
import { getMaxTareasVista } from "./runtime-config.service.js";
import { getUserPermissions } from "./authorization.service.js";

export type HomeProcessStatus = "normal" | "warning" | "overdue";

export type HomeProcessItem = ProcesoListItem & {
  semaforo: HomeProcessStatus;
};

export type HomeTaskItem = {
  taskId: string;
  procesoId: string;
  tarea: string;
  empleadoId: string;
  estado: string;
  fechaLimite: string;
  requiereEvidencia: boolean;
};

export type HomeTaskGroup = {
  procesoId: string;
  empleadoId: string;
  fechaLimite: string;
  tareasPendientes: number;
  tareas: HomeTaskItem[];
};

export type HomeAreaItem = {
  slackItemId: string;
  areaProcesoId: string;
  procesoId: string;
  areaId: string;
  areaNombre: string;
  responsableFuncionalId: string;
  estado: string;
  ordenArea: number;

  fechaAprobacion: string | null;
  aprobadoPorId: string | null;
  comentario: string | null;

  empleadoId: string;
  fechaLimite: string;

  tareasTotal: number;
  tareasObligatorias: number;
  tareasCompletadas: number;

  avance: number;
};

function isClosed(estado: string): boolean {
  return CLOSED_PROCESS_STATUSES.some((status) => status === estado);
}

function classifyProcess(
  proceso: ProcesoListItem,
  today: string,
): HomeProcessStatus {
  if (isClosed(proceso.estado)) {
    return "normal";
  }

  if (proceso.fechaLimite < today) {
    return "overdue";
  }

  if (proceso.fechaLimite === today) {
    return "warning";
  }

  return "normal";
}

export async function getHomeData(client: WebClient, userId: string) {
  const [procesos, todasLasAreas, todasLasTareas, maxTareasVista, permisos] =
    await Promise.all([
      getProcesos(client),
      getAllAreasProceso(client),
      getAllTareasProceso(client),
      getMaxTareasVista(client),
      getUserPermissions(client, userId),
    ]);
  const today = new Date().toISOString().slice(0, 10);

  const procesosActivosBase = procesos.filter(
    (proceso) => !isClosed(proceso.estado),
  );

  const procesosActivosIds = new Set(
    procesosActivosBase.map((proceso) => proceso.procesoId),
  );

  const areasActivas = todasLasAreas.filter((area) =>
    procesosActivosIds.has(area.procesoId),
  );

  const tareasActivas = todasLasTareas.filter((tarea) =>
    procesosActivosIds.has(tarea.procesoId),
  );

  const tareasUsuario = tareasActivas
    .filter(
      (tarea) =>
        tarea.responsableOperativoId === userId &&
        ![
          TASK_STATUS.COMPLETED,
          TASK_STATUS.NOT_APPLICABLE,
          TASK_STATUS.PENDING_APPROVAL,
        ].some((status) => status === tarea.estado),
    )
    .sort((a, b) => {
      if (a.fechaLimite !== b.fechaLimite) {
        return a.fechaLimite.localeCompare(b.fechaLimite);
      }

      const byProcess = a.procesoId.localeCompare(b.procesoId);

      if (byProcess !== 0) {
        return byProcess;
      }

      return a.ordenTarea - b.ordenTarea;
    });

  const areasUsuario = areasActivas
    .filter(
      (area) =>
        area.responsableFuncionalId === userId && area.estado !== "Completada",
    )
    .sort((a, b) => {
      const byProcess = a.procesoId.localeCompare(b.procesoId);

      if (byProcess !== 0) {
        return byProcess;
      }

      return a.ordenArea - b.ordenArea;
    });

  const misTareas = tareasUsuario
    .map((tarea) => {
      const proceso = procesosActivosBase.find(
        (item) => item.procesoId === tarea.procesoId,
      );

      if (!proceso) {
        return null;
      }

      return {
        taskId: tarea.taskId,
        procesoId: tarea.procesoId,
        tarea: tarea.tarea,
        empleadoId: proceso.empleadoId,
        estado: tarea.estado,
        fechaLimite: tarea.fechaLimite,
        requiereEvidencia: tarea.requiereEvidencia,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const misTareasPorProceso = Array.from(
    misTareas
      .reduce((grupos, tarea) => {
        const existente = grupos.get(tarea.procesoId);

        if (existente) {
          existente.tareas.push(tarea);

          existente.tareasPendientes = existente.tareas.length;

          return grupos;
        }

        grupos.set(tarea.procesoId, {
          procesoId: tarea.procesoId,

          empleadoId: tarea.empleadoId,

          fechaLimite: tarea.fechaLimite,

          tareasPendientes: 1,

          tareas: [tarea],
        });

        return grupos;
      }, new Map<string, HomeTaskGroup>())
      .values(),
  ).sort((a, b) => {
    const byDate = a.fechaLimite.localeCompare(b.fechaLimite);

    if (byDate !== 0) {
      return byDate;
    }

    return a.procesoId.localeCompare(b.procesoId);
  });

  const misAreas = areasUsuario
    .map((area) => {
      const proceso = procesosActivosBase.find(
        (item) => item.procesoId === area.procesoId,
      );

      if (!proceso) {
        return null;
      }

      const tareasArea = tareasActivas.filter(
        (tarea) => tarea.areaProcesoId === area.areaProcesoId,
      );

      const obligatorias = tareasArea.filter(
        (tarea) =>
          tarea.obligatoria && tarea.estado !== TASK_STATUS.NOT_APPLICABLE,
      );

      const gestionadas = obligatorias.filter((tarea) =>
        [TASK_STATUS.COMPLETED, TASK_STATUS.PENDING_APPROVAL].some(
          (status) => status === tarea.estado,
        ),
      ).length;

      const avance =
        obligatorias.length === 0
          ? 0
          : Math.round((gestionadas / obligatorias.length) * 100);

      return {
        ...area,
        empleadoId: proceso.empleadoId,
        fechaLimite: proceso.fechaLimite,
        tareasTotal: tareasArea.length,
        tareasObligatorias: obligatorias.length,
        tareasCompletadas: gestionadas,
        avance,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const activos = procesosActivosBase.map((proceso) => ({
    ...proceso,

    semaforo: classifyProcess(proceso, today),
  }));

  return {
    procesosActivos: activos,
    misTareas,
    misTareasPorProceso,
    misAreas,
    permisos,
    configuracion: {
      maxTareasVista,
    },

    resumen: {
      activos: activos.length,
      vencidos: activos.filter((proceso) => proceso.semaforo === "overdue")
        .length,
      vencenHoy: activos.filter((proceso) => proceso.semaforo === "warning")
        .length,
      misTareas: misTareas.length,
      misAreas: misAreas.length,
    },
  };
}
