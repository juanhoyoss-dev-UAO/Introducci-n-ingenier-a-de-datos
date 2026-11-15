import type { VolunteerComparisonRow } from "../view-model";
import {
  ChartCard,
  ChartLegend,
  EmptyChart,
  MetricBar,
  formatChartNumber,
} from "./chart-primitives";

export function VolunteerChart({ rows }: { rows: VolunteerComparisonRow[] }) {
  const maximum = Math.max(
    1,
    ...rows.flatMap((row) => [row.disponibles, row.requeridos]),
  );

  return (
    <ChartCard
      description="Compara personas disponibles y requeridas sin crear nuevas reglas de gestión."
      legend={
        <ChartLegend
          items={[
            { label: "Disponibles", colorClass: "bg-cyan-600" },
            { label: "Requeridos", colorClass: "bg-slate-400" },
          ]}
        />
      }
      title="Disponibilidad de voluntarios"
    >
      {rows.length === 0 ? (
        <EmptyChart message="No hay datos de voluntariado para este filtro." />
      ) : (
        <div className="space-y-5">
          {rows.map((row) => (
            <div key={row.centro_id}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-medium text-slate-900">
                    {row.centro_nombre}
                  </span>
                  <span className="ml-2 font-mono text-xs text-slate-500">
                    {row.centro_id}
                  </span>
                </div>
                {row.faltantes > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Faltan {formatChartNumber(row.faltantes)}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    Requerimiento cubierto
                  </span>
                )}
              </div>
              <div className="space-y-2.5">
                <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-xs">
                  <span className="text-slate-600">Disponibles</span>
                  <MetricBar
                    colorClass={row.faltantes > 0 ? "bg-amber-500" : "bg-cyan-600"}
                    label={`${row.centro_nombre}: ${formatChartNumber(row.disponibles)} voluntarios disponibles`}
                    maximum={maximum}
                    value={row.disponibles}
                  />
                  <strong className="min-w-10 text-right tabular-nums text-slate-800">
                    {formatChartNumber(row.disponibles)}
                  </strong>
                </div>
                <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-xs">
                  <span className="text-slate-600">Requeridos</span>
                  <MetricBar
                    colorClass="bg-slate-400"
                    label={`${row.centro_nombre}: ${formatChartNumber(row.requeridos)} voluntarios requeridos`}
                    maximum={maximum}
                    value={row.requeridos}
                  />
                  <strong className="min-w-10 text-right tabular-nums text-slate-800">
                    {formatChartNumber(row.requeridos)}
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
