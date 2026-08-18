import type { WebClient } from "@slack/web-api";

import type { SlackListItem } from "../repositories/list-helpers.js";

export async function getAllListItems(
  client: WebClient,
  listId: string,
): Promise<SlackListItem[]> {
  const allItems: SlackListItem[] = [];

  let cursor: string | undefined;

  do {
    const response = await client.apiCall("slackLists.items.list", {
      list_id: listId,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });

    const rawResponse = response as {
      items?: SlackListItem[];
      response_metadata?: {
        next_cursor?: string;
      };
    };

    allItems.push(...(rawResponse.items ?? []));

    const nextCursor = rawResponse.response_metadata?.next_cursor;

    cursor = nextCursor && nextCursor.trim() !== "" ? nextCursor : undefined;
  } while (cursor);

  return allItems;
}
