import type {
  DashboardIndicatorSummary,
  DashboardVisualizations,
} from "@/contracts/types/analytics";
import {
  calculateCoveragePercentage,
  calculateDeficit,
  calculateMissingVolunteers,
  calculatePackageUnits,
  calculatePotentialDeficit,
  calculateStorageOccupancy,
  calculateTransferableSurplus,
} from "@/domain/inventory";
import {
  recommendTransfers,
  type CenterProductBalance,
} from "@/domain/transfers";
import {
  getOperationsRepository,
  type OperationsRepository,
} from "@/server/repositories/operations";
import { serverLog } from "@/server/observability/request-context";
import { ApiError } from "./errors";

export async function getDashboard(
  snapshotId: string,
  repository: OperationsRepository = getOperationsRepository(),
) {
  const startedAt = performance.now();
  serverLog("INFO", "SERVICE", "Calculando indicadores");
  const source = await repository.getDashboardSource(snapshotId);
  if (!source.snapshot) {
    throw new ApiError(404, "SNAPSHOT_NOT_FOUND", "El snapshot no existe.");
  }

  const presentationBySku = new Map(
    source.presentations.map((presentation) => [presentation.sku_id, presentation]),
  );
  const balances: CenterProductBalance[] = [];

  const centers = source.centers.map((center) => {
    const volunteer = source.volunteers.find(
      (row) => row.centro_id === center.centro_id,
    );

    const products = source.products.map((product) => {
      const stock = source.inventory
        .filter((row) => row.centro_id === center.centro_id)
        .map((row) => ({ row, presentation: presentationBySku.get(row.sku_id) }))
        .filter(
          (
            item,
          ): item is {
            row: (typeof source.inventory)[number];
            presentation: (typeof source.presentations)[number];
          } => item.presentation?.producto_id === product.producto_id,
        )
        .map(({ row, presentation }) => ({
          sku_id: row.sku_id,
          cantidad_paquetes: row.cantidad_paquetes,
          contenido_por_paquete: presentation.contenido_por_paquete,
        }));
      const need = source.needs.find(
        (row) =>
          row.centro_id === center.centro_id &&
          row.producto_id === product.producto_id,
      );
      const expectedLines = source.expectedDonations
        .filter(
          (row) => row.centro_id === center.centro_id && row.estado === "pendiente",
        )
        .map((row) => ({ row, presentation: presentationBySku.get(row.sku_id) }))
        .filter(
          (
            item,
          ): item is {
            row: (typeof source.expectedDonations)[number];
            presentation: (typeof source.presentations)[number];
          } => item.presentation?.producto_id === product.producto_id,
        )
        .map(({ row, presentation }) => ({
          cantidad_paquetes: row.cantidad_paquetes,
          contenido_por_paquete: presentation.contenido_por_paquete,
        }));
      const confirmedUnits = calculatePackageUnits(stock);
      const targetUnits = need?.objetivo_unidad_base ?? 0;
      const reserveUnits = need?.reserva_unidad_base ?? 0;
      const deficitUnits = calculateDeficit(confirmedUnits, targetUnits);
      const expectedUnits = calculatePackageUnits(expectedLines);
      const surplusUnits = calculateTransferableSurplus(
        confirmedUnits,
        targetUnits,
        reserveUnits,
      );

      balances.push({
        centro_id: center.centro_id,
        producto_id: product.producto_id,
        deficit_unidad_base: deficitUnits,
        excedente_transferible_unidad_base: surplusUnits,
        existencias: stock,
      });

      return {
        producto_id: product.producto_id,
        nombre: product.nombre,
        unidad_base: product.unidad_base,
        inventario_confirmado_unidad_base: confirmedUnits,
        objetivo_unidad_base: targetUnits,
        reserva_unidad_base: reserveUnits,
        prioridad: need?.prioridad ?? null,
        deficit_confirmado_unidad_base: deficitUnits,
        cobertura_porcentaje: calculateCoveragePercentage(
          confirmedUnits,
          targetUnits,
        ),
        deficit_potencial_unidad_base: calculatePotentialDeficit(
          confirmedUnits,
          targetUnits,
          expectedUnits,
        ),
        excedente_transferible_unidad_base: surplusUnits,
        donaciones_esperadas_unidad_base: expectedUnits,
        existencias: stock,
      };
    });

    const centerInventory = source.inventory
      .filter((row) => row.centro_id === center.centro_id)
      .map((row) => ({
        cantidad_paquetes: row.cantidad_paquetes,
        peso_kg_por_paquete: null,
      }));

    return {
      ...center,
      voluntarios: {
        disponibles: volunteer?.disponibles ?? 0,
        requeridos: volunteer?.requeridos ?? 0,
        faltantes: calculateMissingVolunteers(
          volunteer?.disponibles ?? 0,
          volunteer?.requeridos ?? 0,
        ),
      },
      capacidad_almacenamiento: calculateStorageOccupancy(
        centerInventory,
        null,
      ),
      productos: products,
    };
  });

  const indicadores: DashboardIndicatorSummary = {
    centros_activos: centers.filter(
      (center) => center.estado.trim().toLowerCase() === "activo",
    ).length,
  };
  const visualizaciones: DashboardVisualizations = {
    cobertura_por_centro: centers.flatMap((center) =>
      center.productos.map((product) => ({
        centro_id: center.centro_id,
        centro_nombre: center.nombre,
        producto_id: product.producto_id,
        producto_nombre: product.nombre,
        cobertura_porcentaje: product.cobertura_porcentaje,
        unidad: "porcentaje",
        unidad_base_producto: product.unidad_base,
      })),
    ),
    inventario_vs_necesidad: centers.flatMap((center) =>
      center.productos.map((product) => ({
        centro_id: center.centro_id,
        centro_nombre: center.nombre,
        producto_id: product.producto_id,
        producto_nombre: product.nombre,
        inventario_confirmado:
          product.inventario_confirmado_unidad_base,
        necesidad_vigente: product.objetivo_unidad_base,
        unidad: product.unidad_base,
      })),
    ),
    recursos_confirmados_vs_esperados: centers.flatMap((center) =>
      center.productos.map((product) => ({
        centro_id: center.centro_id,
        centro_nombre: center.nombre,
        producto_id: product.producto_id,
        producto_nombre: product.nombre,
        recursos_confirmados:
          product.inventario_confirmado_unidad_base,
        recursos_esperados: product.donaciones_esperadas_unidad_base,
        unidad: product.unidad_base,
      })),
    ),
    voluntarios_disponibles_vs_requeridos: centers.map((center) => ({
      centro_id: center.centro_id,
      centro_nombre: center.nombre,
      disponibles: center.voluntarios.disponibles,
      requeridos: center.voluntarios.requeridos,
      unidad: "persona",
    })),
  };

  const result = {
    snapshot: source.snapshot,
    centros: centers,
    indicadores,
    visualizaciones,
    donaciones_esperadas: source.expectedDonations,
    candidatos_traslado: recommendTransfers(balances, source.travelTimes),
  };
  serverLog("OK", "SERVICE", "Indicadores calculados", {
    centers: result.centros.length,
    durationMs: Math.round(performance.now() - startedAt),
    expectedDonations: result.donaciones_esperadas.length,
    transferCandidates: result.candidatos_traslado.length,
  });
  return result;
}

