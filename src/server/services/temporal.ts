import {
  operationalTemporalPayloadSchema,
  temporalQuerySchema,
  type TemporalQuery,
} from "@/contracts/schemas/temporal";
import type { SnapshotBundle } from "@/contracts/schemas/data";
import type {
  TemporalAnalysisResult,
  TemporalEvent,
  TemporalHourlyFlowPoint,
  TemporalInventoryPoint,
  TemporalPhysicalQuantityPoint,
  TemporalVolunteerPoint,
} from "@/contracts/types/temporal";
import {
  calculateDeficit,
  calculatePackageUnits,
} from "@/domain/inventory";
import {
  reconstructTemporalState,
  sortTemporalEvents,
} from "@/domain/temporal";
import {
  getOperationsRepository,
  type DashboardSource,
  type OperationsRepository,
} from "@/server/repositories/operations";
import { serverLog } from "@/server/observability/request-context";
import { ApiError } from "./errors";
import { getDashboard } from "./dashboard";

const bogotaFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

function localBucket(value: string) {
  const parts = Object.fromEntries(
    bogotaFormatter
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour);
  return {
    date,
    hour,
    key: `${date}T${String(hour).padStart(2, "0")}`,
    label: `${date} ${String(hour).padStart(2, "0")}:00`,
  };
}

function effectiveTime(event: TemporalEvent, query: TemporalQuery) {
  return query.perspectiva === "fisica"
    ? event.ocurrido_en
    : event.registrado_en;
}

function movementEvents(
  selected: SnapshotBundle,
  base: SnapshotBundle,
  scenarioId: string,
): TemporalEvent[] {
  const incorporated = new Set(
    base.movements.map((movement) => movement.movimiento_id),
  );
  const events: TemporalEvent[] = [];
  selected.movements.forEach((movement, index) => {
    const isReception = movement.tipo === "recepcion_confirmada";
    const centerId = isReception
      ? movement.centro_destino_id
      : movement.centro_origen_id;
    if (!centerId) {
      return;
    }
    const common = {
      evento_id: movement.movimiento_id,
      operacion_id: movement.operacion_id,
      escenario_id: scenarioId,
      snapshot_origen_id: movement.snapshot_origen_id,
      centro_id: centerId,
      producto_id: movement.producto_id,
      sku_id: movement.sku_id,
      ocurrido_en: movement.ocurrido_en,
      registrado_en: movement.registrado_en,
      orden: index,
      incorporado_en_estado_inicial: incorporated.has(
        movement.movimiento_id,
      ),
    };
    if (isReception) {
      events.push({
        ...common,
        tipo: "recepcion_confirmada",
        operacion: movement.intencion_id
          ? "confirm_donation"
          : "direct_reception",
        payload: {
          cantidad_paquetes: movement.cantidad_paquetes,
          intencion_id: movement.intencion_id,
        },
      });
      return;
    }
    events.push({
      ...common,
      tipo: "despacho",
      operacion: "dispatch",
      payload: { cantidad_paquetes: movement.cantidad_paquetes },
    });
  });
  return events;
}

function operationalEvents(
  selected: SnapshotBundle,
  base: SnapshotBundle,
): TemporalEvent[] {
  const incorporated = new Set(
    base.operationalEvents.map((event) => event.evento_id),
  );
  return selected.operationalEvents.map((row) => {
    const payload = operationalTemporalPayloadSchema.parse(
      JSON.parse(row.payload_json),
    );
    const common = {
      evento_id: row.evento_id,
      operacion_id: row.operacion_id,
      escenario_id: row.escenario_id,
      snapshot_origen_id: row.snapshot_origen_id,
      centro_id: row.centro_id,
      producto_id: row.producto_id,
      sku_id: row.sku_id,
      ocurrido_en: row.ocurrido_en,
      registrado_en: row.registrado_en,
      orden: row.orden,
      incorporado_en_estado_inicial: incorporated.has(row.evento_id),
    };
    if (payload.operacion === "upsert_inventory") {
      return {
        ...common,
        tipo: "ajuste_inventario",
        operacion: payload.operacion,
        payload: { cantidad_paquetes: payload.cantidad_paquetes },
      };
    }
    if (payload.operacion === "upsert_need") {
      return {
        ...common,
        tipo: "actualizacion_necesidad",
        operacion: payload.operacion,
        payload: {
          objetivo_unidad_base: payload.objetivo_unidad_base,
          reserva_unidad_base: payload.reserva_unidad_base,
          prioridad: payload.prioridad,
        },
      };
    }
    if (payload.operacion === "upsert_volunteers") {
      return {
        ...common,
        tipo: "actualizacion_voluntariado",
        operacion: payload.operacion,
        payload: {
          disponibles: payload.disponibles,
          requeridos: payload.requeridos,
        },
      };
    }
    if (payload.operacion === "announce_donation") {
      return {
        ...common,
        tipo: "anuncio_donacion",
        operacion: payload.operacion,
        payload: {
          intencion_id: payload.intencion_id,
          cantidad_paquetes: payload.cantidad_paquetes,
          llegada_prevista: payload.llegada_prevista,
        },
      };
    }
    return {
      ...common,
      tipo: "cambio_estado_centro",
      operacion: payload.operacion,
      payload: {
        nombre: payload.nombre,
        estado: payload.estado,
        zona: payload.zona,
        coordinador_nombre: payload.coordinador_nombre,
      },
    };
  });
}

