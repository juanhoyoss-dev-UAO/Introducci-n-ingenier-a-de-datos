import type { AlertType } from "@/contracts/types/alerts";
import type { DashboardTab } from "./types";

export type VisibleDashboardTab = Extract<
  DashboardTab,
  | "resumen"
  | "alertas"
  | "centros"
  | "inventario"
  | "voluntarios"
  | "donaciones"
>;

export type AlertNavigationTab = Extract<
  VisibleDashboardTab,
  "centros" | "inventario" | "voluntarios" | "donaciones"
>;

export const DASHBOARD_TABS: ReadonlyArray<{
  id: VisibleDashboardTab;
  label: string;
}> = [
  { id: "resumen", label: "Resumen operativo" },
  { id: "alertas", label: "Alertas operativas" },
  { id: "centros", label: "Centros" },
  { id: "inventario", label: "Inventario" },
  { id: "voluntarios", label: "Voluntarios" },
  { id: "donaciones", label: "Donaciones esperadas" },
];

export function alertNavigationTarget(
  type: AlertType,
  centerId: string,
): { tab: AlertNavigationTab; centerId: string } {
  return {
    tab:
      type === "voluntariado_insuficiente"
        ? "voluntarios"
        : type === "donacion_retrasada"
          ? "donaciones"
          : "inventario",
    centerId,
  };
}
