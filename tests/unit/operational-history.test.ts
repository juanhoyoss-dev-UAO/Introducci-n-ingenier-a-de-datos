import { describe, expect, it } from "vitest";

import {
  delayHistory,
  historyRange,
  inventoryHistory,
  movementEvents,
  movementHistory,
} from "@/app/dashboard/operational-history";
import type {
  TemporalAnalysisResult,
  TemporalEvent,
} from "@/contracts/types/temporal";

function movement(
  overrides: Partial<TemporalEvent> & Pick<TemporalEvent, "evento_id" | "tipo">,
): TemporalEvent {
  const common = {
    evento_id: overrides.evento_id,
    operacion_id: `operation-${overrides.evento_id}`,
    escenario_id: "scenario-main",
    snapshot_origen_id: "snapshot-main",
    centro_id: "C01",
    producto_id: "P01",
    sku_id: "AGUA-600",
    ocurrido_en: "2026-11-10T09:00:00-05:00",
    registrado_en: "2026-11-10T09:30:00-05:00",
    orden: 1,
    incorporado_en_estado_inicial: false,
  };
  if (overrides.tipo === "recepcion_confirmada") {
    return {
      ...common,
      ...overrides,
      tipo: "recepcion_confirmada",
      operacion: "direct_reception",
      payload: { cantidad_paquetes: 2, intencion_id: null },
    };
  }
  if (overrides.tipo === "despacho") {
    return {
      ...common,
      ...overrides,
      tipo: "despacho",
      operacion: "dispatch",
      payload: { cantidad_paquetes: 1 },
    };
  }
  return {
    ...common,
    ...overrides,
    tipo: "anuncio_donacion",
    operacion: "announce_donation",
    payload: {
      intencion_id: "D01",
      cantidad_paquetes: 1,
      llegada_prevista: "2026-11-10T12:00:00-05:00",
    },
  };
}

describe("modelo del historial operativo", () => {
  it("usa por defecto la semana simulada y nunca genera el año 0001", () => {
    expect(historyRange({ mode: "week" })).toEqual({
      from: "2026-11-09T00:00:00-05:00",
      to: "2026-11-15T23:59:59-05:00",
    });
    expect(historyRange({ mode: "day", day: "" }).from).toBe(
      "2026-11-09T00:00:00-05:00",
    );
  });

  it("agrega centros comparables y conserva el último estado verificable del día", () => {
    const points = inventoryHistory(
      [
        { instante: "2026-11-10T09:00:00-05:00", centro_id: "C01", producto_id: "P01", producto_nombre: "Agua", inventario: 1_000, necesidad: 2_000, deficit: 1_000, unidad: "ml" },
        { instante: "2026-11-10T09:00:00-05:00", centro_id: "C02", producto_id: "P01", producto_nombre: "Agua", inventario: 500, necesidad: 1_000, deficit: 500, unidad: "ml" },
        { instante: "2026-11-10T18:00:00-05:00", centro_id: "C01", producto_id: "P01", producto_nombre: "Agua", inventario: 2_000, necesidad: 2_000, deficit: 0, unidad: "ml" },
        { instante: "2026-11-10T18:00:00-05:00", centro_id: "C02", producto_id: "P01", producto_nombre: "Agua", inventario: 700, necesidad: 1_000, deficit: 300, unidad: "ml" },
      ],
      "week",
    );

    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ inventory: 2_700, need: 3_000, unit: "ml" });
  });

  it("agrupa recepciones y despachos por día u hora como conteos", () => {
    const rows = [
      { fecha_local: "2026-11-10", hora_local: 9, etiqueta: "", recepciones: 2, paquetes_recibidos: 5, despachos: 1, paquetes_despachados: 1 },
      { fecha_local: "2026-11-10", hora_local: 12, etiqueta: "", recepciones: 1, paquetes_recibidos: 20, despachos: 3, paquetes_despachados: 8 },
    ];

    expect(movementHistory(rows, "week")[0]).toMatchObject({
      receptions: 3,
      dispatches: 4,
    });
    expect(movementHistory(rows, "day")).toHaveLength(2);
  });

  it("calcula retrasos sólo para movimientos con tiempos válidos", () => {
    const reception = movement({ evento_id: "reception", tipo: "recepcion_confirmada" });
    const dispatch = movement({
      evento_id: "dispatch",
      tipo: "despacho",
      ocurrido_en: "2026-11-10T10:00:00-05:00",
      registrado_en: "2026-11-10T10:00:00-05:00",
    });
    const announcement = movement({ evento_id: "announcement", tipo: "anuncio_donacion" });
    const analysis = {
      eventos: [announcement, dispatch, reception],
      series: {
        movimientos_por_hora: [],
        recepciones_fisicas: [],
        inventario_necesidad_deficit: [],
        voluntarios: [],
        desfase_registro: [
          { evento_id: "reception", ocurrido_en: reception.ocurrido_en, registrado_en: reception.registrado_en, desfase_minutos: 30 },
          { evento_id: "dispatch", ocurrido_en: dispatch.ocurrido_en, registrado_en: dispatch.registrado_en, desfase_minutos: 0 },
          { evento_id: "announcement", ocurrido_en: announcement.ocurrido_en, registrado_en: announcement.registrado_en, desfase_minutos: 120 },
        ],
      },
    } satisfies Pick<TemporalAnalysisResult, "eventos" | "series">;

    expect(delayHistory(analysis, "week")[0]).toMatchObject({
      averageMinutes: 15,
      maximumMinutes: 30,
      evaluatedMovements: 2,
      delayedMovements: 1,
    });
    expect(movementEvents(analysis.eventos).map((event) => event.evento_id)).toEqual([
      "reception",
      "dispatch",
    ]);
  });
});
