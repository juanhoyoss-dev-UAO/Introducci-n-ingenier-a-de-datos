"use client";

import { useEffect, useMemo, useState } from "react";

import type { TemporalAnalysisResult } from "@/contracts/types/temporal";
import { isWeeklyTestingScenario } from "@/lib/operational-scenarios";
import {
  WEEK_START,
  delayHistory,
  historyRange,
  inventoryHistory,
  movementEvents,
  movementHistory,
  type HistoryPeriod,
  type InventoryHistoryPoint,
  type MovementTemporalEvent,
} from "../operational-history";
import type {
  CenterFilter,
  CenterRecord,
  ProductRecord,
  SnapshotRecord,
} from "../types";
import {
  ChartCard,
  ChartLegend,
  EmptyChart,
  MetricBar,
  formatChartNumber,
  formatChartValue,
} from "./chart-primitives";

interface ApiResponse<T> {
  data?: T;
  error?: { message?: string };
}

const instantFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatInstant(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin fecha válida"
    : instantFormatter.format(date);
}

function InventoryLineChart({ points }: { points: InventoryHistoryPoint[] }) {
  if (points.length === 0) {
    return (
      <EmptyChart message="Sin información suficiente para reconstruir esta serie sin inventar estados intermedios." />
    );
  }
  const width = 720;
  const height = 230;
  const left = 48;
  const right = 18;
  const top = 18;
  const bottom = 38;
  const maximum = Math.max(
    1,
    ...points.flatMap((point) => [point.inventory, point.need]),
  );
  const x = (index: number) =>
    points.length === 1
      ? width / 2
      : left + (index * (width - left - right)) / (points.length - 1);
  const y = (value: number) =>
    top + ((maximum - value) * (height - top - bottom)) / maximum;
  const inventoryCoordinates = points
    .map((point, index) => `${x(index)},${y(point.inventory)}`)
    .join(" ");
  const needCoordinates = points
    .map((point, index) => `${x(index)},${y(point.need)}`)
    .join(" ");

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          aria-label="Inventario confirmado frente a necesidad vigente en puntos históricos verificables"
          className="min-w-[620px]"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const value = maximum * ratio;
            return (
              <g key={ratio}>
                <line
                  stroke="#e2e8f0"
                  x1={left}
                  x2={width - right}
                  y1={y(value)}
                  y2={y(value)}
                />
                <text
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="end"
                  x={left - 8}
                  y={y(value) + 4}
                >
                  {formatChartNumber(value)}
                </text>
              </g>
            );
          })}
          <polyline
            fill="none"
            points={inventoryCoordinates}
            stroke="#2563eb"
            strokeWidth="3"
          />
          <polyline
            fill="none"
            points={needCoordinates}
            stroke="#8b5cf6"
            strokeWidth="3"
          />
          {points.map((point, index) => (
            <g key={point.key}>
              <circle cx={x(index)} cy={y(point.inventory)} fill="#2563eb" r="4" />
              <circle cx={x(index)} cy={y(point.need)} fill="#8b5cf6" r="4" />
              <text
                fill="#475569"
                fontSize="10"
                textAnchor="middle"
                x={x(index)}
                y={height - 12}
              >
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {points.map((point) => (
          <div className="rounded-lg bg-slate-50 p-3 text-xs" key={point.key}>
            <strong className="text-slate-950">{point.label}</strong>
            <p className="mt-1 text-slate-600">
              Inventario: {formatChartValue(point.inventory, point.unit)}
            </p>
            <p className="text-slate-600">
              Necesidad: {formatChartValue(point.need, point.unit)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function movementQuantity(
  event: MovementTemporalEvent,
  products: readonly ProductRecord[],
) {
  const product = products.find(
    (item) => item.producto_id === event.producto_id,
  );
  const presentation = product?.presentaciones.find(
    (item) => item.sku_id === event.sku_id,
  );
  return product && presentation
    ? formatChartValue(
        event.payload.cantidad_paquetes * presentation.contenido_por_paquete,
        product.unidad_base,
      )
    : `${event.payload.cantidad_paquetes} paquetes`;
}

export function TemporalEvolution({
  snapshot,
  centers,
  products,
  initialCenterFilter,
  initialProductId,
}: {
  snapshot: SnapshotRecord;
  centers: CenterRecord[];
  products: ProductRecord[];
  initialCenterFilter: CenterFilter;
  initialProductId: string;
}) {
  const [productId, setProductId] = useState(
    products.some((product) => product.producto_id === initialProductId)
      ? initialProductId
      : (products[0]?.producto_id ?? ""),
  );
  const [periodMode, setPeriodMode] = useState<HistoryPeriod["mode"]>("week");
  const [selectedDay, setSelectedDay] = useState(WEEK_START);
  const [responseState, setResponseState] = useState<{
    key: string;
    analysis: TemporalAnalysisResult | null;
    error: string;
  } | null>(null);
  const period: HistoryPeriod =
    periodMode === "week" ? { mode: "week" } : { mode: "day", day: selectedDay };
  const range = historyRange(period);
  const requestKey = [
    snapshot.id,
    initialCenterFilter,
    productId,
    range.from,
    range.to,
  ].join("|");
  const matchingResponse =
    responseState?.key === requestKey ? responseState : null;
  const loading = matchingResponse === null;
  const analysis = matchingResponse?.analysis ?? null;
  const error = matchingResponse?.error ?? "";

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      escenarioId: snapshot.escenario_id ?? snapshot.id,
      perspectiva: "fisica",
      corte: range.to,
      desde: range.from,
      hasta: range.to,
      productoId: productId,
    });
    if (initialCenterFilter !== "all") {
      params.set("centroId", initialCenterFilter);
    }
    void fetch(
      `/api/snapshots/${encodeURIComponent(snapshot.id)}/temporal?${params}`,
      { cache: "no-store", credentials: "same-origin", signal: controller.signal },
    )
      .then(async (response) => {
        const body = (await response.json()) as ApiResponse<TemporalAnalysisResult>;
        if (!response.ok || !body.data) {
          throw new Error(
            body.error?.message ?? "No fue posible consultar el historial operativo.",
          );
        }
        setResponseState({ key: requestKey, analysis: body.data, error: "" });
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setResponseState({
            key: requestKey,
            analysis: null,
            error:
              caught instanceof Error
                ? caught.message
                : "Error inesperado al consultar el historial.",
          });
        }
      });
    return () => controller.abort();
  }, [
    initialCenterFilter,
    productId,
    range.from,
    range.to,
    requestKey,
    snapshot,
  ]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.producto_id === productId),
    [productId, products],
  );
  const selectedCenterName =
    initialCenterFilter === "all"
      ? "Todos los centros"
      : (centers.find((center) => center.centro_id === initialCenterFilter)
          ?.nombre ?? initialCenterFilter);
  const inventoryPoints = inventoryHistory(
    analysis?.series.inventario_necesidad_deficit ?? [],
    periodMode,
  );
  const movementPoints = movementHistory(
    analysis?.series.movimientos_por_hora ?? [],
    periodMode,
  );
  const delayPoints = analysis ? delayHistory(analysis, periodMode) : [];
  const detailedMovements = movementEvents(analysis?.eventos ?? []);
  const maximumOperations = Math.max(
    1,
    ...movementPoints.flatMap((point) => [point.receptions, point.dispatches]),
  );
  const maximumAverageDelay = Math.max(
    1,
    ...delayPoints.map((point) => point.averageMinutes),
  );
  const totalEvaluated = delayPoints.reduce(
    (total, point) => total + point.evaluatedMovements,
    0,
  );
  const totalDelayed = delayPoints.reduce(
    (total, point) => total + point.delayedMovements,
    0,
  );
  const maximumDelay = Math.max(
    0,
    ...delayPoints.map((point) => point.maximumMinutes),
  );
  const centerNames = new Map(
    centers.map((center) => [center.centro_id, center.nombre]),
  );
  const productNames = new Map(
    products.map((product) => [product.producto_id, product.nombre]),
  );
  const testingScenario = isWeeklyTestingScenario(snapshot);

  return (
    <section className="space-y-5">
      <header className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          Historial operativo
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Consulta cómo cambiaron los recursos, las necesidades y los movimientos durante la emergencia.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Periodo
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              onChange={(event) =>
                setPeriodMode(event.target.value as HistoryPeriod["mode"])
              }
              value={periodMode}
            >
              <option value="week">Semana del 9 al 15 de noviembre</option>
              <option value="day">Día específico</option>
            </select>
          </label>
          {periodMode === "day" ? (
            <label className="text-sm font-medium text-slate-700">
              Día
              <input
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setSelectedDay(event.target.value)}
                type="date"
                value={selectedDay}
              />
            </label>
          ) : (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Centro
              </span>
              <strong className="mt-1 block text-slate-950">
                {selectedCenterName}
              </strong>
              <span className="mt-1 block text-xs">Se controla con el filtro global.</span>
            </div>
          )}
          <label className="text-sm font-medium text-slate-700">
            Producto
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setProductId(event.target.value)}
              value={productId}
            >
              {products.map((product) => (
                <option key={product.producto_id} value={product.producto_id}>
                  {product.nombre} · {product.unidad_base}
                </option>
              ))}
            </select>
          </label>
          {periodMode === "day" ? (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Centro
              </span>
              <strong className="mt-1 block text-slate-950">
                {selectedCenterName}
              </strong>
              <span className="mt-1 block text-xs">Se controla con el filtro global.</span>
            </div>
          ) : null}
        </div>
      </section>

      <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        {testingScenario
          ? "PRUEBAS muestra únicamente movimientos verificables de su propia cadena. La evolución anterior a su estado inicial no se reconstruye ni se inventa."
          : "MAIN muestra el historial inmutable y verificable de la semana simulada."}
      </p>

      {loading ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          Consultando el historial seleccionado…
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {analysis ? (
        <div className="space-y-5">
          <ChartCard
            description={`Estados verificados de ${selectedProduct?.nombre ?? "el producto"}; no se mezclan unidades ni se estiman puntos desconocidos.`}
            legend={
              <ChartLegend
                items={[
                  { label: "Inventario confirmado", colorClass: "bg-blue-600" },
                  { label: "Necesidad vigente", colorClass: "bg-violet-500" },
                ]}
              />
            }
            title="Inventario frente a necesidades"
          >
            <InventoryLineChart points={inventoryPoints} />
          </ChartCard>

          <ChartCard
            description={`Las barras cuentan operaciones por ${periodMode === "week" ? "día" : "hora"}; no representan litros, gramos ni unidades.`}
            legend={
              <ChartLegend
                items={[
                  { label: "Recepciones", colorClass: "bg-emerald-500" },
                  { label: "Despachos", colorClass: "bg-rose-500" },
                ]}
              />
            }
            title="Recepciones y despachos"
          >
            {movementPoints.length === 0 ? (
              <EmptyChart message="No hay recepciones ni despachos verificables para este periodo, centro y producto." />
            ) : (
              <div className="space-y-5">
                {movementPoints.map((point) => (
                  <div key={point.key}>
                    <div className="mb-2 flex justify-between gap-3 text-sm">
                      <strong>{point.label}</strong>
                      <span>
                        {point.receptions} recep. · {point.dispatches} desp.
                      </span>
                    </div>
                    <div className="space-y-2">
                      <MetricBar
                        colorClass="bg-emerald-500"
                        label={`${point.receptions} operaciones de recepción`}
                        maximum={maximumOperations}
                        value={point.receptions}
                      />
                      <MetricBar
                        colorClass="bg-rose-500"
                        label={`${point.dispatches} operaciones de despacho`}
                        maximum={maximumOperations}
                        value={point.dispatches}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          <ChartCard
            description="Promedio de minutos entre el movimiento físico y su registro. Sólo se incluyen recepciones y despachos con ambos tiempos válidos."
            title="Tiempo de registro"
          >
            {delayPoints.length === 0 ? (
              <EmptyChart message="Sin información suficiente para calcular tiempos de registro." />
            ) : (
              <div>
                <dl className="mb-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Movimientos evaluados
                    </dt>
                    <dd className="mt-2 text-2xl font-semibold text-slate-950">
                      {totalEvaluated}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Mayor retraso
                    </dt>
                    <dd className="mt-2 text-2xl font-semibold text-slate-950">
                      {formatChartNumber(maximumDelay)} min
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Registrados con demora
                    </dt>
                    <dd className="mt-2 text-2xl font-semibold text-slate-950">
                      {totalDelayed}
                    </dd>
                  </div>
                </dl>
                <div className="space-y-5">
                  {delayPoints.map((point) => (
                    <div key={point.key}>
                      <div className="mb-2 flex justify-between gap-3 text-sm">
                        <strong>{point.label}</strong>
                        <span>
                          Promedio {formatChartNumber(point.averageMinutes)} min
                        </span>
                      </div>
                      <MetricBar
                        colorClass="bg-cyan-600"
                        label={`Retraso promedio ${point.averageMinutes} minutos`}
                        maximum={maximumAverageDelay}
                        value={point.averageMinutes}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>

          <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-5 py-4 font-semibold text-slate-950">
              Ver movimientos detallados
            </summary>
            <div className="border-t border-slate-200 p-5">
              {detailedMovements.length === 0 ? (
                <p className="text-sm text-slate-600">
                  No hay movimientos para los filtros seleccionados.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Fecha y hora</th>
                        <th className="px-3 py-3">Centro</th>
                        <th className="px-3 py-3">Producto</th>
                        <th className="px-3 py-3">Movimiento</th>
                        <th className="px-3 py-3">Cantidad</th>
                        <th className="px-3 py-3">Hora de registro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {detailedMovements.map((event) => (
                        <tr key={event.evento_id}>
                          <td className="whitespace-nowrap px-3 py-3">
                            {formatInstant(event.ocurrido_en)}
                          </td>
                          <td className="px-3 py-3">
                            {centerNames.get(event.centro_id) ?? event.centro_id}
                          </td>
                          <td className="px-3 py-3">
                            {event.producto_id
                              ? (productNames.get(event.producto_id) ?? event.producto_id)
                              : "Sin producto"}
                          </td>
                          <td className="px-3 py-3">
                            {event.tipo === "recepcion_confirmada"
                              ? "Recepción"
                              : "Despacho"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {movementQuantity(event, products)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {formatInstant(event.registrado_en)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </details>

          <details className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <summary className="cursor-pointer font-semibold text-slate-900">
              Opciones avanzadas
            </summary>
            <p className="mt-3">
              Perspectiva utilizada: acontecimiento físico. Estado de la historia: {analysis.completitud.estado}.
            </p>
            {analysis.completitud.limitaciones.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {analysis.completitud.limitaciones.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </details>
        </div>
      ) : null}
    </section>
  );
}
