import type { QrDonationOperation } from "@/contracts/schemas/qr-donations";
import type { QrDonationSyncResult } from "@/contracts/types/qr-donations";
import {
  getOperationsRepository,
  type OperationsRepository,
} from "@/server/repositories/operations";
import { readGoogleDonationSheetRows } from "@/server/integrations/google-sheets";
import { ApiError } from "./errors";
import { applyQrDonationOperation } from "./qr-donations";
import { assertSnapshotWritable } from "./scenario-protection";
import { stableUuid } from "./snapshot-versioning";

const EXPECTED_HEADERS = {
  responseId: ["id de respuesta", "response id"],
  donationId: ["id de donacion", "id de donación", "donacion_id"],
  itemId: ["id del articulo", "id del artículo", "item_id"],
  registeredAt: ["marca temporal", "timestamp", "fecha de registro"],
  center: ["centro de acopio", "centro"],
  presentation: ["producto y presentacion", "producto y presentación"],
  quantity: ["cantidad anunciada en paquetes", "cantidad anunciada"],
  expectedAt: ["fecha estimada de entrega", "fecha estimada"],
  donor: [
    "nombre o entidad donante (opcional)",
    "nombre o entidad donante",
    "donante",
  ],
  observations: ["observaciones (opcional)", "observaciones"],
} as const;

type CreateDonationOperation = Extract<
  QrDonationOperation,
  { operation: "create_donation" }
>;

interface ParsedSheetDonation {
  rowNumbers: number[];
  operation: CreateDonationOperation;
}

export interface ParsedGoogleDonationRows {
  donations: ParsedSheetDonation[];
  invalidRows: Array<{ fila: number; mensaje: string }>;
  dataRowCount: number;
}

interface ParsedSheetItem {
  rowNumber: number;
  responseId: string;
  itemOriginId: string;
  centerId: string;
  skuId: string;
  quantity: number;
  expectedAt: string;
  registeredAt: string;
  donor: string | null;
  observations: string | null;
}

function normalizedHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es");
}

function headerIndex(headers: string[], aliases: readonly string[]) {
  const normalizedAliases = new Set(aliases.map(normalizedHeader));
  return headers.findIndex((header) => normalizedAliases.has(normalizedHeader(header)));
}

function identifierFromOption(value: string, description: string) {
  const identifier = value.trim().split(/\s+[—–-]\s+|\s+/u, 1)[0] ?? "";
  if (!/^[A-Za-z0-9_:@.-]+$/.test(identifier)) {
    throw new Error(`${description} no contiene un identificador válido.`);
  }
  return identifier;
}

function bogotaTimestamp(value: string, dateOnlyTime: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T${dateOnlyTime}-05:00`;
  }
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
    trimmed,
  );
  if (local) {
    const [, day, month, year, hour = dateOnlyTime.slice(0, 2), minute = dateOnlyTime.slice(3, 5), second = dateOnlyTime.slice(6, 8)] = local;
    const timestamp = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:${second}-05:00`;
    if (!Number.isNaN(Date.parse(timestamp))) return timestamp;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed) && !Number.isNaN(Date.parse(trimmed))) {
    return trimmed;
  }
  throw new Error("La fecha no tiene un formato reconocido para America/Bogota.");
}

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

