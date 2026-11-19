import type { SnapshotBundle } from "@/contracts/schemas/data";
import {
  qrDonationOperationSchema,
  type QrDonationOperation,
  type QrDonationRecord,
  type QrDonationStatus,
} from "@/contracts/schemas/qr-donations";
import type {
  QrDonationModuleData,
  QrDonationOperationResult,
} from "@/contracts/types/qr-donations";
import {
  googleDonationSyncInterval,
  isGoogleDonationIntegrationConfigured,
} from "@/server/integrations/google-sheets";
import {
  getOperationsRepository,
  type OperationsRepository,
} from "@/server/repositories/operations";
import { ApiError, RepositoryError } from "./errors";
import { assertSnapshotWritable } from "./scenario-protection";
import { reidentifySnapshot, stableUuid } from "./snapshot-versioning";

function snapshotIdForOperation(operationId: string) {
  return stableUuid(`redes-ayuda:qr-donation-snapshot:${operationId}`);
}

type CreateAnnouncementOperation = Extract<
  QrDonationOperation,
  { operation: "create_announcement" }
>;
type CreateDonationOperation = Extract<
  QrDonationOperation,
  { operation: "create_donation" }
>;
type CreateOperation = CreateAnnouncementOperation | CreateDonationOperation;

function donationId(scenarioId: string, sourceResponseId: string) {
  return stableUuid(
    `redes-ayuda:qr-donation:${scenarioId}:${sourceResponseId}`,
  );
}

function itemId(
  scenarioId: string,
  sourceResponseId: string,
  sourceItemId: string,
) {
  if (sourceItemId === "item:1") {
    return donationId(scenarioId, sourceResponseId);
  }
  return stableUuid(
    `redes-ayuda:qr-donation-item:${scenarioId}:${sourceResponseId}:${sourceItemId}`,
  );
}

function normalizedCreation(operation: CreateOperation): CreateDonationOperation {
  if (operation.operation === "create_donation") return operation;
  const values = operation.values;
  return {
    operation: "create_donation",
    values: {
      operacion_id: values.operacion_id,
      respuesta_origen_id: values.respuesta_origen_id,
      centro_id: values.centro_id,
      llegada_estimada: values.llegada_estimada,
      registrado_en: values.registrado_en,
      donante_referencia: values.donante_referencia,
      observaciones: values.observaciones,
      fuente: values.fuente,
      articulos: [
        {
          item_origen_id: values.item_origen_id,
          producto_id: values.producto_id,
          sku_id: values.sku_id,
          cantidad_anunciada_paquetes: values.cantidad_anunciada_paquetes,
        },
      ],
    },
  };
}

export function qrDonationGeneralStatus(
  rows: ReadonlyArray<
    Pick<
      QrDonationRecord,
      | "estado"
      | "cantidad_recibida_paquetes"
      | "cantidad_pendiente_paquetes"
    >
  >,
): QrDonationStatus {
  const active = rows.filter((row) => row.estado !== "cancelado");
  if (active.length === 0) return "cancelado";
  if (active.every((row) => row.estado === "recibido_completo")) {
    return "recibido_completo";
  }
  if (
    active.some(
      (row) =>
        row.cantidad_recibida_paquetes > 0 ||
        row.estado === "recibido_completo",
    )
  ) {
    return "parcialmente_recibido";
  }
  return "anunciado";
}

function sameItem(
  row: QrDonationRecord,
  operation: CreateDonationOperation,
  item: CreateDonationOperation["values"]["articulos"][number],
  scenarioId: string,
) {
  const values = operation.values;
  return (
    row.anuncio_id ===
      itemId(scenarioId, values.respuesta_origen_id, item.item_origen_id) &&
    row.respuesta_origen_id === values.respuesta_origen_id &&
    row.centro_id === values.centro_id &&
    row.producto_id === item.producto_id &&
    row.sku_id === item.sku_id &&
    row.cantidad_anunciada_paquetes === item.cantidad_anunciada_paquetes &&
    row.llegada_estimada === values.llegada_estimada &&
    row.registrado_en === values.registrado_en &&
    row.donante_referencia === values.donante_referencia &&
    row.observaciones === values.observaciones &&
    row.fuente === values.fuente
  );
}

