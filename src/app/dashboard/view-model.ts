import type {
  ConfirmedExpectedPoint,
  CoverageByCenterPoint,
  InventoryNeedPoint,
  VolunteerComparisonPoint,
} from "@/contracts/types/analytics";
import type {
  CenterFilter,
  CenterRecord,
  DashboardBundle,
  DashboardCenter,
  DashboardProduct,
  ExpectedDonationRecord,
  ProductRecord,
  TravelTimeRecord,
} from "./types";
import { DEFAULT_ALERT_THRESHOLDS } from "@/domain/alerts";

export const WEEKLY_SCENARIO_ID = "65000000-0000-4000-8000-000000000001";
export const WEEKLY_OPERATIONAL_SNAPSHOT_ID =
  "65000000-0000-4000-8000-000000000003";
export const WEEKLY_SCENARIO_LABEL =
  "Emergencia simulada de Cali — Semana del 9 al 15 de noviembre de 2026.";
export const ALL_PRODUCTS_FILTER = "all";

export interface DashboardSummary {
  centros: number;
  productos: number;
  presentaciones: number;
  centrosConNecesidades: number;
  centrosConDeficit: number;
  donacionesAnunciadas: number;
}

export interface OperationalAttention {
  centro_id: string;
  centro_nombre: string;
  productosConDeficit: number;
  voluntariosFaltantes: number;
}

export interface OperationalSummary {
  centrosActivos: number;
  centrosConDeficit: number;
  productos: number;
  centrosConNecesidades: number;
  donacionesPendientes: number;
  centrosConVoluntariosFaltantes: number;
  alertasActivas: number;
  alertasCriticas: number;
  centrosQueRequierenAtencion: number;
  atencion: OperationalAttention | null;
}

export interface InventoryComparisonRow extends InventoryNeedPoint {
  deficit_confirmado: number | null;
}

export interface VolunteerComparisonRow extends VolunteerComparisonPoint {
  faltantes: number;
}

export interface InventoryTableRow {
  centro_id: string;
  centro_nombre: string;
  producto_id: string;
  producto_nombre: string;
  sku_id: string;
  presentacion_nombre: string;
  cantidad_paquetes: number;
  contenido_por_paquete: number;
  unidad_base: DashboardProduct["unidad_base"];
  subtotal_presentacion_unidad_base: number;
  total_producto_unidad_base: number;
}

export interface NeedTableRow {
  centro_id: string;
  centro_nombre: string;
  producto_id: string;
  producto_nombre: string;
  unidad_base: DashboardProduct["unidad_base"];
  objetivo_unidad_base: number;
  inventario_confirmado_unidad_base: number;
  deficit_confirmado_unidad_base: number;
  prioridad: number | null;
}

export interface VolunteerTableRow {
  centro_id: string;
  centro_nombre: string;
  disponibles: number;
  requeridos: number;
  faltantes: number;
}

export interface DonationTableRow extends ExpectedDonationRecord {
  centro_nombre: string;
  producto_nombre: string;
  presentacion_nombre: string;
  contenido_por_paquete: number;
  unidad_base: DashboardProduct["unidad_base"];
  total_unidad_base: number;
}

export type CoverageMatrixState =
  | "deficit_importante"
  | "deficit_parcial"
  | "cubierta"
  | "excedente"
  | "sin_necesidad";

export interface CoverageMatrixCell {
  centro_id: string;
  centro_nombre: string;
  producto_id: string;
  producto_nombre: string;
  unidad_base: DashboardProduct["unidad_base"];
  inventario_confirmado_unidad_base: number;
  objetivo_unidad_base: number;
  deficit_confirmado_unidad_base: number;
  excedente_transferible_unidad_base: number;
  cobertura_porcentaje: number | null;
  estado: CoverageMatrixState;
}

export interface CoverageMatrixRow {
  producto_id: string;
  producto_nombre: string;
  unidad_base: DashboardProduct["unidad_base"];
  deficit_total_unidad_base: number;
  celdas: Array<CoverageMatrixCell | null>;
}

export interface CoverageMatrix {
  centros: Array<{ centro_id: string; centro_nombre: string }>;
  filas: CoverageMatrixRow[];
}

export interface OperationalSummaryVisualizationState {
  mostrarMatriz: boolean;
  mostrarCoberturaProductos: boolean;
  mostrarVoluntarios: boolean;
  mostrarGraficosIndividuales: boolean;
}

function matchesCenter(centerId: string, filter: CenterFilter) {
  return filter === "all" || centerId === filter;
}

function presentationCatalog(products: readonly ProductRecord[]) {
  return new Map(
    products.flatMap((product) =>
      product.presentaciones.map((presentation) => [
        presentation.sku_id,
        { product, presentation },
      ] as const),
    ),
  );
}

