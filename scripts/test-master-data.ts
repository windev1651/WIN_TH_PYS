import "dotenv/config";
import { WebClient } from "@slack/web-api";

import { getAreas } from "../src/repositories/areas.repository.js";
import { getConfigTareas } from "../src/repositories/config-tareas.repository.js";
import { getTiposSolicitud } from "../src/repositories/tipos-solicitud.repository.js";
import { getParametros } from "../src/repositories/parametros.repository.js";
import { getNumberParametro } from "../src/services/master-data.service.js";
import { getFestivos } from "../src/repositories/festivos.repository.js";
import {
  addBusinessDays,
  isBusinessDay,
} from "../src/services/business-days.service.js";

const token = process.env.SLACK_BOT_TOKEN;

if (!token) {
  throw new Error("SLACK_BOT_TOKEN no está configurado");
}

const client = new WebClient(token);

async function main(): Promise<void> {
  console.log("");
  console.log("TH_PYS · Master Data Smoke Test");
  console.log("===============================");

  const tipos = await getTiposSolicitud(client);

  console.log("");
  console.log("Tipos de solicitud:");

  for (const tipo of tipos) {
    console.log(tipo);
  }

  console.log("");
  console.log(`Tipos encontrados: ${tipos.length}`);

  const areas = await getAreas(client);

  console.log("");
  console.log("Áreas:");

  for (const area of areas) {
    console.log(area);
  }

  console.log("");
  console.log(`Áreas encontradas: ${areas.length}`);

  const tareas = await getConfigTareas(client);

  console.log("");
  console.log("Configuración de tareas:");

  for (const tarea of tareas) {
    console.log(tarea);
  }

  console.log("");
  console.log(`Tareas encontradas: ${tareas.length}`);

  const parametros = await getParametros(client);

  console.log("");
  console.log("Parámetros:");

  for (const parametro of parametros) {
    console.log(parametro);
  }

  console.log("");
  console.log(`Parámetros encontrados: ${parametros.length}`);

  const diasHabiles = getNumberParametro(parametros, "DiasHabilesProceso");

  const maxEvidencia = getNumberParametro(parametros, "MaxTamanoEvidenciaMB");

  const mesesArchivo = getNumberParametro(
    parametros,
    "MesesParaArchivarProceso",
  );

  console.log("");
  console.log("Parámetros interpretados:");

  console.log({
    diasHabiles,
    maxEvidencia,
    mesesArchivo,
  });

  const festivos = await getFestivos(client);

  console.log("");
  console.log("Festivos activos:");

  for (const festivo of festivos.filter((item) => item.activo)) {
    console.log(festivo);
  }

  console.log("");
  console.log(`Festivos encontrados: ${festivos.length}`);

  const fechaInicio = new Date("2026-08-14T00:00:00Z");

  const fechaLimite = addBusinessDays(fechaInicio, diasHabiles, festivos);

  console.log("");
  console.log("Prueba días hábiles:");

  console.log({
    fechaInicio: fechaInicio.toISOString().slice(0, 10),
    esHabilInicio: isBusinessDay(fechaInicio, festivos),
    diasHabiles,
    fechaLimite: fechaLimite.toISOString().slice(0, 10),
  });
}

main().catch((error: unknown) => {
  console.error("Master data smoke test failed");

  console.error(error);

  process.exit(1);
});
