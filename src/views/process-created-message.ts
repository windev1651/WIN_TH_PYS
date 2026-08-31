import type { ProcessSnapshot } from "../types/process.js";

function buildAreasSummary(snapshot: ProcessSnapshot): string {
  if (snapshot.areas.length === 0) {
    return "_El proceso no generó áreas ni tareas._";
  }

  return snapshot.areas
    .map((area) => {
      const tareasArea = snapshot.tareas
        .filter((tarea) => tarea.areaProcesoId === area.areaProcesoId)
        .sort((a, b) => a.ordenTarea - b.ordenTarea);

      const tareas =
        tareasArea.length > 0
          ? tareasArea
              .map((tarea) => {
                const evidencia = tarea.requiereEvidencia
                  ? " · Evidencia requerida"
                  : "";

                const obligatoria = tarea.obligatoria ? "" : " · Opcional";

                return (
                  `• *${tarea.tareaSnapshot}* — ` +
                  `<@${tarea.responsableOperativoSnapshot}>` +
                  `${obligatoria}` +
                  `${evidencia}`
                );
              })
              .join("\n")
          : "_Sin tareas configuradas_";

      return (
        `*${area.areaNombreSnapshot}*\n` +
        `Responsable funcional: ` +
        `<@${area.responsableFuncionalSnapshot}>\n` +
        tareas
      );
    })
    .join("\n\n");
}

export function buildProcessCreatedDirectMessage(
  snapshot: ProcessSnapshot,
): string {
  const areasText = buildAreasSummary(snapshot);

  return (
    "✅ *Paz y Salvo creado correctamente*\n\n" +
    `*Proceso:* ${snapshot.proceso.procesoId}\n` +
    `*Empleado:* <@${snapshot.proceso.empleadoId}>\n` +
    `*Tipo de solicitud:* ${snapshot.proceso.tipoSolicitudId}\n` +
    `*Fecha de salida:* ${snapshot.proceso.fechaSalida}\n` +
    `*Fecha límite:* ${snapshot.proceso.fechaLimite}\n\n` +
    "*Áreas, tareas y responsables*\n\n" +
    areasText +
    "\n\n" +
    "Si necesitas ajustar algún responsable, " +
    "usa *Ver detalle* desde el App Home."
  );
}

export function buildProcessCreatedChannelMessage(
  snapshot: ProcessSnapshot,
  createdByUserId: string,
): string {
  return (
    buildProcessCreatedDirectMessage(snapshot) +
    "\n\n" +
    `*Creado por:* <@${createdByUserId}>`
  );
}
