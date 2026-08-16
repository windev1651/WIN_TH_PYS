import "dotenv/config";
import { WebClient } from "@slack/web-api";

import { createPazYSalvo } from "../src/services/process-create.service.js";
import { correlationId } from "../src/utils/logger.js";

const token = process.env.SLACK_BOT_TOKEN;

if (!token) {
  throw new Error("SLACK_BOT_TOKEN no está configurado");
}

const client = new WebClient(token);

async function main(): Promise<void> {
  const cid = correlationId("create-test");

  const result = await createPazYSalvo(
    client,
    {
      tipoSolicitudId: "RET",

      // Usa dos usuarios reales de prueba.
      empleadoId: "U0AG1SC2J84",
      creadoPorId: "U09R05LDUD8",

      fechaInicio: "2026-08-18",
      fechaSalida: "2026-08-31",

      comentarioTH: "Prueba técnica creación TH_PYS",
    },
    cid,
  );

  console.log("");
  console.log("Paz y Salvo creado:");
  console.log(result.proceso.procesoId);
  console.log(`Áreas: ${result.areas.length}`);
  console.log(`Tareas: ${result.tareas.length}`);
}

main().catch((error: unknown) => {
  console.error("Process creation test failed");

  console.error(error);

  process.exit(1);
});
