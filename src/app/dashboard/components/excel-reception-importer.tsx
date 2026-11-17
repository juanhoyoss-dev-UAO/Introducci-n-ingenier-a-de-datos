"use client";

import { useState } from "react";

import type {
  ExcelReceptionImportResult,
  ExcelReceptionPreview,
  TestingScenarioResetResult,
} from "@/contracts/types/excel-receptions";
import { isWeeklyTestingScenario } from "@/lib/operational-scenarios";
import type { ApiFailure, ApiSuccess, SnapshotRecord } from "../types";

const numberFormatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

async function responseData<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as ApiSuccess<T> | ApiFailure;
  if (!response.ok || !("data" in body)) {
    const failure = body as ApiFailure;
    throw new UploadError(failure.error?.message ?? "No fue posible procesar la solicitud.");
  }
  return body.data;
}

async function postFile<T>(url: string, file: File) {
  const form = new FormData();
  form.set("archivo", file);
  return responseData<T>(await fetch(url, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    body: form,
  }));
}

async function resetTestingScenario() {
  return responseData<TestingScenarioResetResult>(await fetch("/api/testing-scenario/reset", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operacion_id: crypto.randomUUID() }),
  }));
}

function formatCoverage(value: number | null) {
  return value === null ? "No calculable" : `${numberFormatter.format(value)} %`;
}