function sameDonation(
  rows: readonly QrDonationRecord[],
  operation: CreateDonationOperation,
  scenarioId: string,
) {
  return (
    rows.length === operation.values.articulos.length &&
    operation.values.articulos.every((item) => {
      const expectedItemId = itemId(
        scenarioId,
        operation.values.respuesta_origen_id,
        item.item_origen_id,
      );
      const row = rows.find((candidate) => candidate.anuncio_id === expectedItemId);
      return Boolean(row && sameItem(row, operation, item, scenarioId));
    })
  );
}

function requireDonationReferences(
  bundle: SnapshotBundle,
  operation: CreateDonationOperation,
) {
  const values = operation.values;
  if (!bundle.centers.some((row) => row.centro_id === values.centro_id)) {
    throw new ApiError(400, "INVALID_REFERENCE", "El centro no existe.");
  }
  for (const item of values.articulos) {
    if (!bundle.products.some((row) => row.producto_id === item.producto_id)) {
      throw new ApiError(400, "INVALID_REFERENCE", "El producto no existe.");
    }
    const presentation = bundle.presentations.find(
      (row) => row.sku_id === item.sku_id,
    );
    if (!presentation || presentation.producto_id !== item.producto_id) {
      throw new ApiError(
        400,
        "INVALID_REFERENCE",
        "La presentación no pertenece al producto seleccionado.",
      );
    }
  }
}

function applyToBundle(
  source: SnapshotBundle,
  operation: QrDonationOperation,
  now: Date,
) {
  const next = structuredClone(source);
  const sourceSnapshotId = source.metadata.id;
  const nextId = snapshotIdForOperation(operation.values.operacion_id);
  const scenarioId = source.metadata.escenario_id ?? sourceSnapshotId;
  next.metadata = {
    id: nextId,
    nombre: `${source.metadata.nombre} · donaciones esperadas`,
    created_at: now.toISOString(),
    descripcion: `Versión de donaciones esperadas derivada del snapshot ${sourceSnapshotId}.`,
    escenario_id: scenarioId,
    snapshot_origen_id: sourceSnapshotId,
    snapshot_base_id: source.metadata.snapshot_base_id ?? sourceSnapshotId,
  };
  reidentifySnapshot(next, nextId);

  let announcements: QrDonationRecord[];
  let resolvedDonationId: string;
  if (
    operation.operation === "create_announcement" ||
    operation.operation === "create_donation"
  ) {
    const creation = normalizedCreation(operation);
    requireDonationReferences(next, creation);
    const duplicate = next.qrDonations.filter(
      (row) => row.respuesta_origen_id === creation.values.respuesta_origen_id,
    );
    if (duplicate.length > 0) {
      throw new ApiError(
        409,
        "SOURCE_RESPONSE_CONFLICT",
        "La respuesta de origen ya existe con otros datos.",
      );
    }
    resolvedDonationId = donationId(
      scenarioId,
      creation.values.respuesta_origen_id,
    );
    announcements = creation.values.articulos.map((item) => ({
        snapshot_id: nextId,
        anuncio_id: itemId(
          scenarioId,
          creation.values.respuesta_origen_id,
          item.item_origen_id,
        ),
        respuesta_origen_id: creation.values.respuesta_origen_id,
        centro_id: creation.values.centro_id,
        producto_id: item.producto_id,
        sku_id: item.sku_id,
        cantidad_anunciada_paquetes: item.cantidad_anunciada_paquetes,
        cantidad_recibida_paquetes: 0,
        cantidad_pendiente_paquetes: item.cantidad_anunciada_paquetes,
        llegada_estimada: creation.values.llegada_estimada,
        registrado_en: creation.values.registrado_en,
        donante_referencia: creation.values.donante_referencia,
        observaciones: creation.values.observaciones,
        estado: "anunciado" as const,
        fuente: creation.values.fuente,
      }));
    next.qrDonations.push(...announcements);
  } else {
    const found = next.qrDonations.find(
      (row) => row.anuncio_id === operation.values.anuncio_id,
    );
    if (!found) {
      throw new ApiError(404, "QR_DONATION_NOT_FOUND", "El anuncio no existe.");
    }
    if (found.cantidad_recibida_paquetes > 0) {
      throw new ApiError(
        409,
        "QR_DONATION_HAS_RECEIPTS",
        "No se puede cancelar un anuncio con recepciones confirmadas.",
      );
    }
    found.estado = "cancelado";
    announcements = [found];
    resolvedDonationId = donationId(scenarioId, found.respuesta_origen_id);
  }
  return {
    next,
    announcements,
    donationId: resolvedDonationId,
  };
}

