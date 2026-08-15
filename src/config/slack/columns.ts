/**
 * Slack List Column IDs for TH_PYS.
 * Generated from the actual list schemas supplied on 2026-08-15.
 *
 * Property names are application-friendly camelCase aliases.
 * Values are the physical Slack Column IDs.
 */
export const slackColumns = {
  tiposSolicitud: {
    tipoSolicitudId: "Col0BR7R157ME",
    nombre: "Col0BQFCX9VBK",
    descripcion: "Col0BPY3LD5HD",
    activo: "Col0BQDDX6J1Y",
    orden: "Col0BQH588268",
  },

  areas: {
    areaId: "Col0BQFD2H9BK",
    nombre: "Col0BQ77Y9HDZ",
    responsableFuncional: "Col0BQ9QL88JZ",
    activa: "Col0BQH5DHC8L",
    orden: "Col0BQDE2HQ2W",
  },

  parametros: {
    clave: "Col0BR7SYG940",
    valor: "Col0BQDFUG7AN",
    tipoDato: "Col0BQ9SC82J1",
    descripcion: "Col0BQH75GLBE",
    activo: "Col0BQ79QDDS7",
  },

  festivos: {
    llave: "Col0B0MDT2QMN",
    fechaFestivo: "Col0AV75RP798",
    nombreFestivo: "Col0AVAP760KE",
    anio: "Col0B062WUWAV",
    activo: "Col0AV0Q27NP5",
    creadoEn: "Col0AURMM6U3H",
    creadoPor: "Col0AV3P73ANR",
    tipoFestivo: "Col0AV7B3U42E",
  },

  configTareas: {
    configTareaId: "Col0BQ9QYHZHB",
    tipoSolicitudId: "Col0BQBG8RKL6",
    areaId: "Col0BQ78APYJF",
    tarea: "Col0BPY4468SK",
    responsableOperativo: "Col0BQFDF3K7T",
    obligatoria: "Col0BQH5S184C",
    requiereEvidencia: "Col0BQDEF1CSE",
    activa: "Col0BQ9QYNFRB",
    ordenArea: "Col0BQBG90CQ6",
    ordenTarea: "Col0BQ78AUW4B",
    observacion: "Col0BPY44AKB9",
  },

  procesos: {
    procesoId: "Col0BPY64RGF9",
    tipoSolicitudId: "Col0BQFFFPNMP",
    empleado: "Col0BQBJ9JDGW",
    creadoPor: "Col0BQDGFKNJW",
    fechaInicio: "Col0BQ7ABGUEP",
    fechaSalida: "Col0BQH7SLPT6",
    fechaLimite: "Col0BR7TKLXQ8",
    estado: "Col0BQ9SZCD6Z",
    porcentajeAvance: "Col0BPY64URF1",
    fechaCierre: "Col0BQFFFTU9X",
    cerradoPor: "Col0BQBJ9PU3G",
    cierreExcepcion: "Col0BQDGFS2RY",
    comentarioTh: "Col0BQ7ABNPBM",
  },

  areasProceso: {
    areaProcesoId: "Col0BQDGWNZAN",
    procesoId: "Col0BQ9TEEJMB",
    areaIdSnapshot: "Col0BQFFWTBJM",
    areaNombreSnapshot: "Col0BQBJQMPNJ",
    responsableFuncionalSnapshot: "Col0BR7U0NYSC",
    estado: "Col0BPY6L10P9",
    ordenArea: "Col0BQH87NYRJ",
    fechaAprobacion: "Col0BQ7ASKJ9Z",
    aprobadoPor: "Col0BQDGWNZFU",
    comentario: "Col0BQ9TEEK37",
  },

  tareasProceso: {
    taskId: "Col0BQ9TZHV2R",
    procesoId: "Col0BQDHFSETC",
    areaProcesoId: "Col0BQ7BBPXEX",
    configTareaIdOrigen: "Col0BPY755NVD",
    tareaSnapshot: "Col0BR7UKUC56",
    responsableOperativoSnapshot: "Col0BQBK9U4KY",
    obligatoria: "Col0BQH8T025S",
    requiereEvidencia: "Col0BQFGG5L81",
    estado: "Col0BQ9TZNBHB",
    fechaLimite: "Col0BQDHG1CGJ",
    comentario: "Col0BQ7BBTE9Z",
    fechaCompletado: "Col0BPY759UMD",
    completadoPor: "Col0BR7UL457A",
    ordenTarea: "Col0BQBKA36CE",
    dmChannelId: "Col0BQH8T4P36",
    dmMessageTs: "Col0BQFGGA63T",
  },

  evidencias: {
    evidenceId: "Col0BQFGRSTG9",
    procesoId: "Col0BQH92NNG4",
    taskId: "Col0BQ9U9ESQ5",
    slackFileId: "Col0BQ7BMMUCT",
    nombreOriginal: "Col0BR7UVR82C",
    tipoArchivo: "Col0BQDHRRYCS",
    tamanoBytes: "Col0BPY7F49CP",
    autor: "Col0BQBKKRS9L",
    fechaCarga: "Col0BQFGS3P8R",
    estado: "Col0BQH93065S",
    revisorFuncional: "Col0BQ9U9M953",
    fechaRevision: "Col0BQ7BMS9GB",
    comentarioRevision: "Col0BR7UW0F9N",
    slackPermalink: "Col0BQDHS0M2N",
    tipoAprobacion: "Col0BQ7FV15NX",
  },

  auditoria: {
    eventId: "Col0BQ7CRK29Z",
    correlationId: "Col0BQHA6NQ92",
    procesoId: "Col0BQDJVNVC2",
    entidadTipo: "Col0BR80KNZ16",
    entidadId: "Col0BQ9VDEUUV",
    accion: "Col0BQFHVTN5P",
    usuario: "Col0BQBLPN622",
    fechaHoraUtc: "Col0BPY8K1GH5",
    estadoAnterior: "Col0BQ7CRL8PM",
    estadoNuevo: "Col0BQHA6PVDJ",
    detalle: "Col0BQDJVQ534",
    tipoAprobacion: "Col0BQBPQ630E",
  },

  notificaciones: {
    notificationId: "Col0BR80SENC8",
    procesoId: "Col0BQHADFFGU",
    areaProcesoId: "Col0BQDK2FS1Y",
    taskId: "Col0BQ7CYD2EP",
    destinatario: "Col0BQBLWGAG6",
    tipo: "Col0BQFJ2MUU9",
    fechaProgramada: "Col0BQA0696R3",
    fechaEnvioUtc: "Col0BPY8RQZTR",
    resultado: "Col0BR80SHGTA",
    idempotencyKey: "Col0BQHADJ01J",
    errorDetalle: "Col0BQDK2K9EE",
    dmChannelId: "Col0BQ7CYFX99",
    dmMessageTs: "Col0BQBLWJ84E",
  },
} as const;

export type SlackColumns = typeof slackColumns;
