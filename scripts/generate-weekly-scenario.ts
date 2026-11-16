import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { stringify } from "csv-stringify/sync";

type Unit = "ml" | "g" | "unidad";

interface ScenarioConfig {
  version: number;
  seed: string;
  scenario_id: string;
  base_snapshot_id: string;
  final_snapshot_id: string;
  name: string;
  start: string;
  end: string;
  timezone: string;
  simulated: boolean;
  centers: Array<{
    id: string;
    name: string;
    zone: string;
    coordinator: string;
    profile: string;
    initial_available: number;
    initial_required: number;
  }>;
  products: Array<{
    id: string;
    name: string;
    unit: Unit;
    category: string;
    source_kind: "humanitaria" | "simulacion";
    source: string;
    source_note: string;
  }>;
  presentations: Array<{
    sku: string;
    product: string;
    name: string;
    content: number;
  }>;
  sources: unknown[];
}

interface Bundle {
  metadata: Record<string, unknown>;
  centers: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  presentations: Array<Record<string, unknown>>;
  inventory: Array<Record<string, unknown>>;
  needs: Array<Record<string, unknown>>;
  volunteers: Array<Record<string, unknown>>;
  travelTimes: Array<Record<string, unknown>>;
  expectedDonations: Array<Record<string, unknown>>;
  movements: Array<Record<string, unknown>>;
  operationalEvents: Array<Record<string, unknown>>;
}

export interface WeeklyScenarioBuild {
  config: ScenarioConfig;
  base: Bundle;
  final: Bundle;
  summary: Record<string, unknown>;
}

const COLUMNS = {
  centers: ["snapshot_id", "centro_id", "nombre", "estado", "zona", "coordinador_nombre"],
  products: ["snapshot_id", "producto_id", "nombre", "unidad_base"],
  presentations: ["snapshot_id", "sku_id", "producto_id", "nombre", "contenido_por_paquete"],
  inventory: ["snapshot_id", "centro_id", "sku_id", "cantidad_paquetes"],
  needs: ["snapshot_id", "centro_id", "producto_id", "objetivo_unidad_base", "reserva_unidad_base", "prioridad"],
  volunteers: ["snapshot_id", "centro_id", "disponibles", "requeridos"],
  travelTimes: ["snapshot_id", "origen_id", "destino_id", "minutos"],
  expectedDonations: ["snapshot_id", "intencion_id", "centro_id", "sku_id", "cantidad_paquetes", "llegada_prevista", "estado"],
  movements: ["snapshot_id", "movimiento_id", "operacion_id", "tipo", "centro_origen_id", "centro_destino_id", "producto_id", "sku_id", "cantidad_paquetes", "ocurrido_en", "registrado_en", "intencion_id", "snapshot_origen_id", "cantidad_anunciada_paquetes"],
  operationalEvents: ["snapshot_id", "evento_id", "operacion_id", "escenario_id", "snapshot_origen_id", "tipo", "operacion", "centro_id", "producto_id", "sku_id", "ocurrido_en", "registrado_en", "orden", "payload_json"],
} as const;

const FILES: Record<keyof typeof COLUMNS, string> = {
  centers: "centros.csv",
  products: "productos.csv",
  presentations: "presentaciones.csv",
  inventory: "inventario.csv",
  needs: "necesidades.csv",
  volunteers: "voluntarios.csv",
  travelTimes: "tiempos.csv",
  expectedDonations: "intenciones.csv",
  movements: "movimientos.csv",
  operationalEvents: "eventos.csv",
};

