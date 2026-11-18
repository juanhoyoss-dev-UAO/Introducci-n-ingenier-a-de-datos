"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { OperationalUpdate } from "@/contracts/schemas/operational-updates";
import type { MovementOperation } from "@/contracts/schemas/movement-operations";
import type {
  ExcelReceptionImportResult,
  TestingScenarioResetResult,
} from "@/contracts/types/excel-receptions";
import { logger } from "@/lib/logger";
import type { AlertGroupId } from "./alert-groups";
import {
  buildAlertResolutionSummary,
  pendingReception,
  type AlertReceptionContext,
  type PendingAlertReception,
} from "./alert-resolution";
import { AdministrativeEditor } from "./components/administrative-editor";
import { AlertCenter } from "./components/alert-center";
import { DashboardStatus } from "./components/dashboard-status";
import { OperationalSummary } from "./components/operational-summary";
import { MovementEditor } from "./components/movement-editor";
import { TemporalEvolution } from "./components/temporal-evolution";
import {
  ALL_PRODUCTS_FILTER,
  centerRows,
  donationRows,
  findWeeklyOperationalSnapshot,
  inventoryRows,
  needRows,
  operationalScenarioKey,
  operationalScenarioOptions,
  sortSnapshots,
  travelTimeRows,
  volunteerRows,
  type OperationalScenarioKey,
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
  OperationalUpdateResult,
  MovementOperationResult,
  ProductRecord,
  SessionState,
  SessionUser,
  SnapshotRecord,
  TravelTimeRecord,
} from "./types";