export function parseGoogleDonationSheetRows(
  rows: string[][],
): ParsedGoogleDonationRows {
  if (rows.length === 0) {
    return { donations: [], invalidRows: [], dataRowCount: 0 };
  }
  const headers = rows[0];
  const indexes = {
    responseId: headerIndex(headers, EXPECTED_HEADERS.responseId),
    donationId: headerIndex(headers, EXPECTED_HEADERS.donationId),
    itemId: headerIndex(headers, EXPECTED_HEADERS.itemId),
    registeredAt: headerIndex(headers, EXPECTED_HEADERS.registeredAt),
    center: headerIndex(headers, EXPECTED_HEADERS.center),
    presentation: headerIndex(headers, EXPECTED_HEADERS.presentation),
    quantity: headerIndex(headers, EXPECTED_HEADERS.quantity),
    expectedAt: headerIndex(headers, EXPECTED_HEADERS.expectedAt),
    donor: headerIndex(headers, EXPECTED_HEADERS.donor),
    observations: headerIndex(headers, EXPECTED_HEADERS.observations),
  };
  const missingHeaders = Object.entries(indexes)
    .filter(([name]) => name !== "donationId" && name !== "itemId")
    .filter(([, index]) => index < 0)
    .map(([name]) => name);
  if (missingHeaders.length > 0) {
    throw new ApiError(
      502,
      "GOOGLE_SHEETS_HEADERS_INVALID",
      "La hoja de respuestas no contiene las columnas esperadas.",
      { missingHeaders },
    );
  }
  const extendedIdentity = indexes.donationId >= 0 || indexes.itemId >= 0;
  if (extendedIdentity && (indexes.donationId < 0 || indexes.itemId < 0)) {
    throw new ApiError(
      502,
      "GOOGLE_SHEETS_HEADERS_INVALID",
      "La hoja multiproducto debe incluir los identificadores de donación y artículo.",
      { missingHeaders: indexes.donationId < 0 ? ["donationId"] : ["itemId"] },
    );
  }

  const parsedItems: ParsedSheetItem[] = [];
  const invalidRows: Array<{ fila: number; mensaje: string }> = [];
  const invalidResponses = new Set<string>();
  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
    if (row.every((value) => !value.trim())) return;
    const rawResponseId = row[indexes.responseId]?.trim() ?? "";
    try {
      const quantity = Number(row[indexes.quantity]?.trim());
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error("La cantidad debe ser un número entero positivo.");
      }
      if (!/^[A-Za-z0-9_:@.-]+$/.test(rawResponseId)) {
        throw new Error("El ID de respuesta de Google Forms no es válido.");
      }
      const responseId = `forms:${rawResponseId}`;
      let itemOriginId = "item:1";
      if (extendedIdentity) {
        const sourceDonationId = row[indexes.donationId]?.trim() ?? "";
        const sourceItemId = row[indexes.itemId]?.trim() ?? "";
        if (sourceDonationId !== rawResponseId) {
          throw new Error("El ID de donación no coincide con la respuesta de Forms.");
        }
        const itemMatch = new RegExp(
          `^${rawResponseId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:item:([1-5])$`,
        ).exec(sourceItemId);
        if (!itemMatch) {
          throw new Error("El ID del artículo no corresponde a una posición entre 1 y 5.");
        }
        itemOriginId = `item:${itemMatch[1]}`;
      }
      parsedItems.push({
        rowNumber,
        responseId,
        itemOriginId,
        centerId: identifierFromOption(row[indexes.center] ?? "", "El centro"),
        skuId: identifierFromOption(
          row[indexes.presentation] ?? "",
          "La presentación",
        ),
        quantity,
        expectedAt: bogotaTimestamp(row[indexes.expectedAt] ?? "", "12:00:00"),
        registeredAt: bogotaTimestamp(row[indexes.registeredAt] ?? "", "00:00:00"),
        donor: optionalText(row[indexes.donor] ?? ""),
        observations: optionalText(row[indexes.observations] ?? ""),
      });
    } catch (error) {
      if (/^[A-Za-z0-9_:@.-]+$/.test(rawResponseId)) {
        invalidResponses.add(`forms:${rawResponseId}`);
      }
      invalidRows.push({
        fila: rowNumber,
        mensaje:
          error instanceof Error ? error.message : "La fila no es válida.",
      });
    }
  });

  const groups = new Map<string, ParsedSheetItem[]>();
  for (const item of parsedItems) {
    const group = groups.get(item.responseId) ?? [];
    group.push(item);
    groups.set(item.responseId, group);
  }
  const donations: ParsedSheetDonation[] = [];
  for (const [responseId, items] of groups) {
    if (invalidResponses.has(responseId)) continue;
    const first = items[0];
    if (!first) continue;
    const itemIds = new Set<string>();
    let inconsistent: ParsedSheetItem | undefined;
    for (const item of items) {
      if (
        item.centerId !== first.centerId ||
        item.expectedAt !== first.expectedAt ||
        item.registeredAt !== first.registeredAt ||
        item.donor !== first.donor ||
        item.observations !== first.observations ||
        itemIds.has(item.itemOriginId)
      ) {
        inconsistent = item;
        break;
      }
      itemIds.add(item.itemOriginId);
    }
    if (items.length > 5 || inconsistent) {
      invalidRows.push({
        fila: inconsistent?.rowNumber ?? first.rowNumber,
        mensaje:
          items.length > 5
            ? "Una donación no puede contener más de cinco artículos."
            : "Los artículos de una donación no comparten una cabecera e identidad coherentes.",
      });
      continue;
    }
    donations.push({
      rowNumbers: items.map((item) => item.rowNumber),
      operation: {
        operation: "create_donation",
        values: {
          operacion_id: stableUuid(`redes-ayuda:google-sheets:${responseId}`),
          respuesta_origen_id: responseId,
          centro_id: first.centerId,
          llegada_estimada: first.expectedAt,
          registrado_en: first.registeredAt,
          donante_referencia: first.donor,
          observaciones: first.observations,
          fuente: "google_forms",
          articulos: items.map((item) => ({
            item_origen_id: item.itemOriginId,
            producto_id: "PENDIENTE_CATALOGO",
            sku_id: item.skuId,
            cantidad_anunciada_paquetes: item.quantity,
          })),
        },
      },
    });
  }
  return {
    donations,
    invalidRows,
    dataRowCount: rows.slice(1).filter((row) => row.some((value) => value.trim())).length,
  };
}

