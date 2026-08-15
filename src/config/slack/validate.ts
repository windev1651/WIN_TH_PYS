import { slackColumns } from "./columns.js";
import { slackLists } from "./lists.js";

function findInvalidValues(value: unknown, path = ""): string[] {
  if (typeof value === "string") {
    return value.startsWith("REEMPLAZAR_") || value.trim() === "" ? [path] : [];
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    findInvalidValues(child, path ? `${path}.${key}` : key),
  );
}

export function validateSlackConfiguration(): void {
  const invalidLists = findInvalidValues(slackLists, "slackLists");
  const invalidColumns = findInvalidValues(slackColumns, "slackColumns");

  const invalid = [...invalidLists, ...invalidColumns];

  if (invalid.length > 0) {
    throw new Error(
      `Configuración Slack incompleta:\n${invalid
        .map((item) => `- ${item}`)
        .join("\n")}`,
    );
  }
}
