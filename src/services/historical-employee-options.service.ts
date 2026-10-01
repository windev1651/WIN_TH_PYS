import type { WebClient } from "@slack/web-api";

import { PROCESS_STATUS } from "../constants/status.js";
import { getProcesos } from "../repositories/procesos-read.repository.js";
import { logger } from "../utils/logger.js";

type CachedSlackUser = {
  id: string;
  label: string;
};

type HistoricalEmployeeCache = {
  employeeIds: Set<string>;
  expiresAt: number;
};

type SlackDirectoryCache = {
  users: CachedSlackUser[];
  expiresAt: number;
};

const HISTORICAL_EMPLOYEE_CACHE_TTL_MS = 30_000;
const SLACK_DIRECTORY_CACHE_TTL_MS = 5 * 60_000;

let historicalEmployeeCache: HistoricalEmployeeCache | undefined;
let slackDirectoryCache: SlackDirectoryCache | undefined;

export function invalidateHistoricalEmployeeOptionsCache(): void {
  historicalEmployeeCache = undefined;

  logger.info(
    {
      action: "history_employee_options_cache_invalidated",
    },
    "Cache de empleados históricos invalidado",
  );
}

async function getHistoricalEmployeeIds(
  client: WebClient,
): Promise<Set<string>> {
  const now = Date.now();

  if (
    historicalEmployeeCache &&
    historicalEmployeeCache.expiresAt > now
  ) {
    return historicalEmployeeCache.employeeIds;
  }

  const procesos = await getProcesos(client, { bypassCache: true });

  const employeeIds = new Set(
    procesos
      .filter((proceso) =>
        [
          PROCESS_STATUS.COMPLETED,
          PROCESS_STATUS.COMPLETED_WITH_EXCEPTION,
        ].some((status) => status === proceso.estado),
      )
      .map((proceso) => proceso.empleadoId),
  );

  historicalEmployeeCache = {
    employeeIds,
    expiresAt: now + HISTORICAL_EMPLOYEE_CACHE_TTL_MS,
  };

  return employeeIds;
}

async function getSlackDirectory(client: WebClient): Promise<CachedSlackUser[]> {
  const now = Date.now();

  if (slackDirectoryCache && slackDirectoryCache.expiresAt > now) {
    return slackDirectoryCache.users;
  }

  const users: CachedSlackUser[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.users.list({
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });

    for (const user of response.members ?? []) {
      if (!user.id) continue;

      const profile = user.profile;
      const name =
        profile?.display_name_normalized?.trim() ||
        profile?.real_name_normalized?.trim() ||
        profile?.display_name?.trim() ||
        profile?.real_name?.trim() ||
        user.real_name?.trim() ||
        user.name?.trim() ||
        user.id;

      users.push({
        id: user.id,
        label: `${name}${user.deleted ? " · Inactivo" : ""}`,
      });
    }

    const nextCursor = response.response_metadata?.next_cursor;
    cursor = nextCursor && nextCursor.trim() !== "" ? nextCursor : undefined;
  } while (cursor);

  users.sort((a, b) => a.label.localeCompare(b.label, "es"));

  slackDirectoryCache = {
    users,
    expiresAt: now + SLACK_DIRECTORY_CACHE_TTL_MS,
  };

  return users;
}

export async function getHistoricalEmployeeOptions(
  client: WebClient,
  query: string,
) {
  const [historicalEmployeeIds, directory] = await Promise.all([
    getHistoricalEmployeeIds(client),
    getSlackDirectory(client),
  ]);

  const normalizedQuery = query.trim().toLocaleLowerCase("es");

  return directory
    .filter(
      (user) =>
        historicalEmployeeIds.has(user.id) &&
        (normalizedQuery === "" ||
          user.label.toLocaleLowerCase("es").includes(normalizedQuery)),
    )
    .slice(0, 100)
    .map((user) => ({
      text: {
        type: "plain_text" as const,
        text: user.label.slice(0, 75),
      },
      value: user.id,
    }));
}