export function sortSnapshots<T extends { id: string; created_at: string }>(
  snapshots: readonly T[],
) {
  return [...snapshots].sort(
    (left, right) =>
      left.created_at.localeCompare(right.created_at) ||
      left.id.localeCompare(right.id),
  );
}

export function findWeeklyOperationalSnapshot<
  T extends { id: string; escenario_id?: string },
>(snapshots: readonly T[]) {
  return (
    snapshots.find(
      (snapshot) =>
        snapshot.id === WEEKLY_OPERATIONAL_SNAPSHOT_ID &&
        snapshot.escenario_id === WEEKLY_SCENARIO_ID,
    ) ?? null
  );
}

export function summarySnapshotOptions<
  T extends { id: string; escenario_id?: string },
>(snapshots: readonly T[]) {
  const weeklySnapshot = findWeeklyOperationalSnapshot(snapshots);
  return weeklySnapshot ? [weeklySnapshot] : [];
}

export function operationalSummaryVisualizationState(
  centerFilter: CenterFilter,
  productId: string,
): OperationalSummaryVisualizationState {
  const allCenters = centerFilter === "all";
  const allProducts = productId === ALL_PRODUCTS_FILTER;
  return {
    mostrarMatriz: allCenters && allProducts,
    mostrarCoberturaProductos: !allCenters && allProducts,
    mostrarVoluntarios: allProducts,
    mostrarGraficosIndividuales: !allProducts,
  };
}

export function coverageMatrixState(
  product: Pick<
    DashboardProduct,
    | "objetivo_unidad_base"
    | "deficit_confirmado_unidad_base"
    | "cobertura_porcentaje"
    | "excedente_transferible_unidad_base"
  >,
): CoverageMatrixState {
  if (
    product.objetivo_unidad_base <= 0 ||
    product.cobertura_porcentaje === null
  ) {
    return "sin_necesidad";
  }
  if (product.excedente_transferible_unidad_base > 0) {
    return "excedente";
  }
  if (product.deficit_confirmado_unidad_base <= 0) {
    return "cubierta";
  }
  return product.cobertura_porcentaje <
    DEFAULT_ALERT_THRESHOLDS.cobertura_importante_menor_que
    ? "deficit_importante"
    : "deficit_parcial";
}

export function coverageMatrixRows(
  bundle: DashboardBundle,
  filter: CenterFilter,
): CoverageMatrix {
  const centers = bundle.dashboard.centros.filter((center) =>
    matchesCenter(center.centro_id, filter),
  );
  const rows = bundle.products.map((catalogProduct) => {
    const cells = centers.map((center) => {
      const product = center.productos.find(
        (item) => item.producto_id === catalogProduct.producto_id,
      );
      if (!product) {
        return null;
      }
      return {
        centro_id: center.centro_id,
        centro_nombre: center.nombre,
        producto_id: product.producto_id,
        producto_nombre: product.nombre,
        unidad_base: product.unidad_base,
        inventario_confirmado_unidad_base:
          product.inventario_confirmado_unidad_base,
        objetivo_unidad_base: product.objetivo_unidad_base,
        deficit_confirmado_unidad_base:
          product.deficit_confirmado_unidad_base,
        excedente_transferible_unidad_base:
          product.excedente_transferible_unidad_base,
        cobertura_porcentaje: product.cobertura_porcentaje,
        estado: coverageMatrixState(product),
      } satisfies CoverageMatrixCell;
    });
    return {
      producto_id: catalogProduct.producto_id,
      producto_nombre: catalogProduct.nombre,
      unidad_base: catalogProduct.unidad_base,
      deficit_total_unidad_base: cells.reduce(
        (total, cell) =>
          total + (cell?.deficit_confirmado_unidad_base ?? 0),
        0,
      ),
      celdas: cells,
    } satisfies CoverageMatrixRow;
  });

  rows.sort(
    (left, right) => {
      const leftDeficits = left.celdas.filter(
        (cell) => (cell?.deficit_confirmado_unidad_base ?? 0) > 0,
      );
      const rightDeficits = right.celdas.filter(
        (cell) => (cell?.deficit_confirmado_unidad_base ?? 0) > 0,
      );
      const leftImportant = leftDeficits.filter(
        (cell) => cell?.estado === "deficit_importante",
      ).length;
      const rightImportant = rightDeficits.filter(
        (cell) => cell?.estado === "deficit_importante",
      ).length;
      const leftLowestCoverage = Math.min(
        ...leftDeficits.map((cell) => cell?.cobertura_porcentaje ?? 100),
        100,
      );
      const rightLowestCoverage = Math.min(
        ...rightDeficits.map((cell) => cell?.cobertura_porcentaje ?? 100),
        100,
      );

      return (
        rightImportant - leftImportant ||
        rightDeficits.length - leftDeficits.length ||
        leftLowestCoverage - rightLowestCoverage ||
        left.producto_nombre.localeCompare(right.producto_nombre, "es") ||
        left.producto_id.localeCompare(right.producto_id)
      );
    },
  );

  return {
    centros: centers.map((center) => ({
      centro_id: center.centro_id,
      centro_nombre: center.nombre,
    })),
    filas: rows,
  };
}

