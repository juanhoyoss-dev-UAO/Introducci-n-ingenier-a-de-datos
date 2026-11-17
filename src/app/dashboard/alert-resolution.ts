import type { MovementOperationResult } from "./types";
import type {
  AlertSeverity,
  OperationalAlert,
} from "@/contracts/types/alerts";
import {
  calculateCoveragePercentage,
  calculateDeficit,
} from "@/domain/inventory";
import type { AlertGroupId } from "./alert-groups";
import type { DashboardBundle, DashboardProduct } from "./types";

export interface ReceiptPreview {
  incomingBaseUnits: number;
  estimatedInventory: number;
  estimatedCoverage: number | null;
  remainingDeficit: number;
  grossSurplus: number;
}

export interface AlertReceptionContext {
  groupId: AlertGroupId;
  centerId: string;
  centerName: string;
  productId: string;
  productName: string;
  unit: DashboardProduct["unidad_base"];
  previousInventory: number;
  previousCoverage: number | null;
  previousSeverity: AlertSeverity;
  packagesReceived: number;
  incomingBaseUnits: number;
  presentationName: string;
}

export interface PendingAlertReception extends AlertReceptionContext {
  targetSnapshotId: string;
  idempotent: boolean;
}

export interface AlertResolutionSummary extends PendingAlertReception {
  newInventory: number;
  newCoverage: number | null;
  remainingDeficit: number;
  grossSurplus: number;
  currentSeverity: AlertSeverity | null;
  outcome: "resolved" | "reduced" | "active";
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critica: 0,
  advertencia: 1,
  informativa: 2,
};

export function validPackageQuantity(value: number) {
  return Number.isInteger(value) && value > 0;
}

export function calculateReceiptPreview(
  currentInventory: number,
  target: number,
  packageContent: number,
  packagesReceived: number,
): ReceiptPreview | null {
  if (
    !validPackageQuantity(packagesReceived) ||
    !Number.isFinite(packageContent) ||
    packageContent <= 0
  ) {
    return null;
  }
  const incomingBaseUnits = packageContent * packagesReceived;
  const estimatedInventory = currentInventory + incomingBaseUnits;
  return {
    incomingBaseUnits,
    estimatedInventory,
    estimatedCoverage: calculateCoveragePercentage(estimatedInventory, target),
    remainingDeficit: calculateDeficit(estimatedInventory, target),
    grossSurplus: Math.max(0, estimatedInventory - target),
  };
}

export function buildAlertResolutionSummary(
  bundle: DashboardBundle,
  pending: PendingAlertReception,
): AlertResolutionSummary | null {
  if (bundle.snapshot.id !== pending.targetSnapshotId) {
    return null;
  }
  const product = bundle.dashboard.centros
    .find((center) => center.centro_id === pending.centerId)
    ?.productos.find((item) => item.producto_id === pending.productId);
  if (!product) {
    return null;
  }
  const currentAlert: OperationalAlert | undefined =
    bundle.dashboard.alertas.alertas.find(
      (alert) =>
        alert.tipo === "deficit_cobertura" &&
        alert.centro_id === pending.centerId &&
        alert.producto_id === pending.productId,
    );
  const outcome =
    product.deficit_confirmado_unidad_base === 0
      ? "resolved"
      : currentAlert &&
          SEVERITY_ORDER[currentAlert.severidad] >
            SEVERITY_ORDER[pending.previousSeverity]
        ? "reduced"
        : "active";

  return {
    ...pending,
    newInventory: product.inventario_confirmado_unidad_base,
    newCoverage: product.cobertura_porcentaje,
    remainingDeficit: product.deficit_confirmado_unidad_base,
    grossSurplus: Math.max(
      0,
      product.inventario_confirmado_unidad_base -
        product.objetivo_unidad_base,
    ),
    currentSeverity: currentAlert?.severidad ?? null,
    outcome,
  };
}

export function pendingReception(
  context: AlertReceptionContext,
  result: MovementOperationResult,
): PendingAlertReception {
  return {
    ...context,
    targetSnapshotId: result.snapshot.id,
    idempotent: result.idempotent,
  };
}

export function toBogotaLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}T${values.get("hour")}:${values.get("minute")}`;
}

export function bogotaLocalToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const result = `${value}:00-05:00`;
  return Number.isNaN(new Date(result).getTime()) ? null : result;
}
