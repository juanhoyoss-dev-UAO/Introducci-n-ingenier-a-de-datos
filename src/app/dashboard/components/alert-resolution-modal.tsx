"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import type { MovementOperation } from "@/contracts/schemas/movement-operations";
import type { OperationalAlert } from "@/contracts/types/alerts";
import {
  bogotaLocalToIso,
  calculateReceiptPreview,
  toBogotaLocalInput,
  validPackageQuantity,
  type AlertReceptionContext,
} from "../alert-resolution";
import { alertGroupId } from "../alert-groups";
import type { DashboardProduct, ProductRecord } from "../types";

const numberFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
});

function formatValue(value: number, unit: DashboardProduct["unidad_base"]) {
  const suffix = unit === "unidad" && value !== 1 ? "unidades" : unit;
  return `${numberFormatter.format(value)} ${suffix}`;
}

function formatCoverage(value: number | null) {
  return value === null ? "N/D" : `${numberFormatter.format(value)} %`;
}

export function AlertResolutionModal({
  alert,
  dashboardProduct,
  evaluationTime,
  product,
  onCancel,
  onSave,
}: {
  alert: OperationalAlert;
  dashboardProduct: DashboardProduct;
  evaluationTime: string;
  product: ProductRecord;
  onCancel: () => void;
  onSave: (
    update: MovementOperation,
    context: AlertReceptionContext,
  ) => Promise<void>;
}) {
  const [skuId, setSkuId] = useState(product.presentaciones[0]?.sku_id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [occurredAt, setOccurredAt] = useState(() =>
    toBogotaLocalInput(evaluationTime),
  );
  const [operationId] = useState(() => globalThis.crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const presentationRef = useRef<HTMLSelectElement>(null);
  const presentation = product.presentaciones.find(
    (item) => item.sku_id === skuId,
  );
  const packagesReceived = Number(quantity);
  const preview = presentation
    ? calculateReceiptPreview(
        dashboardProduct.inventario_confirmado_unidad_base,
        dashboardProduct.objetivo_unidad_base,
        presentation.contenido_por_paquete,
        packagesReceived,
      )
    : null;

  useEffect(() => {
    presentationRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onCancel();
    }
    globalThis.addEventListener("keydown", closeOnEscape);
    return () => globalThis.removeEventListener("keydown", closeOnEscape);
  }, [onCancel, saving]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (!presentation || !preview) {
      setError(
        validPackageQuantity(packagesReceived)
          ? "Selecciona una presentación válida."
          : "La cantidad recibida debe ser un entero mayor que cero.",
      );
      return;
    }
    const occurredAtIso = bogotaLocalToIso(occurredAt);
    if (!occurredAtIso) {
      setError("La fecha y hora de recepción no es válida.");
      return;
    }
    if (new Date(occurredAtIso).getTime() > new Date(evaluationTime).getTime()) {
      setError(
        "La recepción no puede quedar después de la hora operativa evaluada.",
      );
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          operation: "direct_reception",
          values: {
            operacion_id: operationId,
            centro_id: alert.centro_id,
            producto_id: dashboardProduct.producto_id,
            sku_id: presentation.sku_id,
            cantidad_paquetes: packagesReceived,
            ocurrido_en: occurredAtIso,
          },
        },
        {
          groupId: alertGroupId(alert),
          centerId: alert.centro_id,
          centerName: alert.centro_nombre,
          productId: dashboardProduct.producto_id,
          productName: dashboardProduct.nombre,
          unit: dashboardProduct.unidad_base,
          previousInventory:
            dashboardProduct.inventario_confirmado_unidad_base,
          previousCoverage: dashboardProduct.cobertura_porcentaje,
          previousSeverity: alert.severidad,
          packagesReceived,
          incomingBaseUnits: preview.incomingBaseUnits,
          presentationName: presentation.nombre,
        },
      );
      onCancel();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible guardar la recepción.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      aria-labelledby="alert-resolution-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
    >
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
              Recepción directa en PRUEBAS
            </p>
            <h3
              className="mt-1 text-xl font-semibold text-slate-950"
              id="alert-resolution-title"
            >
              Solucionar alerta
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {alert.centro_nombre} · {dashboardProduct.nombre}
            </p>
          </div>
          <button
            aria-label="Cerrar formulario"
            className="rounded-lg px-3 py-1.5 text-xl text-slate-500 hover:bg-slate-100"
            disabled={saving}
            onClick={onCancel}
            type="button"
          >
            ×
          </button>
        </div>

        <dl className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">
              Inventario actual
            </dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {formatValue(
                dashboardProduct.inventario_confirmado_unidad_base,
                dashboardProduct.unidad_base,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">
              Necesidad vigente
            </dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {formatValue(
                dashboardProduct.objetivo_unidad_base,
                dashboardProduct.unidad_base,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">
              Déficit actual
            </dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {formatValue(
                dashboardProduct.deficit_confirmado_unidad_base,
                dashboardProduct.unidad_base,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">
              Cobertura
            </dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {formatCoverage(dashboardProduct.cobertura_porcentaje)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">
              Severidad
            </dt>
            <dd className="mt-1 font-semibold capitalize text-slate-950">
              {alert.severidad}
            </dd>
          </div>
        </dl>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Presentación
              <select
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setSkuId(event.target.value)}
                ref={presentationRef}
                required
                value={skuId}
              >
                {product.presentaciones.map((item) => (
                  <option key={item.sku_id} value={item.sku_id}>
                    {item.nombre} · {numberFormatter.format(item.contenido_por_paquete)} {dashboardProduct.unidad_base}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Paquetes recibidos
              <input
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                min="1"
                onChange={(event) => setQuantity(event.target.value)}
                required
                step="1"
                type="number"
                value={quantity}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Fecha y hora de recepción
              <input
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                max={toBogotaLocalInput(evaluationTime)}
                onChange={(event) => setOccurredAt(event.target.value)}
                required
                type="datetime-local"
                value={occurredAt}
              />
            </label>
          </div>

          <section aria-label="Vista previa de recepción" className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h4 className="font-semibold text-blue-950">Vista previa</h4>
            {preview ? (
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-blue-700">Inventario actual</dt><dd className="font-semibold text-blue-950">{formatValue(dashboardProduct.inventario_confirmado_unidad_base, dashboardProduct.unidad_base)}</dd></div>
                <div><dt className="text-blue-700">Cantidad que ingresará</dt><dd className="font-semibold text-blue-950">{formatValue(preview.incomingBaseUnits, dashboardProduct.unidad_base)}</dd></div>
                <div><dt className="text-blue-700">Inventario estimado</dt><dd className="font-semibold text-blue-950">{formatValue(preview.estimatedInventory, dashboardProduct.unidad_base)}</dd></div>
                <div><dt className="text-blue-700">Cobertura estimada</dt><dd className="font-semibold text-blue-950">{formatCoverage(preview.estimatedCoverage)}</dd></div>
                <div><dt className="text-blue-700">Déficit restante</dt><dd className="font-semibold text-blue-950">{formatValue(preview.remainingDeficit, dashboardProduct.unidad_base)}</dd></div>
                <div><dt className="text-blue-700">Excedente bruto</dt><dd className="font-semibold text-blue-950">{formatValue(preview.grossSurplus, dashboardProduct.unidad_base)}</dd></div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-red-800">
                Introduce una cantidad entera mayor que cero.
              </p>
            )}
          </section>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={saving}
              onClick={onCancel}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving || !preview || !occurredAt}
              type="submit"
            >
              {saving ? "Guardando recepción…" : "Guardar recepción"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
