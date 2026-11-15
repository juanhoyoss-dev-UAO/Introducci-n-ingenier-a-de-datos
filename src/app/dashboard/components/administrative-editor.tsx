import { useState, type FormEvent, type ReactNode } from "react";

import type { OperationalUpdate } from "@/contracts/schemas/operational-updates";
import type { DashboardBundle, DashboardTab } from "../types";

const fieldClass =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}

function EditorFrame({
  title,
  description,
  saving,
  error,
  children,
}: {
  title: string;
  description: string;
  saving: boolean;
  error: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-5 rounded-xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Actualización administrativa
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
        </div>
        <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-800">
          {saving ? "Guardando…" : "Publica una versión nueva"}
        </span>
      </div>
      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SaveButton({ saving }: { saving: boolean }) {
  return (
    <button
      className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={saving}
      type="submit"
    >
      {saving ? "Guardando…" : "Guardar en una versión nueva"}
    </button>
  );
}

export function AdministrativeEditor({
  activeTab,
  bundle,
  onSave,
}: {
  activeTab: DashboardTab;
  bundle: DashboardBundle;
  onSave: (update: OperationalUpdate) => Promise<void>;
}) {
  const firstCenter = bundle.centers[0];
  const firstProduct = bundle.products[0];
  const firstPresentation = firstProduct?.presentaciones[0];

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [centerMode, setCenterMode] = useState<"create" | "edit">(
    firstCenter ? "edit" : "create",
  );
  const [centerId, setCenterId] = useState(firstCenter?.centro_id ?? "");
  const [centerName, setCenterName] = useState(firstCenter?.nombre ?? "");
  const [centerStatus, setCenterStatus] = useState<"activo" | "inactivo">(
    firstCenter?.estado === "inactivo" ? "inactivo" : "activo",
  );
  const [centerZone, setCenterZone] = useState(firstCenter?.zona ?? "");
  const [centerCoordinator, setCenterCoordinator] = useState(
    firstCenter?.coordinador_nombre ?? "",
  );

  const inventoryQuantity = (centerIdValue: string, skuIdValue: string) =>
    bundle.dashboard.centros
      .find((center) => center.centro_id === centerIdValue)
      ?.productos.flatMap((product) => product.existencias)
      .find((stock) => stock.sku_id === skuIdValue)?.cantidad_paquetes ?? 0;
  const [inventoryCenterId, setInventoryCenterId] = useState(
    firstCenter?.centro_id ?? "",
  );
  const [inventoryProductId, setInventoryProductId] = useState(
    firstProduct?.producto_id ?? "",
  );
  const [inventorySkuId, setInventorySkuId] = useState(
    firstPresentation?.sku_id ?? "",
  );
  const [inventoryPackages, setInventoryPackages] = useState(
    inventoryQuantity(
      firstCenter?.centro_id ?? "",
      firstPresentation?.sku_id ?? "",
    ),
  );

  const needValues = (centerIdValue: string, productIdValue: string) =>
    bundle.dashboard.centros
      .find((center) => center.centro_id === centerIdValue)
      ?.productos.find((product) => product.producto_id === productIdValue);
  const initialNeed = needValues(
    firstCenter?.centro_id ?? "",
    firstProduct?.producto_id ?? "",
  );
  const [needCenterId, setNeedCenterId] = useState(firstCenter?.centro_id ?? "");
  const [needProductId, setNeedProductId] = useState(
    firstProduct?.producto_id ?? "",
  );
  const [needTarget, setNeedTarget] = useState(
    initialNeed?.objetivo_unidad_base ?? 0,
  );
  const [needPriority, setNeedPriority] = useState(
    initialNeed?.prioridad ?? 3,
  );

  const initialVolunteers = bundle.dashboard.centros.find(
    (center) => center.centro_id === firstCenter?.centro_id,
  )?.voluntarios;
  const [volunteerCenterId, setVolunteerCenterId] = useState(
    firstCenter?.centro_id ?? "",
  );
  const [volunteersAvailable, setVolunteersAvailable] = useState(
    initialVolunteers?.disponibles ?? 0,
  );
  const [volunteersRequired, setVolunteersRequired] = useState(
    initialVolunteers?.requeridos ?? 0,
  );

  async function submit(update: OperationalUpdate) {
    setSaving(true);
    setError("");
    try {
      await onSave(update);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible guardar la actualización.",
      );
    } finally {
      setSaving(false);
    }
  }

  function selectCenterForEdit(id: string) {
    const center = bundle.centers.find((item) => item.centro_id === id);
    if (!center) return;
    setCenterId(center.centro_id);
    setCenterName(center.nombre);
    setCenterStatus(center.estado === "inactivo" ? "inactivo" : "activo");
    setCenterZone(center.zona ?? "");
    setCenterCoordinator(center.coordinador_nombre);
  }

  function changeCenterMode(mode: "create" | "edit") {
    setCenterMode(mode);
    if (mode === "create") {
      setCenterId("");
      setCenterName("");
      setCenterStatus("activo");
      setCenterZone("");
      setCenterCoordinator("");
    } else if (firstCenter) {
      selectCenterForEdit(firstCenter.centro_id);
    }
  }

  if (activeTab === "centros") {
    const hasRelations = bundle.dashboard.centros.some(
      (center) =>
        center.centro_id === centerId &&
        (center.productos.some(
          (product) =>
            product.inventario_confirmado_unidad_base > 0 ||
            product.objetivo_unidad_base > 0,
        ) ||
          center.voluntarios.disponibles > 0 ||
          center.voluntarios.requeridos > 0),
    );
    return (
      <EditorFrame
        description="Crear o editar un centro publica un snapshot operativo nuevo. Desactivar no elimina inventario, necesidades, voluntarios ni donaciones relacionados."
        error={error}
        saving={saving}
        title="Gestionar centros"
      >
        <form
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void submit({
              operation: centerMode === "create" ? "create_center" : "update_center",
              values: {
                centro_id: centerId,
                nombre: centerName,
                estado: centerStatus,
                zona: centerZone || null,
                coordinador_nombre: centerCoordinator,
              },
            });
          }}
        >
          <Field label="Acción">
            <select className={fieldClass} disabled={saving} onChange={(event) => changeCenterMode(event.target.value as "create" | "edit")} value={centerMode}>
              <option value="edit">Editar centro existente</option>
              <option value="create">Crear centro</option>
            </select>
          </Field>
          {centerMode === "edit" ? (
            <Field label="Centro">
              <select className={fieldClass} disabled={saving} onChange={(event) => selectCenterForEdit(event.target.value)} value={centerId}>
                {bundle.centers.map((center) => (
                  <option key={center.centro_id} value={center.centro_id}>{center.centro_id} · {center.nombre}</option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Identificador">
              <input className={fieldClass} disabled={saving} maxLength={64} onChange={(event) => setCenterId(event.target.value)} required value={centerId} />
            </Field>
          )}
          <Field label="Nombre">
            <input className={fieldClass} disabled={saving} maxLength={160} onChange={(event) => setCenterName(event.target.value)} required value={centerName} />
          </Field>
          <Field label="Estado">
            <select className={fieldClass} disabled={saving} onChange={(event) => setCenterStatus(event.target.value as "activo" | "inactivo")} value={centerStatus}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </Field>
          <Field label="Zona">
            <input className={fieldClass} disabled={saving} maxLength={160} onChange={(event) => setCenterZone(event.target.value)} value={centerZone} />
          </Field>
          <Field label="Coordinación">
            <input className={fieldClass} disabled={saving} maxLength={160} onChange={(event) => setCenterCoordinator(event.target.value)} required value={centerCoordinator} />
          </Field>
          {centerMode === "edit" && centerStatus === "inactivo" && hasRelations ? (
            <p className="md:col-span-2 xl:col-span-3 text-sm text-amber-800">
              Este centro tiene registros relacionados. Se conservarán intactos; solo cambiará su estado.
            </p>
          ) : null}
          <div className="md:col-span-2 xl:col-span-3"><SaveButton saving={saving} /></div>
        </form>
      </EditorFrame>
    );
  }

  if (activeTab === "inventario") {
    const selectedProduct = bundle.products.find(
      (product) => product.producto_id === inventoryProductId,
    );
    return (
      <EditorFrame
        description="La cantidad representa paquetes físicos confirmados. Las donaciones pendientes no se incorporan al inventario."
        error={error}
        saving={saving}
        title="Actualizar inventario"
      >
        <form
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void submit({
              operation: "upsert_inventory",
              values: {
                centro_id: inventoryCenterId,
                producto_id: inventoryProductId,
                sku_id: inventorySkuId,
                cantidad_paquetes: inventoryPackages,
              },
            });
          }}
        >
          <Field label="Centro">
            <select className={fieldClass} disabled={saving} onChange={(event) => {
              const id = event.target.value;
              setInventoryCenterId(id);
              setInventoryPackages(inventoryQuantity(id, inventorySkuId));
            }} value={inventoryCenterId}>
              {bundle.centers.map((center) => <option key={center.centro_id} value={center.centro_id}>{center.centro_id} · {center.nombre}</option>)}
            </select>
          </Field>
          <Field label="Producto">
            <select className={fieldClass} disabled={saving} onChange={(event) => {
              const productId = event.target.value;
              const skuId = bundle.products.find((item) => item.producto_id === productId)?.presentaciones[0]?.sku_id ?? "";
              setInventoryProductId(productId);
              setInventorySkuId(skuId);
              setInventoryPackages(inventoryQuantity(inventoryCenterId, skuId));
            }} value={inventoryProductId}>
              {bundle.products.map((product) => <option key={product.producto_id} value={product.producto_id}>{product.producto_id} · {product.nombre} ({product.unidad_base})</option>)}
            </select>
          </Field>
          <Field label="Presentación">
            <select className={fieldClass} disabled={saving} onChange={(event) => {
              const skuId = event.target.value;
              setInventorySkuId(skuId);
              setInventoryPackages(inventoryQuantity(inventoryCenterId, skuId));
            }} value={inventorySkuId}>
              {selectedProduct?.presentaciones.map((presentation) => <option key={presentation.sku_id} value={presentation.sku_id}>{presentation.sku_id} · {presentation.nombre}</option>)}
            </select>
          </Field>
          <Field label="Paquetes confirmados">
            <input className={fieldClass} disabled={saving} min={0} onChange={(event) => setInventoryPackages(event.target.valueAsNumber)} required step={1} type="number" value={inventoryPackages} />
          </Field>
          <div className="md:col-span-2 xl:col-span-4"><SaveButton saving={saving} /></div>
        </form>
      </EditorFrame>
    );
  }

  if (activeTab === "necesidades") {
    const selectedProduct = bundle.products.find(
      (product) => product.producto_id === needProductId,
    );
    const refreshNeed = (centerIdValue: string, productIdValue: string) => {
      const values = needValues(centerIdValue, productIdValue);
      setNeedTarget(values?.objetivo_unidad_base ?? 0);
      setNeedPriority(values?.prioridad ?? 3);
    };
    return (
      <EditorFrame
        description="Un objetivo igual a cero deja el producto sin necesidad vigente. La reserva existente se conserva y las prioridades usan la escala 1–3."
        error={error}
        saving={saving}
        title="Actualizar necesidades"
      >
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void submit({ operation: "upsert_need", values: { centro_id: needCenterId, producto_id: needProductId, objetivo_unidad_base: needTarget, prioridad: needPriority } });
        }}>
          <Field label="Centro">
            <select className={fieldClass} disabled={saving} onChange={(event) => { const id = event.target.value; setNeedCenterId(id); refreshNeed(id, needProductId); }} value={needCenterId}>
              {bundle.centers.map((center) => <option key={center.centro_id} value={center.centro_id}>{center.centro_id} · {center.nombre}</option>)}
            </select>
          </Field>
          <Field label="Producto">
            <select className={fieldClass} disabled={saving} onChange={(event) => { const id = event.target.value; setNeedProductId(id); refreshNeed(needCenterId, id); }} value={needProductId}>
              {bundle.products.map((product) => <option key={product.producto_id} value={product.producto_id}>{product.producto_id} · {product.nombre}</option>)}
            </select>
          </Field>
          <Field label={`Cantidad objetivo (${selectedProduct?.unidad_base ?? "unidad"})`}>
            <input className={fieldClass} disabled={saving} min={0} onChange={(event) => setNeedTarget(event.target.valueAsNumber)} required step="any" type="number" value={needTarget} />
          </Field>
          <Field label="Prioridad">
            <select className={fieldClass} disabled={saving} onChange={(event) => setNeedPriority(Number(event.target.value))} value={needPriority}>
              <option value={1}>1 · Alta</option><option value={2}>2 · Media</option><option value={3}>3 · Baja</option>
            </select>
          </Field>
          <div className="md:col-span-2 xl:col-span-4"><SaveButton saving={saving} /></div>
        </form>
      </EditorFrame>
    );
  }

  if (activeTab === "voluntarios") {
    const missing = Math.max(0, volunteersRequired - volunteersAvailable);
    return (
      <EditorFrame
        description="Solo se guardan cantidades agregadas. No se crean cuentas ni datos personales de voluntarios."
        error={error}
        saving={saving}
        title="Actualizar voluntarios"
      >
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void submit({ operation: "upsert_volunteers", values: { centro_id: volunteerCenterId, disponibles: volunteersAvailable, requeridos: volunteersRequired } });
        }}>
          <Field label="Centro">
            <select className={fieldClass} disabled={saving} onChange={(event) => {
              const id = event.target.value;
              const values = bundle.dashboard.centros.find((center) => center.centro_id === id)?.voluntarios;
              setVolunteerCenterId(id);
              setVolunteersAvailable(values?.disponibles ?? 0);
              setVolunteersRequired(values?.requeridos ?? 0);
            }} value={volunteerCenterId}>
              {bundle.centers.map((center) => <option key={center.centro_id} value={center.centro_id}>{center.centro_id} · {center.nombre}</option>)}
            </select>
          </Field>
          <Field label="Disponibles">
            <input className={fieldClass} disabled={saving} min={0} onChange={(event) => setVolunteersAvailable(event.target.valueAsNumber)} required step={1} type="number" value={volunteersAvailable} />
          </Field>
          <Field label="Requeridos">
            <input className={fieldClass} disabled={saving} min={0} onChange={(event) => setVolunteersRequired(event.target.valueAsNumber)} required step={1} type="number" value={volunteersRequired} />
          </Field>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            Personal faltante calculado<br /><strong className="text-xl text-slate-950">{missing}</strong>
          </div>
          <div className="md:col-span-2 xl:col-span-4"><SaveButton saving={saving} /></div>
        </form>
      </EditorFrame>
    );
  }

  return null;
}
