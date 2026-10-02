import type { WebClient } from "@slack/web-api";

import { invalidateListReadCache } from "./slack-list-read.service.js";

type CreateListItemArgs = Parameters<
  WebClient["slackLists"]["items"]["create"]
>[0];

type SlackListItemField = NonNullable<
  CreateListItemArgs["initial_fields"]
>[number];

type UpdateListItemArgs = Parameters<
  WebClient["slackLists"]["items"]["update"]
>[0];

type SlackListItemCellUpdate = UpdateListItemArgs["cells"][number];

export type ListWriteOptions = {
  invalidateCache?: boolean;
};

function shouldInvalidate(options: ListWriteOptions): boolean {
  return options.invalidateCache !== false;
}

export function textCell(columnId: string, text: string): SlackListItemField {
  return {
    column_id: columnId,
    rich_text: [
      {
        type: "rich_text",
        elements: [
          {
            type: "rich_text_section",
            elements: [
              {
                type: "text",
                text,
              },
            ],
          },
        ],
      },
    ],
  };
}

export function numberCell(
  columnId: string,
  value: number,
): SlackListItemField {
  return {
    column_id: columnId,
    number: [value],
  };
}

export function dateCell(columnId: string, value: string): SlackListItemField {
  return {
    column_id: columnId,
    date: [value],
  };
}

export function userCell(columnId: string, userId: string): SlackListItemField {
  return {
    column_id: columnId,
    user: [userId],
  };
}

export function checkboxCell(
  columnId: string,
  checked: boolean,
): SlackListItemField {
  return {
    column_id: columnId,
    checkbox: checked,
  };
}

export function selectCell(
  columnId: string,
  optionId: string,
): SlackListItemField {
  return {
    column_id: columnId,
    select: [optionId],
  };
}

export async function createListItem(
  client: WebClient,
  listId: string,
  fields: SlackListItemField[],
  options: ListWriteOptions = {},
): Promise<string> {
  const response = await client.slackLists.items.create({
    list_id: listId,
    initial_fields: fields,
  });

  const itemId = response.item?.id;

  if (!itemId) {
    throw new Error(`Slack no devolvió item.id al crear registro en ${listId}`);
  }

  if (shouldInvalidate(options)) {
    invalidateListReadCache(listId);
  }

  return itemId;
}

export async function deleteListItem(
  client: WebClient,
  listId: string,
  itemId: string,
  options: ListWriteOptions = {},
): Promise<void> {
  await client.slackLists.items.delete({
    list_id: listId,
    id: itemId,
  });

  if (shouldInvalidate(options)) {
    invalidateListReadCache(listId);
  }
}

export async function updateListItem(
  client: WebClient,
  listId: string,
  rowId: string,
  fields: SlackListItemField[],
  options: ListWriteOptions = {},
): Promise<void> {
  const cells: SlackListItemCellUpdate[] = fields.map((field) => ({
    ...field,
    row_id: rowId,
  }));

  await client.slackLists.items.update({
    list_id: listId,
    cells,
  });

  if (shouldInvalidate(options)) {
    invalidateListReadCache(listId);
  }
}

export function linkCell(
  columnId: string,
  url: string,
  displayName?: string,
): SlackListItemField {
  return {
    column_id: columnId,
    link: [
      {
        original_url: url,
        display_as_url: true,
        display_name: displayName ?? url,
      },
    ],
  };
}
