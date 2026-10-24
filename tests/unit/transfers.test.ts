import { describe, expect, it } from "vitest";

import { recommendTransfers } from "@/domain/transfers";

describe("recomendaciones de traslado", () => {
  const balances = [
    {
      centro_id: "C02",
      producto_id: "P01",
      deficit_unidad_base: 0,
      excedente_transferible_unidad_base: 10000,
      existencias: [
        {
          sku_id: "AGUA-1500",
          cantidad_paquetes: 6,
          contenido_por_paquete: 1500,
        },
        {
          sku_id: "AGUA-600",
          cantidad_paquetes: 20,
          contenido_por_paquete: 600,
        },
      ],
    },
    {
      centro_id: "C01",
      producto_id: "P01",
      deficit_unidad_base: 8000,
      excedente_transferible_unidad_base: 0,
      existencias: [],
    },
  ];

  it("T06 recomienda paquetes completos, usa el sentido correcto y no muta", () => {
    const original = structuredClone(balances);
    const result = recommendTransfers(balances, [
      { origen_id: "C02", destino_id: "C01", minutos: 15 },
      { origen_id: "C01", destino_id: "C02", minutos: 20 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      origen_id: "C02",
      destino_id: "C01",
      minutos: 15,
      total_unidad_base: 7500,
    });
    expect(result[0].paquetes).toEqual([
      {
        sku_id: "AGUA-1500",
        cantidad_paquetes: 5,
        contenido_por_paquete: 1500,
      },
    ]);
    expect(result[0].total_unidad_base).toBeLessThanOrEqual(8000);
    expect(result[0].total_unidad_base).toBeLessThanOrEqual(10000);
    expect(balances).toEqual(original);
  });

  it("no inventa una recomendación si falta el tiempo dirigido", () => {
    expect(recommendTransfers(balances, [])).toEqual([]);
    expect(
      recommendTransfers(balances, [
        { origen_id: "C01", destino_id: "C02", minutos: 20 },
      ]),
    ).toEqual([]);
  });
});

