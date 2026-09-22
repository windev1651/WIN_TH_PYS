export type AreaProcesoDetail = {
  slackItemId: string;
  areaProcesoId: string;
  procesoId: string;
  areaId: string;
  areaNombre: string;
  responsableFuncionalId: string;
  estado: string;
  ordenArea: number;

  fechaAprobacion: string | null;
  aprobadoPorId: string | null;
  comentario: string | null;
};

export type TareaProcesoDetail = {
  slackItemId: string;
  taskId: string;
  procesoId: string;
  areaProcesoId: string;
  configTareaIdOrigen: string;
  tarea: string;
  responsableOperativoId: string;
  obligatoria: boolean;
  requiereEvidencia: boolean;
  estado: string;
  fechaLimite: string;
  comentario: string | null;
  ordenTarea: number;
  comentarioRechazo: string | null;
};

export type ProcessDetail = {
  procesoId: string;
  empleadoId: string;
  tipoSolicitudId: string;
  estado: string;
  fechaInicio: string;
  fechaSalida: string;
  fechaLimite: string;
  porcentajeAvance: number;
  comentarioTH: string | null;
  areas: Array<
    AreaProcesoDetail & {
      tareas: TareaProcesoDetail[];
    }
  >;
};
