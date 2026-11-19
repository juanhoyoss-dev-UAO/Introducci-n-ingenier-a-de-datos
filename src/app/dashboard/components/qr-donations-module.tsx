"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { MovementOperation } from "@/contracts/schemas/movement-operations";
import type { QrDonationOperation } from "@/contracts/schemas/qr-donations";
import type {
  QrDonationModuleData,
  QrDonationSyncResult,
  QrDonationView,
} from "@/contracts/types/qr-donations";
import { QR_DONATION_STATUS_LABELS } from "@/contracts/types/qr-donations";
import { isWeeklyTestingScenario } from "@/lib/operational-scenarios";
import type { CenterFilter, SnapshotRecord } from "../types";

const numberFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

function bogotaLocalNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}T${values.get("hour")}:${values.get("minute")}`;
}

function bogotaIso(value: string) {
  return `${value.length === 16 ? `${value}:00` : value}-05:00`;
}

function formatUnits(value: number, unit: QrDonationView["unidad_base"]) {
  const suffix = unit === "unidad" && value !== 1 ? "unidades" : unit;
  return `${numberFormatter.format(value)} ${suffix}`;
}

const statusStyles = {
  anunciado: "bg-blue-50 text-blue-900",
  parcialmente_recibido: "bg-amber-100 text-amber-900",
  recibido_completo: "bg-emerald-100 text-emerald-900",
  cancelado: "bg-slate-100 text-slate-700",
} as const;

export function QrDonationsModule({
  centerFilter,
  onCancel,
  onReceive,
  onSync,
  snapshot,
}: {
  centerFilter: CenterFilter;
  onCancel(operation: QrDonationOperation): Promise<void>;
  onReceive(operation: MovementOperation): Promise<void>;
  onSync(): Promise<QrDonationSyncResult>;
  snapshot: SnapshotRecord;
}) {
  const [data, setData] = useState<QrDonationModuleData | null>(null);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "pending">("newest");
  const [receivedAt, setReceivedAt] = useState(bogotaLocalNow);
  const [partialQuantities, setPartialQuantities] = useState<Record<string, number>>({});
  const editable = isWeeklyTestingScenario(snapshot);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/snapshots/${encodeURIComponent(snapshot.id)}/qr-donations`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          data?: QrDonationModuleData;
          error?: { message?: string };
        };
        if (!response.ok || !body.data) {
          throw new Error(body.error?.message ?? "No fue posible consultar los anuncios.");
        }
        setData(body.data);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "No fue posible consultar los anuncios.");
        }
      });
    return () => controller.abort();
  }, [snapshot.id]);

  const synchronize = useCallback(async (silent = false) => {
    if (syncing || !data?.integracion_google_configurada || !editable) return;
    setSyncing(true);
    if (!silent) setError("");
    try {
      const result = await onSync();
      setSyncNotice(
        result.donaciones_importadas > 0
          ? `${result.donaciones_importadas} donación(es) y ${result.articulos_importados} artículo(s) importados.`
          : result.filas_invalidas.length > 0
            ? `${result.filas_invalidas.length} fila(s) no pudieron importarse.`
            : "Sincronización completada sin anuncios nuevos.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible sincronizar Google Sheets.",
      );
    } finally {
      setSyncing(false);
    }
  }, [data?.integracion_google_configurada, editable, onSync, syncing]);

  useEffect(() => {
    if (!data?.integracion_google_configurada || !editable) return;
    const timer = window.setInterval(
      () => void synchronize(true),
      data.intervalo_sincronizacion_ms,
    );
    return () => window.clearInterval(timer);
  }, [data?.integracion_google_configurada, data?.intervalo_sincronizacion_ms, editable, synchronize]);

  const centerAnnouncements = useMemo(
    () =>
      (data?.anuncios ?? []).filter(
        (row) => centerFilter === "all" || row.centro_id === centerFilter,
      ),
    [centerFilter, data],
  );
  const centerDonations = useMemo(
    () =>
      (data?.donaciones ?? []).filter(
        (donation) =>
          centerFilter === "all" || donation.centro_id === centerFilter,
      ),
    [centerFilter, data],
  );
  const products = useMemo(
    () =>
      Array.from(
        new Map(
          centerAnnouncements.map((row) => [
            row.producto_id,
            row.producto_nombre,
          ]),
        ),
      ).sort((left, right) => left[1].localeCompare(right[1], "es")),
    [centerAnnouncements],
  );
  const filteredDonations = useMemo(() => {
    const donations = centerDonations.filter(
      (donation) =>
        (productFilter === "all" ||
          donation.articulos.some(
            (item) => item.producto_id === productFilter,
          )) &&
        (statusFilter === "all" ||
          donation.estado_general === statusFilter),
    );
    return [...donations].sort((left, right) => {
      if (sort === "pending") {
        return (
          right.articulos.filter((item) => item.cantidad_pendiente_paquetes > 0)
            .length -
            left.articulos.filter((item) => item.cantidad_pendiente_paquetes > 0)
              .length ||
          Date.parse(right.fecha_registro) - Date.parse(left.fecha_registro)
        );
      }
      const delta =
        Date.parse(right.fecha_registro) - Date.parse(left.fecha_registro);
      return sort === "newest" ? delta : -delta;
    });
  }, [centerDonations, productFilter, sort, statusFilter]);
  const filteredItems = useMemo(
    () =>
      filteredDonations.flatMap((donation) =>
        donation.articulos.filter(
          (item) =>
            productFilter === "all" || item.producto_id === productFilter,
        ),
      ),
    [filteredDonations, productFilter],
  );
  const comparisons = useMemo(() => {
    const map = new Map<string, QrDonationView & { pendingBase: number }>();
    for (const row of filteredItems) {
      const key = `${row.centro_id}\u0000${row.producto_id}`;
      const current = map.get(key);
      const pending =
        row.estado === "cancelado"
          ? 0
          : row.cantidad_pendiente_paquetes * row.contenido_por_paquete;
      if (current) current.pendingBase += pending;
      else map.set(key, { ...row, pendingBase: pending });
    }
    return [...map.values()];
  }, [filteredItems]);

  const metrics = [
    ["Donaciones registradas", centerDonations.length],
    ["Donaciones pendientes", centerDonations.filter((row) => row.estado_general === "anunciado").length],
    ["Parcialmente recibidas", centerDonations.filter((row) => row.estado_general === "parcialmente_recibido").length],
    ["Completadas", centerDonations.filter((row) => row.estado_general === "recibido_completo").length],
    [
      "Centros con recursos pendientes",
      new Set(
        centerDonations
          .flatMap((donation) => donation.articulos)
          .filter((row) => row.cantidad_pendiente_paquetes > 0 && row.estado !== "cancelado")
          .map((row) => row.centro_id),
      ).size,
    ],
  ] as const;

  async function receive(row: QrDonationView, quantity: number) {
    setSavingId(row.anuncio_id);
    setError("");
    try {
      await onReceive({
        operation: "confirm_qr_donation",
        values: {
          operacion_id: crypto.randomUUID(),
          anuncio_id: row.anuncio_id,
          cantidad_paquetes: quantity,
          ocurrido_en: bogotaIso(receivedAt),
        },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible confirmar la recepción.");
    } finally {
      setSavingId("");
    }
  }

  async function cancel(row: QrDonationView) {
    if (!window.confirm("¿Cancelar este artículo? El inventario no será modificado.")) return;
    setSavingId(row.anuncio_id);
    setError("");
    try {
      await onCancel({
        operation: "cancel_announcement",
        values: { operacion_id: crypto.randomUUID(), anuncio_id: row.anuncio_id },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cancelar el anuncio.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">Donaciones esperadas</h2>
        <p className="mt-1 text-sm text-slate-600">
          Los anuncios permanecen separados del inventario hasta confirmar una entrega física.
        </p>
      </div>

      {!data?.integracion_google_configurada ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Integración con Google pendiente de configuración
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <span>
            Google Sheets configurado. Sincronización periódica cada {Math.round(data.intervalo_sincronizacion_ms / 1000)} segundos.
          </span>
          {editable ? (
            <button
              className="rounded-lg bg-emerald-800 px-3 py-2 font-semibold text-white disabled:opacity-50"
              disabled={syncing}
              onClick={() => void synchronize()}
              type="button"
            >
              {syncing ? "Sincronizando…" : "Sincronizar ahora"}
            </button>
          ) : null}
        </div>
      )}
      {!editable ? (
        <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          MAIN es de solo lectura. Selecciona PRUEBAS para confirmar o cancelar anuncios.
        </div>
      ) : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">{error}</div> : null}
      {syncNotice ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900" role="status">{syncNotice}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores de donaciones esperadas">
        {metrics.map(([label, value]) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-950">{value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">Producto
            <select className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" onChange={(event) => setProductFilter(event.target.value)} value={productFilter}>
              <option value="all">Todos los productos</option>
              {products.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Estado
            <select className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">Todos los estados</option>
              {Object.entries(QR_DONATION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Orden
            <select className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" onChange={(event) => setSort(event.target.value as typeof sort)} value={sort}>
              <option value="newest">Más recientes primero</option>
              <option value="oldest">Más antiguos primero</option>
              <option value="pending">Más artículos pendientes</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-950">Inventario, pendientes y necesidad</h3>
        <p className="mt-1 text-sm text-slate-600">La cobertura real continúa calculándose exclusivamente con inventario confirmado.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {comparisons.map((row) => (
            <article className="rounded-xl border border-slate-200 p-4" key={`${row.centro_id}-${row.producto_id}`}>
              <p className="font-semibold text-slate-950">{row.producto_nombre} · {row.centro_nombre}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-slate-600">Inventario confirmado</dt><dd className="text-right font-semibold">{formatUnits(row.inventario_confirmado_unidad_base, row.unidad_base)}</dd>
                <dt className="text-slate-600">Anunciado pendiente</dt><dd className="text-right font-semibold text-amber-800">{formatUnits(row.pendingBase, row.unidad_base)}</dd>
                <dt className="text-slate-600">Necesidad vigente</dt><dd className="text-right font-semibold">{formatUnits(row.necesidad_vigente_unidad_base, row.unidad_base)}</dd>
              </dl>
            </article>
          ))}
          {comparisons.length === 0 ? <p className="text-sm text-slate-500">No hay anuncios para los filtros seleccionados.</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h3 className="font-semibold text-slate-950">Donaciones registradas</h3>
          <p className="mt-1 text-sm text-slate-600">
            Expande una donación para consultar y recibir cada artículo de forma independiente.
          </p>
          <label className="mt-3 block max-w-sm text-sm font-medium text-slate-700">Fecha y hora de recepción
            <input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" onChange={(event) => setReceivedAt(event.target.value)} type="datetime-local" value={receivedAt} />
          </label>
        </div>
        <div className="space-y-3 p-5">
          {filteredDonations.map((donation) => (
            <details
              className="overflow-hidden rounded-xl border border-slate-200"
              key={donation.donacion_id}
            >
              <summary className="cursor-pointer list-inside bg-slate-50 px-4 py-3">
                <span className="ml-2 font-semibold text-slate-950">
                  {donation.centro_nombre} · {donation.articulos.length} artículo(s)
                </span>
                <span className="ml-3 text-sm text-slate-600">
                  {dateFormatter.format(new Date(donation.fecha_registro))}
                </span>
                <span className={`ml-3 inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[donation.estado_general]}`}>
                  {QR_DONATION_STATUS_LABELS[donation.estado_general]}
                </span>
              </summary>
              <div className="border-t border-slate-200">
                <dl className="grid gap-3 bg-white px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="text-slate-500">Donante</dt><dd className="font-medium text-slate-900">{donation.donante ?? "No informado"}</dd></div>
                  <div><dt className="text-slate-500">Centro</dt><dd className="font-medium text-slate-900">{donation.centro_id} · {donation.centro_nombre}</dd></div>
                  <div><dt className="text-slate-500">Entrega estimada</dt><dd className="font-medium text-slate-900">{dateFormatter.format(new Date(donation.fecha_estimada))}</dd></div>
                  <div><dt className="text-slate-500">Observaciones</dt><dd className="font-medium text-slate-900">{donation.observaciones ?? "Sin observaciones"}</dd></div>
                </dl>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
                      {['Producto y presentación','Anunciada','Recibida','Pendiente','Estado','Acciones'].map((header) => <th className="whitespace-nowrap px-4 py-3" key={header}>{header}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {donation.articulos.map((row) => {
                        const partial = partialQuantities[row.item_id] ?? 1;
                        const pending = row.cantidad_pendiente_paquetes;
                        const saving = savingId === row.item_id;
                        const actionable = editable && pending > 0 && row.estado !== "cancelado";
                        return <tr key={row.item_id}>
                          <td className="min-w-64 px-4 py-3"><strong>{row.producto_nombre}</strong><br/><span className="text-xs text-slate-500">{row.sku_id} · {row.presentacion_nombre}</span></td>
                          <td className="px-4 py-3 text-center tabular-nums">{row.cantidad_anunciada_paquetes}</td>
                          <td className="px-4 py-3 text-center tabular-nums">{row.cantidad_recibida_paquetes}</td>
                          <td className="px-4 py-3 text-center font-semibold tabular-nums">{pending}</td>
                          <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[row.estado]}`}>{QR_DONATION_STATUS_LABELS[row.estado]}</span></td>
                          <td className="min-w-72 px-4 py-3">
                            {actionable ? <div className="flex flex-wrap gap-2">
                              {pending > 1 ? <><input aria-label={`Cantidad parcial ${row.item_id}`} className="w-20 rounded-lg border border-slate-300 px-2 py-1.5" max={pending - 1} min={1} onChange={(event) => setPartialQuantities((current) => ({...current, [row.item_id]: event.target.valueAsNumber}))} step={1} type="number" value={partial}/><button className="rounded-lg border border-blue-300 px-2.5 py-1.5 font-semibold text-blue-800 disabled:opacity-50" disabled={saving || !Number.isInteger(partial) || partial < 1 || partial >= pending} onClick={() => void receive(row, partial)} type="button">Confirmar parcial</button></> : null}
                              <button className="rounded-lg bg-blue-700 px-2.5 py-1.5 font-semibold text-white disabled:opacity-50" disabled={saving} onClick={() => void receive(row, pending)} type="button">Confirmar completa</button>
                              {row.cantidad_recibida_paquetes === 0 ? <button className="rounded-lg border border-red-300 px-2.5 py-1.5 font-semibold text-red-800 disabled:opacity-50" disabled={saving} onClick={() => void cancel(row)} type="button">Cancelar artículo</button> : null}
                            </div> : <span className="text-xs text-slate-500">Sin acciones disponibles</span>}
                          </td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          ))}
          {filteredDonations.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No hay donaciones para mostrar.</p> : null}
        </div>
      </section>
    </div>
  );
}
