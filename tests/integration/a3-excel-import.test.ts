import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  WEEKLY_MAIN_SNAPSHOT_ID,
  WEEKLY_TESTING_BASE_SNAPSHOT_ID,
  WEEKLY_TESTING_SCENARIO_ID,
} from "@/lib/operational-scenarios";
import { CsvOperationsRepository } from "@/server/repositories/operations";
import {
  importExcelReceptions,
  previewExcelReceptions,
} from "@/server/services/excel-reception-imports";
import { getDashboard } from "@/server/services/dashboard";
import { applyMovementOperation } from "@/server/services/movement-operations";
import { resetTestingScenario } from "@/server/services/testing-scenario";
import { copyDemoSnapshot, createTempDataRoots } from "../helpers/csv";

const assetsRoot = path.resolve(process.cwd(), "data", "demo", "a3");

describe("A3 · importación Excel y aislamiento de escenarios", () => {
  it("valida plantilla, lote múltiple e inmutabilidad de MAIN", async () => {
    const roots = await createTempDataRoots();
    try {
      await copyDemoSnapshot(WEEKLY_MAIN_SNAPSHOT_ID, roots.demoRoot);
      await copyDemoSnapshot(WEEKLY_TESTING_BASE_SNAPSHOT_ID, roots.demoRoot);
      const repository = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });
      const emptyTemplate = await readFile(path.join(assetsRoot, "PLANTILLA_RECEPCIONES.xlsx"));
      const invalid = await previewExcelReceptions(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
        emptyTemplate,
        "PLANTILLA_RECEPCIONES.xlsx",
        repository,
      );
      expect(invalid.valido).toBe(false);
      expect(invalid.errores).toEqual(
        expect.arrayContaining([expect.objectContaining({ codigo: "EMPTY_WORKBOOK" })]),
      );

      const multi = await readFile(path.join(assetsRoot, "RECEPCION_04.xlsx"));
      const preview = await previewExcelReceptions(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
        multi,
        "RECEPCION_04.xlsx",
        repository,
      );
      expect(preview).toMatchObject({ valido: true, total_filas: 3, total_paquetes: 35 });
      expect(new Set(preview.filas.map((row) => row.producto_id)).size).toBe(3);

      await expect(
        importExcelReceptions(
          WEEKLY_MAIN_SNAPSHOT_ID,
          multi,
          "RECEPCION_04.xlsx",
          repository,
        ),
      ).rejects.toMatchObject({ code: "TESTING_SCENARIO_REQUIRED" });
      await expect(
        applyMovementOperation(
          WEEKLY_MAIN_SNAPSHOT_ID,
          {
            operation: "direct_reception",
            values: {
              operacion_id: "a3ff0000-0001-4000-8000-000000000001",
              centro_id: "C01",
              producto_id: "P22",
              sku_id: "PICO-UN",
              cantidad_paquetes: 1,
              ocurrido_en: "2026-11-16T08:00:00-05:00",
            },
          },
          repository,
          new Date("2026-11-16T08:00:00-05:00"),
        ),
      ).rejects.toMatchObject({ code: "SCENARIO_READ_ONLY" });
    } finally {
      await roots.cleanup();
    }
  });

  it("reproduce diez importaciones, idempotencia, alertas y reinicio aislado", async () => {
    const roots = await createTempDataRoots();
    try {
      await copyDemoSnapshot(WEEKLY_MAIN_SNAPSHOT_ID, roots.demoRoot);
      await copyDemoSnapshot(WEEKLY_TESTING_BASE_SNAPSHOT_ID, roots.demoRoot);
      const repository = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });
      const mainBefore = await repository.getSnapshotBundle(WEEKLY_MAIN_SNAPSHOT_ID);
      const testingBase = await repository.getSnapshotBundle(WEEKLY_TESTING_BASE_SNAPSHOT_ID);
      expect(testingBase?.metadata).toMatchObject({
        escenario_id: WEEKLY_TESTING_SCENARIO_ID,
        snapshot_origen_id: WEEKLY_MAIN_SNAPSHOT_ID,
        snapshot_base_id: WEEKLY_TESTING_BASE_SNAPSHOT_ID,
      });
      expect(testingBase?.inventory).toEqual(
        mainBefore?.inventory.map((row) => ({ ...row, snapshot_id: WEEKLY_TESTING_BASE_SNAPSHOT_ID })),
      );
      expect(testingBase?.movements).toHaveLength(0);
      expect(testingBase?.operationalEvents).toHaveLength(0);

      let currentSnapshotId = WEEKLY_TESTING_BASE_SNAPSHOT_ID;
      const results: Array<Record<string, unknown>> = [];
      let totalResolved = 0;
      let totalReduced = 0;
      for (let index = 1; index <= 10; index += 1) {
        const file = `RECEPCION_${String(index).padStart(2, "0")}.xlsx`;
        const bytes = await readFile(path.join(assetsRoot, file));
        const preview = await previewExcelReceptions(
          currentSnapshotId,
          bytes,
          file,
          repository,
        );
        expect(preview.valido, JSON.stringify(preview.errores)).toBe(true);
        const result = await importExcelReceptions(
          currentSnapshotId,
          bytes,
          file,
          repository,
        );
        expect(result.idempotent).toBe(false);
        expect(result.filas_importadas).toBe(preview.total_filas);
        expect(result.efectos.every((effect) => effect.inventario_nuevo > effect.inventario_anterior)).toBe(true);

        const imported = await repository.getSnapshotBundle(result.snapshot.id);
        expect(imported?.metadata.snapshot_origen_id).toBe(currentSnapshotId);
        expect(imported?.metadata.escenario_id).toBe(WEEKLY_TESTING_SCENARIO_ID);
        expect(imported?.movements.filter((movement) =>
          preview.filas.some((row) => row.operacion_id === movement.operacion_id),
        )).toHaveLength(preview.total_filas);

        const repeated = await importExcelReceptions(
          result.snapshot.id,
          bytes,
          file,
          repository,
        );
        expect(repeated.idempotent).toBe(true);
        expect(repeated.snapshot.id).toBe(result.snapshot.id);
        expect(repeated.filas_importadas).toBe(0);

        totalResolved += result.alertas_resueltas.length;
        totalReduced += result.alertas_reducidas.length;
        results.push({
          Excel: file,
          Centro: [...new Set(preview.filas.map((row) => row.centro_id))].join(", "),
          Productos: [...new Set(preview.filas.map((row) => row.producto_nombre))].join(", "),
          "Alertas antes": result.alertas_antes,
          "Alertas después": result.alertas_despues,
          Resueltas: result.alertas_resueltas.length,
          "Reducción de severidad": result.alertas_reducidas.length,
        });
        currentSnapshotId = result.snapshot.id;
      }

      expect(totalResolved).toBeGreaterThan(0);
      expect(totalReduced).toBeGreaterThan(0);
      expect(results.find((row) => row.Excel === "RECEPCION_04.xlsx")?.Productos).toContain(",");
      expect(results.find((row) => row.Excel === "RECEPCION_10.xlsx")?.Centro).toBe("C03, C04, C02");
      expect(await repository.getSnapshotBundle(WEEKLY_MAIN_SNAPSHOT_ID)).toEqual(mainBefore);

      const reset = await resetTestingScenario(
        { operacion_id: "a3990000-0001-4000-8000-000000000001" },
        repository,
      );
      const resetBundle = await repository.getSnapshotBundle(reset.snapshot.id);
      expect(reset.idempotent).toBe(false);
      expect(resetBundle?.metadata).toMatchObject({
        escenario_id: WEEKLY_TESTING_SCENARIO_ID,
        snapshot_origen_id: WEEKLY_MAIN_SNAPSHOT_ID,
        snapshot_base_id: reset.snapshot.id,
      });
      expect(resetBundle?.movements).toHaveLength(0);
      expect(resetBundle?.operationalEvents).toHaveLength(0);
      expect(resetBundle?.inventory).toEqual(
        mainBefore?.inventory.map((row) => ({ ...row, snapshot_id: reset.snapshot.id })),
      );
      const [mainDashboard, resetDashboard] = await Promise.all([
        getDashboard(
          WEEKLY_MAIN_SNAPSHOT_ID,
          repository,
          reset.snapshot.created_at,
        ),
        getDashboard(reset.snapshot.id, repository, reset.snapshot.created_at),
      ]);
      const productBalances = (
        dashboard: Awaited<ReturnType<typeof getDashboard>>,
      ) =>
        dashboard.centros.flatMap((center) =>
          center.productos.map((product) => ({
            centro_id: center.centro_id,
            producto_id: product.producto_id,
            inventario: product.inventario_confirmado_unidad_base,
            necesidad: product.objetivo_unidad_base,
            deficit: product.deficit_confirmado_unidad_base,
            cobertura: product.cobertura_porcentaje,
          })),
        );
      const alertState = (
        dashboard: Awaited<ReturnType<typeof getDashboard>>,
      ) =>
        dashboard.alertas.alertas.map((alert) => ({
          alerta_id: alert.alerta_id,
          tipo: alert.tipo,
          severidad: alert.severidad,
          centro_id: alert.centro_id,
          producto_id: alert.producto_id,
          valor_observado: alert.valor_observado,
        }));
      expect(productBalances(resetDashboard)).toEqual(
        productBalances(mainDashboard),
      );
      expect(alertState(resetDashboard)).toEqual(alertState(mainDashboard));
      expect(resetDashboard.alertas.informacion_temporal_desconocida).toEqual(
        mainDashboard.alertas.informacion_temporal_desconocida,
      );
      expect(resetDashboard.movimientos).toHaveLength(0);
      expect(await resetTestingScenario(
        { operacion_id: "a3990000-0001-4000-8000-000000000001" },
        repository,
      )).toMatchObject({ idempotent: true, snapshot: { id: reset.snapshot.id } });
      expect(await repository.getSnapshotBundle(WEEKLY_MAIN_SNAPSHOT_ID)).toEqual(mainBefore);

      if (process.env.A3_WRITE_RESULTS === "1") {
        await writeFile(
          path.join(assetsRoot, "resultados-prueba.json"),
          `${JSON.stringify({ generated_at_scenario: "2026-11-16T17:02:00-05:00", results }, null, 2)}\n`,
          "utf8",
        );
      }
      console.table(results);
    } finally {
      await roots.cleanup();
    }
  }, 15_000);
});
