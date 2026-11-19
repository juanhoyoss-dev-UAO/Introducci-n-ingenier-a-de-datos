import { useMemo, useState, type FormEvent } from "react";

import type { MovementOperation } from "@/contracts/schemas/movement-operations";
import type {
  CenterFilter,
  DashboardBundle,
  ExpectedDonationRecord,
  MovementRecord,
} from "../types";

type EditorMovementMode = Exclude<
  MovementOperation["operation"],
  "confirm_qr_donation"
>;

const numberFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function newOperationId() {
  return globalThis.crypto.randomUUID();
}

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

function toBogotaIso(value: string) {
  return `${value.length === 16 ? `${value}:00` : value}-05:00`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function formClass() {
  return "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";
}

function SaveButton({ saving }: { saving: boolean }) {
  return (
    <button
      className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={saving}
      type="submit"
    >
      {saving ? "Guardando movimiento…" : "Guardar en una versión nueva"}
    </button>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}

export function MovementEditor({
  bundle,
  centerFilter,
  onSave,
}: {
  bundle: DashboardBundle;
  centerFilter: CenterFilter;
  onSave(update: MovementOperation): Promise<void>;
}) {
  const pending = bundle.dashboard.donaciones_esperadas.filter(
    (donation) =>
      donation.estado === "pendiente" &&
      (centerFilter === "all" || donation.centro_id === centerFilter),
  );
  const initialCenter =
    centerFilter !== "all" && bundle.centers.some((row) => row.centro_id === centerFilter)
      ? centerFilter
      : (bundle.centers[0]?.centro_id ?? "");
  const [mode, setMode] = useState<EditorMovementMode>(
    pending.length > 0 ? "confirm_donation" : "direct_reception",
  );
  const [operationId, setOperationId] = useState(newOperationId);
  const [donationId, setDonationId] = useState(pending[0]?.intencion_id ?? "");
  const [centerId, setCenterId] = useState(initialCenter);
  const [productId, setProductId] = useState(bundle.products[0]?.producto_id ?? "");
  const selectedProduct = bundle.products.find(
    (product) => product.producto_id === productId,
  );
  const [skuId, setSkuId] = useState(selectedProduct?.presentaciones[0]?.sku_id ?? "");
  const [quantity, setQuantity] = useState(
    String(pending[0]?.cantidad_paquetes ?? 1),
  );
  const [occurredAt, setOccurredAt] = useState(bogotaLocalNow);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");

  const selectedDonation: ExpectedDonationRecord | undefined = pending.find(
    (donation) => donation.intencion_id === donationId,
  );
  const receivedQuantity = Number(quantity);
  const difference = selectedDonation
    ? receivedQuantity - selectedDonation.cantidad_paquetes
    : null;

  const history = useMemo(() => {
    const from = fromDate ? new Date(toBogotaIso(fromDate)).getTime() : null;
    const to = toDate ? new Date(toBogotaIso(toDate)).getTime() : null;
    return bundle.dashboard.movimientos.filter((movement) => {
      const occurred = new Date(movement.ocurrido_en).getTime();
      const matchesCenter =
        centerFilter === "all" ||
        movement.centro_origen_id === centerFilter ||
        movement.centro_destino_id === centerFilter;
      return (
        matchesCenter &&
        (from === null || occurred >= from) &&
        (to === null || occurred <= to)
      );
    });
  }, [bundle.dashboard.movimientos, centerFilter, fromDate, toDate]);

  function selectProduct(nextProductId: string) {
    setProductId(nextProductId);
    const product = bundle.products.find(
      (item) => item.producto_id === nextProductId,
    );
    setSkuId(product?.presentaciones[0]?.sku_id ?? "");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setLocalError("");
    try {
      const cantidadPaquetes = Number(quantity);
      const update: MovementOperation =
        mode === "confirm_donation"
          ? {
              operation: mode,
              values: {
                operacion_id: operationId,
                intencion_id: donationId,
                cantidad_paquetes: cantidadPaquetes,
                ocurrido_en: toBogotaIso(occurredAt),
              },
            }
          : {
              operation: mode,
              values: {
                operacion_id: operationId,
                centro_id: centerId,
                producto_id: productId,
                sku_id: skuId,
                cantidad_paquetes: cantidadPaquetes,
                ocurrido_en: toBogotaIso(occurredAt),
              },
            };
      await onSave(update);
      setOperationId(newOperationId());
    } catch (caught) {
      setLocalError(
        caught instanceof Error
          ? caught.message
          : "No fue posible guardar el movimiento.",
      );
    } finally {
      setSaving(false);
    }
  }

  const centers = new Map(
    bundle.centers.map((center) => [center.centro_id, center.nombre]),
  );
  const products = new Map(
    bundle.products.map((product) => [product.producto_id, product]),
  );
  const presentations = new Map(
    bundle.products.flatMap((product) =>
      product.presentaciones.map((presentation) => [presentation.sku_id, presentation] as const),
    ),
  );

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              Movimiento operativo M4
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Movimientos y recepciones
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Cada guardado publica inventario, donación y movimiento en una misma versión atómica.
            </p>
          </div>
          <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-800">
            Horario America/Bogota
          </span>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Tipo de movimiento">
              <select
                className={formClass()}
                onChange={(event) => {
                  const nextMode = event.target.value as EditorMovementMode;
                  setMode(nextMode);
                  if (nextMode === "confirm_donation") {
                    setQuantity(String(selectedDonation?.cantidad_paquetes ?? 1));
                  }
                }}
                value={mode}
              >
                <option disabled={pending.length === 0} value="confirm_donation">
                  Confirmar donación anunciada
                </option>
                <option value="direct_reception">Registrar recepción directa</option>
                <option value="dispatch">Registrar despacho</option>
              </select>
            </Field>
            <Field label="Fecha y hora del acontecimiento">
              <input
                className={formClass()}
                onChange={(event) => setOccurredAt(event.target.value)}
                required
                type="datetime-local"
                value={occurredAt}
              />
            </Field>
            <Field label="Cantidad de paquetes">
              <input
                className={formClass()}
                min="1"
                onChange={(event) => setQuantity(event.target.value)}
                required
                step="1"
                type="number"
                value={quantity}
              />
            </Field>
          </div>

          {mode === "confirm_donation" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Donación pendiente">
                <select
                  className={formClass()}
                  onChange={(event) => {
                    const next = pending.find(
                      (donation) => donation.intencion_id === event.target.value,
                    );
                    setDonationId(event.target.value);
                    setQuantity(String(next?.cantidad_paquetes ?? 1));
                  }}
                  required
                  value={donationId}
                >
                  {pending.length === 0 ? (
                    <option value="">No hay donaciones pendientes</option>
                  ) : null}
                  {pending.map((donation) => (
                    <option key={donation.intencion_id} value={donation.intencion_id}>
                      {donation.intencion_id} · {centers.get(donation.centro_id) ?? donation.centro_id} · {donation.sku_id}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="rounded-lg border border-blue-200 bg-white p-3 text-sm text-slate-700">
                <p>
                  Anunciado: <strong>{numberFormatter.format(selectedDonation?.cantidad_paquetes ?? 0)} paquetes</strong>
                  {selectedDonation ? (
                    <> · {numberFormatter.format(
                      selectedDonation.cantidad_paquetes *
                        (presentations.get(selectedDonation.sku_id)?.contenido_por_paquete ?? 0),
                    )} {products.get(presentations.get(selectedDonation.sku_id)?.producto_id ?? "")?.unidad_base ?? "unidades"}</>
                  ) : null}
                </p>
                <p className="mt-1">
                  Diferencia recibida: <strong>{difference === null || Number.isNaN(difference) ? "N/D" : `${difference >= 0 ? "+" : ""}${numberFormatter.format(difference)} paquetes`}</strong>
                </p>
                <p className="mt-1 text-xs text-slate-500">El valor anunciado original se conservará en el historial.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <Field label={mode === "dispatch" ? "Centro de origen" : "Centro de destino"}>
                <select className={formClass()} onChange={(event) => setCenterId(event.target.value)} value={centerId}>
                  {bundle.centers.map((center) => (
                    <option key={center.centro_id} value={center.centro_id}>
                      {center.centro_id} · {center.nombre}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Producto">
                <select className={formClass()} onChange={(event) => selectProduct(event.target.value)} value={productId}>
                  {bundle.products.map((product) => (
                    <option key={product.producto_id} value={product.producto_id}>
                      {product.producto_id} · {product.nombre} ({product.unidad_base})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Presentación">
                <select className={formClass()} onChange={(event) => setSkuId(event.target.value)} value={skuId}>
                  {selectedProduct?.presentaciones.map((presentation) => (
                    <option key={presentation.sku_id} value={presentation.sku_id}>
                      {presentation.sku_id} · {presentation.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {localError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {localError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <SaveButton saving={saving} />
            <span className="font-mono text-xs text-slate-500">Operación: {operationId}</span>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Historial de movimientos</h2>
            <p className="mt-1 text-sm text-slate-600">Filtrado por el centro visible y por la fecha del acontecimiento.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Desde">
              <input className={formClass()} onChange={(event) => setFromDate(event.target.value)} type="datetime-local" value={fromDate} />
            </Field>
            <Field label="Hasta">
              <input className={formClass()} onChange={(event) => setToDate(event.target.value)} type="datetime-local" value={toDate} />
            </Field>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {[
                  "Ocurrido",
                  "Registrado",
                  "Tipo",
                  "Centro",
                  "Producto y presentación",
                  "Paquetes",
                  "Anunciado / diferencia",
                  "Operación",
                ].map((header) => (
                  <th className="whitespace-nowrap px-4 py-3 font-semibold" key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {history.length === 0 ? (
                <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={8}>No hay movimientos para el filtro seleccionado.</td></tr>
              ) : history.map((movement: MovementRecord) => {
                const product = products.get(movement.producto_id);
                const presentation = presentations.get(movement.sku_id);
                const centerId = movement.centro_destino_id ?? movement.centro_origen_id ?? "";
                const announced = movement.cantidad_anunciada_paquetes;
                const diff = announced === null ? null : movement.cantidad_paquetes - announced;
                const totalBaseUnits =
                  movement.cantidad_paquetes *
                  (presentation?.contenido_por_paquete ?? 0);
                const lagMinutes = Math.max(0, Math.round((new Date(movement.registrado_en).getTime() - new Date(movement.ocurrido_en).getTime()) / 60_000));
                return (
                  <tr key={movement.movimiento_id}>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(movement.ocurrido_en)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(movement.registrado_en)}<br /><span className="text-xs text-slate-500">{lagMinutes} min después</span></td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">{movement.tipo === "despacho" ? "Despacho" : "Recepción"}</td>
                    <td className="whitespace-nowrap px-4 py-3">{centers.get(centerId) ?? centerId}<br /><span className="font-mono text-xs text-slate-500">{centerId}</span></td>
                    <td className="whitespace-nowrap px-4 py-3">{product?.nombre ?? movement.producto_id}<br /><span className="font-mono text-xs text-slate-500">{presentation?.nombre ?? movement.sku_id}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">{numberFormatter.format(movement.cantidad_paquetes)} paquetes<br /><span className="text-xs font-normal text-slate-500">{numberFormatter.format(totalBaseUnits)} {product?.unidad_base ?? "unidades"}</span></td>
                    <td className="whitespace-nowrap px-4 py-3">{announced === null ? "Sin anuncio" : `${numberFormatter.format(announced)} / ${diff && diff > 0 ? "+" : ""}${numberFormatter.format(diff ?? 0)}`}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{movement.operacion_id}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
