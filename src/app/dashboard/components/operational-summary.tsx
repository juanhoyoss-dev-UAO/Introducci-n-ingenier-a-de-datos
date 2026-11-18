import type { CenterFilter, DashboardBundle } from "../types";
import {
  ALL_PRODUCTS_FILTER,
  coverageChartRows,
  coverageMatrixRows,
  deriveOperationalSummary,
  inventoryComparisonRows,
  operationalSummaryVisualizationState,
  productCoverageRows,
  volunteerComparisonRows,
} from "../view-model";
import { CoverageChart } from "./coverage-chart";
import { CoverageMatrix } from "./coverage-matrix";
import { InventoryNeedsChart } from "./inventory-needs-chart";
import { MetricCards } from "./metric-cards";
import { ProductCoverageChart } from "./product-coverage-chart";
import { VolunteerChart } from "./volunteer-chart";

export function OperationalSummary({
  bundle,
  centerFilter,
  productId,
}: {
  bundle: DashboardBundle;
  centerFilter: CenterFilter;
  productId: string;
}) {
  const summary = deriveOperationalSummary(bundle, centerFilter);
  const showAllProducts = productId === ALL_PRODUCTS_FILTER;
  const visualization = operationalSummaryVisualizationState(
    centerFilter,
    productId,
  );
  const product = bundle.products.find((item) => item.producto_id === productId);
  const coverageMatrix = coverageMatrixRows(bundle, centerFilter);
  const productCoverage = visualization.mostrarCoberturaProductos
    ? productCoverageRows(bundle, centerFilter)
    : [];
  const coverageRows = coverageChartRows(bundle, centerFilter, productId);
  const inventoryRows = inventoryComparisonRows(
    bundle,
    centerFilter,
    productId,
  );
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
              snapshot seleccionado. Producto visible: {showAllProducts
                ? "todos los productos"
                : (product?.nombre ?? "sin selección")}.
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

      <MetricCards
        showCentersWithAttention={centerFilter === "all"}
        summary={summary}
      />

      {visualization.mostrarMatriz ? (
        <CoverageMatrix matrix={coverageMatrix} />
      ) : null}

      {visualization.mostrarCoberturaProductos ? (
        <ProductCoverageChart rows={productCoverage} />
      ) : null}

      {visualization.mostrarVoluntarios ? (
        <VolunteerChart rows={volunteerRows} />
      ) : null}

      {visualization.mostrarGraficosIndividuales ? (
        <section
          aria-label="Gráficos comparativos"
          className="grid gap-5 xl:grid-cols-2"
        >
          <CoverageChart rows={coverageRows} />
          <InventoryNeedsChart rows={inventoryRows} />
        </section>
      ) : null}
    </div>
  );
}
