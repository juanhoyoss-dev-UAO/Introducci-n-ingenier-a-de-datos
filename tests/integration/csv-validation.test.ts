import { describe, expect, it } from "vitest";

import type { SnapshotBundle } from "@/contracts/schemas/data";
import { CsvOperationsRepository } from "@/server/repositories/operations";
import {
  createTempDataRoots,
  loadDemoBundle,
  reidentifyBundle,
} from "../helpers/csv";

const INVALID_SNAPSHOT = "40000000-0000-4000-8000-000000000021";
const OTHER_SNAPSHOT = "40000000-0000-4000-8000-000000000022";

type InvalidBundleMutation = (bundle: SnapshotBundle) => void;

const invalidCases: Array<[string, InvalidBundleMutation]> = [
  ["una cadena numérica vacía", (bundle) => {
    const row = bundle.inventory[0] as unknown as Record<string, unknown>;
    row.cantidad_paquetes = "";
  }],
  ["contenido de presentación igual a cero", (bundle) => {
    bundle.presentations[0].contenido_por_paquete = 0;
  }],
  ["inventario negativo", (bundle) => {
    bundle.inventory[0].cantidad_paquetes = -1;
  }],
  ["donación con cantidad cero", (bundle) => {
    bundle.expectedDonations[0].cantidad_paquetes = 0;
  }],
  ["tiempo negativo", (bundle) => {
    bundle.travelTimes[0].minutos = -1;
  }],
  ["prioridad fuera de 1 a 3", (bundle) => {
    bundle.needs[0].prioridad = 4;
  }],
  ["estado de donación no permitido", (bundle) => {
    const row = bundle.expectedDonations[0] as unknown as Record<
      string,
      unknown
    >;
    row.estado = "desconocida";
  }],
  ["una fila perteneciente a otro snapshot", (bundle) => {
    bundle.centers[0].snapshot_id = OTHER_SNAPSHOT;
  }],
  ["un centro duplicado", (bundle) => {
    bundle.centers.push(structuredClone(bundle.centers[0]));
  }],
  ["un producto inexistente desde una presentación", (bundle) => {
    bundle.presentations[0].producto_id = "P99";
  }],
  ["un SKU inexistente desde inventario", (bundle) => {
    bundle.inventory[0].sku_id = "SKU-INEXISTENTE";
  }],
];

describe("validación integral de snapshots CSV", () => {
  it.each(invalidCases)("rechaza %s sin publicar datos", async (_name, mutate) => {
    const roots = await createTempDataRoots();
    try {
      const bundle = reidentifyBundle(
        await loadDemoBundle(),
        INVALID_SNAPSHOT,
      );
      mutate(bundle);
      const repository = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });

      await expect(repository.writeSnapshot(bundle)).rejects.toThrow(/inválido/i);
      await expect(
        repository.findSnapshot(INVALID_SNAPSHOT),
      ).resolves.toBeNull();
    } finally {
      await roots.cleanup();
    }
  });
});
