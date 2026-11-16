import { describe, expect, it } from "vitest";

import type {
  AlertCenterInput,
  AlertEvaluationInput,
} from "@/contracts/types/alerts";
import {
  DEFAULT_ALERT_THRESHOLDS,
  evaluateOperationalAlerts,
} from "@/domain/alerts";

const SNAPSHOT_A = "10000000-0000-4000-8000-000000000001";
const EVALUATED_AT = "2026-10-01T16:00:00-05:00";

function center(
  values: Partial<AlertCenterInput> & {
    coverage?: number | null;
    target?: number;
    confirmed?: number;
    priority?: number | null;
  } = {},
): AlertCenterInput {
  const target = values.target ?? 100;
  const confirmed = values.confirmed ?? 60;
  const coverage =
    values.coverage === undefined ? (target > 0 ? (confirmed / target) * 100 : null) : values.coverage;
  return {
    centro_id: values.centro_id ?? "C01",
    centro_nombre: values.centro_nombre ?? "Centro Norte",
    voluntarios_disponibles: values.voluntarios_disponibles ?? 5,
    voluntarios_requeridos: values.voluntarios_requeridos ?? 5,
    capacidad_almacenamiento: values.capacidad_almacenamiento ?? {
      calculable: false,
      capacidad_maxima_kg: null,
      peso_almacenado_kg: null,
      ocupacion_porcentaje: null,
      sobrecapacidad: null,
      datos_faltantes: ["capacidad_maxima_kg", "peso_kg_por_paquete"],
    },
    productos: values.productos ?? [
      {
        producto_id: "P01",
        producto_nombre: "Agua",
        unidad_base: "ml",
        inventario_confirmado_unidad_base: confirmed,
        objetivo_unidad_base: target,
        deficit_confirmado_unidad_base: Math.max(0, target - confirmed),
        cobertura_porcentaje: coverage,
        excedente_transferible_unidad_base: 0,
        prioridad: values.priority === undefined ? 2 : values.priority,
      },
    ],
  };
}

function input(
  values: Partial<AlertEvaluationInput> = {},
): AlertEvaluationInput {
  return {
    referencia_tipo: "snapshot",
    referencia_id: SNAPSHOT_A,
    evaluado_en: EVALUATED_AT,
    centros: [center()],
    donaciones: [],
    evidencia_temporal: [],
    ...values,
  };
}

function alertsOfType(
  result: ReturnType<typeof evaluateOperationalAlerts>,
  type: ReturnType<typeof evaluateOperationalAlerts>["alertas"][number]["tipo"],
) {
  return result.alertas.filter((alert) => alert.tipo === type);
}

