import {
  movementHistoryQuerySchema,
  movementOperationSchema,
  type MovementHistoryQuery,
  type MovementOperation,
} from "@/contracts/schemas/movement-operations";
import { snapshotBundleSchema, type SnapshotBundle } from "@/contracts/schemas/data";
import type { MovementRecord, SnapshotRecord } from "@/contracts/types/database";
import {
  getOperationsRepository,
  type OperationsRepository,
} from "@/server/repositories/operations";
import { serverLog } from "@/server/observability/request-context";
import { ApiError, RepositoryError } from "./errors";
import { assertSnapshotWritable } from "./scenario-protection";
import { reidentifySnapshot, stableUuid } from "./snapshot-versioning";

export interface MovementOperationResult {
  snapshot: SnapshotRecord;
  source_snapshot_id: string;
  operation: MovementOperation["operation"];
  movement: MovementRecord;
  idempotent: boolean;
}

function snapshotIdForOperation(operationId: string) {
  return stableUuid(`redes-ayuda:snapshot:${operationId}`);
}

function movementIdForOperation(operationId: string) {
  return stableUuid(`redes-ayuda:movement:${operationId}`);
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

function inventoryCoordinates(operation: MovementOperation) {
  if (operation.operation === "confirm_donation") {
    return null;
  }
  return operation.values;
}

function matchesExistingMovement(
  movement: MovementRecord,
  sourceSnapshotId: string,
  operation: MovementOperation,
) {
  if (
    movement.operacion_id !== operation.values.operacion_id ||
    movement.snapshot_origen_id !== sourceSnapshotId ||
    movement.cantidad_paquetes !== operation.values.cantidad_paquetes ||
    movement.ocurrido_en !== operation.values.ocurrido_en
  ) {
    return false;
  }
  if (operation.operation === "confirm_donation") {
    return (
      movement.tipo === "recepcion_confirmada" &&
      movement.intencion_id === operation.values.intencion_id
    );
  }
  const values = inventoryCoordinates(operation);
  return Boolean(
    values &&
      movement.tipo ===
        (operation.operation === "dispatch" ? "despacho" : "recepcion_confirmada") &&
      movement.producto_id === values.producto_id &&
      movement.sku_id === values.sku_id &&
      (operation.operation === "dispatch"
        ? movement.centro_origen_id === values.centro_id &&
          movement.centro_destino_id === null
        : movement.centro_destino_id === values.centro_id &&
          movement.centro_origen_id === null) &&
      movement.intencion_id === null
  );
}

function existingResult(
  bundle: SnapshotBundle,
  sourceSnapshotId: string,
  operation: MovementOperation,
): MovementOperationResult {
  const movement = bundle.movements.find(
    (row) => row.operacion_id === operation.values.operacion_id,
  );
  if (!movement || !matchesExistingMovement(movement, sourceSnapshotId, operation)) {
    throw new ApiError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "El identificador de operación ya fue utilizado con otros datos.",
    );
  }
  return {
    snapshot: bundle.metadata,
    source_snapshot_id: sourceSnapshotId,
    operation: operation.operation,
    movement,
    idempotent: true,
  };
}

function changeInventory(
  bundle: SnapshotBundle,
  centerId: string,
  skuId: string,
  delta: number,
) {
  const index = bundle.inventory.findIndex(
    (row) => row.centro_id === centerId && row.sku_id === skuId,
  );
  const current = index >= 0 ? bundle.inventory[index].cantidad_paquetes : 0;
  const nextQuantity = current + delta;
  if (nextQuantity < 0) {
    throw new ApiError(
      409,
      "INSUFFICIENT_INVENTORY",
      "El despacho supera el inventario confirmado disponible.",
    );
  }
  const row = {
    snapshot_id: bundle.metadata.id,
    centro_id: centerId,
    sku_id: skuId,
    cantidad_paquetes: nextQuantity,
  };
  if (index >= 0) {
    bundle.inventory[index] = row;
  } else {
    bundle.inventory.push(row);
  }
}

