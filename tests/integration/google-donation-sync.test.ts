import { describe, expect, it } from "vitest";

import {
  WEEKLY_MAIN_SNAPSHOT_ID,
  WEEKLY_TESTING_BASE_SNAPSHOT_ID,
} from "@/lib/operational-scenarios";
import { CsvOperationsRepository } from "@/server/repositories/operations";
import { syncGoogleDonations } from "@/server/services/google-donation-sync";
import { getQrDonationModule } from "@/server/services/qr-donations";
import { createTempDataRoots, PROJECT_DEMO_ROOT } from "../helpers/csv";

const responseRows = [
  [
    "ID de respuesta",
    "Marca temporal",
    "Centro de acopio",
    "Producto y presentación",
    "Cantidad anunciada en paquetes",
    "Fecha estimada de entrega",
    "Nombre o entidad donante (opcional)",
    "Observaciones (opcional)",
  ],
  [
    "response-sync-001",
    "18/11/2026 09:30:15",
    "C01 — Centro Norte",
    "AGUA-600 — Botella de 600 ml",
    "20",
    "20/11/2026",
    "Donante de integración",
    "",
  ],
  [
    "response-sync-invalid",
    "18/11/2026 09:35:00",
    "C01 — Centro Norte",
    "SKU-INEXISTENTE — Presentación inexistente",
    "2",
    "20/11/2026",
    "",
    "",
  ],
];

const multiProductRows = [
  [
    "ID de respuesta",
    "ID de donación",
    "ID del artículo",
    "Marca temporal",
    "Centro de acopio",
    "Producto y presentación",
    "Cantidad anunciada en paquetes",
    "Fecha estimada de entrega",
    "Nombre o entidad donante (opcional)",
    "Observaciones (opcional)",
  ],
  ["response-multi-001", "response-multi-001", "response-multi-001:item:1", "18/11/2026 11:00:00", "C01 — Centro Norte", "AGUA-600 — Botella de 600 ml", "20", "20/11/2026", "Donante múltiple", "Entrega conjunta"],
  ["response-multi-001", "response-multi-001", "response-multi-001:item:2", "18/11/2026 11:00:00", "C01 — Centro Norte", "ARROZ-1000 — Bolsa de 1 kg", "15", "20/11/2026", "Donante múltiple", "Entrega conjunta"],
  ["response-multi-001", "response-multi-001", "response-multi-001:item:3", "18/11/2026 11:00:00", "C01 — Centro Norte", "FILTRO-PORT — Filtro portátil", "10", "20/11/2026", "Donante múltiple", "Entrega conjunta"],
];

describe("sincronización idempotente de Google Sheets", () => {
  it("publica respuestas válidas en PRUEBAS, conserva inventario y omite duplicados", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const before = await repository.getSnapshotBundle(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
      );
      const inventoryBefore = before?.inventory.map(
        ({ centro_id, sku_id, cantidad_paquetes }) => ({
          centro_id,
          sku_id,
          cantidad_paquetes,
        }),
      );

      const first = await syncGoogleDonations(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
        repository,
        async () => responseRows,
        new Date("2026-11-18T15:00:00.000Z"),
      );

      expect(first).toMatchObject({
        source_snapshot_id: WEEKLY_TESTING_BASE_SNAPSHOT_ID,
        filas_consultadas: 2,
        anuncios_importados: 1,
        respuestas_duplicadas: 0,
      });
      expect(first.filas_invalidas).toEqual([
        {
          fila: 3,
          mensaje: "La presentación no existe en el catálogo del escenario.",
        },
      ]);
      const firstBundle = await repository.getSnapshotBundle(first.snapshot.id);
      expect(
        firstBundle?.inventory.map(
          ({ centro_id, sku_id, cantidad_paquetes }) => ({
            centro_id,
            sku_id,
            cantidad_paquetes,
          }),
        ),
      ).toEqual(inventoryBefore);
      expect(firstBundle?.qrDonations).toHaveLength(1);
      expect(firstBundle?.qrDonations[0]).toMatchObject({
        respuesta_origen_id: "forms:response-sync-001",
        centro_id: "C01",
        producto_id: "P01",
        sku_id: "AGUA-600",
        cantidad_anunciada_paquetes: 20,
        cantidad_recibida_paquetes: 0,
        fuente: "google_forms",
      });

      const second = await syncGoogleDonations(
        first.snapshot.id,
        repository,
        async () => responseRows,
        new Date("2026-11-18T15:01:00.000Z"),
      );
      expect(second).toMatchObject({
        snapshot: { id: first.snapshot.id },
        anuncios_importados: 0,
        respuestas_duplicadas: 1,
      });
      expect(second.filas_invalidas).toHaveLength(1);
    } finally {
      await roots.cleanup();
    }
  }, 20_000);

  it("rechaza MAIN antes de consultar el proveedor externo", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      let providerWasCalled = false;
      await expect(
        syncGoogleDonations(
          WEEKLY_MAIN_SNAPSHOT_ID,
          repository,
          async () => {
            providerWasCalled = true;
            return responseRows;
          },
        ),
      ).rejects.toMatchObject({ code: "SCENARIO_READ_ONLY" });
      expect(providerWasCalled).toBe(false);
    } finally {
      await roots.cleanup();
    }
  });

  it("publica tres artículos como una sola donación atómica e idempotente", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const before = await repository.getSnapshotBundle(WEEKLY_TESTING_BASE_SNAPSHOT_ID);
      const first = await syncGoogleDonations(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
        repository,
        async () => multiProductRows,
        new Date("2026-11-18T16:00:00.000Z"),
      );

      expect(first).toMatchObject({
        donaciones_importadas: 1,
        articulos_importados: 3,
        donaciones_duplicadas: 0,
        articulos_duplicados: 0,
      });
      const published = await repository.getSnapshotBundle(first.snapshot.id);
      expect(published?.qrDonations).toHaveLength(3);
      expect(published?.inventory).toEqual(
        before?.inventory.map((row) => ({ ...row, snapshot_id: first.snapshot.id })),
      );
      const moduleData = await getQrDonationModule(first.snapshot.id, repository);
      expect(moduleData.donaciones).toHaveLength(1);
      expect(moduleData.donaciones[0]).toMatchObject({
        estado_general: "anunciado",
        articulos: expect.arrayContaining([
          expect.objectContaining({ sku_id: "AGUA-600", cantidad_anunciada_paquetes: 20 }),
          expect.objectContaining({ sku_id: "ARROZ-1000", cantidad_anunciada_paquetes: 15 }),
          expect.objectContaining({ sku_id: "FILTRO-PORT", cantidad_anunciada_paquetes: 10 }),
        ]),
      });

      const second = await syncGoogleDonations(
        first.snapshot.id,
        repository,
        async () => multiProductRows,
      );
      expect(second).toMatchObject({
        snapshot: { id: first.snapshot.id },
        donaciones_importadas: 0,
        articulos_importados: 0,
        donaciones_duplicadas: 1,
        articulos_duplicados: 3,
      });
    } finally {
      await roots.cleanup();
    }
  }, 20_000);
});
