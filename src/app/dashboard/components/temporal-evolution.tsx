"use client";

import { useEffect, useMemo, useState } from "react";

import type { TemporalAnalysisResult } from "@/contracts/types/temporal";
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

function bogotaInputValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .filter((part) => part.type !== "literal");
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function withBogotaOffset(value: string) {
  return value ? `${value}:00-05:00` : "";
}

function formatInstant(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: TemporalAnalysisResult["completitud"]["estado"] }) {
  const styles = {
    completa: "border-emerald-200 bg-emerald-50 text-emerald-800",
    parcial: "border-amber-200 bg-amber-50 text-amber-900",
    insuficiente: "border-rose-200 bg-rose-50 text-rose-800",
  }[status];
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${styles}`}>
      Historia {status}
    </span>
  );
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
  const [centerId, setCenterId] = useState(
    initialCenterFilter === "all"
      ? (centers[0]?.centro_id ?? "")
      : initialCenterFilter,
  );
  const [productId, setProductId] = useState(
    products.some((product) => product.producto_id === initialProductId)
      ? initialProductId
      : (products[0]?.producto_id ?? ""),
  );
  const [perspective, setPerspective] = useState<"fisica" | "informativa">(
    "fisica",
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cutoff, setCutoff] = useState(() => bogotaInputValue(new Date()));
  const [analysis, setAnalysis] = useState<TemporalAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      escenarioId: snapshot.escenario_id ?? snapshot.id,
      perspectiva: perspective,
      corte: withBogotaOffset(cutoff),
    });
    if (centerId) params.set("centroId", centerId);
    if (productId) params.set("productoId", productId);
    if (from) params.set("desde", withBogotaOffset(from));
    if (to) {
      const end = withBogotaOffset(to);
      params.set("hasta", end);
      if (Date.parse(end) > Date.parse(params.get("corte") ?? "")) {
        params.set("corte", end);
      }
    }
    void fetch(
      `/api/snapshots/${encodeURIComponent(snapshot.id)}/temporal?${params}`,
      { cache: "no-store", credentials: "same-origin", signal: controller.signal },
    )
      .then(async (response) => {
        const body = (await response.json()) as ApiResponse<TemporalAnalysisResult>;
        if (!response.ok || !body.data) {
          throw new Error(
            body.error?.message ?? "No fue posible consultar la evolución temporal.",
          );
        }
        setError("");
        setAnalysis(body.data);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setAnalysis(null);
          setError(caught instanceof Error ? caught.message : "Error temporal inesperado.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [centerId, cutoff, from, perspective, productId, snapshot, to]);

  const inventoryRows = analysis?.series.inventario_necesidad_deficit ?? [];
  const flowRows = analysis?.series.movimientos_por_hora ?? [];
  const maximumPackages = Math.max(
    1,
    ...flowRows.flatMap((row) => [row.paquetes_recibidos, row.paquetes_despachados]),
  );
  const maximumInventory = Math.max(
    1,
    ...inventoryRows.flatMap((row) => [row.inventario, row.necesidad]),
  );
  const maximumDeficit = Math.max(1, ...inventoryRows.map((row) => row.deficit));
  const maximumDelay = Math.max(
    1,
    ...(analysis?.series.desfase_registro.map((row) => Math.abs(row.desfase_minutos)) ?? []),
  );
  const selectedProduct = useMemo(
    () => products.find((product) => product.producto_id === productId),
    [productId, products],
  );

  return (
    <section className="space-y-5">
      <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Reconstrucción reproducible · America/Bogota
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">Evolución temporal</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Compara lo que físicamente había ocurrido con lo que ya estaba registrado. No interpola puntos ni modifica snapshots.
            </p>
          </div>
          {analysis ? <StatusBadge status={analysis.completitud.estado} /> : null}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm text-slate-200">
            Escenario / cadena
            <select className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" disabled value={snapshot.escenario_id ?? snapshot.id}>
              <option value={snapshot.escenario_id ?? snapshot.id}>{snapshot.escenario_id ?? snapshot.id}</option>
            </select>
          </label>
          <label className="text-sm text-slate-200">
            Centro
            <select className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" onChange={(event) => setCenterId(event.target.value)} value={centerId}>
              {centers.map((center) => <option key={center.centro_id} value={center.centro_id}>{center.centro_id} · {center.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-200">
            Producto
            <select className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" onChange={(event) => setProductId(event.target.value)} value={productId}>
              {products.map((product) => <option key={product.producto_id} value={product.producto_id}>{product.producto_id} · {product.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-200">
            Perspectiva
            <select className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" onChange={(event) => setPerspective(event.target.value as "fisica" | "informativa")} value={perspective}>
              <option value="fisica">Estado físico por ocurrido_en</option>
              <option value="informativa">Información disponible por registrado_en</option>
            </select>
          </label>
          <label className="text-sm text-slate-200">
            Desde (opcional)
            <input className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" onChange={(event) => setFrom(event.target.value)} type="datetime-local" value={from} />
          </label>
          <label className="text-sm text-slate-200">
            Hasta (opcional)
            <input className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" onChange={(event) => setTo(event.target.value)} type="datetime-local" value={to} />
          </label>
          <label className="text-sm text-slate-200">
            Hora de corte
            <input className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" onChange={(event) => setCutoff(event.target.value)} required type="datetime-local" value={cutoff} />
          </label>
        </div>
      </div>

      {loading ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">Reconstruyendo la cadena seleccionada…</div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</div> : null}
      {analysis?.completitud.limitaciones.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <strong>Limitaciones de la reconstrucción</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {analysis.completitud.limitaciones.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}

      {analysis ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <ChartCard
            description="Cada barra distingue paquetes de cantidad de movimientos. Las cantidades físicas se conservan por producto y unidad."
            legend={<ChartLegend items={[{ label: "Recepciones", colorClass: "bg-emerald-500" }, { label: "Despachos", colorClass: "bg-rose-500" }]} />}
            title="Recepciones y despachos por hora"
          >
            {flowRows.length === 0 ? <EmptyChart message="No hay movimientos reales en el periodo y filtros seleccionados." /> : (
              <div className="space-y-5">
                {flowRows.map((row) => (
                  <div key={row.etiqueta}>
                    <div className="mb-2 flex justify-between gap-3 text-sm"><strong>{row.etiqueta}</strong><span>{row.recepciones} recep. · {row.despachos} desp.</span></div>
                    <div className="space-y-2">
                      <MetricBar colorClass="bg-emerald-500" label={`${row.paquetes_recibidos} paquetes recibidos`} maximum={maximumPackages} value={row.paquetes_recibidos} />
                      <MetricBar colorClass="bg-rose-500" label={`${row.paquetes_despachados} paquetes despachados`} maximum={maximumPackages} value={row.paquetes_despachados} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{row.paquetes_recibidos} paquetes recibidos · {row.paquetes_despachados} paquetes despachados</p>
                  </div>
                ))}
                {analysis.series.recepciones_fisicas.map((row) => (
                  <p className="text-xs text-slate-600" key={`${row.fecha_local}-${row.hora_local}-${row.producto_id}`}>
                    {row.fecha_local} {String(row.hora_local).padStart(2, "0")}:00 · {row.producto_nombre}: <strong>{formatChartValue(row.cantidad_unidad_base, row.unidad)}</strong> recibidos físicamente
                  </p>
                ))}
              </div>
            )}
          </ChartCard>

          <ChartCard description="Sólo aparecen instantes respaldados por un evento aplicable del producto seleccionado." title={`Inventario durante la jornada · ${selectedProduct?.nombre ?? productId}`}>
            {inventoryRows.length === 0 ? <EmptyChart message="Información insuficiente para reconstruir esta serie sin usar el snapshot final como estado inicial." /> : (
              <div className="space-y-4">{inventoryRows.map((row) => <div key={`${row.instante}-${row.centro_id}-${row.producto_id}`}><div className="mb-2 flex justify-between text-sm"><span>{formatInstant(row.instante)}</span><strong>{formatChartValue(row.inventario, row.unidad)}</strong></div><MetricBar colorClass="bg-blue-600" label={`Inventario ${row.inventario}`} maximum={maximumInventory} value={row.inventario} /></div>)}</div>
            )}
          </ChartCard>

          <ChartCard description="Inventario confirmado y necesidad vigente calculados para el mismo instante; no se suman unidades incompatibles." legend={<ChartLegend items={[{ label: "Inventario", colorClass: "bg-blue-600" }, { label: "Necesidad", colorClass: "bg-violet-500" }]} />} title="Necesidad frente a inventario">
            {inventoryRows.length === 0 ? <EmptyChart message="No hay cambios reconstruibles de inventario o necesidad para estos filtros." /> : (
              <div className="space-y-5">{inventoryRows.map((row) => <div key={`compare-${row.instante}-${row.centro_id}`}><div className="mb-2 text-sm font-medium">{formatInstant(row.instante)}</div><div className="space-y-2"><MetricBar colorClass="bg-blue-600" label={`Inventario ${row.inventario}`} maximum={maximumInventory} value={row.inventario} /><MetricBar colorClass="bg-violet-500" label={`Necesidad ${row.necesidad}`} maximum={maximumInventory} value={row.necesidad} /></div><p className="mt-2 text-xs text-slate-500">{formatChartValue(row.inventario, row.unidad)} / {formatChartValue(row.necesidad, row.unidad)}</p></div>)}</div>
            )}
          </ChartCard>

          <ChartCard description="Déficit = máximo entre cero y necesidad menos inventario, reutilizando la regla M1." title="Evolución del déficit">
            {inventoryRows.length === 0 ? <EmptyChart message="El déficit no es reconstruible para el intervalo seleccionado." /> : (
              <div className="space-y-4">{inventoryRows.map((row) => <div key={`deficit-${row.instante}-${row.centro_id}`}><div className="mb-2 flex justify-between text-sm"><span>{formatInstant(row.instante)}</span><strong>{formatChartValue(row.deficit, row.unidad)}</strong></div><MetricBar colorClass={row.deficit > 0 ? "bg-amber-500" : "bg-emerald-500"} label={`Déficit ${row.deficit}`} maximum={maximumDeficit} value={row.deficit} /></div>)}</div>
            )}
          </ChartCard>

          <ChartCard description="Minutos entre el hecho físico y su registro. Cero significa registro simultáneo." title="Desfase entre acontecimiento y registro">
            {analysis.series.desfase_registro.length === 0 ? <EmptyChart message="No hay eventos temporales para calcular desfases." /> : (
              <div className="space-y-4">{analysis.series.desfase_registro.map((row) => <div key={row.evento_id}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-mono text-xs text-slate-500">{row.evento_id.slice(0, 8)}</span><strong>{formatChartNumber(row.desfase_minutos)} min</strong></div><MetricBar colorClass="bg-cyan-600" label={`Desfase ${row.desfase_minutos} minutos`} maximum={maximumDelay} value={Math.abs(row.desfase_minutos)} /><p className="mt-1 text-xs text-slate-500">Ocurrió {formatInstant(row.ocurrido_en)} · registrado {formatInstant(row.registrado_en)}</p></div>)}</div>
            )}
          </ChartCard>

          <ChartCard description="Disponible cuando existen eventos M3 nuevos con evidencia explícita." title="Evolución de voluntariado">
            {analysis.series.voluntarios.length === 0 ? <EmptyChart message="No existen actualizaciones temporales de voluntariado en esta cadena." /> : (
              <div className="space-y-3">{analysis.series.voluntarios.map((row) => <div className="rounded-lg bg-slate-50 p-3 text-sm" key={`${row.instante}-${row.centro_id}`}><strong>{formatInstant(row.instante)}</strong><p className="mt-1 text-slate-600">{row.disponibles} disponibles · {row.requeridos} requeridos</p></div>)}</div>
            )}
          </ChartCard>
        </div>
      ) : null}
    </section>
  );
}