function operationResult(
  bundle: SnapshotBundle,
  sourceSnapshotId: string,
  operation: QrDonationOperation,
  announcements: QrDonationRecord[],
  idempotent: boolean,
): QrDonationOperationResult {
  const first = announcements[0];
  if (!first) {
    throw new ApiError(
      500,
      "QR_DONATION_RESULT_EMPTY",
      "La operación no produjo artículos de donación.",
    );
  }
  const scenarioId = bundle.metadata.escenario_id ?? bundle.metadata.id;
  const donationRows = bundle.qrDonations.filter(
    (row) => row.respuesta_origen_id === first.respuesta_origen_id,
  );
  return {
    snapshot: bundle.metadata,
    source_snapshot_id: sourceSnapshotId,
    operation: operation.operation,
    anuncio: first,
    anuncios: announcements,
    donacion_id: donationId(scenarioId, first.respuesta_origen_id),
    estado_general: qrDonationGeneralStatus(donationRows),
    idempotent,
  };
}

export async function applyQrDonationOperation(
  sourceSnapshotId: string,
  input: unknown,
  repository: OperationsRepository = getOperationsRepository(),
  now = new Date(),
): Promise<QrDonationOperationResult> {
  const parsed = qrDonationOperationSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "INVALID_QR_DONATION_OPERATION",
      "Los datos del anuncio no son válidos.",
      parsed.error.flatten(),
    );
  }
  const operation = parsed.data;
  const source = await repository.getSnapshotBundle(sourceSnapshotId);
  if (!source) throw new ApiError(404, "SNAPSHOT_NOT_FOUND", "El snapshot no existe.");
  assertSnapshotWritable(source.metadata);

  const isCreate =
    operation.operation === "create_announcement" ||
    operation.operation === "create_donation";
  const creation = isCreate ? normalizedCreation(operation) : null;
  const cancellation =
    operation.operation === "cancel_announcement" ? operation : null;
  const scenarioId = source.metadata.escenario_id ?? source.metadata.id;

  if (creation) {
    const duplicates = source.qrDonations.filter(
      (row) => row.respuesta_origen_id === creation.values.respuesta_origen_id,
    );
    if (duplicates.length > 0) {
      if (!sameDonation(duplicates, creation, scenarioId)) {
        throw new ApiError(
          409,
          "SOURCE_RESPONSE_CONFLICT",
          "La respuesta de origen ya existe con otros datos.",
        );
      }
      return operationResult(
        source,
        sourceSnapshotId,
        operation,
        duplicates,
        true,
      );
    }
  } else if (cancellation) {
    const current = source.qrDonations.find(
      (row) => row.anuncio_id === cancellation.values.anuncio_id,
    );
    if (current?.estado === "cancelado") {
      return operationResult(
        source,
        sourceSnapshotId,
        operation,
        [current],
        true,
      );
    }
  }

  const nextId = snapshotIdForOperation(operation.values.operacion_id);
  const existing = await repository.getSnapshotBundle(nextId);
  if (existing) {
    const existingAnnouncements = creation
      ? existing.qrDonations.filter(
          (row) =>
            row.respuesta_origen_id === creation.values.respuesta_origen_id,
        )
      : existing.qrDonations.filter(
          (row) => row.anuncio_id === cancellation?.values.anuncio_id,
        );
    const operationMatches = creation
      ? sameDonation(
          existingAnnouncements,
          creation,
          existing.metadata.escenario_id ?? existing.metadata.id,
        )
      : existingAnnouncements.length === 1;
    if (
      existing.metadata.snapshot_origen_id !== sourceSnapshotId ||
      !operationMatches
    ) {
      throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "La operación ya fue utilizada.");
    }
    return operationResult(
      existing,
      sourceSnapshotId,
      operation,
      existingAnnouncements,
      true,
    );
  }

  const { next, announcements } = applyToBundle(source, operation, now);
  try {
    await repository.writeSnapshot(next);
    return operationResult(
      next,
      sourceSnapshotId,
      operation,
      announcements,
      false,
    );
  } catch (error) {
    if (error instanceof RepositoryError) {
      const published = await repository.getSnapshotBundle(nextId);
      const expectedIds = new Set(announcements.map((row) => row.anuncio_id));
      const announcementsAfterRace = published?.qrDonations.filter((row) =>
        expectedIds.has(row.anuncio_id),
      );
      if (
        published &&
        announcementsAfterRace?.length === announcements.length
      ) {
        return operationResult(
          published,
          sourceSnapshotId,
          operation,
          announcementsAfterRace,
          true,
        );
      }
    }
    throw error;
  }
}

