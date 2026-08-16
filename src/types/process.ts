export type ProcessSnapshotInput = {
  tipoSolicitudId: string;
  empleadoId: string;
  creadoPorId: string;
  fechaInicio: string;
  fechaSalida: string;
  comentarioTH?: string;
};

export type ProcessSnapshot = {
  proceso: {
    procesoId: string;
    tipoSolicitudId: string;
    empleadoId: string;
    creadoPorId: string;
    fechaInicio: string;
    fechaSalida: string;
    fechaLimite: string;
    estado: "En ejecución";
    porcentajeAvance: number;
    cierreExcepcion: boolean;
    comentarioTH: string;
  };

  areas: AreaProcesoSnapshot[];

  tareas: TareaProcesoSnapshot[];
};

export type AreaProcesoSnapshot = {
  areaProcesoId: string;
  procesoId: string;
  areaIdSnapshot: string;
  areaNombreSnapshot: string;
  responsableFuncionalSnapshot: string;
  estado: "Pendiente";
  ordenArea: number;
};

export type TareaProcesoSnapshot = {
  taskId: string;
  procesoId: string;
  areaProcesoId: string;
  configTareaIdOrigen: string;
  tareaSnapshot: string;
  responsableOperativoSnapshot: string;
  obligatoria: boolean;
  requiereEvidencia: boolean;
  estado: "Pendiente";
  fechaLimite: string;
  comentario: string;
  ordenTarea: number;
};
