import path from "node:path";

import { describe, expect, it } from "vitest";

import { calculatePackageUnits } from "@/domain/inventory";
import { CsvOperationsRepository } from "@/server/repositories/operations";
import { getDashboard } from "@/server/services/dashboard";
import {
  createTempDataRoots,
  loadDemoBundle,
  PROJECT_DEMO_ROOT,
  reidentifyBundle,
  SNAPSHOT_A,
  SNAPSHOT_B,
} from "../helpers/csv";

const WRITTEN_SNAPSHOT = "40000000-0000-4000-8000-000000000001";

describe("repositorio CSV", () => {
  it("T04 mantiene C01 aislado entre dos snapshots reales", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });

      async function waterUnits(snapshotId: string) {
        const [inventory, presentations] = await Promise.all([
          repository.listInventory(snapshotId),
          repository.listPresentations(snapshotId),
        ]);
        return calculatePackageUnits(
          inventory
            .filter((row) => row.centro_id === "C01")
            .map((row) => ({
              row,
              presentation: presentations.find(
                (item) => item.sku_id === row.sku_id,
              ),
            }))
            .filter((item) => item.presentation?.producto_id === "P01")
            .map(({ row, presentation }) => ({
              cantidad_paquetes: row.cantidad_paquetes,
              contenido_por_paquete: presentation?.contenido_por_paquete ?? 0,
            })),
        );
      }

      expect(await waterUnits(SNAPSHOT_A)).toBe(12000);
      expect(await waterUnits(SNAPSHOT_B)).toBe(2700);
      expect((await repository.listCenters(SNAPSHOT_A))[0].nombre).toBe(
        "Centro Norte",
      );
      expect((await repository.listCenters(SNAPSHOT_B))[0].nombre).toBe(
        "Centro Norte - Jornada B",
      );
    } finally {
      await roots.cleanup();
    }
  });

  it("T04 rechaza una referencia SKU cruzada entre snapshots", async () => {
    const roots = await createTempDataRoots();
    try {
      const source = reidentifyBundle(
        await loadDemoBundle(),
        WRITTEN_SNAPSHOT,
      );
      source.inventory.push({
        snapshot_id: WRITTEN_SNAPSHOT,
        centro_id: "C01",
        sku_id: "AGUA-330",
        cantidad_paquetes: 1,
      });
      const repository = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });

      await expect(repository.writeSnapshot(source)).rejects.toThrow(
        /SKU AGUA-330|inválido/i,
      );
      await expect(repository.findSnapshot(WRITTEN_SNAPSHOT)).resolves.toBeNull();
    } finally {
      await roots.cleanup();
    }
  });

  it("T06 lee seis centros, cinco productos y siete presentaciones desde CSV", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });

      await expect(repository.listSnapshots()).resolves.toHaveLength(2);
      const [centers, products, presentations] = await Promise.all([
        repository.listCenters(SNAPSHOT_A),
        repository.listProducts(SNAPSHOT_A),
        repository.listPresentations(SNAPSHOT_A),
      ]);
      expect(centers.map((row) => row.centro_id)).toEqual([
        "C01",
        "C02",
        "C03",
        "C04",
        "C05",
        "C06",
      ]);
      expect(products.map((row) => row.producto_id)).toEqual([
        "P01",
        "P02",
        "P03",
        "P04",
        "P05",
      ]);
      expect(presentations.map((row) => row.sku_id)).toEqual([
        "AGUA-1500",
        "AGUA-600",
        "ARROZ-1000",
        "ARROZ-5000",
        "ASEO-1",
        "COBIJA-1",
        "ENLATADO-1",
      ]);
    } finally {
      await roots.cleanup();
    }
  });

  it("conserva los cálculos del dashboard sobre el origen CSV", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const dashboard = await getDashboard(SNAPSHOT_A, repository);
      const center = dashboard.centros.find((item) => item.centro_id === "C01");
      const water = center?.productos.find(
        (product) => product.producto_id === "P01",
      );

      expect(dashboard.centros.map((item) => item.centro_id)).toEqual([
        "C01",
        "C02",
        "C03",
        "C04",
        "C05",
        "C06",
      ]);
      expect(center?.productos.map((item) => item.producto_id)).toEqual([
        "P01",
        "P02",
        "P03",
        "P04",
        "P05",
      ]);
      expect(water).toMatchObject({
        inventario_confirmado_unidad_base: 12000,
        donaciones_esperadas_unidad_base: 6000,
        deficit_confirmado_unidad_base: 8000,
      });
      expect(dashboard.candidatos_traslado).toContainEqual(
        expect.objectContaining({
          origen_id: "C02",
          destino_id: "C01",
          minutos: 15,
        }),
      );
    } finally {
      await roots.cleanup();
    }
  });

  it("T07 publica un snapshot y otra instancia puede releerlo", async () => {
    const roots = await createTempDataRoots();
    try {
      const bundle = reidentifyBundle(
        await loadDemoBundle(),
        WRITTEN_SNAPSHOT,
      );
      const writer = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });
      await writer.writeSnapshot(bundle);

      const readerAfterRestart = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });
      await expect(
        readerAfterRestart.findSnapshot(WRITTEN_SNAPSHOT),
      ).resolves.toMatchObject({ id: WRITTEN_SNAPSHOT });
      await expect(
        readerAfterRestart.listCenters(WRITTEN_SNAPSHOT),
      ).resolves.toHaveLength(6);
      await expect(
        readerAfterRestart.listInventory(WRITTEN_SNAPSHOT),
      ).resolves.toHaveLength(11);
    } finally {
      await roots.cleanup();
    }
  });

  it("T08 rechaza un CSV corrupto sin impedir leer otro snapshot válido", async () => {
    const { writeFile } = await import("node:fs/promises");
    const roots = await createTempDataRoots();
    try {
      const { copyDemoSnapshot } = await import("../helpers/csv");
      await copyDemoSnapshot(SNAPSHOT_A, roots.demoRoot);
      await copyDemoSnapshot(SNAPSHOT_B, roots.demoRoot);
      await writeFile(
        path.join(roots.demoRoot, SNAPSHOT_A, "productos.csv"),
        'snapshot_id,producto_id,nombre,unidad_base\n"fila,sin,cierre',
        "utf8",
      );

      const repository = new CsvOperationsRepository({
        demoRoot: roots.demoRoot,
        runtimeRoot: roots.runtimeRoot,
      });
      await expect(repository.listProducts(SNAPSHOT_A)).rejects.toThrow(
        /datos inválidos/i,
      );
      await writeFile(
        path.join(roots.demoRoot, SNAPSHOT_A, "productos.csv"),
        "",
        "utf8",
      );
      await expect(repository.listProducts(SNAPSHOT_A)).rejects.toThrow(
        /datos inválidos/i,
      );
      await expect(repository.listCenters(SNAPSHOT_B)).resolves.toHaveLength(2);
    } finally {
      await roots.cleanup();
    }
  });
});
