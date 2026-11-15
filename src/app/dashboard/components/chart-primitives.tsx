import type { ReactNode } from "react";

const numberFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
});

export function formatChartNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatChartValue(value: number, unit: string) {
  const suffix = unit === "unidad" && value !== 1 ? "unidades" : unit;
  return `${formatChartNumber(value)} ${suffix}`;
}

export function ChartCard({
  title,
  description,
  legend,
  children,
}: {
  title: string;
  description: string;
  legend?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-950">
            {title}
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>
        {legend ? <div className="shrink-0">{legend}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </article>
  );
}

export function ChartLegend({
  items,
}: {
  items: ReadonlyArray<{ label: string; colorClass: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-600">
      {items.map((item) => (
        <span className="inline-flex items-center gap-2" key={item.label}>
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${item.colorClass}`}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function EmptyChart({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-600">
      {message}
    </div>
  );
}

export function MetricBar({
  value,
  maximum,
  colorClass,
  label,
}: {
  value: number;
  maximum: number;
  colorClass: string;
  label: string;
}) {
  const width = maximum > 0 ? Math.min(100, Math.max(0, (value / maximum) * 100)) : 0;

  return (
    <div
      aria-label={label}
      className="h-2.5 overflow-hidden rounded-full bg-slate-100"
      role="img"
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${colorClass}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
