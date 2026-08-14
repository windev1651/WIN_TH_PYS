import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export function isDevUserAllowed(userId: string): boolean {
  if (env.devAllowedUserIds.length === 0) {
    return false;
  }

  return env.devAllowedUserIds.includes(userId);
}

export function logAccessDenied(userId: string, cid: string): void {
  logger.warn(
    {
      cid,
      userId,
      action: "access_denied",
    },
    "Acceso denegado a usuario no autorizado",
  );
}
