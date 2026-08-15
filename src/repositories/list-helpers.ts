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

export type SlackListItem = {
  id?: string;
  fields?: SlackListField[];
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
