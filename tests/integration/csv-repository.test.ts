import path from "node:path";

import { describe, expect, it } from "vitest";

import { calculatePackageUnits } from "@/domain/inventory";
import { CsvOperationsRepository } from "@/server/repositories/operations";
import { getDashboard } from "@/server/services/dashboard";
import { applyMovementOperation } from "@/server/services/movement-operations";
import { applyOperationalUpdate } from "@/server/services/operational-updates";
import { getTemporalAnalysis } from "@/server/services/temporal";
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

      await expect(repository.listSnapshots()).resolves.toHaveLength(5);
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
        deficit_potencial_unidad_base: 2000,
        cobertura_porcentaje: 60,
      });
      expect(dashboard.indicadores.centros_activos).toBe(6);
      expect(center?.capacidad_almacenamiento).toMatchObject({
        calculable: false,
        ocupacion_porcentaje: null,
        sobrecapacidad: null,
      });
      expect(
        dashboard.visualizaciones.inventario_vs_necesidad,
      ).toContainEqual(
        expect.objectContaining({
          centro_id: "C01",
          producto_id: "P01",
          inventario_confirmado: 12000,
          necesidad_vigente: 20000,
          unidad: "ml",
        }),
      );
      expect(
        dashboard.visualizaciones.recursos_confirmados_vs_esperados,
      ).toContainEqual(
        expect.objectContaining({
          centro_id: "C01",
          producto_id: "P01",
          recursos_confirmados: 12000,
          recursos_esperados: 6000,
          unidad: "ml",
        }),
      );
      expect(
        dashboard.visualizaciones.voluntarios_disponibles_vs_requeridos,
      ).toContainEqual({
        centro_id: "C01",
        centro_nombre: "Centro Norte",
        disponibles: 4,
        requeridos: 7,
        unidad: "persona",
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

  it("M3 publica una versión operativa de inventario y conserva el original", async () => {
    const roots = await createTempDataRoots();
    try {
      const writer = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const result = await applyOperationalUpdate(
        SNAPSHOT_A,
        {
          operation: "upsert_inventory",
          values: {
            centro_id: "C01",
            producto_id: "P01",
            sku_id: "AGUA-600",
            cantidad_paquetes: 20,
          },
        },
        writer,
        new Date("2026-11-15T12:00:00.000Z"),
      );

      const readerAfterRestart = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const [original, operational, operationalBundle] = await Promise.all([
        getDashboard(SNAPSHOT_A, readerAfterRestart),
        getDashboard(result.snapshot.id, readerAfterRestart),
        readerAfterRestart.getSnapshotBundle(result.snapshot.id),
      ]);
      const originalWater = original.centros
        .find((center) => center.centro_id === "C01")
        ?.productos.find((product) => product.producto_id === "P01");
      const operationalWater = operational.centros
        .find((center) => center.centro_id === "C01")
        ?.productos.find((product) => product.producto_id === "P01");

      expect(result.source_snapshot_id).toBe(SNAPSHOT_A);
      expect(result.snapshot.id).not.toBe(SNAPSHOT_A);
      expect(originalWater?.inventario_confirmado_unidad_base).toBe(12_000);
      expect(originalWater?.deficit_confirmado_unidad_base).toBe(8_000);
      expect(operationalWater).toMatchObject({
        inventario_confirmado_unidad_base: 18_000,
        deficit_confirmado_unidad_base: 2_000,
        cobertura_porcentaje: 90,
      });
      expect(
        operational.visualizaciones.inventario_vs_necesidad,
      ).toContainEqual(
        expect.objectContaining({
          centro_id: "C01",
          producto_id: "P01",
          inventario_confirmado: 18_000,
          necesidad_vigente: 20_000,
        }),
      );
      expect(operationalBundle?.metadata).toMatchObject({
        escenario_id: SNAPSHOT_A,
        snapshot_origen_id: SNAPSHOT_A,
        snapshot_base_id: SNAPSHOT_A,
      });
      expect(operationalBundle?.operationalEvents).toHaveLength(1);
      expect(operationalBundle?.operationalEvents[0]).toMatchObject({
        tipo: "ajuste_inventario",
        operacion: "upsert_inventory",
        centro_id: "C01",
        producto_id: "P01",
        sku_id: "AGUA-600",
        ocurrido_en: "2026-11-15T12:00:00.000Z",
        registrado_en: "2026-11-15T12:00:00.000Z",
      });
    } finally {
      await roots.cleanup();
    }
  });

  it("M3 actualiza necesidades y voluntarios en versiones sucesivas", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const needVersion = await applyOperationalUpdate(
        SNAPSHOT_A,
        {
          operation: "upsert_need",
          values: {
            centro_id: "C01",
            producto_id: "P01",
            objetivo_unidad_base: 15_000,
            prioridad: 2,
          },
        },
        repository,
      );
      const volunteerVersion = await applyOperationalUpdate(
        needVersion.snapshot.id,
        {
          operation: "upsert_volunteers",
          values: { centro_id: "C01", disponibles: 2, requeridos: 9 },
        },
        repository,
      );
      const dashboard = await getDashboard(
        volunteerVersion.snapshot.id,
        repository,
      );
      const center = dashboard.centros.find(
        (item) => item.centro_id === "C01",
      );
      expect(
        center?.productos.find((product) => product.producto_id === "P01"),
      ).toMatchObject({
        objetivo_unidad_base: 15_000,
        prioridad: 2,
        deficit_confirmado_unidad_base: 3_000,
        deficit_potencial_unidad_base: 0,
      });
      expect(center?.voluntarios).toEqual({
        disponibles: 2,
        requeridos: 9,
        faltantes: 7,
      });
      expect(
        dashboard.visualizaciones.voluntarios_disponibles_vs_requeridos,
      ).toContainEqual(
        expect.objectContaining({
          centro_id: "C01",
          disponibles: 2,
          requeridos: 9,
        }),
      );
    } finally {
      await roots.cleanup();
    }
  });

  it("M3 crea y actualiza centros sin eliminar relaciones existentes", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const created = await applyOperationalUpdate(
        SNAPSHOT_A,
        {
          operation: "create_center",
          values: {
            centro_id: "C99",
            nombre: "Centro temporal",
            estado: "activo",
            zona: "Pruebas",
            coordinador_nombre: "Coordinación temporal",
          },
        },
        repository,
      );
      const updated = await applyOperationalUpdate(
        created.snapshot.id,
        {
          operation: "update_center",
          values: {
            centro_id: "C99",
            nombre: "Centro temporal actualizado",
            estado: "inactivo",
            zona: null,
            coordinador_nombre: "Coordinación temporal",
          },
        },
        repository,
      );

      await expect(repository.listCenters(SNAPSHOT_A)).resolves.toHaveLength(6);
      await expect(repository.listCenters(created.snapshot.id)).resolves.toContainEqual(
        expect.objectContaining({ centro_id: "C99", estado: "activo" }),
      );
      await expect(repository.listCenters(updated.snapshot.id)).resolves.toContainEqual(
        expect.objectContaining({
          centro_id: "C99",
          nombre: "Centro temporal actualizado",
          estado: "inactivo",
        }),
      );
    } finally {
      await roots.cleanup();
    }
  });

  it("M3 rechaza valores negativos y referencias inexistentes sin publicar", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      await expect(
        applyOperationalUpdate(
          SNAPSHOT_A,
          {
            operation: "upsert_inventory",
            values: {
              centro_id: "C01",
              producto_id: "P01",
              sku_id: "AGUA-600",
              cantidad_paquetes: -1,
            },
          },
          repository,
        ),
      ).rejects.toMatchObject({ code: "INVALID_OPERATION" });
      await expect(
        applyOperationalUpdate(
          SNAPSHOT_A,
          {
            operation: "upsert_inventory",
            values: {
              centro_id: "NO-EXISTE",
              producto_id: "P01",
              sku_id: "AGUA-600",
              cantidad_paquetes: 1,
            },
          },
          repository,
        ),
      ).rejects.toMatchObject({ code: "INVALID_REFERENCE" });

      await expect(repository.listSnapshots()).resolves.toHaveLength(5);
      await expect(repository.listInventory(SNAPSHOT_A)).resolves.toContainEqual({
        snapshot_id: SNAPSHOT_A,
        centro_id: "C01",
        sku_id: "AGUA-600",
        cantidad_paquetes: 10,
      });
    } finally {
      await roots.cleanup();
    }
  });

  it("M4 registra una recepción directa, conserva la zona horaria y persiste tras reiniciar", async () => {
    const roots = await createTempDataRoots();
    try {
      const writer = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const result = await applyMovementOperation(
        SNAPSHOT_A,
        {
          operation: "direct_reception",
          values: {
            operacion_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
            centro_id: "C01",
            producto_id: "P01",
            sku_id: "AGUA-600",
            cantidad_paquetes: 5,
            ocurrido_en: "2026-11-15T10:30:00-05:00",
          },
        },
        writer,
        new Date("2026-11-15T16:00:00.000Z"),
      );
      const readerAfterRestart = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const [inventory, movements, originalInventory, bundle] = await Promise.all([
        readerAfterRestart.listInventory(result.snapshot.id),
        readerAfterRestart.listMovements(result.snapshot.id),
        readerAfterRestart.listInventory(SNAPSHOT_A),
        readerAfterRestart.getSnapshotBundle(result.snapshot.id),
      ]);

      expect(result.idempotent).toBe(false);
      expect(inventory).toContainEqual(
        expect.objectContaining({
          centro_id: "C01",
          sku_id: "AGUA-600",
          cantidad_paquetes: 15,
        }),
      );
      expect(originalInventory).toContainEqual(
        expect.objectContaining({
          centro_id: "C01",
          sku_id: "AGUA-600",
          cantidad_paquetes: 10,
        }),
      );
      expect(movements).toHaveLength(1);
      expect(movements[0]).toMatchObject({
        tipo: "recepcion_confirmada",
        cantidad_paquetes: 5,
        ocurrido_en: "2026-11-15T10:30:00-05:00",
        registrado_en: "2026-11-15T16:00:00.000Z",
        snapshot_origen_id: SNAPSHOT_A,
        intencion_id: null,
      });
      expect(bundle?.metadata).toMatchObject({
        escenario_id: SNAPSHOT_A,
        snapshot_origen_id: SNAPSHOT_A,
        snapshot_base_id: SNAPSHOT_A,
      });
      expect(bundle?.operationalEvents).toEqual([]);
    } finally {
      await roots.cleanup();
    }
  });

  it("M6 reconstruye perspectivas física e informativa sin duplicar M4", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const adjustment = await applyOperationalUpdate(
        SNAPSHOT_A,
        {
          operation: "upsert_inventory",
          values: {
            centro_id: "C01",
            producto_id: "P01",
            sku_id: "AGUA-600",
            cantidad_paquetes: 20,
          },
        },
        repository,
        new Date("2026-11-15T17:00:00.000Z"),
      );
      const reception = await applyMovementOperation(
        adjustment.snapshot.id,
        {
          operation: "direct_reception",
          values: {
            operacion_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7",
            centro_id: "C01",
            producto_id: "P01",
            sku_id: "AGUA-600",
            cantidad_paquetes: 5,
            ocurrido_en: "2026-11-15T12:30:00-05:00",
          },
        },
        repository,
        new Date("2026-11-15T18:00:00.000Z"),
      );
      const query = {
        centro_id: "C01",
        producto_id: "P01",
        corte: "2026-11-15T17:45:00.000Z",
      };
      const [physical, informational] = await Promise.all([
        getTemporalAnalysis(reception.snapshot.id, {
          ...query,
          perspectiva: "fisica",
        }, repository),
        getTemporalAnalysis(reception.snapshot.id, {
          ...query,
          perspectiva: "informativa",
        }, repository),
      ]);
      const packages = (analysis: typeof physical) =>
        analysis.reconstruccion.inventario.find(
          (row) => row.centro_id === "C01" && row.sku_id === "AGUA-600",
        )?.cantidad_paquetes;

      expect(packages(physical)).toBe(25);
      expect(packages(informational)).toBe(20);
      expect(physical.eventos).toHaveLength(2);
      expect(new Set(physical.eventos.map((event) => event.evento_id)).size).toBe(2);
      expect(physical.series.movimientos_por_hora).toContainEqual(
        expect.objectContaining({
          fecha_local: "2026-11-15",
          hora_local: 12,
          recepciones: 1,
          paquetes_recibidos: 5,
        }),
      );
      expect(physical.series.desfase_registro).toContainEqual(
        expect.objectContaining({ desfase_minutos: 30 }),
      );
      expect(informational.eventos.map((event) => event.tipo)).toEqual([
        "ajuste_inventario",
      ]);
      expect(physical.indicadores.alertas.referencia_id).toBe(SNAPSHOT_A);
      expect(physical.indicadores.alertas.evaluado_en).toBe(query.corte);
      expect(physical.completitud.estado).toBe("completa");
      await expect(repository.listInventory(SNAPSHOT_A)).resolves.toContainEqual(
        expect.objectContaining({
          centro_id: "C01",
          sku_id: "AGUA-600",
          cantidad_paquetes: 10,
        }),
      );
    } finally {
      await roots.cleanup();
    }
  });

  it("M6 agrupa correctamente una recepción cercana a medianoche en Bogotá", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const reception = await applyMovementOperation(
        SNAPSHOT_A,
        {
          operation: "direct_reception",
          values: {
            operacion_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8",
            centro_id: "C01",
            producto_id: "P01",
            sku_id: "AGUA-600",
            cantidad_paquetes: 1,
            ocurrido_en: "2026-11-16T00:05:00-05:00",
          },
        },
        repository,
        new Date("2026-11-16T05:10:00.000Z"),
      );
      const analysis = await getTemporalAnalysis(
        reception.snapshot.id,
        {
          centro_id: "C01",
          producto_id: "P01",
          corte: "2026-11-16T05:30:00.000Z",
          perspectiva: "fisica",
        },
        repository,
      );
      expect(analysis.series.movimientos_por_hora).toEqual([
        expect.objectContaining({
          fecha_local: "2026-11-16",
          hora_local: 0,
          recepciones: 1,
        }),
      ]);
    } finally {
      await roots.cleanup();
    }
  });

  it("M4 confirma la donación de referencia una sola vez y conserva el anuncio", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const input = {
        operation: "confirm_donation",
        values: {
          operacion_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
          intencion_id: "D01",
          cantidad_paquetes: 10,
          ocurrido_en: "2026-11-15T11:00:00-05:00",
        },
      } as const;
      const first = await applyMovementOperation(
        SNAPSHOT_A,
        input,
        repository,
        new Date("2026-11-15T16:05:00.000Z"),
      );
      const repeated = await applyMovementOperation(
        SNAPSHOT_A,
        input,
        repository,
        new Date("2026-11-15T17:00:00.000Z"),
      );
      const [original, operational, donations, movements, snapshots] =
        await Promise.all([
          getDashboard(SNAPSHOT_A, repository),
          getDashboard(first.snapshot.id, repository),
          repository.listExpectedDonations(first.snapshot.id),
          repository.listMovements(first.snapshot.id),
          repository.listSnapshots(),
        ]);
      const water = (dashboard: Awaited<ReturnType<typeof getDashboard>>) =>
        dashboard.centros
          .find((center) => center.centro_id === "C01")
          ?.productos.find((product) => product.producto_id === "P01");
      const coverageAlert = (
        dashboard: Awaited<ReturnType<typeof getDashboard>>,
      ) =>
        dashboard.alertas.alertas.find(
          (alert) =>
            alert.tipo === "deficit_cobertura" &&
            alert.centro_id === "C01" &&
            alert.producto_id === "P01",
        );

      expect(first.idempotent).toBe(false);
      expect(repeated.idempotent).toBe(true);
      expect(repeated.snapshot.id).toBe(first.snapshot.id);
      expect(snapshots).toHaveLength(6);
      expect(water(original)).toMatchObject({
        inventario_confirmado_unidad_base: 12_000,
        deficit_confirmado_unidad_base: 8_000,
        donaciones_esperadas_unidad_base: 6_000,
      });
      expect(water(operational)).toMatchObject({
        inventario_confirmado_unidad_base: 18_000,
        deficit_confirmado_unidad_base: 2_000,
        donaciones_esperadas_unidad_base: 0,
      });
      expect(coverageAlert(original)).toMatchObject({
        alerta_id: "alerta:deficit_cobertura:C01:P01",
        titulo: "Déficit importante",
        severidad: "advertencia",
        valor_observado: 60,
        referencia_id: SNAPSHOT_A,
      });
      expect(coverageAlert(operational)).toMatchObject({
        alerta_id: "alerta:deficit_cobertura:C01:P01",
        titulo: "Déficit moderado",
        severidad: "informativa",
        valor_observado: 90,
        referencia_id: first.snapshot.id,
      });
      expect(donations).toContainEqual(
        expect.objectContaining({
          intencion_id: "D01",
          cantidad_paquetes: 10,
          estado: "recibida",
        }),
      );
      expect(movements).toHaveLength(1);
      expect(movements[0]).toMatchObject({
        intencion_id: "D01",
        cantidad_anunciada_paquetes: 10,
        cantidad_paquetes: 10,
      });
    } finally {
      await roots.cleanup();
    }
  });

  it("M4 conserva la diferencia entre cantidad anunciada y recibida", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const result = await applyMovementOperation(
        SNAPSHOT_A,
        {
          operation: "confirm_donation",
          values: {
            operacion_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
            intencion_id: "D01",
            cantidad_paquetes: 8,
            ocurrido_en: "2026-11-15T11:15:00-05:00",
          },
        },
        repository,
      );
      const [movement] = await repository.listMovements(result.snapshot.id);
      expect(movement).toMatchObject({
        cantidad_anunciada_paquetes: 10,
        cantidad_paquetes: 8,
      });
      expect(
        (movement.cantidad_anunciada_paquetes ?? 0) -
          movement.cantidad_paquetes,
      ).toBe(2);
    } finally {
      await roots.cleanup();
    }
  });

  it("M4 rechaza un despacho sin inventario suficiente y no publica", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      await expect(
        applyMovementOperation(
          SNAPSHOT_A,
          {
            operation: "dispatch",
            values: {
              operacion_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
              centro_id: "C01",
              producto_id: "P01",
              sku_id: "AGUA-600",
              cantidad_paquetes: 11,
              ocurrido_en: "2026-11-15T12:00:00-05:00",
            },
          },
          repository,
        ),
      ).rejects.toMatchObject({ code: "INSUFFICIENT_INVENTORY" });
      await expect(repository.listSnapshots()).resolves.toHaveLength(5);
      await expect(repository.listMovements(SNAPSHOT_A)).resolves.toEqual([]);
    } finally {
      await roots.cleanup();
    }
  });

  it("M4 no deja movimiento ni inventario parcial cuando falla la publicación", async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const roots = await createTempDataRoots();
    try {
      await mkdir(roots.runtimeRoot, { recursive: true });
      await writeFile(path.join(roots.runtimeRoot, ".staging"), "bloqueado", "utf8");
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      await expect(
        applyMovementOperation(
          SNAPSHOT_A,
          {
            operation: "direct_reception",
            values: {
              operacion_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
              centro_id: "C01",
              producto_id: "P01",
              sku_id: "AGUA-600",
              cantidad_paquetes: 5,
              ocurrido_en: "2026-11-15T12:30:00-05:00",
            },
          },
          repository,
        ),
      ).rejects.toMatchObject({ code: "PERSISTENCE_ERROR" });
      await expect(repository.listSnapshots()).resolves.toHaveLength(5);
      await expect(repository.listInventory(SNAPSHOT_A)).resolves.toContainEqual(
        expect.objectContaining({
          centro_id: "C01",
          sku_id: "AGUA-600",
          cantidad_paquetes: 10,
        }),
      );
    } finally {
      await roots.cleanup();
    }
  });
});
