import type { OperationalSummary } from "../view-model";
import { formatChartNumber } from "./chart-primitives";

export function MetricCards({ summary }: { summary: OperationalSummary }) {
  const metrics = [
    { label: "Centros activos", value: summary.centrosActivos },
    { label: "Centros con déficit", value: summary.centrosConDeficit },
    { label: "Productos", value: summary.productos },
    { label: "Con necesidades", value: summary.centrosConNecesidades },
    { label: "Donaciones pendientes", value: summary.donacionesPendientes },
    {
      label: "Con personal faltante",
      value: summary.centrosConVoluntariosFaltantes,
    },
    { label: "Alertas activas", value: summary.alertasActivas },
    { label: "Alertas críticas", value: summary.alertasCriticas },
    {
      label: "Centros con atención",
      value: summary.centrosQueRequierenAtencion,
    },
  ];

  return (
    <section
      aria-label="Indicadores del resumen operativo"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      {metrics.map((metric) => (
        <article
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          key={metric.label}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {metric.label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 tabular-nums">
            {formatChartNumber(metric.value)}
          </p>
        </article>
      ))}
    </section>
  );
}
