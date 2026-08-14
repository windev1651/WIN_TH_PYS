import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.logLevel,
  base: {
    app: "TH_PYS",
    environment: env.appEnv,
  },
  redact: {
    paths: [
      "token",
      "appToken",
      "authorization",
      "headers.authorization",
      "SLACK_BOT_TOKEN",
      "SLACK_APP_TOKEN",
    ],
    censor: "[REDACTED]",
  },
});

export function correlationId(prefix = "pys"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
