import type {
  DashboardIndicatorSummary,
  DashboardVisualizations,
  StorageCapacityIndicator,
} from "@/contracts/types/analytics";
import type { AlertEvaluationResult } from "@/contracts/types/alerts";

export interface ApiSuccess<T> {
  data: T;
  meta: Record<string, unknown>;
}

export interface ApiFailure {
  error?: {
    code?: string;
    message?: string;
  };
}

export interface SessionUser {
  username: string;
  role: string;
}

export interface SessionState {
  authenticated: boolean;
  user: SessionUser | null;
}

export interface HealthState {
  status: "ok";
}

export interface SnapshotRecord {
  id: string;
  nombre: string;
  created_at: string;
  descripcion: string | null;
  escenario_id?: string;
  snapshot_origen_id?: string;
  snapshot_base_id?: string;
}

export interface OperationalUpdateResult {
  snapshot: SnapshotRecord;
  source_snapshot_id: string;
  operation:
    | "create_center"
    | "update_center"
    | "upsert_inventory"
    | "upsert_need"
    | "upsert_volunteers";
}

export interface MovementRecord {
  snapshot_id: string;
  movimiento_id: string;
  operacion_id: string;
  tipo: "recepcion_confirmada" | "despacho";
  centro_origen_id: string | null;
  centro_destino_id: string | null;
  producto_id: string;
  sku_id: string;
  cantidad_paquetes: number;
  ocurrido_en: string;
  registrado_en: string;
  intencion_id: string | null;
  snapshot_origen_id: string;
  cantidad_anunciada_paquetes: number | null;
}

export interface MovementOperationResult {
  snapshot: SnapshotRecord;
  source_snapshot_id: string;
  operation: "confirm_donation" | "direct_reception" | "dispatch";
  movement: MovementRecord;
  idempotent: boolean;
}

export interface CenterRecord {
  snapshot_id: string;
  centro_id: string;
  nombre: string;
  estado: string;
  zona: string | null;
  coordinador_nombre: string;
}

export interface PresentationRecord {
  snapshot_id: string;
  sku_id: string;
  producto_id: string;
  nombre: string;
  contenido_por_paquete: number;
}

export interface ProductRecord {
  snapshot_id: string;
  producto_id: string;
  nombre: string;
  unidad_base: "ml" | "g" | "unidad";
  presentaciones: PresentationRecord[];
}

export interface TravelTimeRecord {
  snapshot_id: string;
  origen_id: string;
  destino_id: string;
  minutos: number;
}

export interface DashboardStockLine {
  sku_id: string;
  cantidad_paquetes: number;
  contenido_por_paquete: number;
}

export interface DashboardProduct {
  producto_id: string;
  nombre: string;
  unidad_base: "ml" | "g" | "unidad";
  inventario_confirmado_unidad_base: number;
  objetivo_unidad_base: number;
  reserva_unidad_base: number;
  prioridad: number | null;
  deficit_confirmado_unidad_base: number;
  cobertura_porcentaje: number | null;
  deficit_potencial_unidad_base: number;
  excedente_transferible_unidad_base: number;
  donaciones_esperadas_unidad_base: number;
  existencias: DashboardStockLine[];
}

export interface DashboardCenter extends CenterRecord {
  voluntarios: {
    disponibles: number;
    requeridos: number;
    faltantes: number;
  };
  capacidad_almacenamiento: StorageCapacityIndicator;
  productos: DashboardProduct[];
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

export interface DashboardData {
  snapshot: SnapshotRecord;
  centros: DashboardCenter[];
  indicadores: DashboardIndicatorSummary;
  visualizaciones: DashboardVisualizations;
  donaciones_esperadas: ExpectedDonationRecord[];
  movimientos: MovementRecord[];
  alertas: AlertEvaluationResult;
  candidatos_traslado: unknown[];
}

export interface DashboardBundle {
  snapshot: SnapshotRecord;
  centers: CenterRecord[];
  products: ProductRecord[];
  travelTimes: TravelTimeRecord[];
  dashboard: DashboardData;
}

export type CenterFilter = "all" | string;

export type DashboardTab =
  | "resumen"
  | "alertas"
  | "temporal"
  | "centros"
  | "inventario"
  | "necesidades"
  | "voluntarios"
  | "donaciones"
  | "movimientos"
  | "tiempos";