function deterministicUuid(seed: string, label: string) {
  const hex = createHash("sha256").update(`${seed}:${label}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = "8";
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function makeRandom(seed: string) {
  let state = Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) >>> 0;
  return {
    integer(minimum: number, maximum: number) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      const ratio = (state >>> 0) / 0x1_0000_0000;
      return minimum + Math.floor(ratio * (maximum - minimum + 1));
    },
  };
}

function localTimestamp(day: number, hour: number, minute: number) {
  return `2026-11-${String(9 + day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-05:00`;
}

function addMinutes(value: string, minutes: number) {
  const local = new Date(Date.parse(value) + minutes * 60_000 - 5 * 60 * 60_000);
  return `${local.toISOString().slice(0, 19)}-05:00`;
}

function delayFor(index: number) {
  return [0, 30, 90, 240, 900][index % 5] ?? 0;
}

function mapSnapshot<T extends Record<string, unknown>>(rows: T[], snapshotId: string) {
  return rows.map((row) => ({ ...row, snapshot_id: snapshotId }));
}

function quantityByProduct(inventory: Array<Record<string, unknown>>, presentations: ScenarioConfig["presentations"]) {
  const presentationBySku = new Map(presentations.map((row) => [row.sku, row]));
  const totals = new Map<string, number>();
  for (const row of inventory) {
    const presentation = presentationBySku.get(String(row.sku_id));
    if (!presentation) continue;
    const key = `${row.centro_id}:${presentation.product}`;
    totals.set(key, (totals.get(key) ?? 0) + Number(row.cantidad_paquetes) * presentation.content);
  }
  return totals;
}

function validateConfiguration(config: ScenarioConfig) {
  if (!config.simulated || config.timezone !== "America/Bogota") throw new Error("El escenario debe estar marcado como simulado y usar America/Bogota.");
  if (config.centers.length !== 6) throw new Error("El escenario semanal requiere seis centros.");
  if (config.products.length < 28 || config.products.length > 35) throw new Error("El catalogo debe contener entre 28 y 35 productos.");
  if (config.presentations.length < 35 || config.presentations.length > 50) throw new Error("El catalogo debe contener entre 35 y 50 presentaciones.");
  if (Date.parse(config.start) !== Date.parse("2026-11-09T07:30:00-05:00") || Date.parse(config.end) !== Date.parse("2026-11-15T23:59:00-05:00")) throw new Error("El periodo semanal no coincide con la especificacion M6.5.");
  for (const [label, values] of [["centro", config.centers.map((row) => row.id)], ["producto", config.products.map((row) => row.id)], ["SKU", config.presentations.map((row) => row.sku)]] as const) {
    if (new Set(values).size !== values.length) throw new Error(`Identificador duplicado de ${label}.`);
  }
  const productIds = new Set(config.products.map((row) => row.id));
  for (const row of config.presentations) {
    if (!productIds.has(row.product) || !Number.isFinite(row.content) || row.content <= 0) throw new Error(`Presentacion invalida: ${row.sku}.`);
  }
}

export function buildWeeklyScenario(config: ScenarioConfig): WeeklyScenarioBuild {
  validateConfiguration(config);
  const random = makeRandom(config.seed);
  const baseId = config.base_snapshot_id;
  const finalId = config.final_snapshot_id;
  const skuById = new Map(config.presentations.map((row) => [row.sku, row]));
  const skus = config.presentations.map((row) => row.sku);

  const centers = config.centers.map((row) => ({
    snapshot_id: baseId,
    centro_id: row.id,
    nombre: row.name,
    estado: "activo",
    zona: row.zone,
    coordinador_nombre: row.coordinator,
  }));
  const products = config.products.map((row) => ({ snapshot_id: baseId, producto_id: row.id, nombre: row.name, unidad_base: row.unit }));
  const presentations = config.presentations.map((row) => ({ snapshot_id: baseId, sku_id: row.sku, producto_id: row.product, nombre: row.name, contenido_por_paquete: row.content }));

  const initialInventory: Array<Record<string, unknown>> = [];
  config.centers.forEach((center, centerIndex) => {
    config.presentations.forEach((presentation, skuIndex) => {
      const profileMatch = center.id === "C04" ? Number(presentation.product.slice(1)) >= 21 : center.id === "C01" ? Number(presentation.product.slice(1)) <= 12 : center.id === "C06" ? skuIndex % 2 === 0 : false;
      if ((skuIndex * 7 + centerIndex * 11) % 5 < 2 || profileMatch) {
        let quantity = random.integer(2, 14) + centerIndex;
        if (center.id === "C03") quantity = Math.max(1, Math.floor(quantity / 2));
        if (center.id === "C06" && Number(presentation.product.slice(1)) >= 21) quantity += 12;
        initialInventory.push({ snapshot_id: baseId, centro_id: center.id, sku_id: presentation.sku, cantidad_paquetes: quantity });
      }
    });
  });
  const ensureInventory = (centerId: string, sku: string, quantity: number) => {
    const index = initialInventory.findIndex((row) => row.centro_id === centerId && row.sku_id === sku);
    const value = { snapshot_id: baseId, centro_id: centerId, sku_id: sku, cantidad_paquetes: quantity };
    if (index >= 0) initialInventory[index] = value;
    else initialInventory.push(value);
  };
  ensureInventory("C01", "AGUA-600", 10);
  ensureInventory("C03", "AGUA-600", 2);
  ensureInventory("C06", "PALA-UN", 30);

  const initialTotals = quantityByProduct(initialInventory, config.presentations);
  const ratioByCenter: Record<string, number> = { C01: 2, C02: 1.25, C03: 3.2, C04: 1.15, C05: 1.7, C06: 0.75 };
  const floorByUnit: Record<Unit, number> = { ml: 18_000, g: 12_000, unidad: 12 };
  const initialNeeds = config.centers.flatMap((center, centerIndex) =>
    config.products.map((product, productIndex) => {
      const current = initialTotals.get(`${center.id}:${product.id}`) ?? 0;
      const target = Math.max(floorByUnit[product.unit], Math.round(current * ratioByCenter[center.id]! + floorByUnit[product.unit] * ((productIndex + centerIndex) % 3) * 0.25));
      return { snapshot_id: baseId, centro_id: center.id, producto_id: product.id, objetivo_unidad_base: target, reserva_unidad_base: Math.round(target * 0.1), prioridad: ((productIndex + centerIndex) % 3) + 1 };
    }),
  );
  const initialVolunteers = config.centers.map((row) => ({ snapshot_id: baseId, centro_id: row.id, disponibles: row.initial_available, requeridos: row.initial_required }));
  const travelTimes = config.centers.flatMap((origin, originIndex) => config.centers.filter((destination) => destination.id !== origin.id).map((destination, destinationIndex) => ({ snapshot_id: baseId, origen_id: origin.id, destino_id: destination.id, minutos: 14 + Math.abs(originIndex - config.centers.findIndex((row) => row.id === destination.id)) * 7 + destinationIndex })));

  const intentions = Array.from({ length: 80 }, (_, index) => {
    const center = config.centers[index % config.centers.length]!;
    const sku = skus[(index * 7 + 3) % skus.length]!;
    const day = Math.min(6, Math.floor(index / 12));
    const announced = index < 8 ? addMinutes(config.start, -360 - index * 25) : localTimestamp(day, 8 + (index % 8), (index * 13) % 60);
    const arrival = index < 8
      ? addMinutes(config.start, 90 + index * 60)
      : addMinutes(announced, 180 + (index % 6) * 120);
    return {
      index,
      id: `SIM-D${String(index + 1).padStart(3, "0")}`,
      centerId: center.id,
      sku,
      quantity: 3 + (index * 5) % 18,
      announced,
      arrival,
      received: index < 70,
    };
  });
  const baseDonations = intentions.slice(0, 8).map((row) => ({ snapshot_id: baseId, intencion_id: row.id, centro_id: row.centerId, sku_id: row.sku, cantidad_paquetes: row.quantity, llegada_prevista: row.arrival, estado: "pendiente" }));

  const operationalEvents: Array<Record<string, unknown>> = [];
  const addOperational = (label: string, type: string, operation: string, centerId: string, productId: string | null, skuId: string | null, occurred: string, payload: Record<string, unknown>) => {
    const index = operationalEvents.length;
    operationalEvents.push({
      snapshot_id: finalId,
      evento_id: deterministicUuid(config.seed, `event:${label}`),
      operacion_id: deterministicUuid(config.seed, `operation:${label}`),
      escenario_id: config.scenario_id,
      snapshot_origen_id: baseId,
      tipo: type,
      operacion: operation,
      centro_id: centerId,
      producto_id: productId,
      sku_id: skuId,
      ocurrido_en: occurred,
      registrado_en: addMinutes(occurred, delayFor(index)),
      orden: index,
      payload_json: JSON.stringify({ operacion: operation, ...payload }),
    });
  };
  for (const donation of intentions.slice(8)) {
    const productId = skuById.get(donation.sku)!.product;
    addOperational(`announcement:${donation.id}`, "anuncio_donacion", "announce_donation", donation.centerId, productId, donation.sku, donation.announced, { intencion_id: donation.id, cantidad_paquetes: donation.quantity, llegada_prevista: donation.arrival });
  }
  for (let day = 0; day < 7; day += 1) {
    for (const [centerIndex, center] of config.centers.entries()) {
      for (const shift of [0, 1]) {
        const trend = day < 3 ? day : 6 - Math.abs(4 - day);
        const available = Math.max(0, center.initial_available + trend + (shift === 0 ? 1 : -2) + ((centerIndex + day) % 3));
        const required = Math.max(1, center.initial_required + (day === 4 ? 3 : 0) - (day >= 5 ? 2 : 0));
        addOperational(`volunteers:${day}:${center.id}:${shift}`, "actualizacion_voluntariado", "upsert_volunteers", center.id, null, null, localTimestamp(day, shift === 0 ? 8 : 15, 10 + centerIndex * 3), { disponibles: available, requeridos: required });
      }
      const product = day === 6 && center.id === "C01"
        ? config.products[0]!
        : config.products[(day * 5 + centerIndex * 3) % config.products.length]!;
      const current = initialNeeds.find((row) => row.centro_id === center.id && row.producto_id === product.id)!;
      const factor = day === 4 ? 1.35 : day >= 5 ? 0.82 : 1 + ((day + centerIndex) % 3 - 1) * 0.08;
      const target = day === 6 && center.id === "C01"
        ? 0
        : Math.max(0, Math.round(Number(current.objetivo_unidad_base) * factor));
      addOperational(`need:${day}:${center.id}`, "actualizacion_necesidad", "upsert_need", center.id, product.id, null, localTimestamp(day, 11, 20 + centerIndex * 4), { objetivo_unidad_base: target, reserva_unidad_base: target === 0 ? 0 : current.reserva_unidad_base, prioridad: current.prioridad });
    }
    const center = config.centers[day % config.centers.length]!;
    addOperational(`center:${day}`, "cambio_estado_centro", "update_center", center.id, null, null, localTimestamp(day, 13, 35), { nombre: center.name, estado: "activo", zona: center.zone, coordinador_nombre: center.coordinator });
  }

  const movementDrafts: Array<Record<string, unknown>> = [];
  const addMovement = (label: string, type: "recepcion_confirmada" | "despacho", centerId: string, sku: string, quantity: number, occurred: string, intentionId: string | null, announcedQuantity: number | null) => {
    const presentation = skuById.get(sku)!;
    const index = movementDrafts.length;
    movementDrafts.push({
      snapshot_id: finalId,
      movimiento_id: deterministicUuid(config.seed, `movement:${label}`),
      operacion_id: deterministicUuid(config.seed, `movement-operation:${label}`),
      tipo: type,
      centro_origen_id: type === "despacho" ? centerId : null,
      centro_destino_id: type === "recepcion_confirmada" ? centerId : null,
      producto_id: presentation.product,
      sku_id: sku,
      cantidad_paquetes: quantity,
      ocurrido_en: occurred,
      registrado_en: addMinutes(occurred, delayFor(index + 2)),
      intencion_id: intentionId,
      snapshot_origen_id: baseId,
      cantidad_anunciada_paquetes: announcedQuantity,
    });
  };
  for (const donation of intentions.filter((row) => row.received)) {
    const outcome = donation.index % 10;
    const quantity = outcome === 3 ? Math.max(1, donation.quantity - 2) : outcome === 4 ? donation.quantity + 3 : donation.quantity;
    const offset = outcome === 1 ? -45 : outcome === 2 ? 240 : outcome === 5 ? 960 : 0;
    const occurred = addMinutes(donation.arrival, offset);
    addMovement(`donation:${donation.id}`, "recepcion_confirmada", donation.centerId, donation.sku, quantity, occurred, donation.id, donation.quantity);
  }
  for (let index = 0; index < 20; index += 1) {
    const day = index % 7;
    const center = config.centers[(index * 5 + 1) % config.centers.length]!;
    const sku = skus[(index * 11 + 5) % skus.length]!;
    addMovement(`direct:${index}`, "recepcion_confirmada", center.id, sku, 2 + (index % 8), localTimestamp(day, 10 + (index % 7), (index * 17) % 60), null, null);
  }
  for (let index = 0; index < 57; index += 1) {
    const day = index % 7;
    const center = config.centers[(index * 3 + day) % config.centers.length]!;
    const sku = skus[(index * 13 + day * 2) % skus.length]!;
    addMovement(`dispatch:${index}`, "despacho", center.id, sku, 1 + (index % 4), localTimestamp(day, 16 + (index % 5), (index * 19) % 60), null, null);
  }
  movementDrafts.sort((left, right) => Date.parse(String(left.ocurrido_en)) - Date.parse(String(right.ocurrido_en)) || String(left.movimiento_id).localeCompare(String(right.movimiento_id)));

  const inventoryState = new Map(initialInventory.map((row) => [`${row.centro_id}:${row.sku_id}`, Number(row.cantidad_paquetes)]));
  for (const movement of movementDrafts) {
    const centerId = String(movement.centro_destino_id ?? movement.centro_origen_id);
    const key = `${centerId}:${movement.sku_id}`;
    const current = inventoryState.get(key) ?? 0;
    if (movement.tipo === "recepcion_confirmada") inventoryState.set(key, current + Number(movement.cantidad_paquetes));
    else {
      const quantity = Math.min(Number(movement.cantidad_paquetes), Math.max(1, current));
      if (current === 0) {
        const fallbackEntry = [...inventoryState.entries()].find(
          ([candidate, available]) => candidate.startsWith(`${centerId}:`) && available > 0,
        );
        if (!fallbackEntry) throw new Error(`No hay inventario para el despacho ${movement.movimiento_id}.`);
        const [fallback, fallbackCurrent] = fallbackEntry;
        const fallbackSku = fallback.slice(centerId.length + 1);
        movement.sku_id = fallbackSku;
        movement.producto_id = skuById.get(fallbackSku)!.product;
        movement.cantidad_paquetes = Math.min(Number(movement.cantidad_paquetes), fallbackCurrent);
        inventoryState.set(fallback, fallbackCurrent - Number(movement.cantidad_paquetes));
      } else {
        movement.cantidad_paquetes = quantity;
        inventoryState.set(key, current - quantity);
      }
    }
  }

  operationalEvents.sort((left, right) => Date.parse(String(left.ocurrido_en)) - Date.parse(String(right.ocurrido_en)) || String(left.evento_id).localeCompare(String(right.evento_id))).forEach((row, index) => { row.orden = index; });

  const finalCenters = structuredClone(centers);
  const finalNeeds = structuredClone(initialNeeds);
  const finalVolunteers = structuredClone(initialVolunteers);
  const finalDonations = structuredClone(baseDonations);
  for (const event of operationalEvents) {
    const payload = JSON.parse(String(event.payload_json)) as Record<string, unknown>;
    if (event.operacion === "announce_donation") finalDonations.push({ snapshot_id: baseId, intencion_id: String(payload.intencion_id), centro_id: String(event.centro_id), sku_id: String(event.sku_id), cantidad_paquetes: Number(payload.cantidad_paquetes), llegada_prevista: String(payload.llegada_prevista), estado: "pendiente" });
    if (event.operacion === "upsert_volunteers") {
      const row = finalVolunteers.find((item) => item.centro_id === event.centro_id)!;
      row.disponibles = Number(payload.disponibles);
      row.requeridos = Number(payload.requeridos);
    }
    if (event.operacion === "upsert_need") {
      const row = finalNeeds.find((item) => item.centro_id === event.centro_id && item.producto_id === event.producto_id)!;
      row.objetivo_unidad_base = Number(payload.objetivo_unidad_base);
      row.reserva_unidad_base = Number(payload.reserva_unidad_base);
      row.prioridad = Number(payload.prioridad);
    }
  }
  for (const movement of movementDrafts) {
    if (movement.intencion_id) {
      const donation = finalDonations.find((row) => row.intencion_id === movement.intencion_id);
      if (!donation) throw new Error(`Recepcion sin anuncio: ${movement.intencion_id}.`);
      donation.estado = "recibida";
    }
  }
  const finalInventory = [...inventoryState.entries()].filter(([, quantity]) => quantity >= 0).map(([key, quantity]) => {
    const [centerId, sku] = key.split(":");
    return { snapshot_id: finalId, centro_id: centerId, sku_id: sku, cantidad_paquetes: quantity };
  }).sort((left, right) => `${left.centro_id}:${left.sku_id}`.localeCompare(`${right.centro_id}:${right.sku_id}`));

  const base: Bundle = {
    metadata: { id: baseId, nombre: `${config.name} - Inicio SIMULADO`, created_at: config.start, descripcion: "Estado inicial ficticio e independiente. Todos los datos son SIMULADOS.", escenario_id: config.scenario_id, snapshot_base_id: baseId },
    centers,
    products,
    presentations,
    inventory: initialInventory.sort((left, right) => `${left.centro_id}:${left.sku_id}`.localeCompare(`${right.centro_id}:${right.sku_id}`)),
    needs: initialNeeds,
    volunteers: initialVolunteers,
    travelTimes,
    expectedDonations: baseDonations,
    movements: [],
    operationalEvents: [],
  };
  const final: Bundle = {
    metadata: { id: finalId, nombre: `${config.name} - Semana completa SIMULADA`, created_at: config.end, descripcion: "Escenario semanal ficticio, reproducible y trazable. No describe un hecho historico real.", escenario_id: config.scenario_id, snapshot_origen_id: baseId, snapshot_base_id: baseId },
    centers: mapSnapshot(finalCenters, finalId),
    products: mapSnapshot(products, finalId),
    presentations: mapSnapshot(presentations, finalId),
    inventory: finalInventory,
    needs: mapSnapshot(finalNeeds, finalId),
    volunteers: mapSnapshot(finalVolunteers, finalId),
    travelTimes: mapSnapshot(travelTimes, finalId),
    expectedDonations: mapSnapshot(finalDonations, finalId),
    movements: movementDrafts,
    operationalEvents,
  };

  const allEvents = [...movementDrafts, ...operationalEvents].sort((left, right) => Date.parse(String(left.ocurrido_en)) - Date.parse(String(right.ocurrido_en)) || String(left.evento_id ?? left.movimiento_id).localeCompare(String(right.evento_id ?? right.movimiento_id)));
  if (allEvents.length < 250 || allEvents.length > 400) throw new Error(`Volumen de eventos fuera de rango: ${allEvents.length}.`);
  if (allEvents.some((row) => Date.parse(String(row.ocurrido_en)) < Date.parse(config.start) || Date.parse(String(row.ocurrido_en)) > Date.parse(config.end))) throw new Error("Hay eventos fisicos fuera de la semana simulada.");
  if (allEvents.some((row) => Date.parse(String(row.registrado_en)) < Date.parse(String(row.ocurrido_en)))) throw new Error("Un registro temporal es anterior a su ocurrencia.");
  const eventIds = allEvents.map((row) => String(row.evento_id ?? row.movimiento_id));
  const operationIds = allEvents.map((row) => String(row.operacion_id));
  if (new Set(eventIds).size !== eventIds.length || new Set(operationIds).size !== operationIds.length) throw new Error("Los eventos u operaciones no tienen identificadores unicos.");
  if (finalInventory.some((row) => row.cantidad_paquetes < 0)) throw new Error("El inventario final no puede ser negativo.");
  if (finalDonations.length !== 80 || new Set(finalDonations.map((row) => row.intencion_id)).size !== 80) throw new Error("Las intenciones no son validas.");
  const byDay = Object.fromEntries(Array.from({ length: 7 }, (_, day) => {
    const date = `2026-11-${String(9 + day).padStart(2, "0")}`;
    return [date, allEvents.filter((row) => String(row.ocurrido_en).startsWith(date)).length];
  }));
  const byCenter = Object.fromEntries(config.centers.map((center) => [center.id, allEvents.filter((row) => String(row.centro_id ?? row.centro_destino_id ?? row.centro_origen_id) === center.id).length]));
  const summary = {
    simulated: true,
    seed: config.seed,
    products: config.products.length,
    presentations: config.presentations.length,
    centers: config.centers.length,
    events_total: allEvents.length,
    events_by_day: byDay,
    events_by_center: byCenter,
    donation_announcements: 80,
    receptions_confirmed: movementDrafts.filter((row) => row.tipo === "recepcion_confirmada").length,
    dispatches: movementDrafts.filter((row) => row.tipo === "despacho").length,
    donations_pending_at_close: finalDonations.filter((row) => row.estado === "pendiente").length,
    donation_outcomes: {
      announced_received: intentions.filter((row) => row.received).length,
      arrived_on_scheduled_time: intentions.filter((row) => row.received && ![1, 2, 5].includes(row.index % 10)).length,
      arrived_early: intentions.filter((row) => row.received && row.index % 10 === 1).length,
      arrived_late: intentions.filter((row) => row.received && [2, 5].includes(row.index % 10)).length,
      partial: intentions.filter((row) => row.received && row.index % 10 === 3).length,
      above_announced: intentions.filter((row) => row.received && row.index % 10 === 4).length,
      not_received_at_close: intentions.filter((row) => !row.received).length,
      received_without_announcement: movementDrafts.filter((row) => row.tipo === "recepcion_confirmada" && !row.intencion_id).length,
    },
    registrations_next_day: allEvents.filter((row) => String(row.ocurrido_en).slice(0, 10) !== String(row.registrado_en).slice(0, 10)).length,
    volunteer_evaluations: operationalEvents.filter((row) => row.operacion === "upsert_volunteers").length,
    need_updates: operationalEvents.filter((row) => row.operacion === "upsert_need").length,
    temporal_completeness_expected: "completa",
    unknown_data: ["pesos por presentacion", "capacidades maximas por centro", "contenido de presentaciones no declarado por fuentes", "filas del Excel de referencia no disponible"],
  };
  return { config, base, final, summary };
}

function csv(rows: Array<Record<string, unknown>>, columns: readonly string[]) {
  return stringify(rows, { header: true, columns: [...columns], record_delimiter: "\n" });
}

async function writeBundle(directory: string, bundle: Bundle) {
  await mkdir(directory, { recursive: false });
  await writeFile(path.join(directory, "metadata.json"), `${JSON.stringify(bundle.metadata, null, 2)}\n`, "utf8");
  for (const key of Object.keys(COLUMNS) as Array<keyof typeof COLUMNS>) {
    await writeFile(path.join(directory, FILES[key]), csv(bundle[key] as Array<Record<string, unknown>>, COLUMNS[key]), "utf8");
  }
}

async function exists(target: string) {
  try { await stat(target); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

async function publishDirectory(staged: string, destination: string) {
  if (await exists(destination)) {
    const stagedFiles = (await import("node:fs/promises")).readdir(staged);
    for (const name of await stagedFiles) {
      const [left, right] = await Promise.all([readFile(path.join(staged, name)), readFile(path.join(destination, name))]);
      if (!left.equals(right)) throw new Error(`El destino existente difiere de la generacion reproducible: ${destination}.`);
    }
    await rm(staged, { recursive: true, force: true });
    return;
  }
  await rename(staged, destination);
}

export async function generateWeeklyScenario(configPath: string, outputRoot: string) {
  const config = JSON.parse(await readFile(configPath, "utf8")) as ScenarioConfig;
  const result = buildWeeklyScenario(config);
  const stageRoot = path.join(path.dirname(configPath), ".staging-generated");
  await rm(stageRoot, { recursive: true, force: true });
  await mkdir(stageRoot, { recursive: true });
  try {
    await writeBundle(path.join(stageRoot, config.base_snapshot_id), result.base);
    await writeBundle(path.join(stageRoot, config.final_snapshot_id), result.final);
    await mkdir(outputRoot, { recursive: true });
    await publishDirectory(path.join(stageRoot, config.base_snapshot_id), path.join(outputRoot, config.base_snapshot_id));
    await publishDirectory(path.join(stageRoot, config.final_snapshot_id), path.join(outputRoot, config.final_snapshot_id));
    await writeFile(path.join(path.dirname(configPath), "summary.generated.json"), `${JSON.stringify(result.summary, null, 2)}\n`, "utf8");
    return result;
  } finally {
    await rm(stageRoot, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"))) {
  const repositoryRoot = process.cwd();
  const configPath = path.resolve(process.argv[2] ?? path.join(repositoryRoot, "data", "scenarios", "emergencia-cali-semana-2026", "scenario.config.json"));
  const outputRoot = path.resolve(process.argv[3] ?? path.join(repositoryRoot, "data", "demo", "snapshots"));
  const result = await generateWeeklyScenario(configPath, outputRoot);
  process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);
}
