import type { InventoryComparisonRow } from "../view-model";
import {
  ChartCard,
  ChartLegend,
  EmptyChart,
  MetricBar,
  formatChartValue,
} from "./chart-primitives";

export function InventoryNeedsChart({
  rows,
}: {
  rows: InventoryComparisonRow[];
}) {
  const maximum = Math.max(
    1,
    ...rows.flatMap((row) => [row.inventario_confirmado, row.necesidad_vigente]),
  );

  return (
    <ChartCard
      description="Compara inventario físico confirmado y necesidad vigente para un solo producto y una sola unidad."
      legend={
        <ChartLegend
          items={[
            { label: "Confirmado", colorClass: "bg-blue-600" },
            { label: "Necesidad", colorClass: "bg-slate-400" },
          ]}
        />
      }
      title="Inventario frente a necesidades"
    >
      {rows.length === 0 ? (
        <EmptyChart message="No hay registros para este producto y filtro." />
      ) : (
        <div className="space-y-5">
          {rows.map((row) => (
            <div key={`${row.centro_id}-${row.producto_id}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-medium text-slate-900">
                    {row.centro_nombre}
                  </span>
                  <span className="ml-2 font-mono text-xs text-slate-500">
                    {row.centro_id}
                  </span>
                </div>
                {row.deficit_confirmado !== null && row.deficit_confirmado > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Déficit {formatChartValue(row.deficit_confirmado, row.unidad)}
                  </span>
                ) : null}
              </div>
              <div className="space-y-2.5">
                <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-xs">
                  <span className="text-slate-600">Confirmado</span>
                  <MetricBar
                    colorClass="bg-blue-600"
                    label={`${row.centro_nombre}: ${formatChartValue(row.inventario_confirmado, row.unidad)} confirmados`}
                    maximum={maximum}
                    value={row.inventario_confirmado}
                  />
                  <strong className="min-w-20 text-right tabular-nums text-slate-800">
                    {formatChartValue(row.inventario_confirmado, row.unidad)}
                  </strong>
                </div>
                <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-xs">
                  <span className="text-slate-600">Necesidad</span>
                  <MetricBar
                    colorClass="bg-slate-400"
                    label={`${row.centro_nombre}: ${formatChartValue(row.necesidad_vigente, row.unidad)} requeridos`}
                    maximum={maximum}
                    value={row.necesidad_vigente}
                  />
                  <strong className="min-w-20 text-right tabular-nums text-slate-800">
                    {formatChartValue(row.necesidad_vigente, row.unidad)}
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
