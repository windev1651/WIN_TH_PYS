export type SlackListField = {
  column_id?: string;

  text?: string;
  number?: number[];
  date?: string[];
  user?: string[];
  checkbox?: boolean | boolean[];
  select?: string[];

  value?: unknown;
};

type SlackListItemField = {
  column_id?: string;

  rich_text?: Array<{
    type?: string;
    elements?: unknown[];
  }>;

  number?: number[];
  date?: string[];
  user?: string[];
  checkbox?: boolean;
  select?: string[];

  link?: Array<{
    originalUrl?: string;
    displayAsUrl?: boolean;
    displayName?: string;

    original_url?: string;
    display_as_url?: boolean;
    display_name?: string;
  }>;
};

export type SlackListItem = {
  id?: string;
  fields?: SlackListItemField[];
};

function getField(
  item: SlackListItem,
  columnId: string,
): SlackListField | undefined {
  return item.fields?.find((field) => field.column_id === columnId);
}

export function getTextField(
  item: SlackListItem,
  columnId: string,
): string | null {
  const field = getField(item, columnId);

  return field?.text ?? null;
}

export function getNumberField(
  item: SlackListItem,
  columnId: string,
): number | null {
  const field = getField(item, columnId);

  return field?.number?.[0] ?? null;
}

export function getDateField(
  item: SlackListItem,
  columnId: string,
): string | null {
  const field = getField(item, columnId);

  return field?.date?.[0] ?? null;
}

export function getUserField(
  item: SlackListItem,
  columnId: string,
): string | null {
  const field = getField(item, columnId);

  return field?.user?.[0] ?? null;
}

export function getCheckboxField(
  item: SlackListItem,
  columnId: string,
): boolean {
  const field = getField(item, columnId);

  if (!field) {
    return false;
  }

  if (typeof field.checkbox === "boolean") {
    return field.checkbox;
  }

  if (Array.isArray(field.checkbox)) {
    return field.checkbox[0] === true;
  }

  return false;
}

export function getSelectField(
  item: SlackListItem,
  columnId: string,
): string | null {
  const field = getField(item, columnId);

  return field?.select?.[0] ?? null;
}

export function getLinkField(
  item: SlackListItem,
  columnId: string,
): string | null {
  const field = item.fields?.find((current) => current.column_id === columnId);

  const link = field?.link?.[0];

  if (!link) {
    return null;
  }

  return link.originalUrl ?? link.original_url ?? null;
}
