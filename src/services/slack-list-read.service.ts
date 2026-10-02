import type { WebClient } from "@slack/web-api";

import type { SlackListItem } from "../repositories/list-helpers.js";
import { logger } from "../utils/logger.js";

type ListReadOptions = {
  bypassCache?: boolean;
};

type ShortCacheEntry = {
  items: SlackListItem[];
  expiresAt: number;
};

const shortListCache = new Map<string, ShortCacheEntry>();

type CacheEntry = {
  items: SlackListItem[];
  expiresAt: number;
};

type InFlightRead = {
  version: number;
  promise: Promise<SlackListItem[]>;
};

const CACHE_TTL_MS = 60_000;
const SHORT_CACHE_TTL_MS = 15_000;

const CACHEABLE_LIST_IDS = new Set([
  "F0BPY5HLAR5", // Parametros
  "F0BRPNKA72T", // UsuariosAutorizados
]);

const SHORT_CACHEABLE_LIST_IDS = new Set([
  "F0BQ9SZ9EG5", // Procesos
  "F0BQ7ASKJ2F", // AreasProceso
  "F0BQFGG13UZ", // TareasProceso
]);

const listCache = new Map<string, CacheEntry>();
const inFlightReads = new Map<string, InFlightRead>();
const listVersions = new Map<string, number>();

function getListVersion(listId: string): number {
  return listVersions.get(listId) ?? 0;
}

export function invalidateListReadCache(listId: string): void {
  listCache.delete(listId);
  shortListCache.delete(listId);
  listVersions.set(listId, getListVersion(listId) + 1);

  logger.info(
    {
      listId,
      version: getListVersion(listId),
      action: "slack_list_read_cache_invalidated",
    },
    "Cache de Slack List invalidado después de escritura",
  );
}

function getCachedListItems(listId: string): SlackListItem[] | undefined {
  if (!CACHEABLE_LIST_IDS.has(listId)) {
    return undefined;
  }

  const cached = listCache.get(listId);

  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt <= Date.now()) {
    listCache.delete(listId);

    logger.info(
      {
        listId,
        action: "slack_list_read_cache_expired",
      },
      "Cache de Slack List expirado",
    );

    return undefined;
  }

  return cached.items;
}

function cacheListItems(listId: string, items: SlackListItem[]): void {
  if (!CACHEABLE_LIST_IDS.has(listId)) {
    return;
  }

  listCache.set(listId, {
    items,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function cacheShortListItems(listId: string, items: SlackListItem[]): void {
  if (!SHORT_CACHEABLE_LIST_IDS.has(listId)) {
    return;
  }

  shortListCache.set(listId, {
    items,
    expiresAt: Date.now() + SHORT_CACHE_TTL_MS,
  });
}

function getShortCachedListItems(listId: string): SlackListItem[] | undefined {
  if (!SHORT_CACHEABLE_LIST_IDS.has(listId)) {
    return undefined;
  }

  const cached = shortListCache.get(listId);

  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt <= Date.now()) {
    shortListCache.delete(listId);
    return undefined;
  }

  return cached.items;
}

async function fetchAllListItems(
  client: WebClient,
  listId: string,
): Promise<SlackListItem[]> {
  const allItems: SlackListItem[] = [];

  let cursor: string | undefined;
  let pages = 0;

  const startedAt = Date.now();

  try {
    do {
      const pageStartedAt = Date.now();

      const response = await client.apiCall("slackLists.items.list", {
        list_id: listId,
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });

      pages += 1;

      const rawResponse = response as {
        items?: SlackListItem[];

        response_metadata?: {
          next_cursor?: string;
        };
      };

      const pageItems = rawResponse.items ?? [];

      allItems.push(...pageItems);

      logger.info(
        {
          listId,
          page: pages,
          items: pageItems.length,
          durationMs: Date.now() - pageStartedAt,
          action: "slack_list_read_page",
        },
        "Página de Slack List leída",
      );

      const nextCursor = rawResponse.response_metadata?.next_cursor;

      cursor = nextCursor && nextCursor.trim() !== "" ? nextCursor : undefined;
    } while (cursor);

    return allItems;
  } finally {
    logger.info(
      {
        listId,
        pages,
        items: allItems.length,
        durationMs: Date.now() - startedAt,
        action: "slack_list_read",
      },
      "Lectura de Slack List finalizada",
    );
  }
}

export async function getAllListItems(
  client: WebClient,
  listId: string,
  options: ListReadOptions = {},
): Promise<SlackListItem[]> {
  if (!options.bypassCache) {
    const cached = getCachedListItems(listId);

    if (cached) {
      logger.info(
        {
          listId,
          items: cached.length,
          action: "slack_list_read_cache_hit",
        },
        "Lectura de Slack List resuelta desde cache",
      );

      return cached;
    }

    const shortCached = getShortCachedListItems(listId);

    if (shortCached) {
      logger.info(
        {
          listId,
          items: shortCached.length,
          action: "slack_list_read_short_cache_hit",
        },
        "Lectura de Slack List resuelta desde micro-cache",
      );

      return shortCached;
    }
  }

  if (options.bypassCache) {
    logger.info(
      {
        listId,
        action: "slack_list_read_cache_bypass",
      },
      "Lectura crítica de Slack List omite cache",
    );
  }

  const version = getListVersion(listId);
  const existing = inFlightReads.get(listId);

  if (existing) {
    if (existing.version === version) {
      logger.info(
        {
          listId,
          version,
          action: "slack_list_read_joined",
        },
        "Lectura de Slack List reutilizada",
      );

      return existing.promise;
    }

    /*
     * Hubo una escritura mientras la lectura anterior seguía en curso.
     * No lanzamos otra lectura completa en paralelo: esperamos la anterior
     * y luego todos los consumidores convergen en una única lectura fresca.
     */
    logger.info(
      {
        listId,
        readVersion: existing.version,
        currentVersion: version,
        action: "slack_list_read_waiting_previous_version",
      },
      "Lectura fresca espera una lectura anterior para evitar concurrencia innecesaria",
    );

    try {
      await existing.promise;
    } catch {
      // La siguiente llamada realizará el intento fresco.
    }

    return getAllListItems(client, listId, options);
  }

  const request = fetchAllListItems(client, listId);
  const inFlight: InFlightRead = {
    version,
    promise: request,
  };

  inFlightReads.set(listId, inFlight);

  try {
    const items = await request;

    if (getListVersion(listId) === version) {
      cacheListItems(listId, items);
      cacheShortListItems(listId, items);
    } else {
      logger.info(
        {
          listId,
          readVersion: version,
          currentVersion: getListVersion(listId),
          action: "slack_list_read_cache_skip_stale",
        },
        "Lectura finalizada después de una escritura; resultado no cacheado",
      );
    }

    return items;
  } finally {
    if (inFlightReads.get(listId) === inFlight) {
      inFlightReads.delete(listId);
    }
  }
}