export async function syncGoogleDonations(
  sourceSnapshotId: string,
  repository: OperationsRepository = getOperationsRepository(),
  readRows: () => Promise<string[][]> = readGoogleDonationSheetRows,
  now = new Date(),
): Promise<QrDonationSyncResult> {
  const source = await repository.getSnapshotBundle(sourceSnapshotId);
  if (!source) {
    throw new ApiError(404, "SNAPSHOT_NOT_FOUND", "El snapshot no existe.");
  }
  assertSnapshotWritable(source.metadata);

  const parsed = parseGoogleDonationSheetRows(await readRows());
  let currentSnapshotId = sourceSnapshotId;
  let importedDonations = 0;
  let duplicateDonations = 0;
  let importedItems = 0;
  let duplicateItems = 0;
  const invalidRows = [...parsed.invalidRows];
  const presentationProducts = new Map(
    source.presentations.map((row) => [row.sku_id, row.producto_id]),
  );

  for (const donation of parsed.donations) {
    const resolvedItems: CreateDonationOperation["values"]["articulos"] = [];
    let invalidDonation = false;
    for (const [index, item] of donation.operation.values.articulos.entries()) {
      const productId = presentationProducts.get(item.sku_id);
      if (!productId) {
        invalidRows.push({
          fila: donation.rowNumbers[index] ?? donation.rowNumbers[0] ?? 2,
          mensaje: "La presentación no existe en el catálogo del escenario.",
        });
        invalidDonation = true;
        continue;
      }
      resolvedItems.push({ ...item, producto_id: productId });
    }
    if (invalidDonation) continue;
    if (new Set(resolvedItems.map((item) => item.producto_id)).size !== resolvedItems.length) {
      invalidRows.push({
        fila: donation.rowNumbers[0] ?? 2,
        mensaje: "Cada artículo de la donación debe corresponder a un producto diferente.",
      });
      continue;
    }
    const operation: QrDonationOperation = {
      ...donation.operation,
      values: { ...donation.operation.values, articulos: resolvedItems },
    };
    try {
      const result = await applyQrDonationOperation(
        currentSnapshotId,
        operation,
        repository,
        now,
      );
      currentSnapshotId = result.snapshot.id;
      if (result.idempotent) {
        duplicateDonations += 1;
        duplicateItems += resolvedItems.length;
      } else {
        importedDonations += 1;
        importedItems += resolvedItems.length;
      }
    } catch (error) {
      invalidRows.push({
        fila: donation.rowNumbers[0] ?? 2,
        mensaje:
          error instanceof ApiError
            ? error.message
            : "No fue posible persistir la respuesta.",
      });
    }
  }

  const current = await repository.findSnapshot(currentSnapshotId);
  if (!current) {
    throw new ApiError(
      500,
      "SYNC_SNAPSHOT_NOT_FOUND",
      "La sincronización no pudo resolver su versión final.",
    );
  }
  return {
    snapshot: current,
    source_snapshot_id: sourceSnapshotId,
    filas_consultadas: parsed.dataRowCount,
    anuncios_importados: importedDonations,
    respuestas_duplicadas: duplicateDonations,
    donaciones_importadas: importedDonations,
    donaciones_duplicadas: duplicateDonations,
    articulos_importados: importedItems,
    articulos_duplicados: duplicateItems,
    filas_invalidas: invalidRows,
    sincronizado_en: now.toISOString(),
  };
}
