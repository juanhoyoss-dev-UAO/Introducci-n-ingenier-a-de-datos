import type { SnapshotBundle } from "@/contracts/schemas/data";
import type { OperationalAlert } from "@/contracts/types/alerts";
import type {
  ExcelAlertEffect,
  ExcelReceptionEffect,
  ExcelReceptionImportResult,
  ExcelReceptionPreview,
} from "@/contracts/types/excel-receptions";
import type { MovementRecord } from "@/contracts/types/database";
import { isWeeklyTestingScenario } from "@/lib/operational-scenarios";
import {
  getOperationsRepository,
  type DashboardSource,
  type OperationsRepository,
} from "@/server/repositories/operations";
import { getDashboard } from "./dashboard";
import { ApiError, RepositoryError } from "./errors";
import { parseReceptionWorkbook } from "./excel-reception-parser";
import { reidentifySnapshot, stableUuid } from "./snapshot-versioning";

const severityOrder = { critica: 0, advertencia: 1, informativa: 2 } as const;

function dashboardSource(bundle: SnapshotBundle): DashboardSource {
  return {
    snapshot: bundle.metadata,
    centers: bundle.centers,
    products: bundle.products,
    presentations: bundle.presentations,
    inventory: bundle.inventory,
    needs: bundle.needs,
    volunteers: bundle.volunteers,
    travelTimes: bundle.travelTimes,
    expectedDonations: bundle.expectedDonations,
    movements: bundle.movements,
  };
}

function requireTestingScenario(source: SnapshotBundle) {
  if (!isWeeklyTestingScenario(source.metadata)) {
    throw new ApiError(
      409,
      "TESTING_SCENARIO_REQUIRED",
      "Las recepciones Excel solo pueden importarse en Emergencia semanal — PRUEBAS.",
    );
  }
}

function operationalTimestamp(sourceCreatedAt: string, receivedAt: string[]) {
  const sourceTime = Date.parse(sourceCreatedAt);
  const receptionTime = Math.max(...receivedAt.map((value) => Date.parse(value)));
  return new Date(Math.max(sourceTime + 1, receptionTime)).toISOString();
}

function changeInventory(
  bundle: SnapshotBundle,
  centerId: string,
  skuId: string,
  packages: number,
) {
  const index = bundle.inventory.findIndex(
    (row) => row.centro_id === centerId && row.sku_id === skuId,
  );
  if (index < 0) {
    bundle.inventory.push({
      snapshot_id: bundle.metadata.id,
      centro_id: centerId,
      sku_id: skuId,
      cantidad_paquetes: packages,
    });
    return;
  }
  bundle.inventory[index].cantidad_paquetes += packages;
}

function movementMatches(
  movement: MovementRecord,
  row: ExcelReceptionPreview["filas"][number],
) {
  return (
    movement.tipo === "recepcion_confirmada" &&
    movement.operacion_id === row.operacion_id &&
    movement.centro_destino_id === row.centro_id &&
    movement.centro_origen_id === null &&
    movement.producto_id === row.producto_id &&
    movement.sku_id === row.sku_id &&
    movement.cantidad_paquetes === row.cantidad_paquetes &&
    movement.ocurrido_en === row.recibido_en &&
    movement.intencion_id === null
  );
}

function inspectIdempotency(source: SnapshotBundle, preview: ExcelReceptionPreview) {
  const matches = preview.filas.map((row) => {
    const movement = source.movements.find(
      (item) => item.operacion_id === row.operacion_id,
    );
    if (!movement) return false;
    if (!movementMatches(movement, row)) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        `La operación ${row.operacion_id} ya existe con otros datos.`,
      );
    }
    return true;
  });
  if (matches.some(Boolean) && !matches.every(Boolean)) {
    throw new ApiError(
      409,
      "PARTIAL_IMPORT_CONFLICT",
      "El archivo contiene una mezcla de operaciones ya aplicadas y operaciones nuevas.",
    );
  }
  return matches.every(Boolean);
}

