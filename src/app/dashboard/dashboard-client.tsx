"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { logger } from "@/lib/logger";
import {
  centerRows,
  deriveSummary,
  donationRows,
  inventoryRows,
  needRows,
  sortSnapshots,
  travelTimeRows,
  volunteerRows,
} from "./view-model";
import type {
  ApiFailure,
  ApiSuccess,
  CenterFilter,
  CenterRecord,
  DashboardBundle,
  DashboardData,
  DashboardTab,
  HealthState,
  ProductRecord,
  SessionState,
  SessionUser,
  SnapshotRecord,
  TravelTimeRecord,
} from "./types";

const TABS: ReadonlyArray<{ id: DashboardTab; label: string }> = [
  { id: "centros", label: "Centros" },
  { id: "inventario", label: "Inventario" },
  { id: "necesidades", label: "Necesidades" },
  { id: "voluntarios", label: "Voluntarios" },
  { id: "donaciones", label: "Donaciones esperadas" },
  { id: "tiempos", label: "Tiempos de traslado" },
];

const numberFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function fetchApi<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  const body = (await response.json().catch(() => ({}))) as
    | ApiSuccess<T>
    | ApiFailure;

  if (!response.ok) {
    const failure = body as ApiFailure;
    throw new ApiClientError(
      response.status,
      failure.error?.code ?? "REQUEST_ERROR",
      failure.error?.message ?? "No fue posible consultar la información.",
    );
  }
  if (!("data" in body)) {
    throw new ApiClientError(
      500,
      "INVALID_RESPONSE",
      "El servidor devolvió una respuesta inesperada.",
    );
  }
  return body.data;
}

