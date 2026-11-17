import type {
  TemporalAnalysisResult,
  TemporalDelayPoint,
  TemporalEvent,
  TemporalHourlyFlowPoint,
  TemporalInventoryPoint,
} from "@/contracts/types/temporal";

export const WEEK_START = "2026-11-09";
export const WEEK_END = "2026-11-15";

export type HistoryPeriod =
  | { mode: "week" }
  | { mode: "day"; day: string };

export interface InventoryHistoryPoint {
  key: string;
  label: string;
  instant: string;
  inventory: number;
  need: number;
  unit: "ml" | "g" | "unidad";
}

export interface MovementHistoryPoint {
  key: string;
  label: string;
  receptions: number;
  dispatches: number;
}

export interface DelayHistoryPoint {
  key: string;
  label: string;
  averageMinutes: number;
  maximumMinutes: number;
  evaluatedMovements: number;
  delayedMovements: number;
}

export type MovementTemporalEvent = Extract<
  TemporalEvent,
  { tipo: "recepcion_confirmada" | "despacho" }
>;

const dayFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "short",
});

function dateParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    date,
  };
}

function bucket(value: string, mode: HistoryPeriod["mode"]) {
  const parts = dateParts(value);
  if (!parts) return null;
  if (mode === "week") {
    return {
      key: parts.day,
      label: dayFormatter.format(parts.date),
    };
  }
  const hour = String(parts.hour).padStart(2, "0");
  return { key: `${parts.day}T${hour}`, label: `${hour}:00` };
}

export function historyRange(period: HistoryPeriod) {
  const day = period.mode === "week" ? null : period.day;
  const validDay = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : WEEK_START;
  return period.mode === "week"
    ? {
        from: `${WEEK_START}T00:00:00-05:00`,
        to: `${WEEK_END}T23:59:59-05:00`,
      }
    : {
        from: `${validDay}T00:00:00-05:00`,
        to: `${validDay}T23:59:59-05:00`,
      };
}

export function inventoryHistory(
  rows: readonly TemporalInventoryPoint[],
  mode: HistoryPeriod["mode"],
): InventoryHistoryPoint[] {
  const byInstant = new Map<
    string,
    Omit<InventoryHistoryPoint, "key" | "label">
  >();
  for (const row of rows) {
    const current = byInstant.get(row.instante);
    if (current && current.unit !== row.unidad) continue;
    byInstant.set(row.instante, {
      instant: row.instante,
      inventory: (current?.inventory ?? 0) + row.inventario,
      need: (current?.need ?? 0) + row.necesidad,
      unit: row.unidad,
    });
  }
  const latestByBucket = new Map<string, InventoryHistoryPoint>();
  for (const value of byInstant.values()) {
    const currentBucket = bucket(value.instant, mode);
    if (!currentBucket) continue;
    const point = { ...currentBucket, ...value };
    const current = latestByBucket.get(currentBucket.key);
    if (!current || Date.parse(point.instant) > Date.parse(current.instant)) {
      latestByBucket.set(currentBucket.key, point);
    }
  }
  return [...latestByBucket.values()].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

export function movementHistory(
  rows: readonly TemporalHourlyFlowPoint[],
  mode: HistoryPeriod["mode"],
): MovementHistoryPoint[] {
  const result = new Map<string, MovementHistoryPoint>();
  for (const row of rows) {
    const instant = `${row.fecha_local}T${String(row.hora_local).padStart(2, "0")}:00:00-05:00`;
    const currentBucket = bucket(instant, mode);
    if (!currentBucket) continue;
    const current = result.get(currentBucket.key) ?? {
      ...currentBucket,
      receptions: 0,
      dispatches: 0,
    };
    current.receptions += row.recepciones;
    current.dispatches += row.despachos;
    result.set(currentBucket.key, current);
  }
  return [...result.values()].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

export function movementEvents(
  events: readonly TemporalEvent[],
): MovementTemporalEvent[] {
  return events
    .filter(
      (event): event is MovementTemporalEvent =>
        event.tipo === "recepcion_confirmada" || event.tipo === "despacho",
    )
    .sort(
      (left, right) =>
        Date.parse(left.ocurrido_en) - Date.parse(right.ocurrido_en) ||
        left.evento_id.localeCompare(right.evento_id),
    );
}

export function delayHistory(
  analysis: Pick<TemporalAnalysisResult, "eventos" | "series">,
  mode: HistoryPeriod["mode"],
): DelayHistoryPoint[] {
  const movements = new Map(
    movementEvents(analysis.eventos).map((event) => [event.evento_id, event]),
  );
  const result = new Map<
    string,
    DelayHistoryPoint & { totalMinutes: number }
  >();
  for (const row of analysis.series.desfase_registro) {
    const event = movements.get(row.evento_id);
    if (!event || !validDelay(row)) continue;
    const currentBucket = bucket(event.ocurrido_en, mode);
    if (!currentBucket) continue;
    const current = result.get(currentBucket.key) ?? {
      ...currentBucket,
      averageMinutes: 0,
      maximumMinutes: 0,
      evaluatedMovements: 0,
      delayedMovements: 0,
      totalMinutes: 0,
    };
    current.evaluatedMovements += 1;
    current.totalMinutes += row.desfase_minutos;
    current.maximumMinutes = Math.max(
      current.maximumMinutes,
      row.desfase_minutos,
    );
    if (row.desfase_minutos > 0) current.delayedMovements += 1;
    current.averageMinutes =
      current.totalMinutes / current.evaluatedMovements;
    result.set(currentBucket.key, current);
  }
  return [...result.values()]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((point) => ({
      key: point.key,
      label: point.label,
      averageMinutes: point.averageMinutes,
      maximumMinutes: point.maximumMinutes,
      evaluatedMovements: point.evaluatedMovements,
      delayedMovements: point.delayedMovements,
    }));
}

function validDelay(row: TemporalDelayPoint) {
  const occurred = Date.parse(row.ocurrido_en);
  const registered = Date.parse(row.registrado_en);
  return (
    Number.isFinite(occurred) &&
    Number.isFinite(registered) &&
    Number.isFinite(row.desfase_minutos) &&
    registered >= occurred &&
    row.desfase_minutos >= 0
  );
}