export function productCoverageRows(
  bundle: DashboardBundle,
  centerId: Exclude<CenterFilter, "all">,
): CoverageMatrixCell[] {
  return coverageMatrixRows(bundle, centerId).filas.flatMap((row) =>
    row.celdas.flatMap((cell) => (cell ? [cell] : [])),
  );
}

export function deriveSummary(bundle: DashboardBundle): DashboardSummary {
  return {
    centros: bundle.centers.length,
    productos: bundle.products.length,
    presentaciones: bundle.products.reduce(
      (total, product) => total + product.presentaciones.length,
      0,
    ),
    centrosConNecesidades: bundle.dashboard.centros.filter((center) =>
      center.productos.some((product) => product.objetivo_unidad_base > 0),
    ).length,
    centrosConDeficit: bundle.dashboard.centros.filter((center) =>
      center.productos.some(
        (product) => product.deficit_confirmado_unidad_base > 0,
      ),
    ).length,
    donacionesAnunciadas: bundle.dashboard.donaciones_esperadas.length,
  };
}

export function deriveOperationalSummary(
  bundle: DashboardBundle,
  filter: CenterFilter,
): OperationalSummary {
  const centers = bundle.dashboard.centros.filter((center) =>
    matchesCenter(center.centro_id, filter),
  );
  const alerts = bundle.dashboard.alertas.alertas.filter((alert) =>
    matchesCenter(alert.centro_id, filter),
  );
  const attention = centers
    .map((center) => ({
      centro_id: center.centro_id,
      centro_nombre: center.nombre,
      productosConDeficit: center.productos.filter(
        (product) => product.deficit_confirmado_unidad_base > 0,
      ).length,
      voluntariosFaltantes: center.voluntarios.faltantes,
    }))
    .filter(
      (center) =>
        center.productosConDeficit > 0 || center.voluntariosFaltantes > 0,
    )
    .sort(
      (left, right) =>
        right.productosConDeficit - left.productosConDeficit ||
        right.voluntariosFaltantes - left.voluntariosFaltantes ||
        left.centro_id.localeCompare(right.centro_id),
    )[0] ?? null;

  return {
    centrosActivos:
      filter === "all"
        ? bundle.dashboard.indicadores.centros_activos
        : centers.filter(
            (center) => center.estado.trim().toLowerCase() === "activo",
          ).length,
    centrosConDeficit: centers.filter((center) =>
      center.productos.some(
        (product) => product.deficit_confirmado_unidad_base > 0,
      ),
    ).length,
    productos: bundle.products.length,
    centrosConNecesidades: centers.filter((center) =>
      center.productos.some((product) => product.objetivo_unidad_base > 0),
    ).length,
    donacionesPendientes: bundle.dashboard.donaciones_esperadas.filter(
      (donation) =>
        donation.estado === "pendiente" &&
        matchesCenter(donation.centro_id, filter),
    ).length,
    centrosConVoluntariosFaltantes: centers.filter(
      (center) => center.voluntarios.faltantes > 0,
    ).length,
    alertasActivas: alerts.length,
    alertasCriticas: alerts.filter((alert) => alert.severidad === "critica")
      .length,
    centrosQueRequierenAtencion: new Set(
      alerts.map((alert) => alert.centro_id),
    ).size,
    atencion: attention,
  };
}

export function coverageChartRows(
  bundle: DashboardBundle,
  filter: CenterFilter,
  productId: string,
): CoverageByCenterPoint[] {
  return bundle.dashboard.visualizaciones.cobertura_por_centro.filter(
    (row) =>
      row.producto_id === productId && matchesCenter(row.centro_id, filter),
  );
}

export function inventoryComparisonRows(
  bundle: DashboardBundle,
  filter: CenterFilter,
  productId: string,
): InventoryComparisonRow[] {
  const deficitByCenter = new Map(
    bundle.dashboard.centros.flatMap((center) =>
      center.productos.map(
        (product) =>
          [
            `${center.centro_id}\u0000${product.producto_id}`,
            product.deficit_confirmado_unidad_base,
          ] as const,
      ),
    ),
  );

  return bundle.dashboard.visualizaciones.inventario_vs_necesidad
    .filter(
      (row) =>
        row.producto_id === productId && matchesCenter(row.centro_id, filter),
    )
    .map((row) => ({
      ...row,
      deficit_confirmado:
        deficitByCenter.get(`${row.centro_id}\u0000${row.producto_id}`) ?? null,
    }));
}

