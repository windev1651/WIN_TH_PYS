import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.logLevel,
  base: {
    app: "TH_PYS",
    environment: env.appEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,

  redact: {
    paths: [
      "token",
      "appToken",
      "authorization",
      "headers.authorization",
      "req.headers.authorization",
      "SLACK_BOT_TOKEN",
      "SLACK_APP_TOKEN",
      "*.token",
      "*.appToken",
    ],
    censor: "[REDACTED]",
  },
});

export function correlationId(prefix = "pys"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
