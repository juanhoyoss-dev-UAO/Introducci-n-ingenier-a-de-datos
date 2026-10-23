import { describe, expect, it } from "vitest";

import { confirmedReceptionPayloadSchema } from "@/contracts/schemas/events";
import { applyConfirmedReceptions } from "@/domain/events";
import { calculatePackageUnits } from "@/domain/inventory";
import {
  createServiceRoleClient,
  integrationIsEnabled,
} from "../helpers/supabase";

const SNAPSHOT_A = "10000000-0000-4000-8000-000000000001";
const SNAPSHOT_B = "10000000-0000-4000-8000-000000000002";
const SIMULATION_A = "20000000-0000-4000-8000-000000000001";
const SIMULATION_B = "20000000-0000-4000-8000-000000000002";

describe.runIf(integrationIsEnabled())("PostgreSQL real", () => {
  it("T04 conserva inventarios independientes para C01", async () => {
    const client = createServiceRoleClient();
    const { data: presentations, error: presentationError } = await client
      .from("presentaciones")
      .select("snapshot_id,sku_id,producto_id,contenido_por_paquete")
      .in("snapshot_id", [SNAPSHOT_A, SNAPSHOT_B])
      .eq("producto_id", "P01");
    expect(presentationError).toBeNull();

    const { data: inventory, error: inventoryError } = await client
      .from("inventario_inicial")
      .select("snapshot_id,centro_id,sku_id,cantidad_paquetes")
      .in("snapshot_id", [SNAPSHOT_A, SNAPSHOT_B])
      .eq("centro_id", "C01");
    expect(inventoryError).toBeNull();

    function unitsFor(snapshotId: string) {
      return calculatePackageUnits(
        (inventory ?? [])
          .filter((row) => row.snapshot_id === snapshotId)
          .map((row) => {
            const presentation = (presentations ?? []).find(
              (item) =>
                item.snapshot_id === snapshotId && item.sku_id === row.sku_id,
            );
            return {
              cantidad_paquetes: row.cantidad_paquetes,
              contenido_por_paquete: Number(
                presentation?.contenido_por_paquete ?? 0,
              ),
            };
          }),
      );
    }

    expect(unitsFor(SNAPSHOT_A)).toBe(12000);
    expect(unitsFor(SNAPSHOT_B)).toBe(2700);
  });

  it("T04 rechaza una presentación perteneciente a otro snapshot", async () => {
    const client = createServiceRoleClient();
    const { error } = await client.from("inventario_inicial").insert({
      snapshot_id: SNAPSHOT_A,
      centro_id: "C01",
      sku_id: "AGUA-330",
      cantidad_paquetes: 1,
    });

    expect(error?.code).toBe("23503");
  });

  it("T05 aplica el evento persistido solo a su simulación", async () => {
    const client = createServiceRoleClient();
    const { data: inventory, error: inventoryError } = await client
      .from("inventario_inicial")
      .select("centro_id,sku_id,cantidad_paquetes")
      .eq("snapshot_id", SNAPSHOT_A)
      .eq("centro_id", "C01")
      .eq("sku_id", "AGUA-600");
    expect(inventoryError).toBeNull();

    const { data: events, error: eventError } = await client
      .from("eventos_simulacion")
      .select("simulacion_id,tipo,ocurrido_en,payload")
      .eq("simulacion_id", SIMULATION_A);
    expect(eventError).toBeNull();

    const validEvents = (events ?? []).map((event) => ({
      simulacion_id: event.simulacion_id,
      tipo: "recepcion_confirmada" as const,
      ocurrido_en: event.ocurrido_en,
      payload: confirmedReceptionPayloadSchema.parse(event.payload),
    }));
    const first = applyConfirmedReceptions(
      inventory ?? [],
      validEvents,
      SIMULATION_A,
      "2026-10-01T10:00:00-05:00",
    );
    const second = applyConfirmedReceptions(
      inventory ?? [],
      validEvents,
      SIMULATION_B,
      "2026-10-01T10:00:00-05:00",
    );

    expect(first[0].cantidad_paquetes).toBe(15);
    expect(second[0].cantidad_paquetes).toBe(10);
    expect(inventory?.[0].cantidad_paquetes).toBe(10);
  });

  it("T07 aplica checks, claves foráneas y unicidad", async () => {
    const client = createServiceRoleClient();

    const failures = await Promise.all([
      client.from("inventario_inicial").insert({
        snapshot_id: SNAPSHOT_A,
        centro_id: "C02",
        sku_id: "ARROZ-1000",
        cantidad_paquetes: -1,
      }),
      client.from("presentaciones").insert({
        snapshot_id: SNAPSHOT_A,
        sku_id: "INVALIDA-CERO",
        producto_id: "P01",
        nombre: "Inválida",
        contenido_por_paquete: 0,
      }),
      client.from("inventario_inicial").insert({
        snapshot_id: SNAPSHOT_A,
        centro_id: "C99",
        sku_id: "AGUA-600",
        cantidad_paquetes: 1,
      }),
      client.from("inventario_inicial").insert({
        snapshot_id: SNAPSHOT_A,
        centro_id: "C01",
        sku_id: "AGUA-600",
        cantidad_paquetes: 1,
      }),
      client.from("tiempos_traslado").insert({
        snapshot_id: SNAPSHOT_A,
        origen_id: "C03",
        destino_id: "C04",
        minutos: -1,
      }),
      client.from("donaciones_esperadas").insert({
        snapshot_id: SNAPSHOT_A,
        intencion_id: "INVALIDA-CERO",
        centro_id: "C01",
        sku_id: "AGUA-600",
        cantidad_paquetes: 0,
        llegada_prevista: "2026-10-01T12:00:00-05:00",
      }),
      client.from("centros").insert({
        snapshot_id: SNAPSHOT_A,
        centro_id: "C01",
        nombre: "Duplicado",
        estado: "activo",
        coordinador_nombre: "Duplicado",
      }),
    ]);

    expect(failures.map((failure) => failure.error?.code)).toEqual([
      "23514",
      "23514",
      "23503",
      "23505",
      "23514",
      "23514",
      "23505",
    ]);
  });

  it("T12 contiene los datos semilla reproducibles", async () => {
    const client = createServiceRoleClient();
    const [snapshots, centers, products, presentations, simulations] =
      await Promise.all([
        client.from("snapshots").select("id", { count: "exact" }),
        client
          .from("centros")
          .select("centro_id", { count: "exact" })
          .eq("snapshot_id", SNAPSHOT_A),
        client
          .from("productos")
          .select("producto_id", { count: "exact" })
          .eq("snapshot_id", SNAPSHOT_A),
        client
          .from("presentaciones")
          .select("sku_id", { count: "exact" })
          .eq("snapshot_id", SNAPSHOT_A),
        client
          .from("simulaciones")
          .select("id", { count: "exact" })
          .eq("snapshot_id", SNAPSHOT_A),
      ]);

    expect(snapshots.count).toBe(2);
    expect(centers.count).toBe(6);
    expect(products.count).toBe(5);
    expect(presentations.count).toBe(7);
    expect(simulations.count).toBe(2);
  });
});

