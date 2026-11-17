import { randomUUID } from "node:crypto";

import {
  operationalUpdateSchema,
  type OperationalUpdate,
} from "@/contracts/schemas/operational-updates";
import { snapshotBundleSchema, type SnapshotBundle } from "@/contracts/schemas/data";
import type { SnapshotRecord } from "@/contracts/types/database";
import {
  getOperationsRepository,
  type OperationsRepository,
} from "@/server/repositories/operations";
import { serverLog } from "@/server/observability/request-context";
import { ApiError, RepositoryError } from "./errors";
import { assertSnapshotWritable } from "./scenario-protection";

export interface OperationalUpdateResult {
  snapshot: SnapshotRecord;
  source_snapshot_id: string;
  operation: OperationalUpdate["operation"];
}

function requireReference(exists: boolean, description: string) {
  if (!exists) {
    throw new ApiError(
      400,
      "INVALID_REFERENCE",
      `No existe ${description} en el snapshot seleccionado.`,
    );
  }
}

function updateCenter(bundle: SnapshotBundle, update: OperationalUpdate) {
  if (
    update.operation !== "create_center" &&
    update.operation !== "update_center"
  ) {
    return;
  }

  const existingIndex = bundle.centers.findIndex(
    (center) => center.centro_id === update.values.centro_id,
  );
  if (update.operation === "create_center" && existingIndex >= 0) {
    throw new ApiError(
      409,
      "CENTER_ALREADY_EXISTS",
      "Ya existe un centro con ese identificador.",
    );
  }
  if (update.operation === "update_center" && existingIndex < 0) {
    throw new ApiError(404, "CENTER_NOT_FOUND", "El centro no existe.");
  }

  const row = { snapshot_id: bundle.metadata.id, ...update.values };
  if (existingIndex >= 0) {
    bundle.centers[existingIndex] = row;
  } else {
    bundle.centers.push(row);
  }
}

function updateInventory(bundle: SnapshotBundle, update: OperationalUpdate) {
  if (update.operation !== "upsert_inventory") {
    return;
  }
  const { values } = update;
  requireReference(
    bundle.centers.some((center) => center.centro_id === values.centro_id),
    `el centro ${values.centro_id}`,
  );
  requireReference(
    bundle.products.some((product) => product.producto_id === values.producto_id),
    `el producto ${values.producto_id}`,
  );
  const presentation = bundle.presentations.find(
    (item) => item.sku_id === values.sku_id,
  );
  requireReference(Boolean(presentation), `la presentación ${values.sku_id}`);
  if (presentation?.producto_id !== values.producto_id) {
    throw new ApiError(
      400,
      "PRESENTATION_PRODUCT_MISMATCH",
      "La presentación no pertenece al producto seleccionado.",
    );
  }

  const row = {
    snapshot_id: bundle.metadata.id,
    centro_id: values.centro_id,
    sku_id: values.sku_id,
    cantidad_paquetes: values.cantidad_paquetes,
  };
  const existingIndex = bundle.inventory.findIndex(
    (item) =>
      item.centro_id === values.centro_id && item.sku_id === values.sku_id,
  );
  if (existingIndex >= 0) {
    bundle.inventory[existingIndex] = row;
  } else {
    bundle.inventory.push(row);
  }
}

function updateNeed(bundle: SnapshotBundle, update: OperationalUpdate) {
  if (update.operation !== "upsert_need") {
    return;
  }
  const { values } = update;
  requireReference(
    bundle.centers.some((center) => center.centro_id === values.centro_id),
    `el centro ${values.centro_id}`,
  );
  requireReference(
    bundle.products.some((product) => product.producto_id === values.producto_id),
    `el producto ${values.producto_id}`,
  );

  const existingIndex = bundle.needs.findIndex(
    (item) =>
      item.centro_id === values.centro_id &&
      item.producto_id === values.producto_id,
  );
  const current = existingIndex >= 0 ? bundle.needs[existingIndex] : null;
  const row = {
    snapshot_id: bundle.metadata.id,
    centro_id: values.centro_id,
    producto_id: values.producto_id,
    objetivo_unidad_base: values.objetivo_unidad_base,
    reserva_unidad_base: current?.reserva_unidad_base ?? 0,
    prioridad: values.prioridad,
  };
  if (existingIndex >= 0) {
    bundle.needs[existingIndex] = row;
  } else {
    bundle.needs.push(row);
  }
}

function updateVolunteers(bundle: SnapshotBundle, update: OperationalUpdate) {
  if (update.operation !== "upsert_volunteers") {
    return;
  }
  const { values } = update;
  requireReference(
    bundle.centers.some((center) => center.centro_id === values.centro_id),
    `el centro ${values.centro_id}`,
  );
  const row = { snapshot_id: bundle.metadata.id, ...values };
  const existingIndex = bundle.volunteers.findIndex(
    (item) => item.centro_id === values.centro_id,
  );
  if (existingIndex >= 0) {
    bundle.volunteers[existingIndex] = row;
  } else {
    bundle.volunteers.push(row);
  }
}

