import { describe, expect, it } from "vitest";

import {
  WEEKLY_MAIN_SNAPSHOT_ID,
  WEEKLY_TESTING_BASE_SNAPSHOT_ID,
} from "@/lib/operational-scenarios";
import { CsvOperationsRepository } from "@/server/repositories/operations";
import { applyMovementOperation } from "@/server/services/movement-operations";
import {
  applyQrDonationOperation,
  getQrDonationModule,
} from "@/server/services/qr-donations";
import { getDashboard } from "@/server/services/dashboard";
import { resetTestingScenario } from "@/server/services/testing-scenario";
import { createTempDataRoots, PROJECT_DEMO_ROOT } from "../helpers/csv";

function water600Inventory(bundle: NonNullable<Awaited<ReturnType<CsvOperationsRepository["getSnapshotBundle"]>>>) {
  return bundle.inventory.find(
    (row) => row.centro_id === "C01" && row.sku_id === "AGUA-600",
  )?.cantidad_paquetes ?? 0;
}

function inventoryPackages(
  bundle: NonNullable<Awaited<ReturnType<CsvOperationsRepository["getSnapshotBundle"]>>>,
  centerId: string,
  skuId: string,
) {
  return bundle.inventory.find(
    (row) => row.centro_id === centerId && row.sku_id === skuId,
  )?.cantidad_paquetes ?? 0;
}

function waterInventoryBaseUnits(
  bundle: NonNullable<Awaited<ReturnType<CsvOperationsRepository["getSnapshotBundle"]>>>,
) {
  const waterSkus = new Map(
    bundle.presentations
      .filter((row) => row.producto_id === "P01")
      .map((row) => [row.sku_id, row.contenido_por_paquete]),
  );
  return bundle.inventory
    .filter((row) => row.centro_id === "C01" && waterSkus.has(row.sku_id))
    .reduce(
      (total, row) => total + row.cantidad_paquetes * waterSkus.get(row.sku_id)!,
      0,
    );
}

const announcementInput = {
  operation: "create_announcement",
  values: {
    operacion_id: "f2000000-0000-4000-8000-000000000001",
    respuesta_origen_id: "local-test-response-001",
    centro_id: "C01",
    producto_id: "P01",
    sku_id: "AGUA-600",
    cantidad_anunciada_paquetes: 20,
    llegada_estimada: "2026-11-20T10:00:00-05:00",
    registrado_en: "2026-11-18T09:00:00-05:00",
    donante_referencia: "Donante de prueba",
    observaciones: null,
    fuente: "local_prueba",
  },
} as const;

