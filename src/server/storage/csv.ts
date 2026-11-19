import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import type { z } from "zod";

function validateHeader(actual: string[], expected: readonly string[]) {
  const matches =
    actual.length === expected.length &&
    actual.every((column, index) => column === expected[index]);

  if (!matches) {
    throw new Error(
      `Encabezado CSV inválido. Esperado: ${expected.join(",")}. Recibido: ${actual.join(",")}.`,
    );
  }
}

export function parseCsvRows<T>(
  content: string,
  expectedColumns: readonly string[],
  schema: z.ZodType<T>,
): T[] {
  let headerSeen = false;
  const records = parse(content, {
    bom: true,
    columns(header: string[]) {
      headerSeen = true;
      validateHeader(header, expectedColumns);
      return header;
    },
    relax_column_count: false,
    skip_empty_lines: true,
  }) as unknown[];

  if (!headerSeen) {
    throw new Error(
      `CSV inválido: falta el encabezado ${expectedColumns.join(",")}.`,
    );
  }

  return records.map((record, index) => {
    const result = schema.safeParse(record);
    if (!result.success) {
      throw new Error(
        `Fila CSV ${index + 2} inválida: ${result.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    return result.data;
  });
}

export function stringifyCsvRows(
  rows: readonly Record<string, unknown>[],
  columns: readonly string[],
): string {
  return stringify([...rows], {
    header: true,
    columns: [...columns],
    record_delimiter: "\n",
  });
}

export const CSV_COLUMNS = {
  centers: [
    "snapshot_id",
    "centro_id",
    "nombre",
    "estado",
    "zona",
    "coordinador_nombre",
  ],
  products: ["snapshot_id", "producto_id", "nombre", "unidad_base"],
  presentations: [
    "snapshot_id",
    "sku_id",
    "producto_id",
    "nombre",
    "contenido_por_paquete",
  ],
  inventory: [
    "snapshot_id",
    "centro_id",
    "sku_id",
    "cantidad_paquetes",
  ],
  needs: [
    "snapshot_id",
    "centro_id",
    "producto_id",
    "objetivo_unidad_base",
    "reserva_unidad_base",
    "prioridad",
  ],
  volunteers: ["snapshot_id", "centro_id", "disponibles", "requeridos"],
  travelTimes: ["snapshot_id", "origen_id", "destino_id", "minutos"],
  expectedDonations: [
    "snapshot_id",
    "intencion_id",
    "centro_id",
    "sku_id",
    "cantidad_paquetes",
    "llegada_prevista",
    "estado",
  ],
  qrDonations: [
    "snapshot_id",
    "anuncio_id",
    "respuesta_origen_id",
    "centro_id",
    "producto_id",
    "sku_id",
    "cantidad_anunciada_paquetes",
    "cantidad_recibida_paquetes",
    "cantidad_pendiente_paquetes",
    "llegada_estimada",
    "registrado_en",
    "donante_referencia",
    "observaciones",
    "estado",
    "fuente",
  ],
  movements: [
    "snapshot_id",
    "movimiento_id",
    "operacion_id",
    "tipo",
    "centro_origen_id",
    "centro_destino_id",
    "producto_id",
    "sku_id",
    "cantidad_paquetes",
    "ocurrido_en",
    "registrado_en",
    "intencion_id",
    "snapshot_origen_id",
    "cantidad_anunciada_paquetes",
  ],
  operationalEvents: [
    "snapshot_id",
    "evento_id",
    "operacion_id",
    "escenario_id",
    "snapshot_origen_id",
    "tipo",
    "operacion",
    "centro_id",
    "producto_id",
    "sku_id",
    "ocurrido_en",
    "registrado_en",
    "orden",
    "payload_json",
  ],
} as const;

export const CSV_FILE_NAMES = {
  centers: "centros.csv",
  products: "productos.csv",
  presentations: "presentaciones.csv",
  inventory: "inventario.csv",
  needs: "necesidades.csv",
  volunteers: "voluntarios.csv",
  travelTimes: "tiempos.csv",
  expectedDonations: "intenciones.csv",
  qrDonations: "donaciones_qr.csv",
  movements: "movimientos.csv",
  operationalEvents: "eventos.csv",
} as const;
