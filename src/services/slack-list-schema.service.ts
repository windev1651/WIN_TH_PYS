import type { WebClient } from "@slack/web-api";

type SelectChoice = {
  value?: string;
  label?: string;
};

type SlackColumn = {
  id?: string;
  name?: string;
  type?: string;
  options?: {
    choices?: SelectChoice[];
  };
};

type SchemaCacheEntry = {
  schema: SlackColumn[];
  expiresAt: number;
};

const SCHEMA_CACHE_TTL_MS = 10 * 60_000;
const schemaCache = new Map<string, SchemaCacheEntry>();
const schemaInFlight = new Map<string, Promise<SlackColumn[]>>();

async function getListSchema(
  client: WebClient,
  listId: string,
): Promise<SlackColumn[]> {
  const cached = schemaCache.get(listId);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.schema;
  }

  if (cached) {
    schemaCache.delete(listId);
  }

  const existing = schemaInFlight.get(listId);

  if (existing) {
    return existing;
  }

  const request = (async () => {
    const response = await client.files.info({
      file: listId,
    });

    const rawFile = response as {
      file?: {
        list_metadata?: {
          schema?: SlackColumn[];
        };
      };
    };

    const schema = rawFile.file?.list_metadata?.schema ?? [];

    schemaCache.set(listId, {
      schema,
      expiresAt: Date.now() + SCHEMA_CACHE_TTL_MS,
    });

    return schema;
  })();

  schemaInFlight.set(listId, request);

  try {
    return await request;
  } finally {
    if (schemaInFlight.get(listId) === request) {
      schemaInFlight.delete(listId);
    }
  }
}

export async function getSelectOptionMap(
  client: WebClient,
  listId: string,
  columnId: string,
): Promise<Map<string, string>> {
  const schema = await getListSchema(client, listId);

  const column = schema.find((current) => current.id === columnId);

  if (!column) {
    throw new Error(
      `No se encontró la columna ${columnId} en la lista ${listId}`,
    );
  }

  if (column.type !== "select") {
    throw new Error(`La columna ${columnId} no es de tipo select`);
  }

  const choices = column.options?.choices ?? [];

  return new Map(
    choices
      .filter(
        (
          choice,
        ): choice is {
          value: string;
          label: string;
        } =>
          typeof choice.value === "string" && typeof choice.label === "string",
      )
      .map((choice) => [choice.value, choice.label]),
  );
}

export async function getSelectOptionId(
  client: WebClient,
  listId: string,
  columnId: string,
  label: string,
): Promise<string> {
  const optionMap = await getSelectOptionMap(client, listId, columnId);

  for (const [optionId, optionLabel] of optionMap) {
    if (optionLabel === label) {
      return optionId;
    }
  }

  throw new Error(
    `No existe la opción "${label}" en columna ${columnId} de lista ${listId}`,
  );
}
