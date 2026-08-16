export type TipoSolicitud = {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  orden: number;
};

export type Area = {
  id: string;
  nombre: string;
  responsableFuncional: string;
  activo: boolean;
  orden: number;
};

export type ConfigTarea = {
  id: string;
  tipoSolicitudId: string;
  areaId: string;
  tarea: string;
  responsableOperativo: string;
  obligatoria: boolean;
  requiereEvidencia: boolean;
  activo: boolean;
  ordenArea: number;
  ordenTarea: number;
  observacion: string | null;
};

export type Parametro = {
  clave: string;
  valor: string;
  tipoDato: "NUMBER" | "TEXT" | "BOOLEAN";
  descripcion: string | null;
  activo: boolean;
};