export async function getQrDonationModule(
  snapshotId: string,
  repository: OperationsRepository = getOperationsRepository(),
): Promise<QrDonationModuleData> {
  const bundle = await repository.getSnapshotBundle(snapshotId);
  if (!bundle) throw new ApiError(404, "SNAPSHOT_NOT_FOUND", "El snapshot no existe.");
  const scenarioId = bundle.metadata.escenario_id ?? bundle.metadata.id;
  const announcements = bundle.qrDonations
    .map((announcement) => {
      const center = bundle.centers.find(
        (row) => row.centro_id === announcement.centro_id,
      )!;
      const product = bundle.products.find(
        (row) => row.producto_id === announcement.producto_id,
      )!;
      const presentation = bundle.presentations.find(
        (row) => row.sku_id === announcement.sku_id,
      )!;
      const inventory = bundle.inventory
        .filter(
          (row) =>
            row.centro_id === announcement.centro_id &&
            bundle.presentations.find((item) => item.sku_id === row.sku_id)
              ?.producto_id === announcement.producto_id,
        )
        .reduce((total, row) => {
          const item = bundle.presentations.find((entry) => entry.sku_id === row.sku_id);
          return total + row.cantidad_paquetes * (item?.contenido_por_paquete ?? 0);
        }, 0);
      const need = bundle.needs.find(
        (row) =>
          row.centro_id === announcement.centro_id &&
          row.producto_id === announcement.producto_id,
      );
      return {
        ...announcement,
        donacion_id: donationId(
          scenarioId,
          announcement.respuesta_origen_id,
        ),
        item_id: announcement.anuncio_id,
        centro_nombre: center.nombre,
        producto_nombre: product.nombre,
        presentacion_nombre: presentation.nombre,
        contenido_por_paquete: presentation.contenido_por_paquete,
        unidad_base: product.unidad_base,
        inventario_confirmado_unidad_base: inventory,
        necesidad_vigente_unidad_base: need?.objetivo_unidad_base ?? 0,
      };
    })
    .sort(
      (left, right) =>
        Date.parse(right.registrado_en) - Date.parse(left.registrado_en) ||
        right.anuncio_id.localeCompare(left.anuncio_id),
    );
  const donationMap = new Map<
    string,
    QrDonationModuleData["donaciones"][number]
  >();
  for (const item of announcements) {
    const current = donationMap.get(item.donacion_id);
    if (current) {
      current.articulos.push(item);
      current.estado_general = qrDonationGeneralStatus(current.articulos);
      continue;
    }
    donationMap.set(item.donacion_id, {
      donacion_id: item.donacion_id,
      respuesta_origen_id: item.respuesta_origen_id,
      centro_id: item.centro_id,
      centro_nombre: item.centro_nombre,
      donante: item.donante_referencia,
      fecha_registro: item.registrado_en,
      fecha_estimada: item.llegada_estimada,
      observaciones: item.observaciones,
      estado_general: qrDonationGeneralStatus([item]),
      articulos: [item],
    });
  }
  const donations = [...donationMap.values()]
    .map((donation) => ({
      ...donation,
      articulos: [...donation.articulos].sort((left, right) =>
        left.item_id.localeCompare(right.item_id),
      ),
      estado_general: qrDonationGeneralStatus(donation.articulos),
    }))
    .sort(
      (left, right) =>
        Date.parse(right.fecha_registro) - Date.parse(left.fecha_registro) ||
        right.donacion_id.localeCompare(left.donacion_id),
    );
  return {
    anuncios: announcements,
    donaciones: donations,
    integracion_google_configurada: isGoogleDonationIntegrationConfigured(),
    intervalo_sincronizacion_ms: googleDonationSyncInterval(),
  };
}
