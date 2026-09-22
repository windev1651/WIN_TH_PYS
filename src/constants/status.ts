export const TASK_STATUS = {
  PENDING: "Pendiente",
  PENDING_APPROVAL: "Pendiente aprobación",
  COMPLETED: "Completada",
  NOT_APPLICABLE: "No aplica",
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const AREA_STATUS = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  READY_FOR_APPROVAL: "Lista para aprobación",
  COMPLETED: "Completada",
} as const;

export type AreaStatus = (typeof AREA_STATUS)[keyof typeof AREA_STATUS];

export const PROCESS_STATUS = {
  DRAFT: "Borrador",
  IN_PROGRESS: "En ejecución",
  PENDING_APPROVAL: "Pendiente de aprobación",
  COMPLETED: "Finalizado",
  COMPLETED_WITH_EXCEPTION: "Finalizado con excepción",
  CANCELLED: "Cancelado",
} as const;

export type ProcessStatus =
  (typeof PROCESS_STATUS)[keyof typeof PROCESS_STATUS];

export const EVIDENCE_STATUS = {
  PENDING_REVIEW: "Pendiente de revisión",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
} as const;

export type EvidenceStatus =
  (typeof EVIDENCE_STATUS)[keyof typeof EVIDENCE_STATUS];

export const CLOSED_PROCESS_STATUSES = [
  PROCESS_STATUS.COMPLETED,
  PROCESS_STATUS.COMPLETED_WITH_EXCEPTION,
  PROCESS_STATUS.CANCELLED,
] as const;
