"use client";

import { useMemo, useState } from "react";

import type { MovementOperation } from "@/contracts/schemas/movement-operations";
import {
  ALERT_SEVERITIES,
  ALERT_TYPES,
  type AlertEvaluationResult,
  type AlertSeverity,
  type AlertType,
  type OperationalAlert,
} from "@/contracts/types/alerts";
import type { CenterFilter, DashboardTab } from "../types";
import type {
  ExcelReceptionImportResult,
  TestingScenarioResetResult,
} from "@/contracts/types/excel-receptions";
import { isWeeklyTestingScenario } from "@/lib/operational-scenarios";
import type {
  DashboardCenter,
  ProductRecord,
  SnapshotRecord,
} from "../types";
import { ExcelReceptionImporter } from "./excel-reception-importer";
import {
  groupOperationalAlerts,
  type AlertGroupId,
} from "../alert-groups";
import type {
  AlertReceptionContext,
  AlertResolutionSummary,
} from "../alert-resolution";
import { AlertResolutionModal } from "./alert-resolution-modal";

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

function AlertCard({
  alert,
  canResolve,
  onNavigate,
  onResolve,
}: {
  alert: OperationalAlert;
  canResolve: boolean;
  onNavigate: (
    tab: Exclude<DashboardTab, "resumen" | "alertas">,
    centerId: string,
  ) => void;
  onResolve: (alert: OperationalAlert) => void;
}) {
  const isSupplyOpportunity = alert.tipo === "excedente_transferible";
  const isProductDeficit = alert.tipo === "deficit_cobertura";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${severityStyles[alert.severidad]}`}
            >
              {severityLabels[alert.severidad]}
            </span>
            {isSupplyOpportunity ? (
              <span className="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-900">
                Oportunidad de abastecimiento
              </span>
            ) : null}
          </div>
          <h4 className="mt-3 text-lg font-semibold text-slate-950">
            {alert.titulo}
          </h4>
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
      {isProductDeficit ? (
        <div className="mt-4">
          <button
            className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            disabled={!canResolve}
            onClick={() => onResolve(alert)}
            type="button"
          >
            Solucionar alerta
          </button>
          {!canResolve ? (
            <p className="mt-2 text-xs text-slate-500">
              Las recepciones solo se guardan en el escenario PRUEBAS.
            </p>
          ) : null}
        </div>
      ) : (
        <button
          className="mt-4 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          onClick={() => onNavigate(targetTab(alert.tipo), alert.centro_id)}
          type="button"
        >
          Ver apartado relacionado
        </button>
      )}
    </article>
  );
}

export function AlertCenter({
  evaluation,
  dashboardCenters,
  initialCenterFilter,
  latestImportResult,
  openGroups,
  products,
  resolutionSummary,
  snapshot,
  onImportComplete,
  onNavigate,
  onOpenGroupsChange,
  onSaveReception,
  onResetComplete,
}: {
  evaluation: AlertEvaluationResult;
  dashboardCenters: readonly DashboardCenter[];
  initialCenterFilter: CenterFilter;
  latestImportResult: ExcelReceptionImportResult | null;
  openGroups: readonly AlertGroupId[];
  products: readonly ProductRecord[];
  resolutionSummary: AlertResolutionSummary | null;
  snapshot: SnapshotRecord;
  onImportComplete: (result: ExcelReceptionImportResult) => void;
  onOpenGroupsChange: (groups: AlertGroupId[]) => void;
  onSaveReception: (
    update: MovementOperation,
    context: AlertReceptionContext,
  ) => Promise<void>;
  onResetComplete: (result: TestingScenarioResetResult) => void;
  onNavigate: (
    tab: Exclude<DashboardTab, "resumen" | "alertas">,
    centerId: string,
  ) => void;
}) {
  const [severity, setSeverity] = useState<"all" | AlertSeverity>("all");
  const [type, setType] = useState<"all" | AlertType>("all");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const centerAlerts = useMemo(
    () =>
      evaluation.alertas.filter(
        (alert) =>
          initialCenterFilter === "all" ||
          alert.centro_id === initialCenterFilter,
      ),
    [evaluation.alertas, initialCenterFilter],
  );
  const filtered = useMemo(
    () =>
      centerAlerts.filter(
        (alert) =>
          (severity === "all" || alert.severidad === severity) &&
          (type === "all" || alert.tipo === type),
      ),
    [centerAlerts, severity, type],
  );
  const groups = useMemo(() => groupOperationalAlerts(filtered), [filtered]);
  const summaryCards = useMemo(() => {
    if (initialCenterFilter === "all") {
      return [
        ["Alertas activas", evaluation.total],
        ["Críticas", evaluation.por_severidad.critica],
        ["Advertencias", evaluation.por_severidad.advertencia],
        ["Centros con atención", evaluation.centros_que_requieren_atencion],
      ] as const;
    }
    return [
      ["Alertas activas", centerAlerts.length],
      [
        "Críticas",
        centerAlerts.filter((alert) => alert.severidad === "critica").length,
      ],
      [
        "Advertencias",
        centerAlerts.filter((alert) => alert.severidad === "advertencia")
          .length,
      ],
    ] as const;
  }, [centerAlerts, evaluation, initialCenterFilter]);
  const unknownTemporalInformation =
    initialCenterFilter === "all"
      ? evaluation.informacion_temporal_desconocida
      : evaluation.informacion_temporal_desconocida.filter(
          (item) => item.centro_id === initialCenterFilter,
        );

  function toggleGroup(groupId: AlertGroupId) {
    onOpenGroupsChange(
      openGroups.includes(groupId)
        ? openGroups.filter((item) => item !== groupId)
        : [...openGroups, groupId],
    );
  }

  const selectedAlert = selectedAlertId
    ? evaluation.alertas.find((alert) => alert.alerta_id === selectedAlertId)
    : undefined;
  const selectedDashboardProduct = selectedAlert?.producto_id
    ? dashboardCenters
        .find((item) => item.centro_id === selectedAlert.centro_id)
        ?.productos.find(
          (item) => item.producto_id === selectedAlert.producto_id,
        )
    : undefined;
  const selectedProduct = selectedAlert?.producto_id
    ? products.find((item) => item.producto_id === selectedAlert.producto_id)
    : undefined;
  const canResolve = isWeeklyTestingScenario(snapshot);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-slate-200 pb-3">
        <h2 className="text-xl font-semibold text-slate-950">
          Alertas operativas
        </h2>
        <p className="text-sm text-slate-600">
          — Evaluación: {formatDate(evaluation.evaluado_en)}
        </p>
      </div>

      <section
        aria-label="Resumen de alertas"
        className={`grid gap-3 sm:grid-cols-2 ${
          initialCenterFilter === "all" ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        {summaryCards.map(([label, value]) => (
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

      {resolutionSummary ? (
        <section
          aria-live="polite"
          className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 shadow-sm"
        >
          <h3 className="font-semibold">Actualización registrada</h3>
          <p className="mt-1 text-sm">
            {resolutionSummary.centerName} · {resolutionSummary.productName} ·{" "}
            {resolutionSummary.packagesReceived} paquetes de{" "}
            {resolutionSummary.presentationName}.
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-emerald-700">Inventario</dt>
              <dd className="font-semibold">
                {numberFormatter.format(resolutionSummary.previousInventory)} →{" "}
                {numberFormatter.format(resolutionSummary.newInventory)}{" "}
                {resolutionSummary.unit}
              </dd>
            </div>
            <div>
              <dt className="text-emerald-700">Cobertura</dt>
              <dd className="font-semibold">
                {resolutionSummary.previousCoverage === null
                  ? "N/D"
                  : `${numberFormatter.format(resolutionSummary.previousCoverage)} %`}{" "}
                →{" "}
                {resolutionSummary.newCoverage === null
                  ? "N/D"
                  : `${numberFormatter.format(resolutionSummary.newCoverage)} %`}
              </dd>
            </div>
            <div>
              <dt className="text-emerald-700">Déficit restante</dt>
              <dd className="font-semibold">
                {numberFormatter.format(resolutionSummary.remainingDeficit)}{" "}
                {resolutionSummary.unit}
              </dd>
            </div>
            <div>
              <dt className="text-emerald-700">Resultado</dt>
              <dd className="font-semibold">
                {resolutionSummary.outcome === "resolved"
                  ? "Alerta de déficit resuelta"
                  : resolutionSummary.outcome === "reduced"
                    ? "Severidad reducida"
                    : "La alerta continúa activa"}
              </dd>
            </div>
          </dl>
          {resolutionSummary.grossSurplus > 0 ? (
            <p className="mt-3 text-sm font-medium">
              Excedente bruto: {numberFormatter.format(resolutionSummary.grossSurplus)}{" "}
              {resolutionSummary.unit}.
            </p>
          ) : null}
          {resolutionSummary.idempotent ? (
            <p className="mt-2 text-xs text-emerald-800">
              La operación ya existía y fue reutilizada sin duplicar inventario.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
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

      {unknownTemporalInformation.length > 0 ? (
        <p className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Información temporal desconocida para{" "}
          {unknownTemporalInformation.length} combinaciones de
          centro y producto. No se generaron alertas de desactualización sin
          evidencia válida.
        </p>
      ) : null}

      <section aria-label="Grupos de alertas" className="space-y-3">
        {groups.map((group) => {
          const isOpen = openGroups.includes(group.id);
          const panelId = `alert-group-${group.id}`;
          return (
            <article
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              key={group.id}
            >
              <button
                aria-controls={panelId}
                aria-expanded={isOpen}
                className="grid w-full gap-4 p-5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                onClick={() => toggleGroup(group.id)}
                type="button"
              >
                <span>
                  <span className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-semibold text-slate-950">
                      {group.name}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                        group.maximumSeverity
                          ? severityStyles[group.maximumSeverity]
                          : "border-slate-300 bg-slate-100 text-slate-700"
                      }`}
                    >
                      {group.maximumSeverity
                        ? `Máxima: ${severityLabels[group.maximumSeverity]}`
                        : "Sin alertas"}
                    </span>
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-slate-600">
                    {group.description}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 md:justify-end">
                  <span>
                    <strong className="text-slate-950">{group.alerts.length}</strong>{" "}
                    activas
                  </span>
                  <span>
                    <strong className="text-slate-950">{group.criticalCount}</strong>{" "}
                    críticas
                  </span>
                  <span>
                    <strong className="text-slate-950">
                      {group.affectedCenters}
                    </strong>{" "}
                    centros
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-xl font-semibold text-blue-700"
                  >
                    {isOpen ? "−" : "+"}
                  </span>
                </span>
              </button>

              {isOpen ? (
                <div
                  className="border-t border-slate-200 bg-slate-50 p-4 sm:p-5"
                  id={panelId}
                >
                  {group.alerts.length === 0 ? (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-900">
                      Sin alertas en este grupo para los filtros seleccionados.
                    </p>
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-2">
                      {group.alerts.map((alert) => (
                        <AlertCard
                          alert={alert}
                          canResolve={canResolve}
                          key={alert.alerta_id}
                          onNavigate={onNavigate}
                          onResolve={(item) =>
                            setSelectedAlertId(item.alerta_id)
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <ExcelReceptionImporter
        latestResult={latestImportResult}
        onImportComplete={onImportComplete}
        onResetComplete={onResetComplete}
        snapshot={snapshot}
      />

      {selectedAlert && selectedDashboardProduct && selectedProduct ? (
        <AlertResolutionModal
          alert={selectedAlert}
          dashboardProduct={selectedDashboardProduct}
          evaluationTime={evaluation.evaluado_en}
          onCancel={() => setSelectedAlertId(null)}
          onSave={onSaveReception}
          product={selectedProduct}
        />
      ) : null}
    </div>
  );
}
