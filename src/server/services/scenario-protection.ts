import type { SnapshotMetadata } from "@/contracts/schemas/data";
import { isWeeklyMainScenario } from "@/lib/operational-scenarios";
import { ApiError } from "./errors";

export function assertSnapshotWritable(snapshot: SnapshotMetadata) {
  if (isWeeklyMainScenario(snapshot)) {
    throw new ApiError(
      409,
      "SCENARIO_READ_ONLY",
      "Emergencia semanal — MAIN es una referencia de solo lectura. Selecciona PRUEBAS para publicar cambios.",
    );
  }
}
