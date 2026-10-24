import {
  getOperationsRepository,
  type OperationsRepository,
} from "@/server/repositories/operations";
import { serverLog } from "@/server/observability/request-context";
import { ApiError } from "./errors";

function durationSince(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

async function requireSnapshot(
  repository: OperationsRepository,
  snapshotId: string,
) {
  const snapshot = await repository.findSnapshot(snapshotId);
  if (!snapshot) {
    throw new ApiError(404, "SNAPSHOT_NOT_FOUND", "El snapshot no existe.");
  }
  return snapshot;
}

export async function getSnapshots(
  repository: OperationsRepository = getOperationsRepository(),
) {
  const startedAt = performance.now();
  serverLog("INFO", "SERVICE", "Consultando snapshots");
  const snapshots = await repository.listSnapshots();
  serverLog("OK", "SERVICE", "Snapshots consultados", {
    durationMs: durationSince(startedAt),
    records: snapshots.length,
  });
  return snapshots;
}

export async function getSnapshot(
  snapshotId: string,
  repository: OperationsRepository = getOperationsRepository(),
) {
  const startedAt = performance.now();
  serverLog("INFO", "SERVICE", "Consultando snapshot");
  const snapshot = await requireSnapshot(repository, snapshotId);
  serverLog("OK", "SERVICE", "Snapshot consultado", {
    durationMs: durationSince(startedAt),
    records: 1,
  });
  return snapshot;
}

export async function getCenters(
  snapshotId: string,
  repository: OperationsRepository = getOperationsRepository(),
) {
  const startedAt = performance.now();
  serverLog("INFO", "SERVICE", "Consultando centros");
  await requireSnapshot(repository, snapshotId);
  const centers = await repository.listCenters(snapshotId);
  serverLog("OK", "SERVICE", "Centros consultados", {
    durationMs: durationSince(startedAt),
    records: centers.length,
  });
  return centers;
}

export async function getProducts(
  snapshotId: string,
  repository: OperationsRepository = getOperationsRepository(),
) {
  const startedAt = performance.now();
  serverLog("INFO", "SERVICE", "Consultando productos");
  await requireSnapshot(repository, snapshotId);
  const [products, presentations] = await Promise.all([
    repository.listProducts(snapshotId),
    repository.listPresentations(snapshotId),
  ]);

  const result = products.map((product) => ({
    ...product,
    presentaciones: presentations.filter(
      (presentation) => presentation.producto_id === product.producto_id,
    ),
  }));
  serverLog("OK", "SERVICE", "Productos consultados", {
    durationMs: durationSince(startedAt),
    presentations: presentations.length,
    records: result.length,
  });
  return result;
}

export async function getTravelTimes(
  snapshotId: string,
  repository: OperationsRepository = getOperationsRepository(),
) {
  const startedAt = performance.now();
  serverLog("INFO", "SERVICE", "Consultando tiempos de traslado");
  await requireSnapshot(repository, snapshotId);
  const travelTimes = await repository.listTravelTimes(snapshotId);
  serverLog("OK", "SERVICE", "Tiempos de traslado consultados", {
    durationMs: durationSince(startedAt),
    records: travelTimes.length,
  });
  return travelTimes;
}
