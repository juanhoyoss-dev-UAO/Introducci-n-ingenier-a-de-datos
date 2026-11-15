import type { ConfirmedExpectedPoint } from "@/contracts/types/analytics";
import {
  ChartCard,
  ChartLegend,
  EmptyChart,
  MetricBar,
  formatChartValue,
} from "./chart-primitives";

export function ResourcesChart({ rows }: { rows: ConfirmedExpectedPoint[] }) {
  const maximum = Math.max(
    1,
    ...rows.flatMap((row) => [row.recursos_confirmados, row.recursos_esperados]),
  );

  return (
    <ChartCard
      description="Los recursos anunciados permanecen separados y no se suman al inventario confirmado."
      legend={
        <ChartLegend
          items={[
            { label: "Inventario confirmado", colorClass: "bg-emerald-600" },
            { label: "Anunciado, aún no recibido", colorClass: "bg-violet-500" },
          ]}
        />
      }
      title="Recursos confirmados frente a esperados"
    >
      {rows.length === 0 ? (
        <EmptyChart message="No hay recursos confirmados o esperados para este filtro." />
      ) : (
        <div className="space-y-5">
          {rows.map((row) => (
            <div key={`${row.centro_id}-${row.producto_id}`}>
              <div className="mb-2 text-sm">
                <span className="font-medium text-slate-900">
                  {row.centro_nombre}
                </span>
                <span className="ml-2 font-mono text-xs text-slate-500">
                  {row.centro_id}
                </span>
              </div>
              <div className="space-y-2.5">
                <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-xs">
                  <span className="text-slate-600">Confirmado</span>
                  <MetricBar
                    colorClass="bg-emerald-600"
                    label={`${row.centro_nombre}: ${formatChartValue(row.recursos_confirmados, row.unidad)} confirmados`}
                    maximum={maximum}
                    value={row.recursos_confirmados}
                  />
                  <strong className="min-w-20 text-right tabular-nums text-slate-800">
                    {formatChartValue(row.recursos_confirmados, row.unidad)}
                  </strong>
                </div>
                <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-xs">
                  <span className="text-slate-600">Esperado</span>
                  <MetricBar
                    colorClass="bg-violet-500"
                    label={`${row.centro_nombre}: ${formatChartValue(row.recursos_esperados, row.unidad)} anunciados`}
                    maximum={maximum}
                    value={row.recursos_esperados}
                  />
                  <strong className="min-w-20 text-right tabular-nums text-slate-800">
                    {formatChartValue(row.recursos_esperados, row.unidad)}
                  </strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}
