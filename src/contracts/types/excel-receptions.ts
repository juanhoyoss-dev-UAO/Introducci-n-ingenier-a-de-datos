import type { AlertSeverity } from "./alerts";
import type { SnapshotRecord } from "./database";

export const RECEPTION_SHEET_NAME = "Recepciones";
export const RECEPTION_EXCEL_COLUMNS = [
  "operacion_id",
  "recibido_en",
  "centro_id",
  "sku_id",
  "cantidad_paquetes",
] as const;

export interface ExcelReceptionRow {
  fila: number;
  operacion_id: string;
  recibido_en: string;
  centro_id: string;
  centro_nombre: string;
  producto_id: string;
  producto_nombre: string;
  unidad_base: "ml" | "g" | "unidad";
  sku_id: string;
  presentacion_nombre: string;
  contenido_por_paquete: number;
  cantidad_paquetes: number;
  cantidad_unidad_base: number;
}

export interface ExcelReceptionError {
  fila: number | null;
  columna: string | null;
  codigo: string;
  mensaje: string;
}

export interface ExcelReceptionPreview {
  archivo: string;
  huella_sha256: string;
  hoja: typeof RECEPTION_SHEET_NAME;
  filas: ExcelReceptionRow[];
  errores: ExcelReceptionError[];
  valido: boolean;
  total_filas: number;
  total_paquetes: number;
}

export interface ExcelReceptionEffect {
  centro_id: string;
  centro_nombre: string;
  producto_id: string;
  producto_nombre: string;
  unidad_base: "ml" | "g" | "unidad";
  cantidad_recibida_paquetes: number;
  cantidad_recibida_unidad_base: number;
  inventario_anterior: number;
  inventario_nuevo: number;
  necesidad_vigente: number;
  cobertura_anterior: number | null;
  cobertura_nueva: number | null;
  deficit_anterior: number;
  deficit_nuevo: number;
}

export interface ExcelAlertEffect {
  alerta_id: string;
  centro_id: string;
  centro_nombre: string;
  producto_id: string | null;
  producto_nombre: string | null;
  tipo: string;
  severidad_anterior: AlertSeverity | null;
  severidad_nueva: AlertSeverity | null;
  titulo: string;
}

export interface ExcelReceptionImportResult {
  snapshot: SnapshotRecord;
  source_snapshot_id: string;
  idempotent: boolean;
  archivo: string;
  huella_sha256: string;
  evaluado_en: string;
  filas_importadas: number;
  total_paquetes: number;
  efectos: ExcelReceptionEffect[];
  alertas_antes: number;
  alertas_despues: number;
  alertas_resueltas: ExcelAlertEffect[];
  alertas_reducidas: ExcelAlertEffect[];
  alertas_activas_afectadas: ExcelAlertEffect[];
}

export interface TestingScenarioResetResult {
  snapshot: SnapshotRecord;
  source_snapshot_id: string;
  idempotent: boolean;
}
