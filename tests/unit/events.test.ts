import { describe, expect, it } from "vitest";

import { applyConfirmedReceptions } from "@/domain/events";

describe("eventos de simulación", () => {
  it("T05 aplica una recepción solo a la simulación seleccionada", () => {
    const initial = [
      { centro_id: "C01", sku_id: "AGUA-600", cantidad_paquetes: 10 },
    ];
    const events = [
      {
        simulacion_id: "SIM-1",
        tipo: "recepcion_confirmada" as const,
        ocurrido_en: "2026-10-01T09:00:00-05:00",
        payload: {
          centro_id: "C01",
          sku_id: "AGUA-600",
          cantidad_paquetes: 5,
          estado: "confirmada" as const,
        },
      },
    ];

    const firstSimulation = applyConfirmedReceptions(
      initial,
      events,
      "SIM-1",
      "2026-10-01T10:00:00-05:00",
    );
    const secondSimulation = applyConfirmedReceptions(
      initial,
      events,
      "SIM-2",
      "2026-10-01T10:00:00-05:00",
    );

    expect(firstSimulation[0].cantidad_paquetes).toBe(15);
    expect(secondSimulation[0].cantidad_paquetes).toBe(10);
    expect(initial[0].cantidad_paquetes).toBe(10);
  });

  it("ignora eventos posteriores a la hora actual", () => {
    const result = applyConfirmedReceptions(
      [{ centro_id: "C01", sku_id: "AGUA-600", cantidad_paquetes: 10 }],
      [
        {
          simulacion_id: "SIM-1",
          tipo: "recepcion_confirmada",
          ocurrido_en: "2026-10-01T11:00:00-05:00",
          payload: {
            centro_id: "C01",
            sku_id: "AGUA-600",
            cantidad_paquetes: 5,
            estado: "confirmada",
          },
        },
      ],
      "SIM-1",
      "2026-10-01T10:00:00-05:00",
    );

    expect(result[0].cantidad_paquetes).toBe(10);
  });
});

