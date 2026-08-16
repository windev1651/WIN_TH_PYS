import "dotenv/config";
import { WebClient } from "@slack/web-api";

import { buildProcessSnapshot } from "../src/services/process-snapshot.service.js";

const token = process.env.SLACK_BOT_TOKEN;

if (!token) {
  throw new Error("SLACK_BOT_TOKEN no está configurado");
}

const client = new WebClient(token);

async function main(): Promise<void> {
  const snapshot = await buildProcessSnapshot(client, {
    tipoSolicitudId: "RET",

    // Usa IDs reales de usuarios de prueba:
    empleadoId: "REEMPLAZAR_EMPLOYEE_ID",
    creadoPorId: "REEMPLAZAR_TH_USER_ID",

    fechaInicio: "2026-08-15",
    fechaSalida: "2026-08-31",

    comentarioTH: "Prueba de generación de snapshot",
  });

  console.dir(snapshot, {
    depth: null,
  });

  console.log("");
  console.log(`Proceso: ${snapshot.proceso.procesoId}`);
  console.log(`Áreas: ${snapshot.areas.length}`);
  console.log(`Tareas: ${snapshot.tareas.length}`);
  console.log(`Fecha límite: ${snapshot.proceso.fechaLimite}`);
}

main().catch((error: unknown) => {
  console.error("Process snapshot test failed");

  console.error(error);

  process.exit(1);
});
