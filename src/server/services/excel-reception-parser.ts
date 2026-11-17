import { createHash } from "node:crypto";

import { readSheet, type SheetData } from "read-excel-file/node";

import type { SnapshotBundle } from "@/contracts/schemas/data";
import {
  RECEPTION_EXCEL_COLUMNS,
  RECEPTION_SHEET_NAME,
  type ExcelReceptionError,
  type ExcelReceptionPreview,
  type ExcelReceptionRow,
} from "@/contracts/types/excel-receptions";

export const MAX_RECEPTION_XLSX_BYTES = 1_048_576;
export const MAX_RECEPTION_ROWS = 100;

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : null;
}

function addError(
  errors: ExcelReceptionError[],
  fila: number | null,
  columna: string | null,
  codigo: string,
  mensaje: string,
) {
  errors.push({ fila, columna, codigo, mensaje });
}

export async function parseReceptionWorkbook(
  bytes: Buffer,
  fileName: string,
  source: SnapshotBundle,
): Promise<ExcelReceptionPreview> {
  const errors: ExcelReceptionError[] = [];
  const fingerprint = createHash("sha256").update(bytes).digest("hex");
  let data: SheetData;
  try {
    data = await readSheet(bytes, RECEPTION_SHEET_NAME, { trim: true });
  } catch {
    return {
      archivo: fileName,
      huella_sha256: fingerprint,
      hoja: RECEPTION_SHEET_NAME,
      filas: [],
      errores: [{
        fila: null,
        columna: null,
        codigo: "INVALID_WORKBOOK",
        mensaje: `No se pudo leer la hoja obligatoria ${RECEPTION_SHEET_NAME}.`,
      }],
      valido: false,
      total_filas: 0,
      total_paquetes: 0,
    };
  }

  const header = data[0] ?? [];
  const normalizedHeader = header.map((cell) => asTrimmedString(cell) ?? "");
  const exactHeader =
    normalizedHeader.length === RECEPTION_EXCEL_COLUMNS.length &&
    RECEPTION_EXCEL_COLUMNS.every(
      (column, index) => normalizedHeader[index] === column,
    );
  if (!exactHeader) {
    addError(
      errors,
      1,
      null,
      "INVALID_COLUMNS",
      `La hoja debe contener exactamente estas columnas y en este orden: ${RECEPTION_EXCEL_COLUMNS.join(", ")}.`,
    );
  }

  const rawRows = data
    .slice(1)
    .map((cells, index) => ({ cells, rowNumber: index + 2 }))
    .filter(({ cells }) => cells.some((cell) => cell !== null && cell !== ""));
  if (rawRows.length === 0) {
    addError(errors, null, null, "EMPTY_WORKBOOK", "El archivo no contiene recepciones.");
  }
  if (rawRows.length > MAX_RECEPTION_ROWS) {
    addError(
      errors,
      null,
      null,
      "TOO_MANY_ROWS",
      `El archivo supera el máximo de ${MAX_RECEPTION_ROWS} recepciones.`,
    );
  }

  const centers = new Map(source.centers.map((row) => [row.centro_id, row]));
  const products = new Map(source.products.map((row) => [row.producto_id, row]));
  const presentations = new Map(source.presentations.map((row) => [row.sku_id, row]));
  const seenOperations = new Map<string, number>();
  const rows: ExcelReceptionRow[] = [];

  for (const { cells, rowNumber } of rawRows.slice(0, MAX_RECEPTION_ROWS)) {
    const operationId = asTrimmedString(cells[0]);
    const receivedAt = asTrimmedString(cells[1]);
    const centerId = asTrimmedString(cells[2]);
    const skuId = asTrimmedString(cells[3]);
    const packages = cells[4];
    const before = errors.length;

    if (!operationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
      addError(errors, rowNumber, "operacion_id", "INVALID_OPERATION_ID", "El ID de operación debe ser un UUID válido.");
    } else if (seenOperations.has(operationId.toLowerCase())) {
      addError(errors, rowNumber, "operacion_id", "DUPLICATE_OPERATION_ID", `El ID de operación ya aparece en la fila ${seenOperations.get(operationId.toLowerCase())}.`);
    } else {
      seenOperations.set(operationId.toLowerCase(), rowNumber);
    }
    if (!receivedAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-05:00$/.test(receivedAt) || !Number.isFinite(Date.parse(receivedAt))) {
      addError(errors, rowNumber, "recibido_en", "INVALID_TIMESTAMP", "Usa una fecha ISO 8601 explícita de America/Bogota, por ejemplo 2026-11-16T08:00:00-05:00.");
    }
    const center = centerId ? centers.get(centerId) : undefined;
    if (!center) {
      addError(errors, rowNumber, "centro_id", "UNKNOWN_CENTER", "El centro no existe en el escenario seleccionado.");
    }
    const presentation = skuId ? presentations.get(skuId) : undefined;
    if (!presentation) {
      addError(errors, rowNumber, "sku_id", "UNKNOWN_PRESENTATION", "La presentación no existe en el catálogo seleccionado.");
    }
    if (typeof packages !== "number" || !Number.isSafeInteger(packages) || packages <= 0) {
      addError(errors, rowNumber, "cantidad_paquetes", "INVALID_PACKAGE_QUANTITY", "La cantidad debe ser un entero positivo.");
    }
    const product = presentation ? products.get(presentation.producto_id) : undefined;
    if (presentation && !product) {
      addError(errors, rowNumber, "sku_id", "UNKNOWN_PRODUCT", "La presentación no tiene un producto válido en el catálogo.");
    }

    if (
      errors.length === before &&
      operationId && receivedAt && centerId && skuId && center && presentation && product &&
      typeof packages === "number"
    ) {
      rows.push({
        fila: rowNumber,
        operacion_id: operationId.toLowerCase(),
        recibido_en: receivedAt,
        centro_id: centerId,
        centro_nombre: center.nombre,
        producto_id: product.producto_id,
        producto_nombre: product.nombre,
        unidad_base: product.unidad_base,
        sku_id: skuId,
        presentacion_nombre: presentation.nombre,
        contenido_por_paquete: presentation.contenido_por_paquete,
        cantidad_paquetes: packages,
        cantidad_unidad_base: packages * presentation.contenido_por_paquete,
      });
    }
  }

  return {
    archivo: fileName,
    huella_sha256: fingerprint,
    hoja: RECEPTION_SHEET_NAME,
    filas: rows,
    errores: errors,
    valido: errors.length === 0,
    total_filas: rows.length,
    total_paquetes: rows.reduce((sum, row) => sum + row.cantidad_paquetes, 0),
  };
}
