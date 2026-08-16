import type { WebClient } from "@slack/web-api";

import { getProcesos } from "../repositories/procesos-read.repository.js";
import type { ProcesoListItem } from "../types/process-read.js";

export type HomeProcessStatus = "normal" | "warning" | "overdue";

export type HomeProcessItem = ProcesoListItem & {
  semaforo: HomeProcessStatus;
};

function isClosed(estado: string): boolean {
  return ["Finalizado", "Finalizado con excepción", "Cancelado"].includes(
    estado,
  );
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

export async function getHomeData(client: WebClient) {
  const procesos = await getProcesos(client);

  const today = new Date().toISOString().slice(0, 10);

  const activos = procesos
    .filter((proceso) => !isClosed(proceso.estado))
    .map((proceso) => ({
      ...proceso,
      semaforo: classifyProcess(proceso, today),
    }));

  return {
    procesosActivos: activos,

    resumen: {
      activos: activos.length,

      vencidos: activos.filter((proceso) => proceso.semaforo === "overdue")
        .length,

      vencenHoy: activos.filter((proceso) => proceso.semaforo === "warning")
        .length,
    },
  };
}
