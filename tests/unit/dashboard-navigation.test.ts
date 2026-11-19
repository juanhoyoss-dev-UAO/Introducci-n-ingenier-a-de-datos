import { describe, expect, it } from "vitest";

import {
  alertNavigationTarget,
  DASHBOARD_TABS,
} from "@/app/dashboard/navigation";

describe("navegación simplificada del dashboard", () => {
  it("expone los módulos operativos, incluida la gestión de donaciones", () => {
    expect(DASHBOARD_TABS).toEqual([
      { id: "resumen", label: "Resumen operativo" },
      { id: "alertas", label: "Alertas operativas" },
      { id: "centros", label: "Centros" },
      { id: "inventario", label: "Inventario" },
      { id: "voluntarios", label: "Voluntarios" },
      { id: "donaciones", label: "Donaciones esperadas" },
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

  it("dirige las donaciones retrasadas a su módulo y conserva los demás destinos", () => {
    expect(alertNavigationTarget("donacion_retrasada", "C02")).toEqual({
      tab: "donaciones",
      centerId: "C02",
    });
    expect(alertNavigationTarget("informacion_desactualizada", "C04")).toEqual({
      tab: "inventario",
      centerId: "C04",
    });
  });
});
