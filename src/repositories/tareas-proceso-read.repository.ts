import type { WebClient } from "@slack/web-api";

import { slackColumns } from "../config/slack/columns.js";
import { slackLists } from "../config/slack/lists.js";
import { getSelectOptionMap } from "../services/slack-list-schema.service.js";
import { getAllListItems } from "../services/slack-list-read.service.js";
import type { TareaProcesoDetail } from "../types/process-detail.js";
import {
  getCheckboxField,
  getDateField,
  getNumberField,
  getSelectField,
  getTextField,
  getUserField,
  type SlackListItem,
} from "./list-helpers.js";

// export async function getTareasProceso(
//   client: WebClient,
//   procesoId: string,
// ): Promise<TareaProcesoDetail[]> {
//   const response = await client.apiCall("slackLists.items.list", {
//     list_id: slackLists.tareasProceso.id,
//     limit: 100,
//   });

//   const items =
//     (
//       response as {
//         items?: SlackListItem[];
//       }
//     ).items ?? [];

//   const estadoMap = await getSelectOptionMap(
//     client,
//     slackLists.tareasProceso.id,
//     slackColumns.tareasProceso.estado,
//   );

//   return items
//     .map((item): TareaProcesoDetail | null => {
//       const rowProcesoId = getTextField(
//         item,
//         slackColumns.tareasProceso.procesoId,
//       );

//       if (!item.id || rowProcesoId !== procesoId) {
//         return null;
//       }

//       const taskId = getTextField(item, slackColumns.tareasProceso.taskId);

//       const areaProcesoId = getTextField(
//         item,
//         slackColumns.tareasProceso.areaProcesoId,
//       );

//       const tarea = getTextField(
//         item,
//         slackColumns.tareasProceso.tareaSnapshot,
//       );

//       const responsableOperativoId = getUserField(
//         item,
//         slackColumns.tareasProceso.responsableOperativoSnapshot,
//       );

//       const estadoOptionId = getSelectField(
//         item,
//         slackColumns.tareasProceso.estado,
//       );

//       const estado = estadoOptionId ? estadoMap.get(estadoOptionId) : null;

//       if (
//         !taskId ||
//         !areaProcesoId ||
//         !tarea ||
//         !responsableOperativoId ||
//         !estado
//       ) {
//         return null;
//       }

//       return {
//         slackItemId: item.id,
//         taskId,
//         procesoId,
//         areaProcesoId,

//         configTareaIdOrigen:
//           getTextField(item, slackColumns.tareasProceso.configTareaIdOrigen) ??
//           "",

//         tarea,
//         responsableOperativoId,

//         obligatoria: getCheckboxField(
//           item,
//           slackColumns.tareasProceso.obligatoria,
//         ),

//         requiereEvidencia: getCheckboxField(
//           item,
//           slackColumns.tareasProceso.requiereEvidencia,
//         ),

//         estado,

//         fechaLimite:
//           getDateField(item, slackColumns.tareasProceso.fechaLimite) ?? "",

//         comentario: getTextField(item, slackColumns.tareasProceso.comentario),

//         ordenTarea:
//           getNumberField(item, slackColumns.tareasProceso.ordenTarea) ?? 0,
//       };
//     })
//     .filter((item): item is TareaProcesoDetail => item !== null)
//     .sort((a, b) => a.ordenTarea - b.ordenTarea);
// }
export async function getTareasProceso(
  client: WebClient,
  procesoId: string,
): Promise<TareaProcesoDetail[]> {
  const items = await getAllListItems(client, slackLists.tareasProceso.id);

  const tareas = await parseTareas(client, items);

  return tareas
    .filter((item) => item.procesoId === procesoId)
    .sort((a, b) => a.ordenTarea - b.ordenTarea);
}

export async function getTareasUsuario(
  client: WebClient,
  userId: string,
): Promise<TareaProcesoDetail[]> {
  const items = await getAllListItems(client, slackLists.tareasProceso.id);

  const tareas = await parseTareas(client, items);

  // console.log("DEBUG getTareasUsuario", {
  //   userId,
  //   totalTareas: tareas.length,
  //   responsables: tareas.map((tarea) => ({
  //     taskId: tarea.taskId,
  //     responsable: tarea.responsableOperativoId,
  //     estado: tarea.estado,
  //   })),
  // });

  const tareasUsuario = tareas
    .filter(
      (tarea) =>
        tarea.responsableOperativoId === userId &&
        !["Completada", "No aplica"].includes(tarea.estado),
    )
    .sort((a, b) => {
      if (a.fechaLimite !== b.fechaLimite) {
        return a.fechaLimite.localeCompare(b.fechaLimite);
      }

      return a.ordenTarea - b.ordenTarea;
    });

  // console.log("DEBUG tareas encontradas para usuario", {
  //   userId,
  //   cantidad: tareasUsuario.length,
  //   tareas: tareasUsuario.map((tarea) => ({
  //     taskId: tarea.taskId,
  //     tarea: tarea.tarea,
  //     responsable: tarea.responsableOperativoId,
  //     estado: tarea.estado,
  //   })),
  // });

  return tareasUsuario;
}

async function parseTareas(
  client: WebClient,
  items: SlackListItem[],
): Promise<TareaProcesoDetail[]> {
  const estadoMap = await getSelectOptionMap(
    client,
    slackLists.tareasProceso.id,
    slackColumns.tareasProceso.estado,
  );

  return items
    .map((item): TareaProcesoDetail | null => {
      if (!item.id) {
        return null;
      }

      const procesoId = getTextField(
        item,
        slackColumns.tareasProceso.procesoId,
      );

      const taskId = getTextField(item, slackColumns.tareasProceso.taskId);

      const areaProcesoId = getTextField(
        item,
        slackColumns.tareasProceso.areaProcesoId,
      );

      const tarea = getTextField(
        item,
        slackColumns.tareasProceso.tareaSnapshot,
      );

      const responsableOperativoId = getUserField(
        item,
        slackColumns.tareasProceso.responsableOperativoSnapshot,
      );

      const estadoOptionId = getSelectField(
        item,
        slackColumns.tareasProceso.estado,
      );

      const estado = estadoOptionId ? estadoMap.get(estadoOptionId) : null;

      if (
        !procesoId ||
        !taskId ||
        !areaProcesoId ||
        !tarea ||
        !responsableOperativoId ||
        !estado
      ) {
        return null;
      }

      return {
        slackItemId: item.id,
        taskId,
        procesoId,
        areaProcesoId,

        configTareaIdOrigen:
          getTextField(item, slackColumns.tareasProceso.configTareaIdOrigen) ??
          "",

        tarea,
        responsableOperativoId,

        obligatoria: getCheckboxField(
          item,
          slackColumns.tareasProceso.obligatoria,
        ),

        requiereEvidencia: getCheckboxField(
          item,
          slackColumns.tareasProceso.requiereEvidencia,
        ),

        estado,

        fechaLimite:
          getDateField(item, slackColumns.tareasProceso.fechaLimite) ?? "",

        comentario: getTextField(item, slackColumns.tareasProceso.comentario),

        ordenTarea:
          getNumberField(item, slackColumns.tareasProceso.ordenTarea) ?? 0,
      };
    })
    .filter((item): item is TareaProcesoDetail => item !== null);
}
