import type { WebClient } from "@slack/web-api";

import { getAreas } from "../repositories/areas.repository.js";
import { getConfigTareas } from "../repositories/config-tareas.repository.js";
import { getParametros } from "../repositories/parametros.repository.js";
import { getTiposSolicitud } from "../repositories/tipos-solicitud.repository.js";
import type { Parametro } from "../types/master-data.js";

export async function getMasterData(client: WebClient) {
  const [tiposSolicitud, areas, configTareas, parametros] = await Promise.all([
    getTiposSolicitud(client),
    getAreas(client),
    getConfigTareas(client),
    getParametros(client),
  ]);

  return {
    tiposSolicitud: tiposSolicitud.filter((item) => item.activo),

    areas: areas.filter((item) => item.activo),

    configTareas: configTareas.filter((item) => item.activo),

    parametros: parametros.filter((item) => item.activo),
  };
}

export function getParametro(
  parametros: Parametro[],
  clave: string,
): string | number | boolean | null {
  const parametro = parametros.find(
    (item) => item.clave === clave && item.activo,
  );

  if (!parametro) {
    return null;
  }

  switch (parametro.tipoDato) {
    case "NUMBER": {
      const value = Number(parametro.valor);

      return Number.isNaN(value) ? null : value;
    }

    case "BOOLEAN":
      return parametro.valor.trim().toLowerCase() === "true";

    case "TEXT":
      return parametro.valor;

    default:
      return null;
  }
}

export function getNumberParametro(
  parametros: Parametro[],
  clave: string,
): number {
  const value = getParametro(parametros, clave);

  if (typeof value !== "number") {
    throw new Error(`El parámetro ${clave} no existe o no es NUMBER`);
  }

  return value;
}
