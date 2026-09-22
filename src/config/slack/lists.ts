/**
 * Slack List IDs for TH_PYS.
 * Generated from the Slack list metadata exports provided on 2026-08-15.
 *
 * NOTE:
 * - Transactional list titles still contain the suffix  in Slack.
 */
export const slackLists = {
  tiposSolicitud: {
    name: "TH_PYS_TiposSolicitud",
    id: "F0BQBFR2B46",
  },
  areas: {
    name: "TH_PYS_Areas",
    id: "F0BQBFWAMLN",
  },
  configTareas: {
    name: "TH_PYS_ConfigTareas",
    id: "F0BQDEERALA",
  },
  parametros: {
    name: "TH_PYS_Parametros",
    id: "F0BPY5HLAR5",
  },
  festivos: {
    name: "TH_Festivos",
    id: "F0AV3P6P6DB",
  },
  procesos: {
    name: "TH_PYS_Procesos",
    id: "F0BQ9SZ9EG5",
  },
  areasProceso: {
    name: "TH_PYS_AreasProceso",
    id: "F0BQ7ASKJ2F",
  },
  tareasProceso: {
    name: "TH_PYS_TareasProceso",
    id: "F0BQFGG13UZ",
  },
  evidencias: {
    name: "TH_PYS_Evidencias",
    id: "F0BQBKKM754",
  },
  auditoria: {
    name: "TH_PYS_Auditoria",
    id: "F0BPY8K0BFZ",
  },
  notificaciones: {
    name: "TH_PYS_Notificaciones",
    id: "F0BPY8RMXPZ",
  },
  usuariosAutorizados: {
    name: "TH_PYS_UsuariosAutorizados",
    id: "F0BRPNKA72T",
  },
} as const;

export type SlackListKey = keyof typeof slackLists;

export function getSlackListId(key: SlackListKey): string {
  return slackLists[key].id;
}
