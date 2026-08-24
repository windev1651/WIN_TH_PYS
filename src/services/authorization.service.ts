import type { WebClient } from "@slack/web-api";

import { getUsuariosAutorizados } from "../repositories/usuarios-autorizados.repository.js";

export type AppRole = "TH" | "Administrador";

export async function hasRole(
  client: WebClient,
  userId: string,
  role: AppRole,
): Promise<boolean> {
  const usuarios = await getUsuariosAutorizados(client);

  return usuarios.some(
    (usuario) =>
      usuario.userId === userId && usuario.rol === role && usuario.activo,
  );
}

export async function isThUser(
  client: WebClient,
  userId: string,
): Promise<boolean> {
  return hasRole(client, userId, "TH");
}

export async function isAdministrator(
  client: WebClient,
  userId: string,
): Promise<boolean> {
  return hasRole(client, userId, "Administrador");
}

export async function canAdministerPys(
  client: WebClient,
  userId: string,
): Promise<boolean> {
  const usuarios = await getUsuariosAutorizados(client);

  return usuarios.some(
    (usuario) =>
      usuario.userId === userId &&
      usuario.activo &&
      (usuario.rol === "TH" || usuario.rol === "Administrador"),
  );
}

export type UserPermissions = {
  esTH: boolean;
  esAdministrador: boolean;
  puedeAdministrarPys: boolean;
};

export async function getUserPermissions(
  client: WebClient,
  userId: string,
): Promise<UserPermissions> {
  const usuarios = await getUsuariosAutorizados(client);

  const roles = new Set(
    usuarios
      .filter((usuario) => usuario.userId === userId && usuario.activo)
      .map((usuario) => usuario.rol),
  );

  const esTH = roles.has("TH");

  const esAdministrador = roles.has("Administrador");

  return {
    esTH,
    esAdministrador,

    puedeAdministrarPys: esTH || esAdministrador,
  };
}
