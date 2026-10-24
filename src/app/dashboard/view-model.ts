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

export interface DashboardSummary {
  centros: number;
  productos: number;
  presentaciones: number;
  centrosConNecesidades: number;
  centrosConDeficit: number;
  donacionesAnunciadas: number;
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
