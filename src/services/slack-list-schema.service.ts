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

export async function getSelectOptionMap(
  client: WebClient,
  listId: string,
  columnId: string,
): Promise<Map<string, string>> {
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