describe("motor puro de alertas operativas M5", () => {
  it("exige una hora de evaluación explícita y no ambigua", () => {
    expect(() =>
      evaluateOperationalAlerts(input({ evaluado_en: "2026-10-01T16:00:00" })),
    ).toThrow("fecha válida y no ambigua");
  });

  it("clasifica cobertura inferior a 30 % como déficit crítico", () => {
    const result = evaluateOperationalAlerts(
      input({ centros: [center({ confirmed: 29, coverage: 29 })] }),
    );
    expect(alertsOfType(result, "deficit_cobertura")).toEqual([
      expect.objectContaining({
        titulo: "Déficit crítico",
        severidad: "critica",
        valor_observado: 29,
        umbral_aplicado: 30,
        unidad: "porcentaje",
      }),
    ]);
  });

  it.each([
    [30, "Déficit importante", "advertencia"],
    [70, "Déficit moderado", "informativa"],
  ] as const)("clasifica exactamente %s %% sin solapar reglas", (coverage, title, severity) => {
    const result = evaluateOperationalAlerts(
      input({ centros: [center({ confirmed: coverage })] }),
    );
    expect(alertsOfType(result, "deficit_cobertura")[0]).toMatchObject({
      titulo: title,
      severidad: severity,
      valor_observado: coverage,
    });
  });

  it("elimina la alerta de déficit exactamente al 100 %", () => {
    const result = evaluateOperationalAlerts(
      input({ centros: [center({ confirmed: 100 })] }),
    );
    expect(alertsOfType(result, "deficit_cobertura")).toHaveLength(0);
  });

  it("no genera cobertura para necesidades con objetivo cero", () => {
    const result = evaluateOperationalAlerts(
      input({ centros: [center({ target: 0, confirmed: 0 })] }),
    );
    expect(alertsOfType(result, "deficit_cobertura")).toHaveLength(0);
  });

  it("considera prioridad alta en el orden sin convertir 60 % en crítico", () => {
    const result = evaluateOperationalAlerts(
      input({
        centros: [
          center({ centro_id: "C02", centro_nombre: "Centro A", priority: 2 }),
          center({ centro_id: "C01", centro_nombre: "Centro Z", priority: 1 }),
        ],
      }),
    );
    const coverage = alertsOfType(result, "deficit_cobertura");
    expect(coverage.map((alert) => alert.centro_id)).toEqual(["C01", "C02"]);
    expect(coverage[0]).toMatchObject({
      severidad: "advertencia",
      titulo: "Déficit importante",
      prioridad_operativa: 1,
    });
  });

  it("muestra personas faltantes y no alerta cuando el voluntariado es suficiente", () => {
    const shortage = evaluateOperationalAlerts(
      input({
        centros: [
          center({
            target: 0,
            confirmed: 0,
            voluntarios_disponibles: 2,
            voluntarios_requeridos: 7,
          }),
        ],
      }),
    );
    expect(alertsOfType(shortage, "voluntariado_insuficiente")[0]).toMatchObject({
      valor_observado: 5,
      unidad: "persona",
    });

    const sufficient = evaluateOperationalAlerts(
      input({ centros: [center({ target: 0, confirmed: 0 })] }),
    );
    expect(alertsOfType(sufficient, "voluntariado_insuficiente")).toHaveLength(0);
  });

  it("respeta llegada prevista y tolerancia para donaciones pendientes", () => {
    const donation = {
      intencion_id: "D01",
      centro_id: "C01",
      centro_nombre: "Centro Norte",
      producto_id: "P01",
      producto_nombre: "Agua",
      llegada_prevista: "2026-10-01T15:30:00-05:00",
      estado: "pendiente" as const,
    };
    const result = evaluateOperationalAlerts(
      input({ centros: [center({ target: 0, confirmed: 0 })], donaciones: [donation] }),
    );
    expect(alertsOfType(result, "donacion_retrasada")).toHaveLength(0);
  });

  it("alerta después de 60 minutos de tolerancia y excluye donaciones confirmadas", () => {
    const pending = {
      intencion_id: "D01",
      centro_id: "C01",
      centro_nombre: "Centro Norte",
      producto_id: "P01",
      producto_nombre: "Agua",
      llegada_prevista: "2026-10-01T14:00:00-05:00",
      estado: "pendiente" as const,
    };
    const result = evaluateOperationalAlerts(
      input({
        centros: [center({ target: 0, confirmed: 0 })],
        donaciones: [pending, { ...pending, intencion_id: "D02", estado: "recibida" }],
      }),
    );
    expect(alertsOfType(result, "donacion_retrasada")).toEqual([
      expect.objectContaining({
        alerta_id: "alerta:donacion_retrasada:C01:D01",
        valor_observado: 60,
        umbral_aplicado: 60,
      }),
    ]);
  });

  it("declara información temporal desconocida sin inventar alerta", () => {
    const result = evaluateOperationalAlerts(
      input({ centros: [center({ target: 0, confirmed: 0 })] }),
    );
    expect(alertsOfType(result, "informacion_desactualizada")).toHaveLength(0);
    expect(result.informacion_temporal_desconocida).toEqual([
      expect.objectContaining({ centro_id: "C01", producto_id: "P01" }),
    ]);
  });

  it("genera información desactualizada sólo con fecha válida mayor a cuatro horas", () => {
    const base = input({ centros: [center({ target: 0, confirmed: 0 })] });
    const result = evaluateOperationalAlerts({
      ...base,
      evidencia_temporal: [
        {
          entidad: "inventario",
          centro_id: "C01",
          centro_nombre: "Centro Norte",
          producto_id: "P01",
          producto_nombre: "Agua",
          actualizado_en: "2026-10-01T11:00:00-05:00",
        },
      ],
    });
    expect(alertsOfType(result, "informacion_desactualizada")[0]).toMatchObject({
      valor_observado: 300,
      umbral_aplicado: 240,
      unidad: "minuto",
    });
    expect(result.informacion_temporal_desconocida).toHaveLength(0);
  });

  it("no interpreta capacidad no calculable como ocupación cero", () => {
    const result = evaluateOperationalAlerts(
      input({ centros: [center({ target: 0, confirmed: 0 })] }),
    );
    expect(alertsOfType(result, "capacidad")).toHaveLength(0);
  });

  it.each([
    [85, "advertencia", "Capacidad próxima al límite"],
    [95, "critica", "Capacidad en nivel crítico"],
    [101, "critica", "Sobrecapacidad de almacenamiento"],
  ] as const)("aplica el umbral de capacidad en %s %%", (occupancy, severity, title) => {
    const result = evaluateOperationalAlerts(
      input({
        centros: [
          center({
            target: 0,
            confirmed: 0,
            capacidad_almacenamiento: {
              calculable: true,
              capacidad_maxima_kg: 100,
              peso_almacenado_kg: occupancy,
              ocupacion_porcentaje: occupancy,
              sobrecapacidad: occupancy > 100,
              datos_faltantes: [],
            },
          }),
        ],
      }),
    );
    expect(alertsOfType(result, "capacidad")[0]).toMatchObject({
      severidad: severity,
      titulo: title,
      valor_observado: occupancy,
    });
  });

  it("mantiene identificadores deterministas y resultados idénticos al repetir", () => {
    const state = input();
    const first = evaluateOperationalAlerts(state);
    const second = evaluateOperationalAlerts(state);
    expect(first).toEqual(second);
    expect(first.alertas[0]?.alerta_id).toBe(
      "alerta:deficit_cobertura:C01:P01",
    );
  });

  it("conserva la referencia del snapshot sin mezclar evaluaciones", () => {
    const first = evaluateOperationalAlerts(input());
    const second = evaluateOperationalAlerts(
      input({ referencia_id: "20000000-0000-4000-8000-000000000002", centros: [] }),
    );
    expect(first.referencia_id).toBe(SNAPSHOT_A);
    expect(first.alertas.every((alert) => alert.referencia_id === SNAPSHOT_A)).toBe(true);
    expect(second).toMatchObject({ total: 0, referencia_id: "20000000-0000-4000-8000-000000000002" });
  });

  it("no suma productos con unidades incompatibles y conserva cada unidad", () => {
    const result = evaluateOperationalAlerts(
      input({
        centros: [
          center({
            productos: [
              {
                producto_id: "P01",
                producto_nombre: "Agua",
                unidad_base: "ml",
                inventario_confirmado_unidad_base: 20,
                objetivo_unidad_base: 100,
                deficit_confirmado_unidad_base: 80,
                cobertura_porcentaje: 20,
                excedente_transferible_unidad_base: 0,
                prioridad: 1,
              },
              {
                producto_id: "P02",
                producto_nombre: "Arroz",
                unidad_base: "g",
                inventario_confirmado_unidad_base: 60,
                objetivo_unidad_base: 100,
                deficit_confirmado_unidad_base: 40,
                cobertura_porcentaje: 60,
                excedente_transferible_unidad_base: 0,
                prioridad: 2,
              },
            ],
          }),
        ],
      }),
    );
    const coverage = alertsOfType(result, "deficit_cobertura");
    expect(coverage).toHaveLength(2);
    expect(coverage.map((alert) => alert.valor_observado)).toEqual([20, 60]);
    expect(coverage.map((alert) => alert.producto_id)).toEqual(["P01", "P02"]);
  });

  it("permite cambiar umbrales desde una configuración central", () => {
    const result = evaluateOperationalAlerts(input(), {
      ...DEFAULT_ALERT_THRESHOLDS,
      cobertura_critica_menor_que: 65,
    });
    expect(alertsOfType(result, "deficit_cobertura")[0]?.severidad).toBe(
      "critica",
    );
  });
});
