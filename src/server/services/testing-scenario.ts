import { z } from "zod";

import { snapshotBundleSchema } from "@/contracts/schemas/data";
import type { TestingScenarioResetResult } from "@/contracts/types/excel-receptions";
import {
  WEEKLY_MAIN_SNAPSHOT_ID,
  WEEKLY_TESTING_SCENARIO_ID,
} from "@/lib/operational-scenarios";
import {
  getOperationsRepository,
  type OperationsRepository,
} from "@/server/repositories/operations";
import { ApiError, RepositoryError } from "./errors";
import { reidentifySnapshot, stableUuid } from "./snapshot-versioning";

const resetSchema = z.object({ operacion_id: z.string().uuid() }).strict();

export async function resetTestingScenario(
  input: unknown,
  repository: OperationsRepository = getOperationsRepository(),
): Promise<TestingScenarioResetResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(400, "INVALID_RESET_OPERATION", "El reinicio requiere un ID de operación válido.", parsed.error.flatten());
  }
  const nextId = stableUuid(`redes-ayuda:a3:reset:${parsed.data.operacion_id.toLowerCase()}`);
  const existing = await repository.getSnapshotBundle(nextId);
  if (existing) {
    if (existing.metadata.escenario_id !== WEEKLY_TESTING_SCENARIO_ID) {
      throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "El ID de reinicio ya fue utilizado.");
    }
    return { snapshot: existing.metadata, source_snapshot_id: WEEKLY_MAIN_SNAPSHOT_ID, idempotent: true };
  }
  const main = await repository.getSnapshotBundle(WEEKLY_MAIN_SNAPSHOT_ID);
  if (!main) throw new ApiError(404, "MAIN_SNAPSHOT_NOT_FOUND", "No se encontró el cierre validado de MAIN.");
  const testingSnapshots = (await repository.listSnapshots()).filter(
    (snapshot) => snapshot.escenario_id === WEEKLY_TESTING_SCENARIO_ID,
  );
  const latestTestingTime = testingSnapshots.reduce(
    (latest, snapshot) => Math.max(latest, Date.parse(snapshot.created_at)),
    Date.parse("2026-11-16T00:00:00-05:00") - 1,
  );
  const createdAt = new Date(latestTestingTime + 1).toISOString();
  const next = structuredClone(main);
  next.metadata = {
    id: nextId,
    nombre: "Emergencia semanal — PRUEBAS · reinicio confirmado",
    created_at: createdAt,
    descripcion: "Nuevo estado base independiente creado desde el cierre MAIN; no reproduce los movimientos históricos.",
    escenario_id: WEEKLY_TESTING_SCENARIO_ID,
    snapshot_origen_id: WEEKLY_MAIN_SNAPSHOT_ID,
    snapshot_base_id: nextId,
  };
  next.movements = [];
  next.operationalEvents = [];
  next.qrDonations = [];
  reidentifySnapshot(next, nextId);
  const validated = snapshotBundleSchema.parse(next);
  try {
    const snapshot = await repository.writeSnapshot(validated);
    return { snapshot, source_snapshot_id: WEEKLY_MAIN_SNAPSHOT_ID, idempotent: false };
  } catch (error) {
    if (error instanceof RepositoryError) {
      const published = await repository.getSnapshotBundle(nextId);
      if (published?.metadata.escenario_id === WEEKLY_TESTING_SCENARIO_ID) {
        return { snapshot: published.metadata, source_snapshot_id: WEEKLY_MAIN_SNAPSHOT_ID, idempotent: true };
      }
      throw new ApiError(500, "PERSISTENCE_ERROR", "No fue posible reiniciar PRUEBAS.");
    }
    throw error;
  }
}
