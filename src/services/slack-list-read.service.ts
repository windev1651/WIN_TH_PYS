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

const CACHE_TTL_MS = 60_000;
const SHORT_CACHE_TTL_MS = 1_500;

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
const inFlightReads = new Map<string, Promise<SlackListItem[]>>();

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

  const existing = inFlightReads.get(listId);

  if (existing) {
    logger.info(
      {
        listId,
        action: "slack_list_read_joined",
      },
      "Lectura de Slack List reutilizada",
    );

    return existing;
  }

  const request = fetchAllListItems(client, listId);

  inFlightReads.set(listId, request);

  try {
    const items = await request;

    cacheListItems(listId, items);
    cacheShortListItems(listId, items);

    return items;
  } finally {
    if (inFlightReads.get(listId) === request) {
      inFlightReads.delete(listId);
    }
  }
}
