import "dotenv/config";
import { WebClient } from "@slack/web-api";

import { getHomeData } from "../src/services/home-data.service.js";

const token = process.env.SLACK_BOT_TOKEN;

if (!token) {
  throw new Error("SLACK_BOT_TOKEN no está configurado");
}

const client = new WebClient(token);
const TEST_USER_ID = "U0AG1SC2J84";

async function main(): Promise<void> {
  const testUserId = "U0AG1SC2J84";
  const data = await getHomeData(client, TEST_USER_ID);

  console.log("");
  console.log("TH_PYS · Home Data Test");
  console.log("=======================");

  console.log("");
  console.log("Resumen:");
  console.log(data.resumen);

  console.log("");
  console.log("Procesos activos:");

  for (const proceso of data.procesosActivos) {
    console.log({
      procesoId: proceso.procesoId,
      empleadoId: proceso.empleadoId,
      estado: proceso.estado,
      avance: proceso.porcentajeAvance,
      fechaLimite: proceso.fechaLimite,
      semaforo: proceso.semaforo,
    });
  }

  console.log("");
  console.log("Mis tareas:");

  for (const tarea of data.misTareas) {
    console.log({
      taskId: tarea.taskId,
      procesoId: tarea.procesoId,
      tarea: tarea.tarea,
      empleadoId: tarea.empleadoId,
      estado: tarea.estado,
      fechaLimite: tarea.fechaLimite,
    });
  }
}

main().catch((error: unknown) => {
  console.error("Home data test failed");

  console.error(error);

  process.exit(1);
});