function formatUnits(value: number, unit: "ml" | "g" | "unidad") {
  const suffix = unit === "unidad" && value !== 1 ? "unidades" : unit;
  return `${numberFormatter.format(value)} ${suffix}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function TableFrame({
  headers,
  children,
  empty,
}: {
  headers: readonly string[];
  children: ReactNode;
  empty: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {headers.map((header) => (
              <th className="whitespace-nowrap px-4 py-3 font-semibold" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {empty ? (
            <tr>
              <td className="px-4 py-10 text-center text-slate-500" colSpan={headers.length}>
                No hay registros para el filtro seleccionado.
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

function Identifier({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-xs font-semibold text-slate-500">
      {children}
    </span>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
        {numberFormatter.format(value)}
      </p>
    </article>
  );
}

export default function DashboardClient({
  initialUser,
}: {
  initialUser: SessionUser;
}) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [centerFilter, setCenterFilter] = useState<CenterFilter>("all");
  const [activeTab, setActiveTab] = useState<DashboardTab>("centros");
  const [bundle, setBundle] = useState<DashboardBundle | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    logger.info("UI", "navigation", { destination: "/dashboard" });

    async function bootstrap() {
      try {
        const [health, session, availableSnapshots] = await Promise.all([
          fetchApi<HealthState>("/api/health", controller.signal),
          fetchApi<SessionState>("/api/auth/me", controller.signal),
          fetchApi<SnapshotRecord[]>("/api/snapshots", controller.signal),
        ]);
        if (!current) {
          return;
        }
        if (health.status !== "ok") {
          throw new ApiClientError(
            503,
            "HEALTH_CHECK_FAILED",
            "El backend local no está disponible.",
          );
        }
        if (!session.authenticated || session.user?.role !== "admin") {
          logger.warn("UI", "session_missing");
          router.replace("/login");
          router.refresh();
          return;
        }

        const orderedSnapshots = sortSnapshots(availableSnapshots);
        setUser(session.user);
        setSnapshots(orderedSnapshots);
        setLoading(orderedSnapshots.length > 0);
        setSelectedSnapshotId(orderedSnapshots[0]?.id ?? "");
        logger.ok("UI", "snapshots_loaded", {
          count: orderedSnapshots.length,
          selectedSnapshotId: orderedSnapshots[0]?.id ?? null,
        });
      } catch (caught) {
        if (!current || controller.signal.aborted) {
          return;
        }
        if (caught instanceof ApiClientError && caught.status === 401) {
          router.replace("/login");
          router.refresh();
          return;
        }
        const message =
          caught instanceof Error
            ? caught.message
            : "No fue posible iniciar la consola administrativa.";
        setError(message);
        logger.error("UI", "bootstrap_error", { message });
      } finally {
        if (current) {
          setBootstrapping(false);
        }
      }
    }

    void bootstrap();
    return () => {
      current = false;
      controller.abort();
    };
  }, [router]);

  useEffect(() => {
    if (!selectedSnapshotId) {
      return;
    }

    const controller = new AbortController();
    let current = true;
    logger.info("UI", "snapshot_load_started", {
      snapshotId: selectedSnapshotId,
    });

    async function loadSnapshot() {
      const query = encodeURIComponent(selectedSnapshotId);
      try {
        const [snapshot, centers, products, travelTimes, dashboard] =
          await Promise.all([
            fetchApi<SnapshotRecord>(
              `/api/snapshots/${encodeURIComponent(selectedSnapshotId)}`,
              controller.signal,
            ),
            fetchApi<CenterRecord[]>(
              `/api/centers?snapshotId=${query}`,
              controller.signal,
            ),
            fetchApi<ProductRecord[]>(
              `/api/products?snapshotId=${query}`,
              controller.signal,
            ),
            fetchApi<TravelTimeRecord[]>(
              `/api/travel-times?snapshotId=${query}`,
              controller.signal,
            ),
            fetchApi<DashboardData>(
              `/api/dashboard?snapshotId=${query}`,
              controller.signal,
            ),
          ]);

        if (!current || controller.signal.aborted) {
          return;
        }
        if (
          snapshot.id !== selectedSnapshotId ||
          dashboard.snapshot.id !== selectedSnapshotId
        ) {
          throw new ApiClientError(
            409,
            "SNAPSHOT_MISMATCH",
            "La respuesta no corresponde al snapshot seleccionado.",
          );
        }

        setBundle({ snapshot, centers, products, travelTimes, dashboard });
        logger.ok("UI", "snapshot_load_completed", {
          snapshotId: selectedSnapshotId,
          centers: centers.length,
          products: products.length,
          travelTimes: travelTimes.length,
        });
      } catch (caught) {
        if (!current || controller.signal.aborted) {
          return;
        }
        if (caught instanceof ApiClientError && caught.status === 401) {
          router.replace("/login");
          router.refresh();
          return;
        }
        const message =
          caught instanceof Error
            ? caught.message
            : "No fue posible cargar el snapshot seleccionado.";
        setBundle(null);
        setError(message);
        logger.error("UI", "snapshot_load_error", {
          snapshotId: selectedSnapshotId,
          message,
        });
      } finally {
        if (current) {
          setLoading(false);
        }
      }
    }

    void loadSnapshot();
    return () => {
      current = false;
      controller.abort();
    };
  }, [reloadToken, router, selectedSnapshotId]);

  const summary = useMemo(
    () => (bundle ? deriveSummary(bundle) : null),
    [bundle],
  );
  const filteredCenters = useMemo(
    () => (bundle ? centerRows(bundle.centers, centerFilter) : []),
    [bundle, centerFilter],
  );
  const filteredInventory = useMemo(
    () => (bundle ? inventoryRows(bundle, centerFilter) : []),
    [bundle, centerFilter],
  );
  const filteredNeeds = useMemo(
    () =>
      bundle ? needRows(bundle.dashboard.centros, centerFilter) : [],
    [bundle, centerFilter],
  );
  const filteredVolunteers = useMemo(
    () =>
      bundle ? volunteerRows(bundle.dashboard.centros, centerFilter) : [],
    [bundle, centerFilter],
  );
  const filteredDonations = useMemo(
    () => (bundle ? donationRows(bundle, centerFilter) : []),
    [bundle, centerFilter],
  );
  const filteredTravelTimes = useMemo(
    () =>
      bundle ? travelTimeRows(bundle.travelTimes, centerFilter) : [],
    [bundle, centerFilter],
  );
  const centerNames = useMemo(
    () => new Map(bundle?.centers.map((center) => [center.centro_id, center.nombre])),
    [bundle],
  );

  async function handleLogout() {
    setLoggingOut(true);
    setError("");
    logger.info("UI", "logout_started");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("No fue posible cerrar la sesión.");
      }
      logger.ok("UI", "logout_completed");
      router.replace("/login");
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "No fue posible cerrar la sesión.";
      setError(message);
      logger.error("UI", "logout_error", { message });
    } finally {
      setLoggingOut(false);
    }
  }

  function selectSnapshot(snapshotId: string) {
    if (snapshotId === selectedSnapshotId) {
      return;
    }
    logger.info("UI", "snapshot_selected", { snapshotId });
    setBundle(null);
    setCenterFilter("all");
    setError("");
    setLoading(true);
    setSelectedSnapshotId(snapshotId);
  }

  function retrySnapshot() {
    setBundle(null);
    setCenterFilter("all");
    setError("");
    setLoading(true);
    setReloadToken((value) => value + 1);
  }

  function selectCenter(centerId: CenterFilter) {
    logger.info("UI", "center_filter_selected", { centerId });
    setCenterFilter(centerId);
  }

  function renderActiveTable() {
    if (!bundle) {
      return null;
    }

    if (activeTab === "centros") {
      return (
        <TableFrame
          headers={["ID", "Centro", "Estado", "Zona", "Coordinación"]}
          empty={filteredCenters.length === 0}
        >
          {filteredCenters.map((center) => (
            <tr key={center.centro_id}>
              <td className="px-4 py-3"><Identifier>{center.centro_id}</Identifier></td>
              <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">{center.nombre}</td>
              <td className="px-4 py-3">{center.estado}</td>
              <td className="px-4 py-3">{center.zona ?? "Sin zona"}</td>
              <td className="whitespace-nowrap px-4 py-3">{center.coordinador_nombre}</td>
            </tr>
          ))}
        </TableFrame>
      );
    }

    if (activeTab === "inventario") {
      return (
        <TableFrame
          headers={["Centro", "Producto", "Presentación", "Paquetes", "Contenido", "Subtotal presentación", "Total producto"]}
          empty={filteredInventory.length === 0}
        >
          {filteredInventory.map((row) => (
            <tr key={`${row.centro_id}-${row.sku_id}`}>
              <td className="whitespace-nowrap px-4 py-3"><span className="font-medium text-slate-950">{row.centro_nombre}</span><br /><Identifier>{row.centro_id}</Identifier></td>
              <td className="whitespace-nowrap px-4 py-3">{row.producto_nombre}<br /><Identifier>{row.producto_id}</Identifier></td>
              <td className="whitespace-nowrap px-4 py-3">{row.presentacion_nombre}<br /><Identifier>{row.sku_id}</Identifier></td>
              <td className="px-4 py-3 tabular-nums">{numberFormatter.format(row.cantidad_paquetes)}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatUnits(row.contenido_por_paquete, row.unidad_base)}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatUnits(row.subtotal_presentacion_unidad_base, row.unidad_base)}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-slate-950">{formatUnits(row.total_producto_unidad_base, row.unidad_base)}</td>
            </tr>
          ))}
        </TableFrame>
      );
    }

    if (activeTab === "necesidades") {
      return (
        <TableFrame
          headers={["Centro", "Producto", "Objetivo", "Confirmado", "Déficit", "Prioridad"]}
          empty={filteredNeeds.length === 0}
        >
          {filteredNeeds.map((row) => (
            <tr key={`${row.centro_id}-${row.producto_id}`}>
              <td className="whitespace-nowrap px-4 py-3"><span className="font-medium text-slate-950">{row.centro_nombre}</span><br /><Identifier>{row.centro_id}</Identifier></td>
              <td className="whitespace-nowrap px-4 py-3">{row.producto_nombre}<br /><Identifier>{row.producto_id}</Identifier></td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatUnits(row.objetivo_unidad_base, row.unidad_base)}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatUnits(row.inventario_confirmado_unidad_base, row.unidad_base)}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-amber-700">{formatUnits(row.deficit_confirmado_unidad_base, row.unidad_base)}</td>
              <td className="px-4 py-3">{row.prioridad === null ? "Sin prioridad" : `P${row.prioridad}`}</td>
            </tr>
          ))}
        </TableFrame>
      );
    }

    if (activeTab === "voluntarios") {
      return (
        <TableFrame
          headers={["Centro", "Disponibles", "Requeridos", "Faltantes"]}
          empty={filteredVolunteers.length === 0}
        >
          {filteredVolunteers.map((row) => (
            <tr key={row.centro_id}>
              <td className="whitespace-nowrap px-4 py-3"><span className="font-medium text-slate-950">{row.centro_nombre}</span><br /><Identifier>{row.centro_id}</Identifier></td>
              <td className="px-4 py-3 tabular-nums">{numberFormatter.format(row.disponibles)}</td>
              <td className="px-4 py-3 tabular-nums">{numberFormatter.format(row.requeridos)}</td>
              <td className="px-4 py-3 font-semibold tabular-nums text-amber-700">{numberFormatter.format(row.faltantes)}</td>
            </tr>
          ))}
        </TableFrame>
      );
    }

    if (activeTab === "donaciones") {
      return (
        <TableFrame
          headers={["Intención", "Centro", "Producto", "Presentación", "Paquetes", "Total anunciado", "Llegada", "Estado"]}
          empty={filteredDonations.length === 0}
        >
          {filteredDonations.map((row) => (
            <tr key={row.intencion_id}>
              <td className="px-4 py-3"><Identifier>{row.intencion_id}</Identifier></td>
              <td className="whitespace-nowrap px-4 py-3">{row.centro_nombre}<br /><Identifier>{row.centro_id}</Identifier></td>
              <td className="whitespace-nowrap px-4 py-3">{row.producto_nombre}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.presentacion_nombre}<br /><Identifier>{row.sku_id}</Identifier></td>
              <td className="px-4 py-3 tabular-nums">{numberFormatter.format(row.cantidad_paquetes)}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-blue-700">{formatUnits(row.total_unidad_base, row.unidad_base)}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatDate(row.llegada_prevista)}</td>
              <td className="px-4 py-3">{row.estado}</td>
            </tr>
          ))}
        </TableFrame>
      );
    }

    return (
      <TableFrame
        headers={["Origen", "Destino", "Tiempo dirigido"]}
        empty={filteredTravelTimes.length === 0}
      >
        {filteredTravelTimes.map((row) => (
          <tr key={`${row.origen_id}-${row.destino_id}`}>
            <td className="whitespace-nowrap px-4 py-3"><span className="font-medium text-slate-950">{centerNames.get(row.origen_id) ?? row.origen_id}</span><br /><Identifier>{row.origen_id}</Identifier></td>
            <td className="whitespace-nowrap px-4 py-3"><span className="font-medium text-slate-950">{centerNames.get(row.destino_id) ?? row.destino_id}</span><br /><Identifier>{row.destino_id}</Identifier></td>
            <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">{numberFormatter.format(row.minutos)} min</td>
          </tr>
        ))}
      </TableFrame>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Redes de Ayuda</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Consola administrativa</h1>
            <p className="mt-1 text-sm text-slate-300">Inspección operativa de snapshots CSV</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
              <span className="text-slate-400">Administrador</span>{" "}
              <strong>{user.username}</strong>
            </div>
            <div className="max-w-sm rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
              <span className="text-slate-400">Snapshot</span>{" "}
              <strong>{bundle?.snapshot.nombre ?? "Sin cargar"}</strong>
            </div>
            <button
              className="rounded-lg border border-slate-600 px-3 py-2 font-medium transition hover:border-white hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
              type="button"
            >
              {loggingOut ? "Cerrando…" : "Cerrar sesión"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8">
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Snapshot operativo
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              disabled={bootstrapping || snapshots.length === 0}
              onChange={(event) => selectSnapshot(event.target.value)}
              value={selectedSnapshotId}
            >
              {snapshots.length === 0 ? <option value="">Sin snapshots disponibles</option> : null}
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshot.nombre} · {formatDate(snapshot.created_at)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Centro visible
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              disabled={!bundle || loading}
              onChange={(event) => selectCenter(event.target.value)}
              value={centerFilter}
            >
              <option value="all">Todos los centros</option>
              {bundle?.centers.map((center) => (
                <option key={center.centro_id} value={center.centro_id}>
                  {center.centro_id} · {center.nombre}
                </option>
              ))}
            </select>
          </label>
        </section>

        {bootstrapping || loading ? (
          <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900" role="status">
            {bootstrapping ? "Preparando la consola administrativa…" : "Cargando el snapshot seleccionado…"}
          </section>
        ) : null}

        {error ? (
          <section className="mt-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <span>{error}</span>
            {selectedSnapshotId ? (
              <button className="self-start rounded-lg border border-red-300 bg-white px-3 py-2 font-medium hover:bg-red-100 sm:self-auto" onClick={retrySnapshot} type="button">
                Reintentar
              </button>
            ) : null}
          </section>
        ) : null}

        {!bootstrapping && !error && snapshots.length === 0 ? (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-slate-600">
            No hay snapshots disponibles para inspeccionar.
          </section>
        ) : null}

        {summary ? (
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6" aria-label="Resumen del snapshot">
            <MetricCard label="Centros" value={summary.centros} />
            <MetricCard label="Productos" value={summary.productos} />
            <MetricCard label="Presentaciones" value={summary.presentaciones} />
            <MetricCard label="Con necesidades" value={summary.centrosConNecesidades} />
            <MetricCard label="Con déficit" value={summary.centrosConDeficit} />
            <MetricCard label="Donaciones anunciadas" value={summary.donacionesAnunciadas} />
          </section>
        ) : null}

        <section className="mt-7">
          <div className="overflow-x-auto border-b border-slate-300" role="tablist" aria-label="Secciones de inspección">
            <div className="flex min-w-max gap-1">
              {TABS.map((tab) => (
                <button
                  aria-controls={`panel-${tab.id}`}
                  aria-selected={activeTab === tab.id}
                  className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === tab.id ? "border-blue-700 text-blue-800" : "border-transparent text-slate-600 hover:border-slate-400 hover:text-slate-950"}`}
                  id={`tab-${tab.id}`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div
            aria-labelledby={`tab-${activeTab}`}
            className="pt-5"
            id={`panel-${activeTab}`}
            role="tabpanel"
          >
            {renderActiveTable()}
          </div>
        </section>
      </main>
    </div>
  );
}