export function ExcelReceptionImporter({
  snapshot,
  latestResult,
  onImportComplete,
  onResetComplete,
}: {
  snapshot: SnapshotRecord;
  latestResult: ExcelReceptionImportResult | null;
  onImportComplete: (result: ExcelReceptionImportResult) => void;
  onResetComplete: (result: TestingScenarioResetResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExcelReceptionPreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | "reset" | null>(null);
  const [error, setError] = useState("");
  const testing = isWeeklyTestingScenario(snapshot);

  async function previewFile() {
    if (!file) return;
    setBusy("preview");
    setError("");
    try {
      const value = await postFile<ExcelReceptionPreview>(
        `/api/snapshots/${encodeURIComponent(snapshot.id)}/excel-import/preview`,
        file,
      );
      setPreview(value);
    } catch (caught) {
      setPreview(null);
      setError(caught instanceof Error ? caught.message : "No fue posible validar el archivo.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmImport() {
    if (!file || !preview?.valido) return;
    setBusy("import");
    setError("");
    try {
      const result = await postFile<ExcelReceptionImportResult>(
        `/api/snapshots/${encodeURIComponent(snapshot.id)}/excel-import`,
        file,
      );
      onImportComplete(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible importar el archivo.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmReset() {
    if (!window.confirm("¿Restaurar PRUEBAS con el inventario del cierre inmutable de MAIN? Se recalcularán sus indicadores y alertas sin modificar MAIN.")) return;
    setBusy("reset");
    setError("");
    try {
      onResetComplete(await resetTestingScenario());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible reiniciar PRUEBAS.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">Actualización controlada</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">Actualizar inventario desde Excel</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Las filas se validan primero y se publican juntas como recepciones nuevas. MAIN permanece en solo lectura.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60" disabled={busy !== null} onClick={() => void confirmReset()} type="button">
            {busy === "reset" ? "Reiniciando…" : "Reiniciar PRUEBAS desde MAIN"}
          </button>
          <button className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400" disabled={!testing} onClick={() => setOpen((value) => !value)} type="button">
            {open ? "Cerrar carga" : "Actualizar inventario desde Excel"}
          </button>
        </div>
      </div>

      {!testing ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Este escenario es de solo lectura. Selecciona Emergencia semanal — PRUEBAS para importar recepciones.
        </p>
      ) : null}

      {open && testing ? (
        <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
          <label className="block text-sm font-semibold text-slate-800">
            Archivo XLSX (máximo 1 MB y 100 filas)
            <input
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setError("");
              }}
              type="file"
            />
          </label>
          <button className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50" disabled={!file || busy !== null} onClick={() => void previewFile()} type="button">
            {busy === "preview" ? "Validando…" : "Previsualizar y validar"}
          </button>

          {preview ? (
            <div className="space-y-3">
              <p className={`rounded-lg border px-4 py-3 text-sm ${preview.valido ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
                {preview.valido
                  ? `${preview.total_filas} filas válidas y ${preview.total_paquetes} paquetes listos para confirmar.`
                  : "El archivo tiene errores. No se publicará ninguna fila."}
              </p>
              {preview.errores.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-rose-800">
                  {preview.errores.map((item, index) => <li key={`${item.codigo}-${item.fila}-${index}`}>{item.fila ? `Fila ${item.fila}: ` : ""}{item.mensaje}</li>)}
                </ul>
              ) : null}
              {preview.filas.length > 0 ? (
                <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="px-3 py-2">Centro</th><th className="px-3 py-2">Producto</th><th className="px-3 py-2">Presentación</th><th className="px-3 py-2">Paquetes</th><th className="px-3 py-2">Recepción</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.filas.map((row) => <tr key={row.operacion_id}><td className="px-3 py-2">{row.centro_id} · {row.centro_nombre}</td><td className="px-3 py-2">{row.producto_nombre}</td><td className="px-3 py-2">{row.sku_id} · {row.presentacion_nombre}</td><td className="px-3 py-2 tabular-nums">{row.cantidad_paquetes}</td><td className="whitespace-nowrap px-3 py-2">{row.recibido_en}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <button className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50" disabled={!preview.valido || busy !== null} onClick={() => void confirmImport()} type="button">
                {busy === "import" ? "Publicando recepción…" : "Confirmar importación"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p> : null}

      {latestResult ? (
        <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
          <div>
            <h4 className="font-semibold text-emerald-900">{latestResult.idempotent ? "Recepción ya registrada" : "Recepción registrada correctamente"}</h4>
            <p className="mt-1 text-sm text-slate-600">Alertas activas: {latestResult.alertas_antes} antes y {latestResult.alertas_despues} después. Resueltas: {latestResult.alertas_resueltas.length}; con severidad reducida: {latestResult.alertas_reducidas.length}.</p>
          </div>
          {latestResult.efectos.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr><th className="px-3 py-2">Centro / producto</th><th className="px-3 py-2">Recibido</th><th className="px-3 py-2">Inventario</th><th className="px-3 py-2">Necesidad</th><th className="px-3 py-2">Cobertura</th><th className="px-3 py-2">Déficit</th></tr></thead><tbody className="divide-y divide-slate-100">
                {latestResult.efectos.map((effect) => <tr key={`${effect.centro_id}-${effect.producto_id}`}><td className="px-3 py-2"><strong>{effect.centro_nombre}</strong><br />{effect.producto_nombre}</td><td className="px-3 py-2">{effect.cantidad_recibida_paquetes} paquetes<br />{numberFormatter.format(effect.cantidad_recibida_unidad_base)} {effect.unidad_base}</td><td className="px-3 py-2">{numberFormatter.format(effect.inventario_anterior)} → {numberFormatter.format(effect.inventario_nuevo)} {effect.unidad_base}</td><td className="px-3 py-2">{numberFormatter.format(effect.necesidad_vigente)} {effect.unidad_base}</td><td className="px-3 py-2">{formatCoverage(effect.cobertura_anterior)} → {formatCoverage(effect.cobertura_nueva)}</td><td className="px-3 py-2">{numberFormatter.format(effect.deficit_anterior)} → {numberFormatter.format(effect.deficit_nuevo)} {effect.unidad_base}</td></tr>)}
              </tbody></table>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            {[["Alertas resueltas", latestResult.alertas_resueltas], ["Severidad reducida", latestResult.alertas_reducidas], ["Permanecen activas", latestResult.alertas_activas_afectadas]].map(([label, items]) => (
              <div className="rounded-lg bg-slate-50 p-3" key={label as string}><p className="text-xs font-bold uppercase text-slate-600">{label as string}</p><ul className="mt-2 space-y-1 text-sm text-slate-700">{(items as ExcelReceptionImportResult["alertas_resueltas"]).length === 0 ? <li>Ninguna</li> : (items as ExcelReceptionImportResult["alertas_resueltas"]).map((item) => <li key={item.alerta_id}>{item.centro_nombre}{item.producto_nombre ? ` · ${item.producto_nombre}` : ""}</li>)}</ul></div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