function createOperationalVersion(
  source: SnapshotBundle,
  update: OperationalUpdate,
  now: Date,
) {
  const next = structuredClone(source);
  const sourceId = source.metadata.id;
  const nextId = randomUUID();
  const createdAt = now.toISOString();
  const scenarioId = source.metadata.escenario_id ?? sourceId;
  const baseSnapshotId = source.metadata.snapshot_base_id ?? sourceId;
  next.metadata = {
    id: nextId,
    nombre: `${source.metadata.nombre} · versión operativa`,
    created_at: createdAt,
    descripcion: `Versión operativa derivada del snapshot ${sourceId}.`,
    escenario_id: scenarioId,
    snapshot_origen_id: sourceId,
    snapshot_base_id: baseSnapshotId,
  };

  for (const collection of [
    next.centers,
    next.products,
    next.presentations,
    next.inventory,
    next.needs,
    next.volunteers,
    next.travelTimes,
    next.expectedDonations,
    next.movements,
    next.operationalEvents,
  ]) {
    for (const row of collection) {
      row.snapshot_id = nextId;
    }
  }

  updateCenter(next, update);
  updateInventory(next, update);
  updateNeed(next, update);
  updateVolunteers(next, update);
  const eventId = randomUUID();
  const common = {
    snapshot_id: nextId,
    evento_id: eventId,
    operacion_id: nextId,
    escenario_id: scenarioId,
    snapshot_origen_id: sourceId,
    centro_id: update.values.centro_id,
    ocurrido_en: createdAt,
    registrado_en: createdAt,
    orden: source.movements.length + source.operationalEvents.length + 1,
  };
  if (update.operation === "upsert_inventory") {
    next.operationalEvents.push({
      ...common,
      tipo: "ajuste_inventario",
      operacion: update.operation,
      producto_id: update.values.producto_id,
      sku_id: update.values.sku_id,
      payload_json: JSON.stringify({
        operacion: update.operation,
        cantidad_paquetes: update.values.cantidad_paquetes,
      }),
    });
  } else if (update.operation === "upsert_need") {
    const need = next.needs.find(
      (row) =>
        row.centro_id === update.values.centro_id &&
        row.producto_id === update.values.producto_id,
    );
    next.operationalEvents.push({
      ...common,
      tipo: "actualizacion_necesidad",
      operacion: update.operation,
      producto_id: update.values.producto_id,
      sku_id: null,
      payload_json: JSON.stringify({
        operacion: update.operation,
        objetivo_unidad_base: update.values.objetivo_unidad_base,
        reserva_unidad_base: need?.reserva_unidad_base ?? 0,
        prioridad: update.values.prioridad,
      }),
    });
  } else if (update.operation === "upsert_volunteers") {
    next.operationalEvents.push({
      ...common,
      tipo: "actualizacion_voluntariado",
      operacion: update.operation,
      producto_id: null,
      sku_id: null,
      payload_json: JSON.stringify({
        operacion: update.operation,
        disponibles: update.values.disponibles,
        requeridos: update.values.requeridos,
      }),
    });
  } else {
    next.operationalEvents.push({
      ...common,
      tipo: "cambio_estado_centro",
      operacion: update.operation,
      producto_id: null,
      sku_id: null,
      payload_json: JSON.stringify({
        operacion: update.operation,
        nombre: update.values.nombre,
        estado: update.values.estado,
        zona: update.values.zona,
        coordinador_nombre: update.values.coordinador_nombre,
      }),
    });
  }
  return snapshotBundleSchema.parse(next);
}

export async function applyOperationalUpdate(
  sourceSnapshotId: string,
  input: unknown,
  repository: OperationsRepository = getOperationsRepository(),
  now = new Date(),
): Promise<OperationalUpdateResult> {
  const parsed = operationalUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "INVALID_OPERATION",
      "Los datos de la actualización no son válidos.",
      parsed.error.flatten(),
    );
  }

  const source = await repository.getSnapshotBundle(sourceSnapshotId);
  if (!source) {
    throw new ApiError(404, "SNAPSHOT_NOT_FOUND", "El snapshot no existe.");
  }
  assertSnapshotWritable(source.metadata);

  const startedAt = performance.now();
  serverLog("INFO", "SERVICE", "Publicando versión operativa", {
    operation: parsed.data.operation,
    sourceSnapshot: sourceSnapshotId,
  });
  const next = createOperationalVersion(source, parsed.data, now);
  try {
    const snapshot = await repository.writeSnapshot(next);
    serverLog("OK", "SERVICE", "Versión operativa publicada", {
      durationMs: Math.round(performance.now() - startedAt),
      operation: parsed.data.operation,
      sourceSnapshot: sourceSnapshotId,
      snapshot: snapshot.id,
    });
    return {
      snapshot,
      source_snapshot_id: sourceSnapshotId,
      operation: parsed.data.operation,
    };
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw new ApiError(
        500,
        "PERSISTENCE_ERROR",
        "No fue posible guardar la nueva versión operativa.",
      );
    }
    throw error;
  }
}