function matchesFilters(event: TemporalEvent, query: TemporalQuery) {
  const instant = Date.parse(effectiveTime(event, query));
  return (
    (!query.centro_id || event.centro_id === query.centro_id) &&
    (!query.producto_id || event.producto_id === query.producto_id) &&
    (!query.desde || instant >= Date.parse(query.desde)) &&
    (!query.hasta || instant <= Date.parse(query.hasta)) &&
    instant <= Date.parse(query.corte)
  );
}

function hourlyFlows(
  events: readonly TemporalEvent[],
  query: TemporalQuery,
): TemporalHourlyFlowPoint[] {
  const buckets = new Map<string, TemporalHourlyFlowPoint>();
  for (const event of events) {
    if (
      !matchesFilters(event, query) ||
      (event.tipo !== "recepcion_confirmada" && event.tipo !== "despacho")
    ) {
      continue;
    }
    const bucket = localBucket(effectiveTime(event, query));
    const point = buckets.get(bucket.key) ?? {
      fecha_local: bucket.date,
      hora_local: bucket.hour,
      etiqueta: bucket.label,
      recepciones: 0,
      paquetes_recibidos: 0,
      despachos: 0,
      paquetes_despachados: 0,
    };
    if (event.tipo === "recepcion_confirmada") {
      point.recepciones += 1;
      point.paquetes_recibidos += event.payload.cantidad_paquetes;
    } else {
      point.despachos += 1;
      point.paquetes_despachados += event.payload.cantidad_paquetes;
    }
    buckets.set(bucket.key, point);
  }
  return [...buckets.values()].sort(
    (left, right) =>
      left.fecha_local.localeCompare(right.fecha_local) ||
      left.hora_local - right.hora_local,
  );
}

function physicalReceptions(
  events: readonly TemporalEvent[],
  query: TemporalQuery,
  selected: SnapshotBundle,
): TemporalPhysicalQuantityPoint[] {
  const presentationBySku = new Map(
    selected.presentations.map((row) => [row.sku_id, row]),
  );
  const productById = new Map(
    selected.products.map((row) => [row.producto_id, row]),
  );
  const buckets = new Map<string, TemporalPhysicalQuantityPoint>();
  for (const event of events) {
    if (event.tipo !== "recepcion_confirmada" || !matchesFilters(event, query)) {
      continue;
    }
    const presentation = event.sku_id
      ? presentationBySku.get(event.sku_id)
      : undefined;
    const product = event.producto_id
      ? productById.get(event.producto_id)
      : undefined;
    if (!presentation || !product) {
      continue;
    }
    const bucket = localBucket(effectiveTime(event, query));
    const key = `${bucket.key}\u0000${product.producto_id}`;
    const point = buckets.get(key) ?? {
      fecha_local: bucket.date,
      hora_local: bucket.hour,
      producto_id: product.producto_id,
      producto_nombre: product.nombre,
      cantidad_unidad_base: 0,
      unidad: product.unidad_base,
    };
    point.cantidad_unidad_base +=
      event.payload.cantidad_paquetes * presentation.contenido_por_paquete;
    buckets.set(key, point);
  }
  return [...buckets.values()].sort(
    (left, right) =>
      left.fecha_local.localeCompare(right.fecha_local) ||
      left.hora_local - right.hora_local ||
      left.producto_id.localeCompare(right.producto_id),
  );
}

