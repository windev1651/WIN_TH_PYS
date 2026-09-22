import type { WebClient } from "@slack/web-api";

import { AREA_STATUS, TASK_STATUS } from "../constants/status.js";
import { updateAreaEstado } from "../repositories/areas-proceso.repository.js";
import { updateProcesoAvance } from "../repositories/procesos.repository.js";
import type {
  AreaProcesoDetail,
  TareaProcesoDetail,
} from "../types/process-detail.js";

type UpdateTaskProgressInput = {
  procesoSlackItemId: string;
  area: AreaProcesoDetail;
  tareas: TareaProcesoDetail[];
};

export async function updateProgressAfterTaskManagement(
  client: WebClient,
  input: UpdateTaskProgressInput,
): Promise<number> {
  /*
   * Una gestión del operativo significa que el área ya
   * está en ejecución, independientemente de que la tarea
   * requiera o no evidencia.
   */
  if (input.area.estado === AREA_STATUS.PENDING) {
    await updateAreaEstado(
      client,
      input.area.slackItemId,
      AREA_STATUS.IN_PROGRESS,
    );
  }

  /*
   * El avance representa gestión operativa.
   *
   * Pendiente aprobación = operativo terminó.
   * Completada = operativo terminó y funcional aprobó.
   */
  const tareasComputables = input.tareas.filter(
    (tarea) => tarea.obligatoria && tarea.estado !== TASK_STATUS.NOT_APPLICABLE,
  );

  const gestionadas = tareasComputables.filter((tarea) =>
    [TASK_STATUS.PENDING_APPROVAL, TASK_STATUS.COMPLETED].some(
      (status) => status === tarea.estado,
    ),
  ).length;

  const porcentajeAvance =
    tareasComputables.length === 0
      ? 0
      : Math.round((gestionadas / tareasComputables.length) * 100);

  await updateProcesoAvance(client, input.procesoSlackItemId, porcentajeAvance);

  return porcentajeAvance;
}
