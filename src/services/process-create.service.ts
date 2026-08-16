import type { WebClient } from "@slack/web-api";

import { slackLists } from "../config/slack/lists.js";
import { createAreaProceso } from "../repositories/areas-proceso.repository.js";
import { createProceso } from "../repositories/procesos.repository.js";
import { createTareaProceso } from "../repositories/tareas-proceso.repository.js";
import type {
  ProcessSnapshot,
  ProcessSnapshotInput,
} from "../types/process.js";
import { logger } from "../utils/logger.js";
import { deleteListItem } from "./slack-list-write.service.js";
import { buildProcessSnapshot } from "./process-snapshot.service.js";
import { createAuditEvent } from "../repositories/auditoria.repository.js";
import { eventId } from "../utils/entity-id.js";

type CreatedItem = {
  listId: string;
  itemId: string;
};

async function rollbackCreatedItems(
  client: WebClient,
  created: CreatedItem[],
): Promise<void> {
  for (const item of [...created].reverse()) {
    try {
      await deleteListItem(client, item.listId, item.itemId);
    } catch (error) {
      logger.error(
        {
          listId: item.listId,
          itemId: item.itemId,
          error,
        },
        "Rollback de Slack List falló",
      );
    }
  }
}

export async function createPazYSalvo(
  client: WebClient,
  input: ProcessSnapshotInput,
  cid: string,
): Promise<ProcessSnapshot> {
  const snapshot = await buildProcessSnapshot(client, input);

  const created: CreatedItem[] = [];

  try {
    const procesoItemId = await createProceso(client, snapshot.proceso);

    created.push({
      listId: slackLists.procesos.id,
      itemId: procesoItemId,
    });

    for (const area of snapshot.areas) {
      const itemId = await createAreaProceso(client, area);

      created.push({
        listId: slackLists.areasProceso.id,
        itemId,
      });
    }

    for (const tarea of snapshot.tareas) {
      const itemId = await createTareaProceso(client, tarea);

      created.push({
        listId: slackLists.tareasProceso.id,
        itemId,
      });
    }

    const auditItemId = await createAuditEvent(client, {
      eventId: eventId(),
      correlationId: cid,
      procesoId: snapshot.proceso.procesoId,
      entidadTipo: "Proceso",
      entidadId: snapshot.proceso.procesoId,
      accion: "CREACION",
      usuarioId: snapshot.proceso.creadoPorId,
      fechaHoraUtc: new Date().toISOString(),
      estadoNuevo: snapshot.proceso.estado,
      detalle: `Paz y Salvo creado con ${snapshot.areas.length} áreas y ${snapshot.tareas.length} tareas`,
    });

    created.push({
      listId: slackLists.auditoria.id,
      itemId: auditItemId,
    });

    logger.info(
      {
        cid,
        procesoId: snapshot.proceso.procesoId,
        areas: snapshot.areas.length,
        tareas: snapshot.tareas.length,
        auditEvent: true,
        action: "process_created",
      },
      "Paz y Salvo creado correctamente",
    );

    return snapshot;
  } catch (error) {
    logger.error(
      {
        cid,
        procesoId: snapshot.proceso.procesoId,
        createdItems: created.length,
        error,
        action: "process_creation_failed",
      },
      "Error creando Paz y Salvo",
    );

    await rollbackCreatedItems(client, created);

    throw error;
  }
}
