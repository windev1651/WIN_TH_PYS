import type { WebClient } from "@slack/web-api";

import { getAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { getTareasProceso } from "../repositories/tareas-proceso-read.repository.js";
import type { ProcessDetail } from "../types/process-detail.js";

export async function getProcessDetail(
  client: WebClient,
  procesoId: string,
): Promise<ProcessDetail> {
  const [procesos, areas, tareas] = await Promise.all([
    getProcesos(client),
    getAreasProceso(client, procesoId),
    getTareasProceso(client, procesoId),
  ]);

  const proceso = procesos.find((item) => item.procesoId === procesoId);

  if (!proceso) {
    throw new Error(`No se encontró el proceso ${procesoId}`);
  }

  return {
    procesoId: proceso.procesoId,
    empleadoId: proceso.empleadoId,
    tipoSolicitudId: proceso.tipoSolicitudId,
    estado: proceso.estado,
    fechaInicio: proceso.fechaInicio,
    fechaSalida: proceso.fechaSalida,
    fechaLimite: proceso.fechaLimite,
    porcentajeAvance: proceso.porcentajeAvance,
    comentarioTH: proceso.comentarioTH,

    areas: areas.map((area) => ({
      ...area,

      tareas: tareas.filter(
        (tarea) => tarea.areaProcesoId === area.areaProcesoId,
      ),
    })),
  };
}
