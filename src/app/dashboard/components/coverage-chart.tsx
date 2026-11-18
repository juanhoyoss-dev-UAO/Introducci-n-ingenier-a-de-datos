import type { CoverageByCenterPoint } from "@/contracts/types/analytics";
import {
  ChartCard,
  EmptyChart,
  MetricBar,
  formatChartNumber,
} from "./chart-primitives";

export function CoverageChart({ rows }: { rows: CoverageByCenterPoint[] }) {
  const calculable = rows.filter(
    (row): row is CoverageByCenterPoint & { cobertura_porcentaje: number } =>
      row.cobertura_porcentaje !== null,
  );
  const maximum = Math.max(
    100,
    ...calculable.map((row) => row.cobertura_porcentaje),
  );
  const minimum =
    calculable.length > 0
      ? Math.min(...calculable.map((row) => row.cobertura_porcentaje))
      : null;

  return (
    <ChartCard
      description="Porcentaje confirmado frente a la necesidad del producto seleccionado. No se promedian centros ni productos."
      title="Cobertura por centro"
    >
      {rows.length === 0 ? (
        <EmptyChart message="No hay datos de cobertura para este producto y filtro." />
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const value = row.cobertura_porcentaje;
            const isMinimum = value !== null && value === minimum;
            return (
              <div key={`${row.centro_id}-${row.producto_id}`}>
                <div className="mb-2 flex items-end justify-between gap-3 text-sm">
                  <div>
                    <span className="font-medium text-slate-900">
                      {row.centro_nombre}
                    </span>
                    <span className="ml-2 font-mono text-xs text-slate-500">
                      {row.centro_id}
                    </span>
                    {isMinimum ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        Menor cobertura
                      </span>
                    ) : null}
                    {value === null ? (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        Sin necesidad declarada
                      </span>
                    ) : null}
                  </div>
                  <strong className="shrink-0 tabular-nums text-slate-950">
                    {value === null
                      ? "0 %"
                      : `${formatChartNumber(value)} %`}
                  </strong>
                </div>
                {value === null ? (
                  <div className="h-2.5 rounded-full border border-dashed border-slate-300 bg-slate-50" />
                ) : (
                  <MetricBar
                    colorClass={isMinimum ? "bg-amber-500" : "bg-blue-600"}
                    label={`${row.centro_nombre}: ${formatChartNumber(value)} por ciento de cobertura`}
                    maximum={maximum}
                    value={value}
                  />
                )}
              </div>
            );
          })}
          <p className="text-xs text-slate-500">
            Escala del gráfico: 0 a {formatChartNumber(maximum)} %. Los valores
            superiores a 100 % se conservan.
          </p>
        </div>
      )}
    </ChartCard>
  );
}
