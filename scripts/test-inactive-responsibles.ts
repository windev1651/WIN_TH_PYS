import { WebClient } from "@slack/web-api";

import { findInactiveResponsibles } from "../src/services/inactive-responsibles.service.js";
import { notifyInactiveResponsibles } from "../src/services/notification.service.js";

const token = process.env.SLACK_BOT_TOKEN;

if (!token) {
  throw new Error("SLACK_BOT_TOKEN no está configurado");
}

const client = new WebClient(token);
const cid = `test-inactive-${Date.now()}`;
const issues = await findInactiveResponsibles(client, cid);

await notifyInactiveResponsibles(client, {
  cid,
  issues,
});

console.dir(issues, {
  depth: null,
});