function createImportVersion(
  source: SnapshotBundle,
  preview: ExcelReceptionPreview,
) {
  const next = structuredClone(source);
  const sourceId = source.metadata.id;
  const nextId = stableUuid(
    `redes-ayuda:a3:excel:${sourceId}:${preview.huella_sha256}`,
  );
  const registeredAt = operationalTimestamp(
    source.metadata.created_at,
    preview.filas.map((row) => row.recibido_en),
  );
  next.metadata = {
    id: nextId,
    nombre: "Emergencia semanal — PRUEBAS · recepción Excel",
    created_at: registeredAt,
    descripcion: `Recepciones confirmadas importadas desde ${preview.archivo}.`,
    escenario_id: source.metadata.escenario_id,
    snapshot_origen_id: sourceId,
    snapshot_base_id: source.metadata.snapshot_base_id ?? sourceId,
  };
  reidentifySnapshot(next, nextId);

  for (const row of preview.filas) {
    changeInventory(next, row.centro_id, row.sku_id, row.cantidad_paquetes);
    next.movements.push({
      snapshot_id: nextId,
      movimiento_id: stableUuid(`redes-ayuda:a3:movement:${row.operacion_id}`),
      operacion_id: row.operacion_id,
      tipo: "recepcion_confirmada",
      centro_origen_id: null,
      centro_destino_id: row.centro_id,
      producto_id: row.producto_id,
      sku_id: row.sku_id,
      cantidad_paquetes: row.cantidad_paquetes,
      ocurrido_en: row.recibido_en,
      registrado_en: registeredAt,
      intencion_id: null,
      snapshot_origen_id: sourceId,
      cantidad_anunciada_paquetes: null,
    });
  }
  return { next, registeredAt };
}

function alertEffect(
  before: OperationalAlert | null,
  after: OperationalAlert | null,
): ExcelAlertEffect {
  const alert = after ?? before;
  if (!alert) throw new Error("Se requiere al menos una alerta.");
  return {
    alerta_id: alert.alerta_id,
    centro_id: alert.centro_id,
    centro_nombre: alert.centro_nombre,
    producto_id: alert.producto_id,
    producto_nombre: alert.producto_nombre,
    tipo: alert.tipo,
    severidad_anterior: before?.severidad ?? null,
    severidad_nueva: after?.severidad ?? null,
    titulo: alert.titulo,
  };
}

