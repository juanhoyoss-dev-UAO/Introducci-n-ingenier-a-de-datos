export interface PresentationStock {
  sku_id: string;
  cantidad_paquetes: number;
  contenido_por_paquete: number;
}

export interface CenterProductBalance {
  centro_id: string;
  producto_id: string;
  deficit_unidad_base: number;
  excedente_transferible_unidad_base: number;
  existencias: readonly PresentationStock[];
}

export interface DirectedTravelTime {
  origen_id: string;
  destino_id: string;
  minutos: number;
}

export interface TransferPackageProposal {
  sku_id: string;
  cantidad_paquetes: number;
  contenido_por_paquete: number;
}

export interface TransferRecommendation {
  producto_id: string;
  origen_id: string;
  destino_id: string;
  minutos: number;
  paquetes: TransferPackageProposal[];
  total_unidad_base: number;
}

function key(centerId: string, productId: string) {
  return `${centerId}\u0000${productId}`;
}

function stockKey(centerId: string, productId: string, skuId: string) {
  return `${key(centerId, productId)}\u0000${skuId}`;
}

export function recommendTransfers(
  balances: readonly CenterProductBalance[],
  travelTimes: readonly DirectedTravelTime[],
): TransferRecommendation[] {
  const balanceByKey = new Map(
    balances.map((balance) => [
      key(balance.centro_id, balance.producto_id),
      balance,
    ]),
  );
  const remainingDeficit = new Map(
    balances.map((balance) => [
      key(balance.centro_id, balance.producto_id),
      balance.deficit_unidad_base,
    ]),
  );
  const remainingSurplus = new Map(
    balances.map((balance) => [
      key(balance.centro_id, balance.producto_id),
      balance.excedente_transferible_unidad_base,
    ]),
  );
  const remainingPackages = new Map<string, number>();

  for (const balance of balances) {
    for (const stock of balance.existencias) {
      remainingPackages.set(
        stockKey(balance.centro_id, balance.producto_id, stock.sku_id),
        stock.cantidad_paquetes,
      );
    }
  }

  const recommendations: TransferRecommendation[] = [];
  const orderedTimes = [...travelTimes].sort(
    (left, right) => left.minutos - right.minutos,
  );
  const productIds = [...new Set(balances.map((balance) => balance.producto_id))];

  for (const time of orderedTimes) {
    for (const productId of productIds) {
      const sourceKey = key(time.origen_id, productId);
      const destinationKey = key(time.destino_id, productId);
      const source = balanceByKey.get(sourceKey);
      const destination = balanceByKey.get(destinationKey);
      const surplus = remainingSurplus.get(sourceKey) ?? 0;
      const deficit = remainingDeficit.get(destinationKey) ?? 0;

      if (!source || !destination || surplus <= 0 || deficit <= 0) {
        continue;
      }

      let maximumUnits = Math.min(surplus, deficit);
      let proposedUnits = 0;
      const packages: TransferPackageProposal[] = [];
      const orderedStock = [...source.existencias].sort(
        (left, right) =>
          right.contenido_por_paquete - left.contenido_por_paquete,
      );

      for (const stock of orderedStock) {
        const available =
          remainingPackages.get(
            stockKey(source.centro_id, productId, stock.sku_id),
          ) ?? 0;
        const quantity = Math.min(
          available,
          Math.floor(maximumUnits / stock.contenido_por_paquete),
        );

        if (quantity <= 0) {
          continue;
        }

        const units = quantity * stock.contenido_por_paquete;
        packages.push({
          sku_id: stock.sku_id,
          cantidad_paquetes: quantity,
          contenido_por_paquete: stock.contenido_por_paquete,
        });
        proposedUnits += units;
        maximumUnits -= units;
        remainingPackages.set(
          stockKey(source.centro_id, productId, stock.sku_id),
          available - quantity,
        );
      }

      if (proposedUnits === 0) {
        continue;
      }

      remainingSurplus.set(sourceKey, surplus - proposedUnits);
      remainingDeficit.set(destinationKey, deficit - proposedUnits);
      recommendations.push({
        producto_id: productId,
        origen_id: time.origen_id,
        destino_id: time.destino_id,
        minutos: time.minutos,
        paquetes: packages,
        total_unidad_base: proposedUnits,
      });
    }
  }

  return recommendations;
}

