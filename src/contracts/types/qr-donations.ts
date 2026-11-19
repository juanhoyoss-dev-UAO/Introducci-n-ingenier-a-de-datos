import type {
  QrDonationOperation,
  QrDonationRecord,
  QrDonationStatus,
} from "@/contracts/schemas/qr-donations";
import type { SnapshotRecord } from "./database";

export interface QrDonationView extends QrDonationRecord {
  donacion_id: string;
  item_id: string;
  centro_nombre: string;
  producto_nombre: string;
  presentacion_nombre: string;
  contenido_por_paquete: number;
  unidad_base: "ml" | "g" | "unidad";
  inventario_confirmado_unidad_base: number;
  necesidad_vigente_unidad_base: number;
}

export interface QrDonationGroupView {
  donacion_id: string;
  respuesta_origen_id: string;
  centro_id: string;
  centro_nombre: string;
  donante: string | null;
  fecha_registro: string;
  fecha_estimada: string;
  observaciones: string | null;
  estado_general: QrDonationStatus;
  articulos: QrDonationView[];
}

export interface QrDonationModuleData {
  anuncios: QrDonationView[];
  donaciones: QrDonationGroupView[];
  integracion_google_configurada: boolean;
  intervalo_sincronizacion_ms: number;
}

export interface QrDonationSyncResult {
  snapshot: SnapshotRecord;
  source_snapshot_id: string;
  filas_consultadas: number;
  anuncios_importados: number;
  respuestas_duplicadas: number;
  donaciones_importadas: number;
  donaciones_duplicadas: number;
  articulos_importados: number;
  articulos_duplicados: number;
  filas_invalidas: Array<{ fila: number; mensaje: string }>;
  sincronizado_en: string;
}

export interface QrDonationOperationResult {
  snapshot: SnapshotRecord;
  source_snapshot_id: string;
  operation: QrDonationOperation["operation"];
  anuncio: QrDonationRecord;
  anuncios: QrDonationRecord[];
  donacion_id: string;
  estado_general: QrDonationStatus;
  idempotent: boolean;
}

export const QR_DONATION_STATUS_LABELS: Record<QrDonationStatus, string> = {
  anunciado: "Anunciado",
  parcialmente_recibido: "Parcialmente recibido",
  recibido_completo: "Recibido completo",
  cancelado: "Cancelado",
};
