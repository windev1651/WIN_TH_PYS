import "dotenv/config";
import { WebClient } from "@slack/web-api";

import { slackLists } from "../src/config/slack/lists.js";
import { slackColumns } from "../src/config/slack/columns.js";

const token = process.env.SLACK_BOT_TOKEN;

if (!token) {
  throw new Error("SLACK_BOT_TOKEN no está configurado");
}

const client = new WebClient(token);

async function main(): Promise<void> {
  const listId = slackLists.tiposSolicitud.id;

  console.log("Testing Slack List...");
  console.log(`List: ${slackLists.tiposSolicitud.name}`);
  console.log(`List ID: ${listId}`);

  const response = await client.apiCall("slackLists.items.list", {
    list_id: listId,
    limit: 10,
  });

  console.log("Slack API response received");

  console.dir(response, {
    depth: null,
  });

  console.log("\nExpected columns:");

  for (const [name, id] of Object.entries(slackColumns.tiposSolicitud)) {
    console.log(`${name}: ${id}`);
  }
}

main().catch((error: unknown) => {
  console.error("Slack Lists smoke test failed");
  console.error(error);

  process.exit(1);
});