describe("Fase 2 · donaciones esperadas locales", () => {
  it("agrupa tres artículos y confirma recepciones independientes", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const initial = await repository.getSnapshotBundle(WEEKLY_TESTING_BASE_SNAPSHOT_ID);
      expect(initial).not.toBeNull();
      const waterBefore = inventoryPackages(initial!, "C01", "AGUA-600");
      const riceBefore = inventoryPackages(initial!, "C01", "ARROZ-1000");
      const filterBefore = inventoryPackages(initial!, "C01", "FILTRO-PORT");

      const created = await applyQrDonationOperation(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
        {
          operation: "create_donation",
          values: {
            operacion_id: "f2000000-0000-4000-8000-000000000140",
            respuesta_origen_id: "forms:multi-reception-001",
            centro_id: "C01",
            llegada_estimada: "2026-11-20T10:00:00-05:00",
            registrado_en: "2026-11-18T09:00:00-05:00",
            donante_referencia: "Donante múltiple",
            observaciones: "Entrega parcial por artículo",
            fuente: "google_forms",
            articulos: [
              { item_origen_id: "item:1", producto_id: "P01", sku_id: "AGUA-600", cantidad_anunciada_paquetes: 20 },
              { item_origen_id: "item:2", producto_id: "P05", sku_id: "ARROZ-1000", cantidad_anunciada_paquetes: 15 },
              { item_origen_id: "item:3", producto_id: "P03", sku_id: "FILTRO-PORT", cantidad_anunciada_paquetes: 10 },
            ],
          },
        },
        repository,
      );
      expect(created.anuncios).toHaveLength(3);
      expect(created.estado_general).toBe("anunciado");
      const water = created.anuncios.find((row) => row.sku_id === "AGUA-600")!;
      const rice = created.anuncios.find((row) => row.sku_id === "ARROZ-1000")!;

      const waterReceived = await applyMovementOperation(
        created.snapshot.id,
        {
          operation: "confirm_qr_donation",
          values: {
            operacion_id: "f2000000-0000-4000-8000-000000000141",
            anuncio_id: water.anuncio_id,
            cantidad_paquetes: 20,
            ocurrido_en: "2026-11-20T10:15:00-05:00",
          },
        },
        repository,
      );
      const riceReceived = await applyMovementOperation(
        waterReceived.snapshot.id,
        {
          operation: "confirm_qr_donation",
          values: {
            operacion_id: "f2000000-0000-4000-8000-000000000142",
            anuncio_id: rice.anuncio_id,
            cantidad_paquetes: 5,
            ocurrido_en: "2026-11-20T10:20:00-05:00",
          },
        },
        repository,
      );
      const final = await repository.getSnapshotBundle(riceReceived.snapshot.id);
      expect(inventoryPackages(final!, "C01", "AGUA-600")).toBe(waterBefore + 20);
      expect(inventoryPackages(final!, "C01", "ARROZ-1000")).toBe(riceBefore + 5);
      expect(inventoryPackages(final!, "C01", "FILTRO-PORT")).toBe(filterBefore);

      const moduleData = await getQrDonationModule(riceReceived.snapshot.id, repository);
      expect(moduleData.donaciones).toHaveLength(1);
      expect(moduleData.donaciones[0].estado_general).toBe("parcialmente_recibido");
      expect(moduleData.donaciones[0].articulos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sku_id: "AGUA-600", estado: "recibido_completo", cantidad_pendiente_paquetes: 0 }),
          expect.objectContaining({ sku_id: "ARROZ-1000", estado: "parcialmente_recibido", cantidad_pendiente_paquetes: 10 }),
          expect.objectContaining({ sku_id: "FILTRO-PORT", estado: "anunciado", cantidad_pendiente_paquetes: 10 }),
        ]),
      );
    } finally {
      await roots.cleanup();
    }
  }, 20_000);

  it("mantiene el anuncio fuera del inventario y confirma recepciones parciales y completas", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const initial = await repository.getSnapshotBundle(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
      );
      expect(initial).not.toBeNull();
      const initialInventory = water600Inventory(initial!);
      const initialWaterBaseUnits = waterInventoryBaseUnits(initial!);
      const initialEvents = initial!.operationalEvents.length;

      const created = await applyQrDonationOperation(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
        announcementInput,
        repository,
        new Date("2026-11-18T14:00:00.000Z"),
      );
      const afterAnnouncement = await repository.getSnapshotBundle(
        created.snapshot.id,
      );
      expect(afterAnnouncement?.qrDonations).toHaveLength(1);
      expect(water600Inventory(afterAnnouncement!)).toBe(initialInventory);
      expect(afterAnnouncement?.operationalEvents).toHaveLength(initialEvents);
      expect(created.anuncio).toMatchObject({
        estado: "anunciado",
        cantidad_recibida_paquetes: 0,
        cantidad_pendiente_paquetes: 20,
      });

      const retriedCreate = await applyQrDonationOperation(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
        announcementInput,
        repository,
      );
      expect(retriedCreate).toMatchObject({
        idempotent: true,
        snapshot: { id: created.snapshot.id },
      });
      await expect(
        applyQrDonationOperation(
          WEEKLY_TESTING_BASE_SNAPSHOT_ID,
          {
            ...announcementInput,
            values: {
              ...announcementInput.values,
              cantidad_anunciada_paquetes: 21,
            },
          },
          repository,
        ),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });

      const partialInput = {
        operation: "confirm_qr_donation",
        values: {
          operacion_id: "f2000000-0000-4000-8000-000000000002",
          anuncio_id: created.anuncio.anuncio_id,
          cantidad_paquetes: 8,
          ocurrido_en: "2026-11-20T10:15:00-05:00",
        },
      } as const;
      const partial = await applyMovementOperation(
        created.snapshot.id,
        partialInput,
        repository,
        new Date("2026-11-20T15:15:00.000Z"),
      );
      const afterPartial = await repository.getSnapshotBundle(partial.snapshot.id);
      expect(afterPartial?.qrDonations[0]).toMatchObject({
        estado: "parcialmente_recibido",
        cantidad_recibida_paquetes: 8,
        cantidad_pendiente_paquetes: 12,
      });
      expect(water600Inventory(afterPartial!)).toBe(initialInventory + 8);
      expect(afterPartial?.operationalEvents).toHaveLength(initialEvents);
      expect(partial.movement).toMatchObject({
        intencion_id: created.anuncio.anuncio_id,
        cantidad_anunciada_paquetes: 20,
        cantidad_paquetes: 8,
      });

      const repeatedPartial = await applyMovementOperation(
        created.snapshot.id,
        partialInput,
        repository,
      );
      expect(repeatedPartial).toMatchObject({
        idempotent: true,
        snapshot: { id: partial.snapshot.id },
      });

      await expect(
        applyMovementOperation(
          partial.snapshot.id,
          {
            operation: "confirm_qr_donation",
            values: {
              operacion_id: "f2000000-0000-4000-8000-000000000003",
              anuncio_id: created.anuncio.anuncio_id,
              cantidad_paquetes: 13,
              ocurrido_en: "2026-11-20T10:20:00-05:00",
            },
          },
          repository,
        ),
      ).rejects.toMatchObject({ code: "QR_DONATION_EXCEEDS_PENDING" });

      const complete = await applyMovementOperation(
        partial.snapshot.id,
        {
          operation: "confirm_qr_donation",
          values: {
            operacion_id: "f2000000-0000-4000-8000-000000000004",
            anuncio_id: created.anuncio.anuncio_id,
            cantidad_paquetes: 12,
            ocurrido_en: "2026-11-20T10:30:00-05:00",
          },
        },
        repository,
        new Date("2026-11-20T15:30:00.000Z"),
      );
      const afterComplete = await repository.getSnapshotBundle(complete.snapshot.id);
      expect(afterComplete?.qrDonations[0]).toMatchObject({
        estado: "recibido_completo",
        cantidad_recibida_paquetes: 20,
        cantidad_pendiente_paquetes: 0,
      });
      expect(water600Inventory(afterComplete!)).toBe(initialInventory + 20);
      expect(afterComplete?.movements).toHaveLength(initial!.movements.length + 2);

      const moduleData = await getQrDonationModule(complete.snapshot.id, repository);
      expect(moduleData.anuncios[0]).toMatchObject({
        centro_nombre: "Centro Norte",
        producto_nombre: "Agua potable",
        presentacion_nombre: "Botella de 600 ml",
        inventario_confirmado_unidad_base: initialWaterBaseUnits + 20 * 600,
      });
    } finally {
      await roots.cleanup();
    }
  }, 20_000);

  it("cancela antes de recibir, conserva MAIN y rechaza cancelar después de una recepción", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const mainBefore = await repository.getSnapshotBundle(WEEKLY_MAIN_SNAPSHOT_ID);
      const created = await applyQrDonationOperation(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
        {
          ...announcementInput,
          values: {
            ...announcementInput.values,
            operacion_id: "f2000000-0000-4000-8000-000000000005",
            respuesta_origen_id: "local-test-response-002",
          },
        },
        repository,
      );
      const cancelled = await applyQrDonationOperation(
        created.snapshot.id,
        {
          operation: "cancel_announcement",
          values: {
            operacion_id: "f2000000-0000-4000-8000-000000000006",
            anuncio_id: created.anuncio.anuncio_id,
          },
        },
        repository,
      );
      expect(cancelled.anuncio.estado).toBe("cancelado");
      const repeatedCancel = await applyQrDonationOperation(
        cancelled.snapshot.id,
        {
          operation: "cancel_announcement",
          values: {
            operacion_id: "f2000000-0000-4000-8000-000000000007",
            anuncio_id: created.anuncio.anuncio_id,
          },
        },
        repository,
      );
      expect(repeatedCancel).toMatchObject({
        idempotent: true,
        snapshot: { id: cancelled.snapshot.id },
      });

      const receivedAnnouncement = await applyQrDonationOperation(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
        {
          ...announcementInput,
          values: {
            ...announcementInput.values,
            operacion_id: "f2000000-0000-4000-8000-000000000008",
            respuesta_origen_id: "local-test-response-003",
          },
        },
        repository,
      );
      const partial = await applyMovementOperation(
        receivedAnnouncement.snapshot.id,
        {
          operation: "confirm_qr_donation",
          values: {
            operacion_id: "f2000000-0000-4000-8000-000000000009",
            anuncio_id: receivedAnnouncement.anuncio.anuncio_id,
            cantidad_paquetes: 1,
            ocurrido_en: "2026-11-20T11:00:00-05:00",
          },
        },
        repository,
      );
      await expect(
        applyQrDonationOperation(
          partial.snapshot.id,
          {
            operation: "cancel_announcement",
            values: {
              operacion_id: "f2000000-0000-4000-8000-000000000010",
              anuncio_id: receivedAnnouncement.anuncio.anuncio_id,
            },
          },
          repository,
        ),
      ).rejects.toMatchObject({ code: "QR_DONATION_HAS_RECEIPTS" });

      await expect(
        applyQrDonationOperation(
          WEEKLY_MAIN_SNAPSHOT_ID,
          announcementInput,
          repository,
        ),
      ).rejects.toMatchObject({ code: "SCENARIO_READ_ONLY" });
      expect(await repository.getSnapshotBundle(WEEKLY_MAIN_SNAPSHOT_ID)).toEqual(
        mainBefore,
      );

      const reset = await resetTestingScenario(
        { operacion_id: "f2000000-0000-4000-8000-000000000011" },
        repository,
      );
      const resetBundle = await repository.getSnapshotBundle(reset.snapshot.id);
      expect(resetBundle?.qrDonations).toEqual([]);
      expect(
        (await repository.getSnapshotBundle(partial.snapshot.id))?.qrDonations,
      ).toHaveLength(1);
    } finally {
      await roots.cleanup();
    }
  }, 20_000);

  it("recalcula alertas después de incorporar físicamente una donación", async () => {
    const roots = await createTempDataRoots();
    try {
      const repository = new CsvOperationsRepository({
        demoRoot: PROJECT_DEMO_ROOT,
        runtimeRoot: roots.runtimeRoot,
      });
      const initial = await getDashboard(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
        repository,
      );
      const initialAlert = initial.alertas.alertas.find(
        (row) =>
          row.tipo === "deficit_cobertura" &&
          row.centro_id === "C01" &&
          row.producto_id === "P27",
      );
      expect(initialAlert).toBeDefined();

      const created = await applyQrDonationOperation(
        WEEKLY_TESTING_BASE_SNAPSHOT_ID,
        {
          operation: "create_announcement",
          values: {
            operacion_id: "f2000000-0000-4000-8000-000000000012",
            respuesta_origen_id: "local-test-response-alert",
            centro_id: "C01",
            producto_id: "P27",
            sku_id: "EXTENSION-ROLLO20",
            cantidad_anunciada_paquetes: 12,
            llegada_estimada: "2026-11-20T12:00:00-05:00",
            registrado_en: "2026-11-18T10:00:00-05:00",
            donante_referencia: null,
            observaciones: null,
            fuente: "local_prueba",
          },
        },
        repository,
      );
      const afterAnnouncement = await getDashboard(created.snapshot.id, repository);
      expect(
        afterAnnouncement.alertas.alertas.find(
          (row) => row.alerta_id === initialAlert?.alerta_id,
        ),
      ).toBeDefined();

      const received = await applyMovementOperation(
        created.snapshot.id,
        {
          operation: "confirm_qr_donation",
          values: {
            operacion_id: "f2000000-0000-4000-8000-000000000013",
            anuncio_id: created.anuncio.anuncio_id,
            cantidad_paquetes: 12,
            ocurrido_en: "2026-11-20T12:05:00-05:00",
          },
        },
        repository,
      );
      const afterReception = await getDashboard(received.snapshot.id, repository);
      expect(
        afterReception.alertas.alertas.find(
          (row) => row.alerta_id === initialAlert?.alerta_id,
        ),
      ).toBeUndefined();
    } finally {
      await roots.cleanup();
    }
  }, 20_000);
});
