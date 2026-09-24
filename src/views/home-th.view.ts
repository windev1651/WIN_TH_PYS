import type { KnownBlock } from "@slack/types";
import type {
  HomeAreaItem,
  HomeProcessItem,
  HomeTaskGroup,
} from "../services/home-data.service.js";
import type { UserPermissions } from "../services/authorization.service.js";

type HomeSummary = {
  activos: number;
  vencidos: number;
  vencenHoy: number;
  misTareas: number;
  misAreas: number;
};

function getSemaphoreEmoji(semaforo: HomeProcessItem["semaforo"]): string {
  switch (semaforo) {
    case "overdue":
      return "🔴";

    case "warning":
      return "🟡";

    default:
      return "🟢";
  }
}

export function buildHomeBlocks(
  summary: HomeSummary,
  procesos: HomeProcessItem[],
  misTareasPorProceso: HomeTaskGroup[],
  misAreas: HomeAreaItem[],
  maxTareas: number,
  permisos: UserPermissions,
): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Paz y Salvo · Talento Humano",
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🔄 Actualizar",
          },
          action_id: "pys_refresh_home",
        },
      ],
    },
  ];

  if (permisos.puedeAdministrarPys) {
    blocks.push(
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Procesos activos*\n${summary.activos}`,
          },
          {
            type: "mrkdwn",
            text: `*Vencen hoy*\n${summary.vencenHoy}`,
          },
          {
            type: "mrkdwn",
            text: `*Vencidos*\n${summary.vencidos}`,
          },
        ],
      },

      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Crear Paz y Salvo",
            },
            action_id: "pys_create_process",
            style: "primary",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Administrar responsables",
            },
            action_id: "pys_manage_responsibles",
          },
        ],
      },
      {
        type: "divider",
      },

      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Procesos activos*",
        },
      },
    );

    if (procesos.length === 0) {
      blocks.push(
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "No hay procesos activos.",
          },
        },
        {
          type: "divider",
        },
      );

      return blocks;
    }

    for (const proceso of procesos) {
      const listoParaCierre = proceso.estado === "Pendiente de aprobación";

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `${getSemaphoreEmoji(proceso.semaforo)} *${proceso.procesoId}*\n` +
            `Empleado: <@${proceso.empleadoId}>\n` +
            `Estado: *${proceso.estado}*\n` +
            `Fecha límite: ${proceso.fechaLimite}\n` +
            `Avance: ${proceso.porcentajeAvance}%`,
        },
      });

      const actions: KnownBlock = {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Ver detalle",
            },
            action_id: "pys_view_process",
            value: proceso.procesoId,
          },

          {
            type: "button" as const,
            text: {
              type: "plain_text" as const,
              text: listoParaCierre
                ? "Cerrar Paz y Salvo"
                : "Cerrar con excepción",
            },
            action_id: "pys_close_process",
            value: proceso.procesoId,
            style: listoParaCierre ? ("primary" as const) : ("danger" as const),
          },
        ],
      };
      blocks.push(actions, {
        type: "divider",
      });
    }
  }

  if (misAreas.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Mis áreas pendientes: ${misAreas.length}*`,
      },
    });

    for (const area of misAreas) {
      blocks.push({
        type: "section",

        text: {
          type: "mrkdwn",
          text:
            `*Proceso:* ${area.procesoId} / <@${area.empleadoId}>\n` +
            `*Área:* ${area.areaNombre}\n` +
            `*Estado:* ${area.estado}\n` +
            `*Avance:* ${area.tareasCompletadas}/${area.tareasObligatorias} obligatorias (${area.avance}%)`,
        },

        accessory: {
          type: "button",

          text: {
            type: "plain_text",
            text: "Gestionar área",
          },

          action_id: "pys_manage_area",

          value: area.areaProcesoId,
        },
      });
    }
  }

  if (summary.misTareas > 0) {
    blocks.push(
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Mis tareas pendientes: ${summary.misTareas}*`,
        },
      },
    );

    for (const grupo of misTareasPorProceso) {
      blocks.push({
        type: "section",

        text: {
          type: "mrkdwn",
          text:
            `*Proceso:* ${grupo.procesoId} / <@${grupo.empleadoId}>\n` +
            `*Tareas pendientes:* ${grupo.tareasPendientes}\n` +
            `*Vence:* ${grupo.fechaLimite}`,
        },

        accessory: {
          type: "button",

          text: {
            type: "plain_text",
            text: "Gestionar tareas",
          },

          action_id: "pys_manage_tasks",

          // ESTE es el cambio importante:
          value: grupo.procesoId,
        },
      });
    }
  }

  return blocks;
}
