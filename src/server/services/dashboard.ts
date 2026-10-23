import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calculateDeficit,
  calculateMissingVolunteers,
  calculatePackageUnits,
  calculateTransferableSurplus,
} from "@/domain/inventory";
import {
  recommendTransfers,
  type CenterProductBalance,
} from "@/domain/transfers";
import { getDashboardSource } from "@/server/repositories/operations";
import { ApiError } from "./errors";

export async function getDashboard(
  supabase: SupabaseClient,
  snapshotId: string,
) {
  const source = await getDashboardSource(supabase, snapshotId);
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
        excedente_transferible_unidad_base: surplusUnits,
        donaciones_esperadas_unidad_base:
          calculatePackageUnits(expectedLines),
        existencias: stock,
      };
    });

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
      productos: products,
    };
  });

  return {
    snapshot: source.snapshot,
    centros: centers,
    donaciones_esperadas: source.expectedDonations,
    candidatos_traslado: recommendTransfers(balances, source.travelTimes),
  };
}

