import { describe, expect, it } from "vitest";

import {
  alertNavigationTarget,
  DASHBOARD_TABS,
} from "@/app/dashboard/navigation";

describe("navegación simplificada del dashboard", () => {
  it("expone únicamente los cinco módulos autorizados", () => {
    expect(DASHBOARD_TABS).toEqual([
      { id: "resumen", label: "Resumen operativo" },
      { id: "alertas", label: "Alertas operativas" },
      { id: "centros", label: "Centros" },
      { id: "inventario", label: "Inventario" },
      { id: "voluntarios", label: "Voluntarios" },
    ]);
  });

  it("dirige alertas de voluntariado al centro y módulo correspondientes", () => {
    expect(alertNavigationTarget("voluntariado_insuficiente", "C03")).toEqual({
      tab: "voluntarios",
      centerId: "C03",
    });
    expect(alertNavigationTarget("voluntariado_insuficiente", "C05")).toEqual({
      tab: "voluntarios",
      centerId: "C05",
    });
  });

  it("evita dirigir otras alertas hacia pestañas ocultas", () => {
    expect(alertNavigationTarget("donacion_retrasada", "C02")).toEqual({
      tab: "inventario",
      centerId: "C02",
    });
    expect(alertNavigationTarget("informacion_desactualizada", "C04")).toEqual({
      tab: "inventario",
      centerId: "C04",
    });
  });
});
