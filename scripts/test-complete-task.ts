import "dotenv/config";
import { WebClient } from "@slack/web-api";

import { completeTask } from "../src/services/task-management.service.js";
import { correlationId } from "../src/utils/logger.js";

const token = process.env.SLACK_BOT_TOKEN;

if (!token) {
  throw new Error("SLACK_BOT_TOKEN no está configurado");
}

const client = new WebClient(token);

async function main(): Promise<void> {
  const cid = correlationId("task-test");

  await completeTask(client, {
    procesoId: "PYS-370C1B065583",
    taskId: "TASK-547D3E877AD3",
    usuarioId: "U09URA3B5S7",
    comentario: "Prueba técnica de completado",
    cid,
  });

  console.log("Tarea completada correctamente");
}

main().catch((error: unknown) => {
  console.error("Task completion test failed");

  console.error(error);

  process.exit(1);
});
