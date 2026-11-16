import type {
  ProductBaseUnit,
  StorageCapacityIndicator,
} from "./analytics";

export const ALERT_TYPES = [
  "deficit_cobertura",
  "voluntariado_insuficiente",
  "donacion_retrasada",
  "informacion_desactualizada",
  "capacidad",
  "excedente_transferible",
] as const;

export const ALERT_SEVERITIES = [
  "critica",
  "advertencia",
  "informativa",
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];
export type AlertUnit =
  | ProductBaseUnit
  | "porcentaje"
  | "persona"
  | "minuto"
  | "kg";

export interface AlertThresholds {
  cobertura_critica_menor_que: number;
  cobertura_importante_menor_que: number;
  cobertura_completa_desde: number;
  donacion_tolerancia_minutos: number;
  informacion_desactualizada_minutos: number;
  capacidad_advertencia_desde: number;
  capacidad_critica_desde: number;
  capacidad_sobrecapacidad_mayor_que: number;
}

export interface AlertProductInput {
  producto_id: string;
  producto_nombre: string;
  unidad_base: ProductBaseUnit;
  inventario_confirmado_unidad_base: number;
  objetivo_unidad_base: number;
  deficit_confirmado_unidad_base: number;
  cobertura_porcentaje: number | null;
  excedente_transferible_unidad_base: number;
  prioridad: number | null;
}

export interface AlertCenterInput {
  centro_id: string;
  centro_nombre: string;
  voluntarios_disponibles: number;
  voluntarios_requeridos: number;
  capacidad_almacenamiento: StorageCapacityIndicator;
  productos: AlertProductInput[];
}

export interface AlertDonationInput {
  intencion_id: string;
  centro_id: string;
  centro_nombre: string;
  producto_id: string;
  producto_nombre: string;
  llegada_prevista: string;
  estado: "pendiente" | "recibida" | "cancelada";
}

export interface AlertTemporalEvidence {
  entidad: "inventario";
  centro_id: string;
  centro_nombre: string;
  producto_id: string;
  producto_nombre: string;
  actualizado_en: string;
}

export interface AlertEvaluationInput {
  referencia_tipo: "snapshot" | "escenario";
  referencia_id: string;
  evaluado_en: string;
  centros: AlertCenterInput[];
  donaciones: AlertDonationInput[];
  evidencia_temporal: AlertTemporalEvidence[];
}

export interface OperationalAlert {
  alerta_id: string;
  tipo: AlertType;
  severidad: AlertSeverity;
  centro_id: string;
  centro_nombre: string;
  producto_id: string | null;
  producto_nombre: string | null;
  titulo: string;
  descripcion: string;
  valor_observado: number;
  umbral_aplicado: number;
  unidad: AlertUnit;
  accion_sugerida: string;
  prioridad_operativa: number | null;
  referencia_tipo: "snapshot" | "escenario";
  referencia_id: string;
  evaluado_en: string;
  estado: "activa";
}

export interface AlertCenterSummary {
  centro_id: string;
  centro_nombre: string;
  total: number;
  criticas: number;
  advertencias: number;
  informativas: number;
}

export interface UnknownTemporalInformation {
  entidad: "inventario";
  centro_id: string;
  centro_nombre: string;
  producto_id: string;
  producto_nombre: string;
}

export interface AlertEvaluationResult {
  evaluado_en: string;
  referencia_tipo: "snapshot" | "escenario";
  referencia_id: string;
  total: number;
  por_severidad: Record<AlertSeverity, number>;
  por_centro: AlertCenterSummary[];
  por_tipo: Record<AlertType, number>;
  centros_que_requieren_atencion: number;
  informacion_temporal_desconocida: UnknownTemporalInformation[];
  alertas: OperationalAlert[];
}
