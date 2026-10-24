export interface SnapshotRecord {
  id: string;
  nombre: string;
  created_at: string;
  descripcion: string | null;
}

export interface CenterRecord {
  snapshot_id: string;
  centro_id: string;
  nombre: string;
  estado: string;
  zona: string | null;
  coordinador_nombre: string;
}

export interface ProductRecord {
  snapshot_id: string;
  producto_id: string;
  nombre: string;
  unidad_base: "ml" | "g" | "unidad";
}

export interface PresentationRecord {
  snapshot_id: string;
  sku_id: string;
  producto_id: string;
  nombre: string;
  contenido_por_paquete: number;
}

export interface InventoryRecord {
  snapshot_id: string;
  centro_id: string;
  sku_id: string;
  cantidad_paquetes: number;
}

export interface NeedRecord {
  snapshot_id: string;
  centro_id: string;
  producto_id: string;
  objetivo_unidad_base: number;
  reserva_unidad_base: number;
  prioridad: number;
}

export interface VolunteerRecord {
  snapshot_id: string;
  centro_id: string;
  disponibles: number;
  requeridos: number;
}

export interface TravelTimeRecord {
  snapshot_id: string;
  origen_id: string;
  destino_id: string;
  minutos: number;
}

export interface ExpectedDonationRecord {
  snapshot_id: string;
  intencion_id: string;
  centro_id: string;
  sku_id: string;
  cantidad_paquetes: number;
  llegada_prevista: string;
  estado: "pendiente" | "recibida" | "cancelada";
}

export interface SimulationRecord {
  id: string;
  snapshot_id: string;
  nombre: string;
  hora_inicio: string;
  hora_actual: string;
  estado: "activa" | "finalizada";
}

export interface SimulationEventRecord {
  id: string;
  simulacion_id: string;
  tipo: "recepcion_confirmada" | "cambio_necesidad" | "cambio_voluntarios";
  ocurrido_en: string;
  registrado_en: string;
  payload: unknown;
}

