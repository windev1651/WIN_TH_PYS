export type ProcesoListItem = {
  slackItemId: string;
  procesoId: string;
  tipoSolicitudId: string;
  empleadoId: string;
  creadoPorId: string;
  fechaInicio: string;
  fechaSalida: string;
  fechaLimite: string;
  estado: string;
  porcentajeAvance: number;
  fechaCierre: string | null;
  cerradoPorId: string | null;
  cierreExcepcion: boolean;
  comentarioTH: string | null;
};
