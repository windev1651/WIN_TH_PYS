import type { WebClient } from "@slack/web-api";

import { getParametros } from "../repositories/parametros.repository.js";

export type NotificationMode = "N" | "Test" | "Y";

export async function getModoNotificaciones(
  client: WebClient,
): Promise<NotificationMode> {
  const parametros = await getParametros(client);

  const parametro = parametros.find(
    (item) => item.clave === "ModoNotificaciones" && item.activo,
  );

  const value = parametro?.valor?.trim();

  if (value === "N" || value === "Test" || value === "Y") {
    return value;
  }

  /*
   * Fail-safe:
   * si está mal configurado, no enviamos.
   */
  return "N";
}

export async function getNotificacionesTestChannel(
  client: WebClient,
): Promise<string | null> {
  const parametros = await getParametros(client);

  const parametro = parametros.find(
    (item) => item.clave === "NotificacionesTestChannel" && item.activo,
  );

  const value = parametro?.valor?.trim();

  return value?.trim() || null;
}

export async function getCronRecordatoriosDiarios(
  client: WebClient,
): Promise<string> {
  const parametros = await getParametros(client);

  const parametro = parametros.find(
    (item) => item.clave === "CronRecordatoriosDiarios" && item.activo,
  );

  const value = parametro?.valor?.trim();

  return value?.trim() || "0 8 * * 1-5";
}

export async function getMaxTareasVista(client: WebClient): Promise<number> {
  const parametros = await getParametros(client);

  const parametro = parametros.find(
    (item) => item.clave === "MaxTareasPorVista" && item.activo,
  );

  const value = Number(parametro?.valor);

  return Number.isFinite(value) && value > 0 ? value : 6;
}

export async function getCanalNotificacionesTH(
  client: WebClient,
): Promise<string | null> {
  const parametros = await getParametros(client);

  const parametro = parametros.find(
    (item) => item.clave === "CanalNotificacionesTH" && item.activo,
  );

  const valor = parametro?.valor?.trim();

  return valor || null;
}

export async function getCronNotificacionUsuariosInactivos(
  client: WebClient,
): Promise<string | null> {
  const parametros = await getParametros(client);

  const parametro = parametros.find(
    (item) => item.clave === "CronNotificacionUsuariosInactivos" && item.activo,
  );

  const valor = parametro?.valor?.trim();

  return valor || null;
}

export async function getSchedulerTimezone(client: WebClient): Promise<string> {
  const parametros = await getParametros(client);

  const parametro = parametros.find(
    (item) => item.clave === "TimezoneScheduler" && item.activo,
  );

  return parametro?.valor?.trim() || "America/Bogota";
}

export async function getMaxTamanoEvidenciaMB(
  client: WebClient,
): Promise<number> {
  const parametros = await getParametros(client);

  const parametro = parametros.find(
    (item) => item.clave === "MaxTamanoEvidenciaMB" && item.activo,
  );

  if (!parametro) {
    return 5;
  }

  const value = Number(parametro.valor);

  if (!Number.isFinite(value) || value <= 0) {
    return 5;
  }

  return value;
}
