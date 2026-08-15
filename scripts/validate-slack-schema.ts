import "dotenv/config";
import { WebClient } from "@slack/web-api";

import { slackLists } from "../src/config/slack/lists.js";
import { slackColumns } from "../src/config/slack/columns.js";

const token = process.env.SLACK_BOT_TOKEN;

if (!token) {
  throw new Error("SLACK_BOT_TOKEN no está configurado");
}

const client = new WebClient(token);

type ColumnMap = Record<string, string>;

type ValidationResult = {
  key: string;
  name: string;
  id: string;
  ok: boolean;
  expectedColumns: number;
  foundColumns: number;
  missingColumns: Array<{
    key: string;
    id: string;
  }>;
  error?: string;
};

function getColumnMap(key: keyof typeof slackColumns): ColumnMap {
  return slackColumns[key] as ColumnMap;
}

async function validateList(
  key: keyof typeof slackLists,
): Promise<ValidationResult> {
  const list = slackLists[key];

  const columnKey = key as keyof typeof slackColumns;

  const expectedColumns =
    columnKey in slackColumns ? getColumnMap(columnKey) : {};

  try {
    const response = await client.files.info({
      file: list.id,
    });

    const rawFile = response as {
      file?: {
        id?: string;
        title?: string;
        list_metadata?: {
          schema?: Array<{
            id?: string;
            name?: string;
            type?: string;
          }>;
        };
      };
    };

    const schema = rawFile.file?.list_metadata?.schema ?? [];

    if (schema.length === 0) {
      return {
        key,
        name: list.name,
        id: list.id,
        ok: false,
        expectedColumns: Object.keys(expectedColumns).length,
        foundColumns: 0,
        missingColumns: [],
        error:
          "Slack respondió correctamente, pero no devolvió metadata de columnas.",
      };
    }

    const actualColumnIds = new Set(
      schema
        .map((column) => column.id)
        .filter((id): id is string => typeof id === "string"),
    );

    const missingColumns = Object.entries(expectedColumns)
      .filter(([, columnId]) => !actualColumnIds.has(columnId))
      .map(([columnKeyName, columnId]) => ({
        key: columnKeyName,
        id: columnId,
      }));

    return {
      key,
      name: list.name,
      id: list.id,
      ok: missingColumns.length === 0,
      expectedColumns: Object.keys(expectedColumns).length,
      foundColumns: Object.keys(expectedColumns).length - missingColumns.length,
      missingColumns,
    };
  } catch (error: unknown) {
    let message = "Unknown error";

    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      message = error.message;
    }

    return {
      key,
      name: list.name,
      id: list.id,
      ok: false,
      expectedColumns: Object.keys(expectedColumns).length,
      foundColumns: 0,
      missingColumns: [],
      error: message,
    };
  }
}

async function main(): Promise<void> {
  console.log("");
  console.log("TH_PYS · Slack Lists Schema Validation");
  console.log("======================================");
  console.log("");

  const keys = Object.keys(slackLists) as Array<keyof typeof slackLists>;

  const results: ValidationResult[] = [];

  for (const key of keys) {
    const result = await validateList(key);

    results.push(result);

    const status = result.ok ? "OK" : "ERROR";

    console.log(`${result.name} [${result.id}]`);

    console.log(`  Status: ${status}`);

    if (result.error) {
      console.log(`  Error: ${result.error}`);

      console.log("");

      continue;
    }

    console.log(`  Columns: ${result.foundColumns}/${result.expectedColumns}`);

    if (result.missingColumns.length > 0) {
      console.log("  Missing columns:");

      for (const column of result.missingColumns) {
        console.log(`    - ${column.key}: ${column.id}`);
      }
    }

    console.log("");
  }

  const failed = results.filter((result) => !result.ok);

  console.log("--------------------------------------");

  console.log(`Lists checked: ${results.length}`);

  console.log(`OK: ${results.length - failed.length}`);

  console.log(`Errors: ${failed.length}`);

  if (failed.length > 0) {
    process.exitCode = 1;

    console.log("");
    console.log("Schema validation FAILED.");

    return;
  }

  console.log("");
  console.log("Schema validation PASSED.");
}

main().catch((error: unknown) => {
  console.error("Unexpected validation error");

  console.error(error);

  process.exit(1);
});
