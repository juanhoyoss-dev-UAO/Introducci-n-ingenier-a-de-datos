import type {
  CenterFilter,
  DashboardBundle,
  DashboardTab,
} from "../types";
import {
  coverageChartRows,
  deriveOperationalSummary,
  inventoryComparisonRows,
  resourceComparisonRows,
  volunteerComparisonRows,
} from "../view-model";
import { CoverageChart } from "./coverage-chart";
import { InventoryNeedsChart } from "./inventory-needs-chart";
import { MetricCards } from "./metric-cards";
import { ResourcesChart } from "./resources-chart";
import { VolunteerChart } from "./volunteer-chart";

const DETAIL_LINKS: ReadonlyArray<{
  id: Exclude<DashboardTab, "resumen">;
  label: string;
  description: string;
}> = [
  { id: "centros", label: "Centros", description: "Estado y coordinación" },
  {
    id: "inventario",
    label: "Inventario",
    description: "Paquetes y presentaciones",
  },
  {
    id: "necesidades",
    label: "Necesidades",
    description: "Objetivos, déficit y prioridad",
  },
  {
    id: "voluntarios",
    label: "Voluntarios",
    description: "Disponibles y requeridos",
  },
  {
    id: "donaciones",
    label: "Donaciones",
    description: "Recursos pendientes",
  },
  {
    id: "tiempos",
    label: "Tiempos",
    description: "Traslados dirigidos",
  },
];

export function OperationalSummary({
  bundle,
  centerFilter,
  productId,
  onOpenTab,
}: {
  bundle: DashboardBundle;
  centerFilter: CenterFilter;
  productId: string;
  onOpenTab: (tab: Exclude<DashboardTab, "resumen">) => void;
}) {
  const summary = deriveOperationalSummary(bundle, centerFilter);
  const product = bundle.products.find((item) => item.producto_id === productId);
  const coverageRows = coverageChartRows(bundle, centerFilter, productId);
  const inventoryRows = inventoryComparisonRows(
    bundle,
    centerFilter,
    productId,
  );
  const resourceRows = resourceComparisonRows(bundle, centerFilter, productId);
  const volunteerRows = volunteerComparisonRows(bundle, centerFilter);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-sm">
        <div className="grid gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Situación del snapshot
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Resumen operativo
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Comparación de recursos, necesidades y personal con datos del
              snapshot seleccionado. Producto visible: {product?.nombre ?? "sin selección"}.
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 lg:max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Mayor número de productos con déficit
            </p>
            {summary.atencion ? (
              <div className="mt-2">
                <p className="font-semibold text-white">
                  {summary.atencion.centro_nombre}
                  <span className="ml-2 font-mono text-xs text-slate-400">
                    {summary.atencion.centro_id}
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {summary.atencion.productosConDeficit} productos con déficit
                  {summary.atencion.voluntariosFaltantes > 0
                    ? ` · ${summary.atencion.voluntariosFaltantes} voluntarios faltantes`
                    : " · personal cubierto"}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-300">
                No hay déficit confirmado ni personal faltante en el filtro.
              </p>
            )}
          </div>
        </div>
      </section>

      <MetricCards summary={summary} />

      <section
        aria-label="Gráficos comparativos"
        className="grid gap-5 xl:grid-cols-2"
      >
        <CoverageChart rows={coverageRows} />
        <VolunteerChart rows={volunteerRows} />
        <InventoryNeedsChart rows={inventoryRows} />
        <ResourcesChart rows={resourceRows} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-950">
            Consultar detalle
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Las seis secciones originales conservan sus tablas y el filtro de
            centro actual.
          </p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DETAIL_LINKS.map((link) => (
            <button
              className="rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              key={link.id}
              onClick={() => onOpenTab(link.id)}
              type="button"
            >
              <span className="block text-sm font-semibold text-slate-950">
                {link.label}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {link.description}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
