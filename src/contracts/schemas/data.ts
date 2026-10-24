import { z } from "zod";

const canonicalNumberPattern = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const uuidSchema = z.string().uuid().transform((value) => value.toLowerCase());

function numericField(schema: z.ZodNumber) {
  return z.preprocess((value) => {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim();
    if (!canonicalNumberPattern.test(normalized)) {
      return value;
    }

    return Number(normalized);
  }, schema);
}

const identifierSchema = z.string().trim().min(1);
const requiredTextSchema = z.string().refine((value) => value.trim().length > 0, {
  message: "El campo no puede estar vacío.",
});
const nullableTextSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? null : value,
  z.string().nullable(),
);
const timestampSchema = z.string().datetime({ offset: true });
const nonNegativeNumberSchema = numericField(z.number().nonnegative());
const positiveNumberSchema = numericField(z.number().positive());
const nonNegativeIntegerSchema = numericField(z.number().int().nonnegative());
const positiveIntegerSchema = numericField(z.number().int().positive());

export const snapshotMetadataSchema = z
  .object({
    id: uuidSchema,
    nombre: requiredTextSchema,
    created_at: timestampSchema,
    descripcion: nullableTextSchema,
  })
  .strict();

export const centerCsvRowSchema = z
  .object({
    snapshot_id: uuidSchema,
    centro_id: identifierSchema,
    nombre: requiredTextSchema,
    estado: requiredTextSchema,
    zona: nullableTextSchema,
    coordinador_nombre: requiredTextSchema,
  })
  .strict();

export const productCsvRowSchema = z
  .object({
    snapshot_id: uuidSchema,
    producto_id: identifierSchema,
    nombre: requiredTextSchema,
    unidad_base: z.enum(["ml", "g", "unidad"]),
  })
  .strict();

export const presentationCsvRowSchema = z
  .object({
    snapshot_id: uuidSchema,
    sku_id: identifierSchema,
    producto_id: identifierSchema,
    nombre: requiredTextSchema,
    contenido_por_paquete: positiveNumberSchema,
  })
  .strict();

export const inventoryCsvRowSchema = z
  .object({
    snapshot_id: uuidSchema,
    centro_id: identifierSchema,
    sku_id: identifierSchema,
    cantidad_paquetes: nonNegativeIntegerSchema,
  })
  .strict();

export const needCsvRowSchema = z
  .object({
    snapshot_id: uuidSchema,
    centro_id: identifierSchema,
    producto_id: identifierSchema,
    objetivo_unidad_base: nonNegativeNumberSchema,
    reserva_unidad_base: nonNegativeNumberSchema,
    prioridad: numericField(z.number().int().min(1).max(3)),
  })
  .strict();

export const volunteerCsvRowSchema = z
  .object({
    snapshot_id: uuidSchema,
    centro_id: identifierSchema,
    disponibles: nonNegativeIntegerSchema,
    requeridos: nonNegativeIntegerSchema,
  })
  .strict();

export const travelTimeCsvRowSchema = z
  .object({
    snapshot_id: uuidSchema,
    origen_id: identifierSchema,
    destino_id: identifierSchema,
    minutos: nonNegativeIntegerSchema,
  })
  .strict();

export const expectedDonationCsvRowSchema = z
  .object({
    snapshot_id: uuidSchema,
    intencion_id: identifierSchema,
    centro_id: identifierSchema,
    sku_id: identifierSchema,
    cantidad_paquetes: positiveIntegerSchema,
    llegada_prevista: timestampSchema,
    estado: z.enum(["pendiente", "recibida", "cancelada"]),
  })
  .strict();

const snapshotBundleBaseSchema = z
  .object({
    metadata: snapshotMetadataSchema,
    centers: z.array(centerCsvRowSchema),
    products: z.array(productCsvRowSchema),
    presentations: z.array(presentationCsvRowSchema),
    inventory: z.array(inventoryCsvRowSchema),
    needs: z.array(needCsvRowSchema),
    volunteers: z.array(volunteerCsvRowSchema),
    travelTimes: z.array(travelTimeCsvRowSchema),
    expectedDonations: z.array(expectedDonationCsvRowSchema),
  })
  .strict();

type BundleShape = z.infer<typeof snapshotBundleBaseSchema>;
type BundleCollection = Exclude<keyof BundleShape, "metadata">;

function reportDuplicate<T>(
  rows: readonly T[],
  keyFor: (row: T) => string,
  collection: BundleCollection,
  description: string,
  context: z.RefinementCtx,
) {
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const key = keyFor(row);
    if (seen.has(key)) {
      context.addIssue({
        code: "custom",
        path: [collection, index],
        message: `Clave duplicada de ${description}: ${key}.`,
      });
    }
    seen.add(key);
  });
}

function reportMissingReference(
  exists: boolean,
  collection: BundleCollection,
  index: number,
  field: string,
  description: string,
  context: z.RefinementCtx,
) {
  if (!exists) {
    context.addIssue({
      code: "custom",
      path: [collection, index, field],
      message: `Referencia inexistente: ${description}.`,
    });
  }
}

