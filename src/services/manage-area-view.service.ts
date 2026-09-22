import type { WebClient } from "@slack/web-api";

import { getAllAreasProceso } from "../repositories/areas-proceso-read.repository.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { getEvidenciasByProceso } from "../repositories/evidencias-read.repository.js";
import { getTareasProceso } from "../repositories/tareas-proceso-read.repository.js";
import { buildManageAreaView } from "../views/manage-area.view.js";

type LoadManageAreaViewInput = {
  areaProcesoId: string;
  usuarioId: string;
  cid: string;
};

export async function loadManageAreaView(
  client: WebClient,
  input: LoadManageAreaViewInput,
) {
  const [procesos, todasLasAreas] = await Promise.all([
    getProcesos(client),
    getAllAreasProceso(client),
  ]);

  const targetArea = todasLasAreas.find(
    (area) => area.areaProcesoId === input.areaProcesoId,
  );

  if (!targetArea) {
    throw new Error(`Área no encontrada: ${input.areaProcesoId}`);
  }

  if (targetArea.responsableFuncionalId !== input.usuarioId) {
    throw new Error("El usuario no es responsable funcional de esta área");
  }

  const proceso = procesos.find(
    (item) => item.procesoId === targetArea.procesoId,
  );

  if (!proceso) {
    throw new Error(`Proceso no encontrado: ${targetArea.procesoId}`);
  }

  const [tareas, evidencias] = await Promise.all([
    getTareasProceso(client, proceso.procesoId),
    getEvidenciasByProceso(client, proceso.procesoId),
  ]);

  const tareasArea = tareas
    .filter((tarea) => tarea.areaProcesoId === targetArea.areaProcesoId)
    .sort((a, b) => a.ordenTarea - b.ordenTarea)
    .map((tarea) => ({
      ...tarea,

      evidencias: evidencias.filter(
        (evidencia) => evidencia.taskId === tarea.taskId,
      ),
    }));

  return buildManageAreaView(
    {
      area: targetArea,
      empleadoId: proceso.empleadoId,
      fechaLimite: proceso.fechaLimite,
      tareas: tareasArea,
    },
    input.cid,
  );
}
