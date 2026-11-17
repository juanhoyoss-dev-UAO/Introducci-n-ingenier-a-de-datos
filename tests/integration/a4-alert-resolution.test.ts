import { describe, expect, it } from "vitest";

import {
  WEEKLY_MAIN_SNAPSHOT_ID,
  WEEKLY_TESTING_BASE_SNAPSHOT_ID,
} from "@/lib/operational-scenarios";
import { CsvOperationsRepository } from "@/server/repositories/operations";
import { getDashboard } from "@/server/services/dashboard";
import { applyMovementOperation } from "@/server/services/movement-operations";
import { createTempDataRoots, PROJECT_DEMO_ROOT } from "../helpers/csv";

function extension(dashboard: Awaited<ReturnType<typeof getDashboard>>) {
  return dashboard.centros
    .find((center) => center.centro_id === "C01")
    ?.productos.find((product) => product.producto_id === "P27");
}

function extensionDeficitAlert(
  dashboard: Awaited<ReturnType<typeof getDashboard>>,
) {
  return dashboard.alertas.alertas.find(
    (alert) =>
      alert.tipo === "deficit_cobertura" &&
      alert.centro_id === "C01" &&
      alert.producto_id === "P27",
  );
}

describe("A4.2 · recepción persistente desde una alerta", () => {
  it("reduce parcialmente el déficit, lo resuelve y no duplica un reintento", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const partialInput = {
        operation: "direct_reception",
        values: {
          operacion_id: "a4200000-0000-4000-8000-000000000001",
          centro_id: "C01",
          producto_id: "P27",
          sku_id: "EXTENSION-ROLLO20",
          cantidad_paquetes: 3,
          ocurrido_en: "2026-11-16T17:02:00-05:00",
        },
      } as const;
      const initial = await getDashboard(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
        repository,
      );
      const partialResult = await applyMovementOperation(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
        partialInput,
        repository,
        new Date("2026-11-16T22:02:00.000Z"),
      );
      const partial = await getDashboard(partialResult.snapshot.id, repository);
      const completeInput = {
        operation: "direct_reception",
        values: {
          operacion_id: "a4200000-0000-4000-8000-000000000002",
          centro_id: "C01",
          producto_id: "P27",
          sku_id: "EXTENSION-ROLLO20",
          cantidad_paquetes: 9,
          ocurrido_en: "2026-11-16T17:04:00-05:00",
        },
      } as const;
      const completeResult = await applyMovementOperation(
        partialResult.snapshot.id,
        completeInput,
        repository,
        new Date("2026-11-16T22:04:00.000Z"),
      );
      const repeated = await applyMovementOperation(
        partialResult.snapshot.id,
        completeInput,
        repository,
        new Date("2026-11-16T22:05:00.000Z"),
      );
      const complete = await getDashboard(completeResult.snapshot.id, repository);
      const movements = await repository.listMovements(completeResult.snapshot.id);

      expect(extension(initial)).toMatchObject({
        inventario_confirmado_unidad_base: 0,
        objetivo_unidad_base: 12,
        deficit_confirmado_unidad_base: 12,
        cobertura_porcentaje: 0,
      });
      expect(extension(partial)).toMatchObject({
        inventario_confirmado_unidad_base: 3,
        deficit_confirmado_unidad_base: 9,
        cobertura_porcentaje: 25,
      });
      expect(extensionDeficitAlert(partial)).toMatchObject({
        severidad: "critica",
        valor_observado: 25,
      });
      expect(extension(complete)).toMatchObject({
        inventario_confirmado_unidad_base: 12,
        deficit_confirmado_unidad_base: 0,
        cobertura_porcentaje: 100,
      });
      expect(extensionDeficitAlert(complete)).toBeUndefined();
      expect(repeated).toMatchObject({
        idempotent: true,
        snapshot: { id: completeResult.snapshot.id },
      });
      expect(movements).toHaveLength(2);
      expect(extension(initial)?.inventario_confirmado_unidad_base).toBe(0);
    } finally {
      await roots.cleanup();
    }
  }, 15_000);

  it("mantiene MAIN protegido contra la recepción individual", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      await expect(
        applyMovementOperation(
          WEEKLY_MAIN_SNAPSHOT_ID,
          {
            operation: "direct_reception",
            values: {
              operacion_id: "a4200000-0000-4000-8000-000000000003",
              centro_id: "C01",
              producto_id: "P27",
              sku_id: "EXTENSION-ROLLO20",
              cantidad_paquetes: 1,
              ocurrido_en: "2026-11-16T17:06:00-05:00",
            },
          },
          repository,
        ),
      ).rejects.toMatchObject({ code: "SCENARIO_READ_ONLY" });
    } finally {
      await roots.cleanup();
    }
  });
});