async function calculateResult(
  source: SnapshotBundle,
  next: SnapshotBundle,
  preview: ExcelReceptionPreview,
  repository: OperationsRepository,
  evaluatedAt: string,
  idempotent: boolean,
): Promise<ExcelReceptionImportResult> {
  const [before, after] = await Promise.all([
    getDashboard(source.metadata.id, repository, evaluatedAt, {
      source: dashboardSource(source),
    }),
    getDashboard(next.metadata.id, repository, evaluatedAt, {
      source: dashboardSource(next),
    }),
  ]);
  const affected = new Map<string, { packages: number; units: number }>();
  for (const row of preview.filas) {
    const key = `${row.centro_id}\u0000${row.producto_id}`;
    const current = affected.get(key) ?? { packages: 0, units: 0 };
    current.packages += row.cantidad_paquetes;
    current.units += row.cantidad_unidad_base;
    affected.set(key, current);
  }

  const effects: ExcelReceptionEffect[] = [];
  for (const [key, received] of affected) {
    const [centerId, productId] = key.split("\u0000");
    const beforeCenter = before.centros.find((row) => row.centro_id === centerId);
    const afterCenter = after.centros.find((row) => row.centro_id === centerId);
    const beforeProduct = beforeCenter?.productos.find((row) => row.producto_id === productId);
    const afterProduct = afterCenter?.productos.find((row) => row.producto_id === productId);
    if (!beforeCenter || !afterCenter || !beforeProduct || !afterProduct) continue;
    effects.push({
      centro_id: centerId,
      centro_nombre: afterCenter.nombre,
      producto_id: productId,
      producto_nombre: afterProduct.nombre,
      unidad_base: afterProduct.unidad_base,
      cantidad_recibida_paquetes: received.packages,
      cantidad_recibida_unidad_base: received.units,
      inventario_anterior: beforeProduct.inventario_confirmado_unidad_base,
      inventario_nuevo: afterProduct.inventario_confirmado_unidad_base,
      necesidad_vigente: afterProduct.objetivo_unidad_base,
      cobertura_anterior: beforeProduct.cobertura_porcentaje,
      cobertura_nueva: afterProduct.cobertura_porcentaje,
      deficit_anterior: beforeProduct.deficit_confirmado_unidad_base,
      deficit_nuevo: afterProduct.deficit_confirmado_unidad_base,
    });
  }
  effects.sort((left, right) =>
    left.centro_id.localeCompare(right.centro_id) ||
    left.producto_nombre.localeCompare(right.producto_nombre, "es"),
  );

  const affectedKeys = new Set(affected.keys());
  const beforeAlerts = new Map(before.alertas.alertas.map((row) => [row.alerta_id, row]));
  const afterAlerts = new Map(after.alertas.alertas.map((row) => [row.alerta_id, row]));
  const relevant = (alert: OperationalAlert) =>
    alert.producto_id !== null &&
    affectedKeys.has(`${alert.centro_id}\u0000${alert.producto_id}`);
  const resolved = [...beforeAlerts.values()]
    .filter((row) => relevant(row) && !afterAlerts.has(row.alerta_id))
    .map((row) => alertEffect(row, null));
  const reduced = [...beforeAlerts.values()]
    .filter((row) => {
      const nextAlert = afterAlerts.get(row.alerta_id);
      return Boolean(
        relevant(row) && nextAlert &&
        severityOrder[nextAlert.severidad] > severityOrder[row.severidad],
      );
    })
    .map((row) => alertEffect(row, afterAlerts.get(row.alerta_id) ?? null));
  const remaining = [...afterAlerts.values()]
    .filter(relevant)
    .map((row) => alertEffect(beforeAlerts.get(row.alerta_id) ?? null, row));

  return {
    snapshot: next.metadata,
    source_snapshot_id: source.metadata.id,
    idempotent,
    archivo: preview.archivo,
    huella_sha256: preview.huella_sha256,
    evaluado_en: evaluatedAt,
    filas_importadas: idempotent ? 0 : preview.total_filas,
    total_paquetes: idempotent ? 0 : preview.total_paquetes,
    efectos: idempotent ? [] : effects,
    alertas_antes: before.alertas.total,
    alertas_despues: after.alertas.total,
    alertas_resueltas: idempotent ? [] : resolved,
    alertas_reducidas: idempotent ? [] : reduced,
    alertas_activas_afectadas: idempotent ? [] : remaining,
  };
}

export async function previewExcelReceptions(
  sourceSnapshotId: string,
  bytes: Buffer,
  fileName: string,
  repository: OperationsRepository = getOperationsRepository(),
) {
  const source = await repository.getSnapshotBundle(sourceSnapshotId);
  if (!source) throw new ApiError(404, "SNAPSHOT_NOT_FOUND", "El snapshot no existe.");
  requireTestingScenario(source);
  return parseReceptionWorkbook(bytes, fileName, source);
}

export async function importExcelReceptions(
  sourceSnapshotId: string,
  bytes: Buffer,
  fileName: string,
  repository: OperationsRepository = getOperationsRepository(),
): Promise<ExcelReceptionImportResult> {
  const source = await repository.getSnapshotBundle(sourceSnapshotId);
  if (!source) throw new ApiError(404, "SNAPSHOT_NOT_FOUND", "El snapshot no existe.");
  requireTestingScenario(source);
  const preview = await parseReceptionWorkbook(bytes, fileName, source);
  if (!preview.valido) {
    throw new ApiError(400, "INVALID_RECEPTION_WORKBOOK", "El archivo contiene errores y no fue importado.", preview.errores);
  }
  if (inspectIdempotency(source, preview)) {
    return calculateResult(
      source,
      source,
      preview,
      repository,
      source.metadata.created_at,
      true,
    );
  }

  const { next, registeredAt } = createImportVersion(source, preview);
  try {
    await repository.writeSnapshot(next);
  } catch (error) {
    if (error instanceof RepositoryError) {
      const published = await repository.getSnapshotBundle(next.metadata.id);
      if (published && preview.filas.every((row) =>
        published.movements.some((movement) => movementMatches(movement, row)))) {
        return calculateResult(source, published, preview, repository, registeredAt, true);
      }
      throw new ApiError(500, "PERSISTENCE_ERROR", "No fue posible publicar la recepción Excel de forma atómica.");
    }
    throw error;
  }
  return calculateResult(source, next, preview, repository, registeredAt, false);
}