function productPoint(
  state: SnapshotBundle,
  centerId: string,
  productId: string,
  instant: string,
): TemporalInventoryPoint | null {
  const product = state.products.find((row) => row.producto_id === productId);
  if (!product || !state.centers.some((row) => row.centro_id === centerId)) {
    return null;
  }
  const presentationBySku = new Map(
    state.presentations.map((row) => [row.sku_id, row]),
  );
  const lines = state.inventory
    .filter((row) => row.centro_id === centerId)
    .flatMap((row) => {
      const presentation = presentationBySku.get(row.sku_id);
      return presentation?.producto_id === productId
        ? [
            {
              cantidad_paquetes: row.cantidad_paquetes,
              contenido_por_paquete: presentation.contenido_por_paquete,
            },
          ]
        : [];
    });
  const inventory = calculatePackageUnits(lines);
  const need = state.needs.find(
    (row) => row.centro_id === centerId && row.producto_id === productId,
  );
  const target = need?.objetivo_unidad_base ?? 0;
  return {
    instante: instant,
    centro_id: centerId,
    producto_id: productId,
    producto_nombre: product.nombre,
    inventario: inventory,
    necesidad: target,
    deficit: calculateDeficit(inventory, target),
    unidad: product.unidad_base,
  };
}

function evolutionSeries(
  base: SnapshotBundle,
  events: readonly TemporalEvent[],
  scenarioId: string,
  query: TemporalQuery,
) {
  const relevant = sortTemporalEvents(events, query.perspectiva).filter(
    (event) =>
      !event.incorporado_en_estado_inicial &&
      event.escenario_id === scenarioId &&
      matchesFilters(event, query),
  );
  const instants = [...new Set(relevant.map((event) => effectiveTime(event, query)))];
  const inventory: TemporalInventoryPoint[] = [];
  const volunteers: TemporalVolunteerPoint[] = [];

  for (const instant of instants) {
    const reconstruction = reconstructTemporalState(
      base,
      events,
      scenarioId,
      instant,
      query.perspectiva,
    );
    const state = reconstruction.estado;
    const eventsAtInstant = relevant.filter(
      (event) => effectiveTime(event, query) === instant,
    );
    const pairs = new Map<string, { centerId: string; productId: string }>();
    for (const event of eventsAtInstant) {
      if (
        event.producto_id &&
        (!query.centro_id || event.centro_id === query.centro_id) &&
        (!query.producto_id || event.producto_id === query.producto_id)
      ) {
        pairs.set(`${event.centro_id}\u0000${event.producto_id}`, {
          centerId: event.centro_id,
          productId: event.producto_id,
        });
      }
    }
    if (query.centro_id && query.producto_id) {
      pairs.set(`${query.centro_id}\u0000${query.producto_id}`, {
        centerId: query.centro_id,
        productId: query.producto_id,
      });
    }
    for (const pair of pairs.values()) {
      const point = productPoint(
        state,
        pair.centerId,
        pair.productId,
        instant,
      );
      if (point) {
        inventory.push(point);
      }
    }
    for (const event of eventsAtInstant) {
      if (
        event.tipo === "actualizacion_voluntariado" &&
        (!query.centro_id || event.centro_id === query.centro_id)
      ) {
        const row = state.volunteers.find(
          (item) => item.centro_id === event.centro_id,
        );
        if (row) {
          volunteers.push({
            instante: instant,
            centro_id: row.centro_id,
            disponibles: row.disponibles,
            requeridos: row.requeridos,
          });
        }
      }
    }
  }
  return { inventory, volunteers };
}

function dashboardSource(
  selected: SnapshotBundle,
  reconstructed: SnapshotBundle,
  visibleMovementIds: ReadonlySet<string>,
): DashboardSource {
  return {
    snapshot: selected.metadata,
    centers: reconstructed.centers,
    products: reconstructed.products,
    presentations: reconstructed.presentations,
    inventory: reconstructed.inventory,
    needs: reconstructed.needs,
    volunteers: reconstructed.volunteers,
    travelTimes: reconstructed.travelTimes,
    expectedDonations: reconstructed.expectedDonations,
    movements: selected.movements.filter((movement) =>
      visibleMovementIds.has(movement.movimiento_id),
    ),
  };
}