function createMovementVersion(
  source: SnapshotBundle,
  operation: MovementOperation,
  now: Date,
) {
  const next = structuredClone(source);
  const sourceSnapshotId = source.metadata.id;
  const operationId = operation.values.operacion_id;
  const nextId = snapshotIdForOperation(operationId);
  const registeredAt = now.toISOString();
  const scenarioId = source.metadata.escenario_id ?? sourceSnapshotId;
  const baseSnapshotId =
    source.metadata.snapshot_base_id ?? sourceSnapshotId;
  next.metadata = {
    id: nextId,
    nombre: `${source.metadata.nombre} · movimiento operativo`,
    created_at: registeredAt,
    descripcion: `Versión operativa M4 derivada del snapshot ${sourceSnapshotId}.`,
    escenario_id: scenarioId,
    snapshot_origen_id: sourceSnapshotId,
    snapshot_base_id: baseSnapshotId,
  };
  reidentifySnapshot(next, nextId);

  let movement: MovementRecord;
  if (operation.operation === "confirm_donation") {
    const donation = next.expectedDonations.find(
      (row) => row.intencion_id === operation.values.intencion_id,
    );
    requireReference(Boolean(donation), `la donación ${operation.values.intencion_id}`);
    if (!donation || donation.estado !== "pendiente") {
      throw new ApiError(
        409,
        "DONATION_NOT_PENDING",
        "La donación seleccionada ya no está pendiente.",
      );
    }
    const presentation = next.presentations.find(
      (row) => row.sku_id === donation.sku_id,
    );
    requireReference(Boolean(presentation), `la presentación ${donation.sku_id}`);
    changeInventory(
      next,
      donation.centro_id,
      donation.sku_id,
      operation.values.cantidad_paquetes,
    );
    donation.estado = "recibida";
    movement = {
      snapshot_id: nextId,
      movimiento_id: movementIdForOperation(operationId),
      operacion_id: operationId,
      tipo: "recepcion_confirmada",
      centro_origen_id: null,
      centro_destino_id: donation.centro_id,
      producto_id: presentation?.producto_id ?? "",
      sku_id: donation.sku_id,
      cantidad_paquetes: operation.values.cantidad_paquetes,
      ocurrido_en: operation.values.ocurrido_en,
      registrado_en: registeredAt,
      intencion_id: donation.intencion_id,
      snapshot_origen_id: sourceSnapshotId,
      cantidad_anunciada_paquetes: donation.cantidad_paquetes,
    };
  } else {
    const values = operation.values;
    requireReference(
      next.centers.some((row) => row.centro_id === values.centro_id),
      `el centro ${values.centro_id}`,
    );
    requireReference(
      next.products.some((row) => row.producto_id === values.producto_id),
      `el producto ${values.producto_id}`,
    );
    const presentation = next.presentations.find(
      (row) => row.sku_id === values.sku_id,
    );
    requireReference(Boolean(presentation), `la presentación ${values.sku_id}`);
    if (presentation?.producto_id !== values.producto_id) {
      throw new ApiError(
        400,
        "PRESENTATION_PRODUCT_MISMATCH",
        "La presentación no pertenece al producto seleccionado.",
      );
    }
    const isDispatch = operation.operation === "dispatch";
    changeInventory(
      next,
      values.centro_id,
      values.sku_id,
      isDispatch ? -values.cantidad_paquetes : values.cantidad_paquetes,
    );
    movement = {
      snapshot_id: nextId,
      movimiento_id: movementIdForOperation(operationId),
      operacion_id: operationId,
      tipo: isDispatch ? "despacho" : "recepcion_confirmada",
      centro_origen_id: isDispatch ? values.centro_id : null,
      centro_destino_id: isDispatch ? null : values.centro_id,
      producto_id: values.producto_id,
      sku_id: values.sku_id,
      cantidad_paquetes: values.cantidad_paquetes,
      ocurrido_en: values.ocurrido_en,
      registrado_en: registeredAt,
      intencion_id: null,
      snapshot_origen_id: sourceSnapshotId,
      cantidad_anunciada_paquetes: null,
    };
  }
  next.movements.push(movement);
  return { bundle: snapshotBundleSchema.parse(next), movement };
}

export async function applyMovementOperation(
  sourceSnapshotId: string,
  input: unknown,
  repository: OperationsRepository = getOperationsRepository(),
  now = new Date(),
): Promise<MovementOperationResult> {
  const parsed = movementOperationSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "INVALID_MOVEMENT_OPERATION",
      "Los datos del movimiento no son válidos.",
      parsed.error.flatten(),
    );
  }
  const operation = parsed.data;
  const source = await repository.getSnapshotBundle(sourceSnapshotId);
  if (!source) {
    throw new ApiError(404, "SNAPSHOT_NOT_FOUND", "El snapshot no existe.");
  }
  assertSnapshotWritable(source.metadata);
  const nextSnapshotId = snapshotIdForOperation(operation.values.operacion_id);
  const existing = await repository.getSnapshotBundle(nextSnapshotId);
  if (existing) {
    return existingResult(existing, sourceSnapshotId, operation);
  }

  const startedAt = performance.now();
  serverLog("INFO", "SERVICE", "Publicando movimiento operativo", {
    operation: operation.operation,
    sourceSnapshot: sourceSnapshotId,
  });
  const { bundle, movement } = createMovementVersion(source, operation, now);
  try {
    const snapshot = await repository.writeSnapshot(bundle);
    serverLog("OK", "SERVICE", "Movimiento operativo publicado", {
      durationMs: Math.round(performance.now() - startedAt),
      operation: operation.operation,
      sourceSnapshot: sourceSnapshotId,
      snapshot: snapshot.id,
    });
    return {
      snapshot,
      source_snapshot_id: sourceSnapshotId,
      operation: operation.operation,
      movement,
      idempotent: false,
    };
  } catch (error) {
    if (error instanceof RepositoryError) {
      const published = await repository.getSnapshotBundle(nextSnapshotId);
      if (published) {
        return existingResult(published, sourceSnapshotId, operation);
      }
      throw new ApiError(
        500,
        "PERSISTENCE_ERROR",
        "No fue posible guardar el movimiento y la nueva versión operativa.",
      );
    }
    throw error;
  }
}

export async function getMovementHistory(
  snapshotId: string,
  input: unknown,
  repository: OperationsRepository = getOperationsRepository(),
) {
  const parsed = movementHistoryQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "INVALID_MOVEMENT_QUERY",
      "Los filtros del historial no son válidos.",
      parsed.error.flatten(),
    );
  }
  if (!(await repository.findSnapshot(snapshotId))) {
    throw new ApiError(404, "SNAPSHOT_NOT_FOUND", "El snapshot no existe.");
  }
  const query: MovementHistoryQuery = parsed.data;
  const from = query.desde ? new Date(query.desde).getTime() : null;
  const to = query.hasta ? new Date(query.hasta).getTime() : null;
  const movements = await repository.listMovements(snapshotId);
  return movements.filter((movement) => {
    const occurred = new Date(movement.ocurrido_en).getTime();
    const matchesCenter =
      !query.centro_id ||
      movement.centro_origen_id === query.centro_id ||
      movement.centro_destino_id === query.centro_id;
    return (
      matchesCenter &&
      (from === null || occurred >= from) &&
      (to === null || occurred <= to)
    );
  });
}
