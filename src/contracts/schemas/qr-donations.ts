import { z } from "zod";

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_:@.-]+$/);
const uuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const timestampSchema = z.string().datetime({ offset: true });
const optionalTextSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .transform((value) => value || null);

export const qrDonationStatusSchema = z.enum([
  "anunciado",
  "parcialmente_recibido",
  "recibido_completo",
  "cancelado",
]);

export const qrDonationSourceSchema = z.enum([
  "local_prueba",
  "google_forms",
]);

export const qrDonationCsvRowSchema = z
  .object({
    snapshot_id: uuidSchema,
    anuncio_id: uuidSchema,
    respuesta_origen_id: identifierSchema,
    centro_id: identifierSchema,
    producto_id: identifierSchema,
    sku_id: identifierSchema,
    cantidad_anunciada_paquetes: z.coerce.number().int().positive(),
    cantidad_recibida_paquetes: z.coerce.number().int().nonnegative(),
    cantidad_pendiente_paquetes: z.coerce.number().int().nonnegative(),
    llegada_estimada: timestampSchema,
    registrado_en: timestampSchema,
    donante_referencia: optionalTextSchema,
    observaciones: optionalTextSchema,
    estado: qrDonationStatusSchema,
    fuente: qrDonationSourceSchema,
  })
  .strict()
  .superRefine((row, context) => {
    if (
      row.cantidad_recibida_paquetes + row.cantidad_pendiente_paquetes !==
      row.cantidad_anunciada_paquetes
    ) {
      context.addIssue({
        code: "custom",
        path: ["cantidad_pendiente_paquetes"],
        message: "El saldo pendiente no coincide con lo anunciado y recibido.",
      });
    }
    const expectedStatus =
      row.estado === "cancelado"
        ? "cancelado"
        : row.cantidad_pendiente_paquetes === 0
          ? "recibido_completo"
          : row.cantidad_recibida_paquetes > 0
            ? "parcialmente_recibido"
            : "anunciado";
    if (row.estado !== expectedStatus) {
      context.addIssue({
        code: "custom",
        path: ["estado"],
        message: "El estado no corresponde a las cantidades del anuncio.",
      });
    }
    if (row.estado === "cancelado" && row.cantidad_recibida_paquetes > 0) {
      context.addIssue({
        code: "custom",
        path: ["estado"],
        message: "No se puede cancelar un anuncio con recepciones confirmadas.",
      });
    }
  });

const createValuesSchema = z
  .object({
    operacion_id: uuidSchema,
    respuesta_origen_id: identifierSchema,
    item_origen_id: identifierSchema.default("item:1"),
    centro_id: identifierSchema,
    producto_id: identifierSchema,
    sku_id: identifierSchema,
    cantidad_anunciada_paquetes: z.number().int().positive(),
    llegada_estimada: timestampSchema,
    registrado_en: timestampSchema,
    donante_referencia: optionalTextSchema,
    observaciones: optionalTextSchema,
    fuente: qrDonationSourceSchema,
  })
  .strict();

const donationItemValuesSchema = z
  .object({
    item_origen_id: identifierSchema,
    producto_id: identifierSchema,
    sku_id: identifierSchema,
    cantidad_anunciada_paquetes: z.number().int().positive(),
  })
  .strict();

const createDonationValuesSchema = z
  .object({
    operacion_id: uuidSchema,
    respuesta_origen_id: identifierSchema,
    centro_id: identifierSchema,
    llegada_estimada: timestampSchema,
    registrado_en: timestampSchema,
    donante_referencia: optionalTextSchema,
    observaciones: optionalTextSchema,
    fuente: qrDonationSourceSchema,
    articulos: z.array(donationItemValuesSchema).min(1).max(5),
  })
  .strict()
  .superRefine((values, context) => {
    const itemIds = new Set<string>();
    const productIds = new Set<string>();
    values.articulos.forEach((item, index) => {
      if (itemIds.has(item.item_origen_id)) {
        context.addIssue({
          code: "custom",
          path: ["articulos", index, "item_origen_id"],
          message: "El identificador del artículo está duplicado.",
        });
      }
      itemIds.add(item.item_origen_id);
      if (productIds.has(item.producto_id)) {
        context.addIssue({
          code: "custom",
          path: ["articulos", index, "producto_id"],
          message: "Cada artículo debe corresponder a un producto diferente.",
        });
      }
      productIds.add(item.producto_id);
    });
  });

export const qrDonationOperationSchema = z.discriminatedUnion("operation", [
  z
    .object({ operation: z.literal("create_announcement"), values: createValuesSchema })
    .strict(),
  z
    .object({
      operation: z.literal("create_donation"),
      values: createDonationValuesSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("cancel_announcement"),
      values: z
        .object({ operacion_id: uuidSchema, anuncio_id: uuidSchema })
        .strict(),
    })
    .strict(),
]);

export type QrDonationRecord = z.infer<typeof qrDonationCsvRowSchema>;
export type QrDonationOperation = z.infer<typeof qrDonationOperationSchema>;
export type QrDonationStatus = z.infer<typeof qrDonationStatusSchema>;