export function resourceComparisonRows(
  bundle: DashboardBundle,
  filter: CenterFilter,
  productId: string,
): ConfirmedExpectedPoint[] {
  return bundle.dashboard.visualizaciones.recursos_confirmados_vs_esperados.filter(
    (row) =>
      row.producto_id === productId && matchesCenter(row.centro_id, filter),
  );
}

export function volunteerComparisonRows(
  bundle: DashboardBundle,
  filter: CenterFilter,
): VolunteerComparisonRow[] {
  const missingByCenter = new Map(
    bundle.dashboard.centros.map(
      (center) => [center.centro_id, center.voluntarios.faltantes] as const,
    ),
  );

  return bundle.dashboard.visualizaciones.voluntarios_disponibles_vs_requeridos
    .filter((row) => matchesCenter(row.centro_id, filter))
    .map((row) => ({
      ...row,
      faltantes: missingByCenter.get(row.centro_id) ?? 0,
    }));
}

export function centerRows(
  centers: readonly CenterRecord[],
  filter: CenterFilter,
) {
  return centers.filter((center) => matchesCenter(center.centro_id, filter));
}

export function inventoryRows(
  bundle: DashboardBundle,
  filter: CenterFilter,
): InventoryTableRow[] {
  const catalog = presentationCatalog(bundle.products);

  return bundle.dashboard.centros
    .filter((center) => matchesCenter(center.centro_id, filter))
    .flatMap((center) =>
      center.productos.flatMap((product) =>
        product.existencias.map((stock) => {
          const presentation = catalog.get(stock.sku_id)?.presentation;
          return {
            centro_id: center.centro_id,
            centro_nombre: center.nombre,
            producto_id: product.producto_id,
            producto_nombre: product.nombre,
            sku_id: stock.sku_id,
            presentacion_nombre: presentation?.nombre ?? stock.sku_id,
            cantidad_paquetes: stock.cantidad_paquetes,
            contenido_por_paquete: stock.contenido_por_paquete,
            unidad_base: product.unidad_base,
            subtotal_presentacion_unidad_base:
              stock.cantidad_paquetes * stock.contenido_por_paquete,
            total_producto_unidad_base:
              product.inventario_confirmado_unidad_base,
          };
        }),
      ),
    );
}

export function needRows(
  centers: readonly DashboardCenter[],
  filter: CenterFilter,
): NeedTableRow[] {
  return centers
    .filter((center) => matchesCenter(center.centro_id, filter))
    .flatMap((center) =>
      center.productos
        .filter(
          (product) =>
            product.objetivo_unidad_base > 0 || product.prioridad !== null,
        )
        .map((product) => ({
          centro_id: center.centro_id,
          centro_nombre: center.nombre,
          producto_id: product.producto_id,
          producto_nombre: product.nombre,
          unidad_base: product.unidad_base,
          objetivo_unidad_base: product.objetivo_unidad_base,
          inventario_confirmado_unidad_base:
            product.inventario_confirmado_unidad_base,
          deficit_confirmado_unidad_base:
            product.deficit_confirmado_unidad_base,
          prioridad: product.prioridad,
        })),
    );
}

export function volunteerRows(
  centers: readonly DashboardCenter[],
  filter: CenterFilter,
): VolunteerTableRow[] {
  return centers
    .filter((center) => matchesCenter(center.centro_id, filter))
    .map((center) => ({
      centro_id: center.centro_id,
      centro_nombre: center.nombre,
      disponibles: center.voluntarios.disponibles,
      requeridos: center.voluntarios.requeridos,
      faltantes: center.voluntarios.faltantes,
    }));
}

export function donationRows(
  bundle: DashboardBundle,
  filter: CenterFilter,
): DonationTableRow[] {
  const centers = new Map(
    bundle.centers.map((center) => [center.centro_id, center]),
  );
  const catalog = presentationCatalog(bundle.products);

  return bundle.dashboard.donaciones_esperadas
    .filter((donation) => matchesCenter(donation.centro_id, filter))
    .map((donation) => {
      const item = catalog.get(donation.sku_id);
      const content = item?.presentation.contenido_por_paquete ?? 0;
      return {
        ...donation,
        centro_nombre:
          centers.get(donation.centro_id)?.nombre ?? donation.centro_id,
        producto_nombre: item?.product.nombre ?? "Producto no identificado",
        presentacion_nombre: item?.presentation.nombre ?? donation.sku_id,
        contenido_por_paquete: content,
        unidad_base: item?.product.unidad_base ?? "unidad",
        total_unidad_base: donation.cantidad_paquetes * content,
      };
    });
}

export function travelTimeRows(
  travelTimes: readonly TravelTimeRecord[],
  filter: CenterFilter,
) {
  return travelTimes.filter(
    (travelTime) =>
      filter === "all" ||
      travelTime.origen_id === filter ||
      travelTime.destino_id === filter,
  );
}
