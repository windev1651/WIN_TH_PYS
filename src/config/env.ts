import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variable obligatoria no definida: ${name}`);
  }
  return value;
}

export const env = {
  slackBotToken: required("SLACK_BOT_TOKEN"),
  slackAppToken: required("SLACK_APP_TOKEN"),
  appEnv: process.env.APP_ENV?.trim() || "development",
  logLevel: process.env.LOG_LEVEL?.trim() || "info",
  lists: {
    parametros: process.env.TH_PYS_LIST_PARAMETROS_ID?.trim() || "",
    configTareas: process.env.TH_PYS_LIST_CONFIG_TAREAS_ID?.trim() || "",
    festivos: process.env.TH_PYS_LIST_FESTIVOS_ID?.trim() || "",
  },
  canalThId: process.env.TH_PYS_CANAL_TH_ID?.trim() || "",
} as const;
