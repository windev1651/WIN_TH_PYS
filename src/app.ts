import { App, LogLevel } from "@slack/bolt";
import { env } from "./config/env.js";
import { registerAppHomeListeners } from "./listeners/app-home.js";
import { registerProcessCreateListeners } from "./listeners/process-create.js";
import { logger } from "./utils/logger.js";
import { validateSlackConfiguration } from "./config/slack/validate.js";

function boltLogLevel(value: string): LogLevel {
  switch (value.toLowerCase()) {
    case "debug":
      return LogLevel.DEBUG;
    case "warn":
      return LogLevel.WARN;
    case "error":
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
}

validateSlackConfiguration();

const app = new App({
  token: env.slackBotToken,
  appToken: env.slackAppToken,
  socketMode: true,
  logLevel: boltLogLevel(env.logLevel),
});

registerAppHomeListeners(app);
registerProcessCreateListeners(app);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Apagando TH_PYS");
  await app.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

(async () => {
  try {
    await app.start();
    logger.info("TH_PYS iniciado correctamente en Socket Mode");
  } catch (error) {
    logger.fatal({ error }, "No fue posible iniciar TH_PYS");
    process.exit(1);
  }
})();