const TABS: ReadonlyArray<{ id: DashboardTab; label: string }> = [
  { id: "resumen", label: "Resumen operativo" },
  { id: "alertas", label: "Alertas operativas" },
  { id: "temporal", label: "Historial operativo" },
  { id: "centros", label: "Centros" },
  { id: "inventario", label: "Inventario" },
  { id: "necesidades", label: "Necesidades" },
  { id: "voluntarios", label: "Voluntarios" },
  { id: "donaciones", label: "Donaciones esperadas" },
  { id: "movimientos", label: "Movimientos y recepciones" },
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

async function postApi<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as
    | ApiSuccess<T>
    | ApiFailure;
  if (!response.ok) {
    const failure = body as ApiFailure;
    throw new ApiClientError(
      response.status,
      failure.error?.code ?? "REQUEST_ERROR",
      failure.error?.message ?? "No fue posible guardar la actualización.",
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

export default function DashboardClient({
  initialUser,
}: {
  initialUser: SessionUser;
}) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [selectedScenario, setSelectedScenario] =
    useState<OperationalScenarioKey>("main");
  const [centerFilter, setCenterFilter] = useState<CenterFilter>("all");
  const [productFilter, setProductFilter] = useState(ALL_PRODUCTS_FILTER);
  const [activeTab, setActiveTab] = useState<DashboardTab>("resumen");
  const [bundle, setBundle] = useState<DashboardBundle | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [mutationNotice, setMutationNotice] = useState("");
  const [excelImportResult, setExcelImportResult] =
    useState<ExcelReceptionImportResult | null>(null);
  const [alertOpenGroups, setAlertOpenGroups] = useState<AlertGroupId[]>([]);
  const [pendingAlertReception, setPendingAlertReception] =
    useState<PendingAlertReception | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const alertResolutionSummary = useMemo(
    () =>
      bundle && pendingAlertReception
        ? buildAlertResolutionSummary(bundle, pendingAlertReception)
        : null,
    [bundle, pendingAlertReception],
  );
  const scenarioOptions = useMemo(
    () => operationalScenarioOptions(snapshots),
    [snapshots],
  );

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
        const weeklySnapshot = findWeeklyOperationalSnapshot(orderedSnapshots);
        setUser(session.user);
        setSnapshots(orderedSnapshots);
        setSelectedScenario("main");
        setLoading(weeklySnapshot !== null);
        setSelectedSnapshotId(weeklySnapshot?.id ?? "");
        if (!weeklySnapshot && orderedSnapshots.length > 0) {
          setError(
            "No se encontró el estado operativo final del escenario semanal.",
          );
        }
        logger.ok("UI", "snapshots_loaded", {
          count: orderedSnapshots.length,
          selectedSnapshotId: weeklySnapshot?.id ?? null,
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
        setProductFilter((current) =>
          current === ALL_PRODUCTS_FILTER ||
          products.some((product) => product.producto_id === current)
            ? current
            : ALL_PRODUCTS_FILTER,
        );
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
    setProductFilter(ALL_PRODUCTS_FILTER);
    setError("");
    setMutationNotice("");
    setExcelImportResult(null);
    setAlertOpenGroups([]);
    setPendingAlertReception(null);
    setLoading(true);
    setSelectedSnapshotId(snapshotId);
  }

  function selectScenario(scenario: OperationalScenarioKey) {
    const option = scenarioOptions.find((item) => item.key === scenario);
    if (!option) return;
    setSelectedScenario(scenario);
    selectSnapshot(option.snapshot.id);
  }

  function retrySnapshot() {
    setBundle(null);
    setCenterFilter("all");
    setProductFilter(ALL_PRODUCTS_FILTER);
    setError("");
    setMutationNotice("");
    setLoading(true);
    setReloadToken((value) => value + 1);
  }

  function selectCenter(centerId: CenterFilter) {
    logger.info("UI", "center_filter_selected", { centerId });
    setCenterFilter(centerId);
  }

  function selectProduct(productId: string) {
    logger.info("UI", "product_filter_selected", { productId });
    setProductFilter(productId);
  }

  function selectDashboardTab(tab: DashboardTab) {
    setActiveTab(tab);
  }

  function selectPublishedSnapshot(snapshot: SnapshotRecord, notice: string) {
    setSnapshots((current) =>
      sortSnapshots([
        snapshot,
        ...current.filter((item) => item.id !== snapshot.id),
      ]),
    );
    setBundle(null);
    setCenterFilter("all");
    setProductFilter(ALL_PRODUCTS_FILTER);
    setError("");
    setLoading(true);
    setSelectedScenario(operationalScenarioKey(snapshot) ?? selectedScenario);
    setSelectedSnapshotId(snapshot.id);
    setMutationNotice(notice);
  }

  function handleExcelImport(result: ExcelReceptionImportResult) {
    setExcelImportResult(result);
    selectPublishedSnapshot(
      result.snapshot,
      result.idempotent
        ? "El archivo ya estaba aplicado. No se duplicó el inventario."
        : "Recepción Excel registrada; inventario y alertas fueron recalculados.",
    );
  }

  function handleTestingReset(result: TestingScenarioResetResult) {
    setExcelImportResult(null);
    setPendingAlertReception(null);
    setAlertOpenGroups([]);
    selectPublishedSnapshot(
      result.snapshot,
      result.idempotent
        ? "El reinicio ya estaba aplicado; se recargaron inventario y alertas de PRUEBAS."
        : "PRUEBAS se restauró con el inventario de MAIN y sus alertas fueron recalculadas.",
    );
  }

  async function saveOperationalUpdate(update: OperationalUpdate) {
    const sourceSnapshotId = selectedSnapshotId;
    logger.info("UI", "operational_update_started", {
      operation: update.operation,
      snapshotId: sourceSnapshotId,
    });
    setError("");
    setMutationNotice("");
    const result = await postApi<OperationalUpdateResult>(
      `/api/snapshots/${encodeURIComponent(sourceSnapshotId)}/operations`,
      update,
    );
    if (result.source_snapshot_id !== sourceSnapshotId) {
      throw new ApiClientError(
        409,
        "SNAPSHOT_MISMATCH",
        "La versión publicada no corresponde al snapshot editado.",
      );
    }
    setSnapshots((current) =>
      sortSnapshots([
        result.snapshot,
        ...current.filter((snapshot) => snapshot.id !== result.snapshot.id),
      ]),
    );
    setBundle(null);
    setLoading(true);
    setSelectedSnapshotId(result.snapshot.id);
    setMutationNotice(
      "Guardado correctamente. Se creó y seleccionó una nueva versión operativa.",
    );
    logger.ok("UI", "operational_update_completed", {
      operation: result.operation,
      sourceSnapshotId,
      snapshotId: result.snapshot.id,
    });
  }

  async function saveMovement(update: MovementOperation) {
    const sourceSnapshotId = selectedSnapshotId;
    logger.info("UI", "movement_started", {
      operation: update.operation,
      snapshotId: sourceSnapshotId,
    });
    setError("");
    setMutationNotice("");
    const result = await postApi<MovementOperationResult>(
      `/api/snapshots/${encodeURIComponent(sourceSnapshotId)}/movements`,
      update,
    );
    if (result.source_snapshot_id !== sourceSnapshotId) {
      throw new ApiClientError(
        409,
        "SNAPSHOT_MISMATCH",
        "La versión publicada no corresponde al snapshot seleccionado.",
      );
    }
    setSnapshots((current) =>
      sortSnapshots([
        result.snapshot,
        ...current.filter((snapshot) => snapshot.id !== result.snapshot.id),
      ]),
    );
    setBundle(null);
    setLoading(true);
    setSelectedSnapshotId(result.snapshot.id);
    setMutationNotice(
      result.idempotent
        ? "La operación ya estaba registrada. Se seleccionó su versión operativa sin duplicar inventario."
        : "Movimiento guardado. Se creó y seleccionó una nueva versión operativa.",
    );
    logger.ok("UI", "movement_completed", {
      idempotent: result.idempotent,
      operation: result.operation,
      sourceSnapshotId,
      snapshotId: result.snapshot.id,
    });
    return result;
  }

  async function saveAlertReception(
    update: MovementOperation,
    context: AlertReceptionContext,
  ) {
    setPendingAlertReception(null);
    const result = await saveMovement(update);
    setPendingAlertReception(pendingReception(context, result));
    setAlertOpenGroups((current) =>
      current.includes(context.groupId)
        ? current
        : [...current, context.groupId],
    );
  }

  function renderActivePanel() {
    if (!bundle) {
      return null;
    }

    if (activeTab === "resumen") {
      return (
        <OperationalSummary
          bundle={bundle}
          centerFilter={centerFilter}
          productId={productFilter}
        />
      );
    }

    if (activeTab === "alertas") {
      return (
        <AlertCenter
          dashboardCenters={bundle.dashboard.centros}
          evaluation={bundle.dashboard.alertas}
          initialCenterFilter={centerFilter}
          key={centerFilter}
          latestImportResult={excelImportResult}
          onImportComplete={handleExcelImport}
          onNavigate={(tab, centerId) => {
            setCenterFilter(centerId);
            setActiveTab(tab);
          }}
          onOpenGroupsChange={setAlertOpenGroups}
          onSaveReception={saveAlertReception}
          onResetComplete={handleTestingReset}
          openGroups={alertOpenGroups}
          products={bundle.products}
          resolutionSummary={alertResolutionSummary}
          snapshot={bundle.snapshot}
        />
      );
    }

    if (activeTab === "temporal") {
      return (
        <TemporalEvolution
          centers={bundle.centers}
          initialCenterFilter={centerFilter}
          initialProductId={
            productFilter === ALL_PRODUCTS_FILTER
              ? (bundle.products[0]?.producto_id ?? "")
              : productFilter
          }
          key={`${bundle.snapshot.id}-${centerFilter}-${productFilter}`}
          products={bundle.products}
          snapshot={bundle.snapshot}
        />
      );
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

    if (activeTab === "movimientos") {
      return (
        <MovementEditor
          bundle={bundle}
          centerFilter={centerFilter}
          key={`${bundle.snapshot.id}-${centerFilter}`}
          onSave={async (update) => {
            await saveMovement(update);
          }}
        />
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
    <div className="min-h-screen bg-[#eef5ed]">
      <header className="border-b border-[#2f7657] bg-[#073f31] text-white shadow-[0_12px_32px_rgba(7,63,49,0.16)]">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c6ec99]">Redes de Ayuda</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Consola administrativa</h1>
            <p className="mt-1 text-sm text-slate-300">Inspección operativa de snapshots CSV</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">
              <span className="text-slate-400">Administrador</span>{" "}
              <strong>{user.username}</strong>
            </div>
            <div className="max-w-sm rounded-lg border border-white/15 bg-white/5 px-3 py-2">
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
        <section
          className={`grid gap-4 rounded-xl border border-emerald-100 bg-white p-5 shadow-[0_12px_30px_rgba(7,63,49,0.07)] ${
            activeTab === "resumen" ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"
          }`}
        >
          <label className="block text-sm font-medium text-slate-700">
            Snapshot operativo
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              disabled={bootstrapping || scenarioOptions.length === 0}
              onChange={(event) =>
                selectScenario(event.target.value as OperationalScenarioKey)
              }
              value={selectedScenario}
            >
              {scenarioOptions.length === 0 ? (
                <option value="">
                  {snapshots.length === 0
                    ? "Sin snapshots disponibles"
                    : "Escenario semanal no disponible"}
                </option>
              ) : null}
              {scenarioOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
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
          {activeTab === "resumen" ? (
            <label className="block text-sm font-medium text-slate-700">
              Producto comparado
              <select
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                disabled={!bundle || loading || bundle.products.length === 0}
                onChange={(event) => selectProduct(event.target.value)}
                value={productFilter}
              >
                {bundle && bundle.products.length > 0 ? (
                  <option value={ALL_PRODUCTS_FILTER}>Todos los productos</option>
                ) : null}
                {bundle?.products.length === 0 ? (
                  <option value="">Sin productos disponibles</option>
                ) : null}
                {bundle?.products.map((product) => (
                  <option key={product.producto_id} value={product.producto_id}>
                    {product.producto_id} · {product.nombre} ({product.unidad_base})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </section>

        {bootstrapping || loading ? (
          <DashboardStatus
            message={
              bootstrapping
                ? "Preparando la consola administrativa…"
                : "Cargando el snapshot seleccionado…"
            }
            tone="loading"
          />
        ) : null}

        {mutationNotice ? (
          <DashboardStatus message={mutationNotice} tone="success" />
        ) : null}

        {error ? (
          <DashboardStatus
            action={
              selectedSnapshotId
                ? { label: "Reintentar", onClick: retrySnapshot }
                : undefined
            }
            message={error}
            tone="error"
          />
        ) : null}

        {!bootstrapping && !error && snapshots.length === 0 ? (
          <DashboardStatus
            message="No hay snapshots disponibles para inspeccionar."
            tone="empty"
          />
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
                  onClick={() => selectDashboardTab(tab.id)}
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
            {bundle &&
            (activeTab === "centros" ||
              activeTab === "inventario" ||
              activeTab === "necesidades" ||
              activeTab === "voluntarios") ? (
              <AdministrativeEditor
                activeTab={activeTab}
                bundle={bundle}
                key={`${bundle.snapshot.id}-${activeTab}`}
                onSave={saveOperationalUpdate}
              />
            ) : null}
            {renderActivePanel()}
          </div>
        </section>
      </main>
    </div>
  );
}
