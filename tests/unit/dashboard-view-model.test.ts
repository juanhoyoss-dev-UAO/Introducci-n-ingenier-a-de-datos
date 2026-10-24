import { describe, expect, it } from "vitest";

import type { DashboardBundle } from "@/app/dashboard/types";
import {
  centerRows,
  deriveSummary,
  donationRows,
  inventoryRows,
  needRows,
  sortSnapshots,
  travelTimeRows,
  volunteerRows,
} from "@/app/dashboard/view-model";

const SNAPSHOT_ID = "10000000-0000-4000-8000-000000000001";

const bundle: DashboardBundle = {
  snapshot: {
    id: SNAPSHOT_ID,
    nombre: "Jornada A",
    created_at: "2026-10-01T08:00:00-05:00",
    descripcion: null,
  },
  centers: [
    {
      snapshot_id: SNAPSHOT_ID,
      centro_id: "C01",
      nombre: "Centro Norte",
      estado: "activo",
      zona: "Norte",
      coordinador_nombre: "Coordinación Norte",
    },
    {
      snapshot_id: SNAPSHOT_ID,
      centro_id: "C02",
      nombre: "Centro Sur",
      estado: "activo",
      zona: "Sur",
      coordinador_nombre: "Coordinación Sur",
    },
  ],
  products: [
    {
      snapshot_id: SNAPSHOT_ID,
      producto_id: "P01",
      nombre: "Agua",
      unidad_base: "ml",
      presentaciones: [
        {
          snapshot_id: SNAPSHOT_ID,
          sku_id: "SKU-AGUA-600",
          producto_id: "P01",
          nombre: "Botella 600 ml",
          contenido_por_paquete: 600,
        },
        {
          snapshot_id: SNAPSHOT_ID,
          sku_id: "SKU-AGUA-1500",
          producto_id: "P01",
          nombre: "Botella 1.500 ml",
          contenido_por_paquete: 1_500,
        },
      ],
    },
  ],
  travelTimes: [
    {
      snapshot_id: SNAPSHOT_ID,
      origen_id: "C02",
      destino_id: "C01",
      minutos: 15,
    },
  ],
  dashboard: {
    snapshot: {
      id: SNAPSHOT_ID,
      nombre: "Jornada A",
      created_at: "2026-10-01T08:00:00-05:00",
      descripcion: null,
    },
    centros: [
      {
        snapshot_id: SNAPSHOT_ID,
        centro_id: "C01",
        nombre: "Centro Norte",
        estado: "activo",
        zona: "Norte",
        coordinador_nombre: "Coordinación Norte",
        voluntarios: { disponibles: 2, requeridos: 5, faltantes: 3 },
        productos: [
          {
            producto_id: "P01",
            nombre: "Agua",
            unidad_base: "ml",
            inventario_confirmado_unidad_base: 12_000,
            objetivo_unidad_base: 20_000,
            reserva_unidad_base: 0,
            prioridad: 1,
            deficit_confirmado_unidad_base: 8_000,
            excedente_transferible_unidad_base: 0,
            donaciones_esperadas_unidad_base: 6_000,
            existencias: [
              {
                sku_id: "SKU-AGUA-600",
                cantidad_paquetes: 10,
                contenido_por_paquete: 600,
              },
              {
                sku_id: "SKU-AGUA-1500",
                cantidad_paquetes: 4,
                contenido_por_paquete: 1_500,
              },
            ],
          },
        ],
      },
      {
        snapshot_id: SNAPSHOT_ID,
        centro_id: "C02",
        nombre: "Centro Sur",
        estado: "activo",
        zona: "Sur",
        coordinador_nombre: "Coordinación Sur",
        voluntarios: { disponibles: 4, requeridos: 4, faltantes: 0 },
        productos: [
          {
            producto_id: "P01",
            nombre: "Agua",
            unidad_base: "ml",
            inventario_confirmado_unidad_base: 0,
            objetivo_unidad_base: 0,
            reserva_unidad_base: 0,
            prioridad: null,
            deficit_confirmado_unidad_base: 0,
            excedente_transferible_unidad_base: 0,
            donaciones_esperadas_unidad_base: 0,
            existencias: [],
          },
        ],
      },
    ],
    donaciones_esperadas: [
      {
        snapshot_id: SNAPSHOT_ID,
        intencion_id: "D01",
        centro_id: "C01",
        sku_id: "SKU-AGUA-600",
        cantidad_paquetes: 10,
        llegada_prevista: "2026-10-01T10:00:00-05:00",
        estado: "pendiente",
      },
    ],
    candidatos_traslado: [],
  },
};

describe("modelo de vista del inspector D0", () => {
  it("selecciona snapshots de forma cronológica y determinista", () => {
    const ordered = sortSnapshots([
      { id: "b", created_at: "2026-10-02T00:00:00Z" },
      { id: "c", created_at: "2026-10-01T00:00:00Z" },
      { id: "a", created_at: "2026-10-01T00:00:00Z" },
    ]);

    expect(ordered.map((snapshot) => snapshot.id)).toEqual(["a", "c", "b"]);
  });

  it("calcula el resumen con catálogos e intenciones reales", () => {
    expect(deriveSummary(bundle)).toEqual({
      centros: 2,
      productos: 1,
      presentaciones: 2,
      centrosConNecesidades: 1,
      centrosConDeficit: 1,
      donacionesAnunciadas: 1,
    });
  });

  it("expone inventario físico y necesidad sin sumar la donación anunciada", () => {
    expect(inventoryRows(bundle, "all")).toEqual([
      expect.objectContaining({
        cantidad_paquetes: 10,
        contenido_por_paquete: 600,
        subtotal_presentacion_unidad_base: 6_000,
        total_producto_unidad_base: 12_000,
      }),
      expect.objectContaining({
        cantidad_paquetes: 4,
        contenido_por_paquete: 1_500,
        subtotal_presentacion_unidad_base: 6_000,
        total_producto_unidad_base: 12_000,
      }),
    ]);
    expect(needRows(bundle.dashboard.centros, "all")[0]).toMatchObject({
      objetivo_unidad_base: 20_000,
      inventario_confirmado_unidad_base: 12_000,
      deficit_confirmado_unidad_base: 8_000,
    });
    expect(donationRows(bundle, "all")[0]).toMatchObject({
      cantidad_paquetes: 10,
      total_unidad_base: 6_000,
      estado: "pendiente",
    });
  });

  it("aplica el centro específico y conserva la opción todos", () => {
    expect(centerRows(bundle.centers, "all")).toHaveLength(2);
    expect(centerRows(bundle.centers, "C02")).toHaveLength(1);
    expect(inventoryRows(bundle, "C02")).toHaveLength(0);
    expect(volunteerRows(bundle.dashboard.centros, "C02")).toEqual([
      expect.objectContaining({ centro_id: "C02", faltantes: 0 }),
    ]);
  });

  it("mantiene los tiempos dirigidos sin inferir la relación inversa", () => {
    const rows = travelTimeRows(bundle.travelTimes, "C01");
    expect(rows).toEqual([
      expect.objectContaining({
        origen_id: "C02",
        destino_id: "C01",
        minutos: 15,
      }),
    ]);
    expect(rows).not.toContainEqual(
      expect.objectContaining({ origen_id: "C01", destino_id: "C02" }),
    );
  });
});
