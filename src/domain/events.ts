import type { ConfirmedReceptionPayload } from "@/contracts/schemas/events";

export interface SimulationInventoryLine {
  centro_id: string;
  sku_id: string;
  cantidad_paquetes: number;
}

export interface ConfirmedReceptionEvent {
  simulacion_id: string;
  tipo: "recepcion_confirmada";
  ocurrido_en: string;
  payload: ConfirmedReceptionPayload;
}

export function applyConfirmedReceptions(
  initialInventory: readonly SimulationInventoryLine[],
  events: readonly ConfirmedReceptionEvent[],
  simulationId: string,
  currentTime: string,
): SimulationInventoryLine[] {
  const result = initialInventory.map((line) => ({ ...line }));
  const cutoff = Date.parse(currentTime);

  for (const event of events) {
    if (
      event.simulacion_id !== simulationId ||
      event.tipo !== "recepcion_confirmada" ||
      event.payload.estado !== "confirmada" ||
      Date.parse(event.ocurrido_en) > cutoff
    ) {
      continue;
    }

    const existing = result.find(
      (line) =>
        line.centro_id === event.payload.centro_id &&
        line.sku_id === event.payload.sku_id,
    );

    if (existing) {
      existing.cantidad_paquetes += event.payload.cantidad_paquetes;
    } else {
      result.push({
        centro_id: event.payload.centro_id,
        sku_id: event.payload.sku_id,
        cantidad_paquetes: event.payload.cantidad_paquetes,
      });
    }
  }

  return result;
}