export async function getTemporalAnalysis(
  snapshotId: string,
  input: unknown,
  repository: OperationsRepository = getOperationsRepository(),
): Promise<TemporalAnalysisResult> {
  const parsed = temporalQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "INVALID_TEMPORAL_QUERY",
      "Los filtros temporales no son válidos.",
      parsed.error.flatten(),
    );
  }
  const query = parsed.data;
  const selected = await repository.getSnapshotBundle(snapshotId);
  if (!selected) {
    throw new ApiError(404, "SNAPSHOT_NOT_FOUND", "El snapshot no existe.");
  }
  const scenarioId = selected.metadata.escenario_id ?? selected.metadata.id;
  if (query.escenario_id && query.escenario_id !== scenarioId) {
    throw new ApiError(
      400,
      "SCENARIO_MISMATCH",
      "El escenario solicitado no corresponde a la versión seleccionada.",
    );
  }
  const baseSnapshotId =
    selected.metadata.snapshot_base_id ?? selected.metadata.id;
  const base = await repository.getSnapshotBundle(baseSnapshotId);
  if (!base) {
    throw new ApiError(
      409,
      "TEMPORAL_BASE_NOT_FOUND",
      "No está disponible el estado inicial de la cadena temporal.",
    );
  }

  const events = [
    ...movementEvents(selected, base, scenarioId),
    ...operationalEvents(selected, base),
  ];
  const reconstruction = reconstructTemporalState(
    base,
    events,
    scenarioId,
    query.corte,
    query.perspectiva,
  );
  const applied = new Set(reconstruction.eventos_aplicados);
  const visibleMovementIds = new Set(
    events
      .filter(
        (event) =>
          (event.incorporado_en_estado_inicial || applied.has(event.evento_id)) &&
          (event.tipo === "recepcion_confirmada" || event.tipo === "despacho"),
      )
      .map((event) => event.evento_id),
  );
  const dashboard = await getDashboard(
    snapshotId,
    repository,
    query.corte,
    {
      source: dashboardSource(
        selected,
        reconstruction.estado,
        visibleMovementIds,
      ),
      referencia_tipo: "escenario",
      referencia_id: scenarioId,
    },
  );
  const evolution = evolutionSeries(
    base,
    events,
    scenarioId,
    query,
  );
  const limitations: string[] = [];
  const legacyBaseline = !selected.metadata.snapshot_base_id;
  if (legacyBaseline) {
    limitations.push(
      "El snapshot no declara un estado base temporal; su contenido se conserva como punto inicial sin inventar la hora física de sus registros.",
    );
  }
  if (events.some((event) => event.incorporado_en_estado_inicial)) {
    limitations.push(
      "Hay eventos ya incorporados al estado inicial: se muestran en el historial, pero no se reaplican ni permiten reconstruir un instante anterior a esa base.",
    );
  }
  if (!reconstruction.completa) {
    limitations.push(
      "Uno o más eventos no pudieron aplicarse por referencias o cantidades inválidas.",
    );
  }
  if (events.length === 0) {
    limitations.push(
      "No existen eventos con evidencia temporal para esta versión; sólo puede presentarse el estado inicial validado.",
    );
  }
  const status =
    legacyBaseline && events.length > 0
      ? "insuficiente"
      : limitations.length > 0
        ? "parcial"
        : "completa";

  const returnedEvents = sortTemporalEvents(events, query.perspectiva).filter(
    (event) => matchesFilters(event, query),
  );
  serverLog("OK", "SERVICE", "Análisis temporal calculado", {
    snapshot: snapshotId,
    scenario: scenarioId,
    perspective: query.perspectiva,
    events: returnedEvents.length,
    result: status,
  });
  return {
    referencia: {
      snapshot_id: snapshotId,
      escenario_id: scenarioId,
      snapshot_base_id: baseSnapshotId,
      snapshot_origen_id: selected.metadata.snapshot_origen_id ?? null,
    },
    perspectiva: query.perspectiva,
    corte: query.corte,
    completitud: { estado: status, limitaciones: limitations },
    eventos: returnedEvents,
    reconstruccion: {
      centros: reconstruction.estado.centers.map((row) => ({
        centro_id: row.centro_id,
        nombre: row.nombre,
        estado: row.estado,
      })),
      inventario: reconstruction.estado.inventory.map((row) => ({
        centro_id: row.centro_id,
        sku_id: row.sku_id,
        cantidad_paquetes: row.cantidad_paquetes,
      })),
      necesidades: reconstruction.estado.needs.map((row) => ({
        centro_id: row.centro_id,
        producto_id: row.producto_id,
        objetivo_unidad_base: row.objetivo_unidad_base,
        prioridad: row.prioridad,
      })),
      voluntarios: reconstruction.estado.volunteers.map((row) => ({
        centro_id: row.centro_id,
        disponibles: row.disponibles,
        requeridos: row.requeridos,
      })),
      eventos_aplicados: reconstruction.eventos_aplicados,
      eventos_omitidos: reconstruction.eventos_omitidos,
    },
    indicadores: {
      centros_activos: dashboard.indicadores.centros_activos,
      alertas: dashboard.alertas,
    },
    series: {
      movimientos_por_hora: hourlyFlows(events, query),
      recepciones_fisicas: physicalReceptions(events, query, selected),
      inventario_necesidad_deficit: evolution.inventory,
      voluntarios: evolution.volunteers,
      desfase_registro: returnedEvents.map((event) => ({
        evento_id: event.evento_id,
        ocurrido_en: event.ocurrido_en,
        registrado_en: event.registrado_en,
        desfase_minutos:
          (Date.parse(event.registrado_en) - Date.parse(event.ocurrido_en)) /
          60_000,
      })),
    },
  };
}
