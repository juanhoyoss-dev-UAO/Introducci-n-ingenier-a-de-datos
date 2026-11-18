import type {
  CoverageMatrixCell,
  CoverageMatrixState,
} from "../view-model";
import {
  ChartCard,
  ChartLegend,
  EmptyChart,
  MetricBar,
  formatChartNumber,
  formatChartValue,
} from "./chart-primitives";

const STATE_PRESENTATION: Record<
  CoverageMatrixState,
  { label: string; barClassName: string; badgeClassName: string }
> = {
  deficit_importante: {
    label: "Déficit importante",
    barClassName: "bg-rose-500",
    badgeClassName: "bg-rose-100 text-rose-800",
  },
  deficit_parcial: {
    label: "Déficit parcial",
    barClassName: "bg-amber-500",
    badgeClassName: "bg-amber-100 text-amber-800",
  },
  cubierta: {
    label: "Necesidad cubierta",
    barClassName: "bg-emerald-600",
    badgeClassName: "bg-emerald-100 text-emerald-800",
  },
  excedente: {
    label: "Excedente",
    barClassName: "bg-cyan-600",
    badgeClassName: "bg-cyan-100 text-cyan-800",
  },
  sin_necesidad: {
    label: "Sin necesidad declarada",
    barClassName: "bg-slate-400",
    badgeClassName: "bg-slate-100 text-slate-700",
  },
};

export function ProductCoverageChart({
  rows,
}: {
  rows: CoverageMatrixCell[];
}) {
  const maximum = Math.max(
    100,
    ...rows.flatMap((row) =>
      row.cobertura_porcentaje === null ? [] : [row.cobertura_porcentaje],
    ),
  );
  const center = rows[0];

  return (
    <ChartCard
      description={
        center
          ? `Cobertura de todos los productos en ${center.centro_nombre}. Cada barra conserva la unidad propia del producto.`
          : "Cobertura de todos los productos del centro seleccionado."
      }
      legend={
        <ChartLegend
          items={[
            { label: "Déficit", colorClass: "bg-rose-500" },
            { label: "Cubierto", colorClass: "bg-emerald-600" },
            { label: "Excedente", colorClass: "bg-cyan-600" },
            { label: "Sin necesidad", colorClass: "bg-slate-400" },
          ]}
        />
      }
      title="Cobertura por producto"
    >
      {rows.length === 0 ? (
        <EmptyChart message="No hay productos para el centro seleccionado." />
      ) : (
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-2">
          {rows.map((row) => {
            const presentation = STATE_PRESENTATION[row.estado];
            const coverage = row.cobertura_porcentaje;
            return (
              <div
                className="rounded-xl border border-slate-200 p-3"
                key={`${row.centro_id}-${row.producto_id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                  <div>
                    <span className="font-medium text-slate-950">
                      {row.producto_nombre}
                    </span>
                    <span className="ml-2 font-mono text-xs text-slate-500">
                      {row.producto_id} · {row.unidad_base}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${presentation.badgeClassName}`}
                    >
                      {presentation.label}
                    </span>
                    <strong className="min-w-16 text-right tabular-nums text-slate-950">
                      {coverage === null
                        ? "0 %"
                        : `${formatChartNumber(coverage)} %`}
                    </strong>
                  </div>
                </div>
                <div className="mt-2.5">
                  {coverage === null ? (
                    <div
                      aria-label={`${row.producto_nombre}: cobertura no calculable porque no hay necesidad declarada`}
                      className="h-2.5 rounded-full border border-dashed border-slate-300 bg-slate-50"
                      role="img"
                    />
                  ) : (
                    <MetricBar
                      colorClass={presentation.barClassName}
                      label={`${row.producto_nombre}: ${formatChartNumber(coverage)} por ciento de cobertura`}
                      maximum={maximum}
                      value={coverage}
                    />
                  )}
                </div>
                <details className="mt-2 text-xs text-slate-600">
                  <summary className="cursor-pointer font-semibold text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                    Consultar cantidades
                  </summary>
                  <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3 sm:grid-cols-[auto_1fr]">
                    <dt className="font-semibold">Inventario confirmado</dt>
                    <dd className="tabular-nums">
                      {formatChartValue(
                        row.inventario_confirmado_unidad_base,
                        row.unidad_base,
                      )}
                    </dd>
                    <dt className="font-semibold">Necesidad vigente</dt>
                    <dd className="tabular-nums">
                      {formatChartValue(
                        row.objetivo_unidad_base,
                        row.unidad_base,
                      )}
                    </dd>
                    <dt className="font-semibold">Déficit</dt>
                    <dd className="tabular-nums">
                      {formatChartValue(
                        row.deficit_confirmado_unidad_base,
                        row.unidad_base,
                      )}
                    </dd>
                    <dt className="font-semibold">Excedente</dt>
                    <dd className="tabular-nums">
                      {formatChartValue(
                        row.excedente_transferible_unidad_base,
                        row.unidad_base,
                      )}
                    </dd>
                  </dl>
                </details>
              </div>
            );
          })}
          <p className="text-xs text-slate-500">
            Escala del gráfico: 0 a {formatChartNumber(maximum)} %. Los valores
            superiores a 100 % se muestran sin truncar.
          </p>
        </div>
      )}
    </ChartCard>
  );
}
