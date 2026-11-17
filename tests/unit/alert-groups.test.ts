import { describe, expect, it } from "vitest";

import type { OperationalAlert } from "@/contracts/types/alerts";
import {
  PRODUCT_CATEGORY_BY_ID,
  alertGroupId,
  groupOperationalAlerts,
} from "@/app/dashboard/alert-groups";

function alert(
  values: Partial<OperationalAlert> &
    Pick<OperationalAlert, "alerta_id" | "tipo" | "severidad">,
): OperationalAlert {
  return {
    centro_id: "C01",
    centro_nombre: "Centro Norte",
    producto_id: null,
    producto_nombre: null,
    titulo: "Alerta",
    descripcion: "Descripción",
    valor_observado: 1,
    umbral_aplicado: 0,
    unidad: "unidad",
    accion_sugerida: "Revisar",
    prioridad_operativa: null,
    referencia_tipo: "snapshot",
    referencia_id: "snapshot-1",
    evaluado_en: "2026-11-16T10:00:00-05:00",
    estado: "activa",
    ...values,
  };
}

describe("agrupación visual de alertas A4.1", () => {
  it("cubre explícitamente los 32 productos del catálogo M6.5", () => {
    expect(Object.keys(PRODUCT_CATEGORY_BY_ID)).toEqual(
      Array.from({ length: 32 }, (_, index) =>
        `P${String(index + 1).padStart(2, "0")}`,
      ),
    );
  });

  it("clasifica déficits y excedentes por la categoría real del producto", () => {
    expect(
      alertGroupId(
        alert({
          alerta_id: "agua",
          tipo: "deficit_cobertura",
          severidad: "critica",
          producto_id: "P01",
        }),
      ),
    ).toBe("agua_alimentos");
    expect(
      alertGroupId(
        alert({
          alerta_id: "abrigo",
          tipo: "excedente_transferible",
          severidad: "informativa",
          producto_id: "P13",
        }),
      ),
    ).toBe("abrigo_higiene");
    expect(
      alertGroupId(
        alert({
          alerta_id: "proteccion",
          tipo: "deficit_cobertura",
          severidad: "advertencia",
          producto_id: "P17",
        }),
      ),
    ).toBe("herramientas_apoyo");
  });

  it("asigna condiciones no asociadas a escasez únicamente al grupo operativo", () => {
    expect(
      alertGroupId(
        alert({
          alerta_id: "voluntarios",
          tipo: "voluntariado_insuficiente",
          severidad: "advertencia",
        }),
      ),
    ).toBe("otras_alertas");
  });

  it("no duplica alertas y ordena grupos por severidad y cantidad", () => {
    const alerts = [
      alert({
        alerta_id: "agua-1",
        tipo: "deficit_cobertura",
        severidad: "critica",
        producto_id: "P01",
      }),
      alert({
        alerta_id: "agua-2",
        tipo: "deficit_cobertura",
        severidad: "advertencia",
        producto_id: "P05",
        centro_id: "C02",
      }),
      alert({
        alerta_id: "herramienta-1",
        tipo: "deficit_cobertura",
        severidad: "critica",
        producto_id: "P21",
      }),
      alert({
        alerta_id: "otra-1",
        tipo: "donacion_retrasada",
        severidad: "advertencia",
      }),
    ];

    const groups = groupOperationalAlerts(alerts);

    expect(groups.map((group) => group.id)).toEqual([
      "agua_alimentos",
      "herramientas_apoyo",
      "otras_alertas",
      "abrigo_higiene",
    ]);
    expect(groups.flatMap((group) => group.alerts)).toHaveLength(alerts.length);
    expect(
      new Set(groups.flatMap((group) => group.alerts.map((item) => item.alerta_id)))
        .size,
    ).toBe(alerts.length);
    expect(groups[0]).toMatchObject({
      criticalCount: 1,
      affectedCenters: 2,
      maximumSeverity: "critica",
    });
  });
});
