import type { WebClient } from "@slack/web-api";

type CreateListItemArgs = Parameters<
  WebClient["slackLists"]["items"]["create"]
>[0];

type SlackListItemField = NonNullable<
  CreateListItemArgs["initial_fields"]
>[number];

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
): Promise<string> {
  const response = await client.slackLists.items.create({
    list_id: listId,
    initial_fields: fields,
  });

  const itemId = response.item?.id;

  if (!itemId) {
    throw new Error(`Slack no devolvió item.id al crear registro en ${listId}`);
  }

  return itemId;
}

export async function deleteListItem(
  client: WebClient,
  listId: string,
  itemId: string,
): Promise<void> {
  await client.slackLists.items.delete({
    list_id: listId,
    id: itemId,
  });
}
