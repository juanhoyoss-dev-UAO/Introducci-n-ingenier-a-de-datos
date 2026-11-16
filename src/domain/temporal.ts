import type { SnapshotBundle } from "@/contracts/schemas/data";
import type {
  SkippedTemporalEvent,
  TemporalEvent,
  TemporalPerspective,
  TemporalReconstructionResult,
} from "@/contracts/types/temporal";

function effectiveTime(event: TemporalEvent, perspective: TemporalPerspective) {
  return perspective === "fisica" ? event.ocurrido_en : event.registrado_en;
}

export function sortTemporalEvents(
  events: readonly TemporalEvent[],
  perspective: TemporalPerspective,
) {
  return [...events].sort(
    (left, right) =>
      Date.parse(effectiveTime(left, perspective)) -
        Date.parse(effectiveTime(right, perspective)) ||
      effectiveTime(left, perspective).localeCompare(
        effectiveTime(right, perspective),
      ) ||
      left.orden - right.orden ||
      left.operacion_id.localeCompare(right.operacion_id) ||
      left.evento_id.localeCompare(right.evento_id),
  );
}

function hasCenter(state: SnapshotBundle, centerId: string) {
  return state.centers.some((row) => row.centro_id === centerId);
}

function hasProduct(state: SnapshotBundle, productId: string | null) {
  return Boolean(
    productId && state.products.some((row) => row.producto_id === productId),
  );
}

function hasPresentation(
  state: SnapshotBundle,
  skuId: string | null,
  productId: string | null,
) {
  return Boolean(
    skuId &&
      productId &&
      state.presentations.some(
        (row) => row.sku_id === skuId && row.producto_id === productId,
      ),
  );
}

function setInventory(
  state: SnapshotBundle,
  event: TemporalEvent,
  quantity: number,
) {
  if (
    !event.sku_id ||
    !hasCenter(state, event.centro_id) ||
    !hasProduct(state, event.producto_id) ||
    !hasPresentation(state, event.sku_id, event.producto_id)
  ) {
    return "referencia_invalida" as const;
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return "inventario_insuficiente" as const;
  }
  const index = state.inventory.findIndex(
    (row) =>
      row.centro_id === event.centro_id && row.sku_id === event.sku_id,
  );
  const row = {
    snapshot_id: state.metadata.id,
    centro_id: event.centro_id,
    sku_id: event.sku_id,
    cantidad_paquetes: quantity,
  };
  if (index >= 0) {
    state.inventory[index] = row;
  } else {
    state.inventory.push(row);
  }
  return null;
}

function changeInventory(
  state: SnapshotBundle,
  event: TemporalEvent,
  delta: number,
) {
  if (!event.sku_id) {
    return "referencia_invalida" as const;
  }
  const current = state.inventory.find(
    (row) =>
      row.centro_id === event.centro_id && row.sku_id === event.sku_id,
  )?.cantidad_paquetes ?? 0;
  return setInventory(state, event, current + delta);
}

function applyEvent(state: SnapshotBundle, event: TemporalEvent) {
  if (event.tipo === "recepcion_confirmada") {
    const donation = event.payload.intencion_id
      ? state.expectedDonations.find(
          (row) => row.intencion_id === event.payload.intencion_id,
        )
      : null;
    if (event.payload.intencion_id && !donation) {
      return "referencia_invalida" as const;
    }
    const error = changeInventory(
      state,
      event,
      event.payload.cantidad_paquetes,
    );
    if (error) {
      return error;
    }
    if (donation) {
      donation.estado = "recibida";
    }
    return null;
  }

  if (event.tipo === "despacho") {
    return changeInventory(state, event, -event.payload.cantidad_paquetes);
  }

  if (event.tipo === "ajuste_inventario") {
    return setInventory(state, event, event.payload.cantidad_paquetes);
  }

  if (event.tipo === "actualizacion_necesidad") {
    if (
      !event.producto_id ||
      !hasCenter(state, event.centro_id) ||
      !hasProduct(state, event.producto_id)
    ) {
      return "referencia_invalida" as const;
    }
    const index = state.needs.findIndex(
      (row) =>
        row.centro_id === event.centro_id &&
        row.producto_id === event.producto_id,
    );
    const row = {
      snapshot_id: state.metadata.id,
      centro_id: event.centro_id,
      producto_id: event.producto_id,
      ...event.payload,
    };
    if (index >= 0) {
      state.needs[index] = row;
    } else {
      state.needs.push(row);
    }
    return null;
  }

  if (event.tipo === "actualizacion_voluntariado") {
    if (!hasCenter(state, event.centro_id)) {
      return "referencia_invalida" as const;
    }
    const index = state.volunteers.findIndex(
      (row) => row.centro_id === event.centro_id,
    );
    const row = {
      snapshot_id: state.metadata.id,
      centro_id: event.centro_id,
      ...event.payload,
    };
    if (index >= 0) {
      state.volunteers[index] = row;
    } else {
      state.volunteers.push(row);
    }
    return null;
  }

  const index = state.centers.findIndex(
    (row) => row.centro_id === event.centro_id,
  );
  if (
    (event.operacion === "create_center" && index >= 0) ||
    (event.operacion === "update_center" && index < 0)
  ) {
    return "referencia_invalida" as const;
  }
  const center = {
    snapshot_id: state.metadata.id,
    centro_id: event.centro_id,
    ...event.payload,
  };
  if (index >= 0) {
    state.centers[index] = center;
  } else {
    state.centers.push(center);
  }
  return null;
}

export function reconstructTemporalState(
  initialState: SnapshotBundle,
  events: readonly TemporalEvent[],
  scenarioId: string,
  cutoff: string,
  perspective: TemporalPerspective,
): TemporalReconstructionResult<SnapshotBundle> {
  const state = structuredClone(initialState);
  const cutoffTime = Date.parse(cutoff);
  if (!Number.isFinite(cutoffTime)) {
    throw new Error("La hora de corte debe ser una fecha ISO 8601 válida.");
  }

  const applied: string[] = [];
  const skipped: SkippedTemporalEvent[] = [];
  const seen = new Set<string>();

  for (const event of sortTemporalEvents(events, perspective)) {
    if (seen.has(event.evento_id)) {
      skipped.push({
        evento_id: event.evento_id,
        motivo: "evento_duplicado",
      });
      continue;
    }
    seen.add(event.evento_id);
    if (event.escenario_id !== scenarioId) {
      skipped.push({
        evento_id: event.evento_id,
        motivo: "escenario_distinto",
      });
      continue;
    }
    if (event.incorporado_en_estado_inicial) {
      skipped.push({
        evento_id: event.evento_id,
        motivo: "incorporado_en_estado_inicial",
      });
      continue;
    }
    const eventTime = Date.parse(effectiveTime(event, perspective));
    if (!Number.isFinite(eventTime)) {
      skipped.push({ evento_id: event.evento_id, motivo: "fecha_invalida" });
      continue;
    }
    if (eventTime > cutoffTime) {
      skipped.push({
        evento_id: event.evento_id,
        motivo: "posterior_al_corte",
      });
      continue;
    }
    const error = applyEvent(state, event);
    if (error) {
      skipped.push({ evento_id: event.evento_id, motivo: error });
      continue;
    }
    applied.push(event.evento_id);
  }

  return {
    estado: state,
    perspectiva: perspective,
    corte: cutoff,
    eventos_aplicados: applied,
    eventos_omitidos: skipped,
    completa: skipped.every(
      (event) =>
        event.motivo === "posterior_al_corte" ||
        event.motivo === "escenario_distinto" ||
        event.motivo === "incorporado_en_estado_inicial",
    ),
  };
}
