import type { AlertEvaluationResult } from "./alerts";

export type TemporalPerspective = "fisica" | "informativa";

interface TemporalEventBase {
  evento_id: string;
  operacion_id: string;
  escenario_id: string;
  snapshot_origen_id: string;
  centro_id: string;
  producto_id: string | null;
  sku_id: string | null;
  ocurrido_en: string;
  registrado_en: string;
  orden: number;
  incorporado_en_estado_inicial: boolean;
}

export type TemporalEvent =
  | (TemporalEventBase & {
      tipo: "recepcion_confirmada";
      operacion: "confirm_donation" | "direct_reception";
      payload: {
        cantidad_paquetes: number;
        intencion_id: string | null;
      };
    })
  | (TemporalEventBase & {
      tipo: "despacho";
      operacion: "dispatch";
      payload: { cantidad_paquetes: number };
    })
  | (TemporalEventBase & {
      tipo: "ajuste_inventario";
      operacion: "upsert_inventory";
      payload: { cantidad_paquetes: number };
    })
  | (TemporalEventBase & {
      tipo: "actualizacion_necesidad";
      operacion: "upsert_need";
      payload: {
        objetivo_unidad_base: number;
        reserva_unidad_base: number;
        prioridad: number;
      };
    })
  | (TemporalEventBase & {
      tipo: "actualizacion_voluntariado";
      operacion: "upsert_volunteers";
      payload: { disponibles: number; requeridos: number };
    })
  | (TemporalEventBase & {
      tipo: "cambio_estado_centro";
      operacion: "create_center" | "update_center";
      payload: {
        nombre: string;
        estado: "activo" | "inactivo";
        zona: string | null;
        coordinador_nombre: string;
      };
    });

export interface SkippedTemporalEvent {
  evento_id: string;
  motivo:
    | "escenario_distinto"
    | "incorporado_en_estado_inicial"
    | "posterior_al_corte"
    | "fecha_invalida"
    | "referencia_invalida"
    | "inventario_insuficiente"
    | "evento_duplicado";
}

export interface TemporalReconstructionResult<TState> {
  estado: TState;
  perspectiva: TemporalPerspective;
  corte: string;
  eventos_aplicados: string[];
  eventos_omitidos: SkippedTemporalEvent[];
  completa: boolean;
}

export interface TemporalHourlyFlowPoint {
  fecha_local: string;
  hora_local: number;
  etiqueta: string;
  recepciones: number;
  paquetes_recibidos: number;
  despachos: number;
  paquetes_despachados: number;
}

export interface TemporalPhysicalQuantityPoint {
  fecha_local: string;
  hora_local: number;
  producto_id: string;
  producto_nombre: string;
  cantidad_unidad_base: number;
  unidad: "ml" | "g" | "unidad";
}

export interface TemporalInventoryPoint {
  instante: string;
  centro_id: string;
  producto_id: string;
  producto_nombre: string;
  inventario: number;
  necesidad: number;
  deficit: number;
  unidad: "ml" | "g" | "unidad";
}

export interface TemporalVolunteerPoint {
  instante: string;
  centro_id: string;
  disponibles: number;
  requeridos: number;
}

export interface TemporalDelayPoint {
  evento_id: string;
  ocurrido_en: string;
  registrado_en: string;
  desfase_minutos: number;
}

export interface TemporalAnalysisResult {
  referencia: {
    snapshot_id: string;
    escenario_id: string;
    snapshot_base_id: string;
    snapshot_origen_id: string | null;
  };
  perspectiva: TemporalPerspective;
  corte: string;
  completitud: {
    estado: "completa" | "parcial" | "insuficiente";
    limitaciones: string[];
  };
  eventos: TemporalEvent[];
  reconstruccion: {
    centros: Array<{
      centro_id: string;
      nombre: string;
      estado: string;
    }>;
    inventario: Array<{
      centro_id: string;
      sku_id: string;
      cantidad_paquetes: number;
    }>;
    necesidades: Array<{
      centro_id: string;
      producto_id: string;
      objetivo_unidad_base: number;
      prioridad: number;
    }>;
    voluntarios: Array<{
      centro_id: string;
      disponibles: number;
      requeridos: number;
    }>;
    eventos_aplicados: string[];
    eventos_omitidos: SkippedTemporalEvent[];
  };
  indicadores: {
    centros_activos: number;
    alertas: AlertEvaluationResult;
  };
  series: {
    movimientos_por_hora: TemporalHourlyFlowPoint[];
    recepciones_fisicas: TemporalPhysicalQuantityPoint[];
    inventario_necesidad_deficit: TemporalInventoryPoint[];
    voluntarios: TemporalVolunteerPoint[];
    desfase_registro: TemporalDelayPoint[];
  };
}