export const snapshotBundleSchema = snapshotBundleBaseSchema.superRefine(
  (bundle, context) => {
    const snapshotId = bundle.metadata.id;
    const collections: Array<
      [BundleCollection, ReadonlyArray<{ snapshot_id: string }>]
    > = [
      ["centers", bundle.centers],
      ["products", bundle.products],
      ["presentations", bundle.presentations],
      ["inventory", bundle.inventory],
      ["needs", bundle.needs],
      ["volunteers", bundle.volunteers],
      ["travelTimes", bundle.travelTimes],
      ["expectedDonations", bundle.expectedDonations],
    ];

    for (const [collection, rows] of collections) {
      rows.forEach((row, index) => {
        if (row.snapshot_id !== snapshotId) {
          context.addIssue({
            code: "custom",
            path: [collection, index, "snapshot_id"],
            message: `El registro no pertenece al snapshot ${snapshotId}.`,
          });
        }
      });
    }

    reportDuplicate(
      bundle.centers,
      (row) => row.centro_id,
      "centers",
      "centro",
      context,
    );
    reportDuplicate(
      bundle.products,
      (row) => row.producto_id,
      "products",
      "producto",
      context,
    );
    reportDuplicate(
      bundle.presentations,
      (row) => row.sku_id,
      "presentations",
      "presentación",
      context,
    );
    reportDuplicate(
      bundle.inventory,
      (row) => `${row.centro_id}\u0000${row.sku_id}`,
      "inventory",
      "inventario centro/SKU",
      context,
    );
    reportDuplicate(
      bundle.needs,
      (row) => `${row.centro_id}\u0000${row.producto_id}`,
      "needs",
      "necesidad centro/producto",
      context,
    );
    reportDuplicate(
      bundle.volunteers,
      (row) => row.centro_id,
      "volunteers",
      "voluntarios por centro",
      context,
    );
    reportDuplicate(
      bundle.travelTimes,
      (row) => `${row.origen_id}\u0000${row.destino_id}`,
      "travelTimes",
      "tiempo origen/destino",
      context,
    );
    reportDuplicate(
      bundle.expectedDonations,
      (row) => row.intencion_id,
      "expectedDonations",
      "intención",
      context,
    );

    const centerIds = new Set(bundle.centers.map((row) => row.centro_id));
    const productIds = new Set(bundle.products.map((row) => row.producto_id));
    const skuIds = new Set(bundle.presentations.map((row) => row.sku_id));

    bundle.presentations.forEach((row, index) => {
      reportMissingReference(
        productIds.has(row.producto_id),
        "presentations",
        index,
        "producto_id",
        `producto ${row.producto_id}`,
        context,
      );
    });

    bundle.inventory.forEach((row, index) => {
      reportMissingReference(
        centerIds.has(row.centro_id),
        "inventory",
        index,
        "centro_id",
        `centro ${row.centro_id}`,
        context,
      );
      reportMissingReference(
        skuIds.has(row.sku_id),
        "inventory",
        index,
        "sku_id",
        `SKU ${row.sku_id}`,
        context,
      );
    });

    bundle.needs.forEach((row, index) => {
      reportMissingReference(
        centerIds.has(row.centro_id),
        "needs",
        index,
        "centro_id",
        `centro ${row.centro_id}`,
        context,
      );
      reportMissingReference(
        productIds.has(row.producto_id),
        "needs",
        index,
        "producto_id",
        `producto ${row.producto_id}`,
        context,
      );
    });

    bundle.volunteers.forEach((row, index) => {
      reportMissingReference(
        centerIds.has(row.centro_id),
        "volunteers",
        index,
        "centro_id",
        `centro ${row.centro_id}`,
        context,
      );
    });

    bundle.travelTimes.forEach((row, index) => {
      reportMissingReference(
        centerIds.has(row.origen_id),
        "travelTimes",
        index,
        "origen_id",
        `centro de origen ${row.origen_id}`,
        context,
      );
      reportMissingReference(
        centerIds.has(row.destino_id),
        "travelTimes",
        index,
        "destino_id",
        `centro de destino ${row.destino_id}`,
        context,
      );
    });

    bundle.expectedDonations.forEach((row, index) => {
      reportMissingReference(
        centerIds.has(row.centro_id),
        "expectedDonations",
        index,
        "centro_id",
        `centro ${row.centro_id}`,
        context,
      );
      reportMissingReference(
        skuIds.has(row.sku_id),
        "expectedDonations",
        index,
        "sku_id",
        `SKU ${row.sku_id}`,
        context,
      );
    });
  },
);

export function validateSnapshotBundle(input: unknown) {
  return snapshotBundleSchema.parse(input);
}

export type SnapshotMetadata = z.infer<typeof snapshotMetadataSchema>;
export type CenterCsvRow = z.infer<typeof centerCsvRowSchema>;
export type ProductCsvRow = z.infer<typeof productCsvRowSchema>;
export type PresentationCsvRow = z.infer<typeof presentationCsvRowSchema>;
export type InventoryCsvRow = z.infer<typeof inventoryCsvRowSchema>;
export type NeedCsvRow = z.infer<typeof needCsvRowSchema>;
export type VolunteerCsvRow = z.infer<typeof volunteerCsvRowSchema>;
export type TravelTimeCsvRow = z.infer<typeof travelTimeCsvRowSchema>;
export type ExpectedDonationCsvRow = z.infer<
  typeof expectedDonationCsvRowSchema
>;
export type SnapshotBundle = z.infer<typeof snapshotBundleSchema>;
