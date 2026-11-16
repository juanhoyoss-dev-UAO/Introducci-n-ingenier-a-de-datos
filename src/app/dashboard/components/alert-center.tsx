"use client";

import { useMemo, useState } from "react";

import {
  ALERT_SEVERITIES,
  ALERT_TYPES,
  type AlertEvaluationResult,
  type AlertSeverity,
  type AlertType,
  type OperationalAlert,
} from "@/contracts/types/alerts";
import type { CenterFilter, CenterRecord, DashboardTab } from "../types";

const severityLabels: Record<AlertSeverity, string> = {
  critica: "Crítica",
  advertencia: "Advertencia",
  informativa: "Informativa",
};

const typeLabels: Record<AlertType, string> = {
  deficit_cobertura: "Cobertura de necesidades",
  voluntariado_insuficiente: "Voluntariado",
  donacion_retrasada: "Donación retrasada",
  informacion_desactualizada: "Información desactualizada",
  capacidad: "Capacidad",
  excedente_transferible: "Excedente transferible",
};

const severityStyles: Record<AlertSeverity, string> = {
  critica: "border-rose-300 bg-rose-50 text-rose-900",
  advertencia: "border-amber-300 bg-amber-50 text-amber-900",
  informativa: "border-blue-300 bg-blue-50 text-blue-900",
};

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

const numberFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function formatObserved(alert: OperationalAlert) {
  const value = numberFormatter.format(alert.valor_observado);
  if (alert.unidad === "porcentaje") return `${value} %`;
  if (alert.unidad === "persona") {
    return `${value} ${alert.valor_observado === 1 ? "persona" : "personas"}`;
  }
  if (alert.unidad === "minuto") {
    return `${value} ${alert.valor_observado === 1 ? "minuto" : "minutos"}`;
  }
  if (alert.unidad === "unidad") {
    return `${value} ${alert.valor_observado === 1 ? "unidad" : "unidades"}`;
  }
  return `${value} ${alert.unidad}`;
}

function targetTab(
  type: AlertType,
): Exclude<DashboardTab, "resumen" | "alertas"> {
  if (type === "deficit_cobertura") return "necesidades";
  if (type === "voluntariado_insuficiente") return "voluntarios";
  if (type === "donacion_retrasada") return "donaciones";
  return "inventario";
}

export function AlertCenter({
  evaluation,
  centers,
  initialCenterFilter,
  onNavigate,
}: {
  evaluation: AlertEvaluationResult;
  centers: readonly CenterRecord[];
  initialCenterFilter: CenterFilter;
  onNavigate: (
    tab: Exclude<DashboardTab, "resumen" | "alertas">,
    centerId: string,
  ) => void;
}) {
  const [center, setCenter] = useState<CenterFilter>(initialCenterFilter);
  const [severity, setSeverity] = useState<"all" | AlertSeverity>("all");
  const [type, setType] = useState<"all" | AlertType>("all");
  const filtered = useMemo(
    () =>
      evaluation.alertas.filter(
        (alert) =>
          (center === "all" || alert.centro_id === center) &&
          (severity === "all" || alert.severidad === severity) &&
          (type === "all" || alert.tipo === type),
      ),
    [center, evaluation.alertas, severity, type],
  );

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-sm">
        <div className="grid gap-5 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Monitoreo derivado del snapshot
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Alertas operativas
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Condiciones activas calculadas sin modificar datos. La evaluación
              usa una hora explícita y mantiene donaciones pendientes separadas
              del inventario confirmado.
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Evaluado en America/Bogota
            </p>
            <p className="mt-2 font-semibold text-white">
              {formatDate(evaluation.evaluado_en)}
            </p>
          </div>
        </div>
      </section>

      <section
        aria-label="Resumen de alertas"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          ["Alertas activas", evaluation.total],
          ["Críticas", evaluation.por_severidad.critica],
          ["Advertencias", evaluation.por_severidad.advertencia],
          ["Centros con atención", evaluation.centros_que_requieren_atencion],
        ].map(([label, value]) => (
          <article
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            key={label}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {label}
            </p>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-950">
              {value}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Centro
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setCenter(event.target.value)}
              value={center}
            >
              <option value="all">Todos los centros</option>
              {centers.map((item) => (
                <option key={item.centro_id} value={item.centro_id}>
                  {item.centro_id} · {item.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Severidad
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              onChange={(event) =>
                setSeverity(event.target.value as "all" | AlertSeverity)
              }
              value={severity}
            >
              <option value="all">Todas las severidades</option>
              {ALERT_SEVERITIES.map((item) => (
                <option key={item} value={item}>
                  {severityLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Tipo de alerta
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              onChange={(event) =>
                setType(event.target.value as "all" | AlertType)
              }
              value={type}
            >
              <option value="all">Todos los tipos</option>
              {ALERT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {typeLabels[item]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {evaluation.informacion_temporal_desconocida.length > 0 ? (
        <p className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Información temporal desconocida para{" "}
          {evaluation.informacion_temporal_desconocida.length} combinaciones de
          centro y producto. No se generaron alertas de desactualización sin
          evidencia válida.
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-10 text-center">
          <h3 className="font-semibold text-emerald-950">
            Sin alertas para los filtros seleccionados
          </h3>
          <p className="mt-2 text-sm text-emerald-800">
            Cambia los filtros o selecciona otro snapshot para consultar su estado.
          </p>
        </section>
      ) : (
        <section
          aria-label="Detalle de alertas"
          className="grid gap-4 xl:grid-cols-2"
        >
          {filtered.map((alert) => (
            <article
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              key={alert.alerta_id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${severityStyles[alert.severidad]}`}
                  >
                    {severityLabels[alert.severidad]}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-slate-950">
                    {alert.titulo}
                  </h3>
                </div>
                <span className="font-mono text-xs font-semibold text-slate-500">
                  {alert.centro_id}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-800">
                {alert.centro_nombre}
                {alert.producto_nombre ? ` · ${alert.producto_nombre}` : ""}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {alert.descripcion}
              </p>
              <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Valor observado
                  </dt>
                  <dd className="mt-1 font-semibold text-slate-950">
                    {formatObserved(alert)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tipo
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-950">
                    {typeLabels[alert.tipo]}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 border-l-4 border-blue-600 pl-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Acción sugerida
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  {alert.accion_sugerida}
                </p>
              </div>
              <button
                className="mt-4 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                onClick={() => onNavigate(targetTab(alert.tipo), alert.centro_id)}
                type="button"
              >
                Ver apartado relacionado
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
