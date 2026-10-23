import {
  getOperationsRepository,
  type OperationsRepository,
} from "@/server/repositories/operations";
import { ApiError } from "./errors";

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
  return repository.listSnapshots();
}

export async function getSnapshot(
  snapshotId: string,
  repository: OperationsRepository = getOperationsRepository(),
) {
  return requireSnapshot(repository, snapshotId);
}

export async function getCenters(
  snapshotId: string,
  repository: OperationsRepository = getOperationsRepository(),
) {
  await requireSnapshot(repository, snapshotId);
  return repository.listCenters(snapshotId);
}

export async function getProducts(
  snapshotId: string,
  repository: OperationsRepository = getOperationsRepository(),
) {
  await requireSnapshot(repository, snapshotId);
  const [products, presentations] = await Promise.all([
    repository.listProducts(snapshotId),
    repository.listPresentations(snapshotId),
  ]);

  return products.map((product) => ({
    ...product,
    presentaciones: presentations.filter(
      (presentation) => presentation.producto_id === product.producto_id,
    ),
  }));
}

export async function getTravelTimes(
  snapshotId: string,
  repository: OperationsRepository = getOperationsRepository(),
) {
  await requireSnapshot(repository, snapshotId);
  return repository.listTravelTimes(snapshotId);
}
