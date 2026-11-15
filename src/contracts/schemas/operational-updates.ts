import { z } from "zod";

const identifierSchema = z
  .string()
  .trim()
  .min(1, "El identificador es obligatorio.")
  .max(64, "El identificador es demasiado largo.")
  .regex(/^[A-Za-z0-9_-]+$/, "El identificador contiene caracteres no permitidos.");
const requiredTextSchema = z
  .string()
  .trim()
  .min(1, "El campo no puede estar vacío.")
  .max(160, "El texto es demasiado largo.");
const nullableTextSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().max(160).nullable(),
);
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const nonNegativeNumberSchema = z.number().finite().nonnegative();

const centerValuesSchema = z
  .object({
    centro_id: identifierSchema,
    nombre: requiredTextSchema,
    estado: z.enum(["activo", "inactivo"]),
    zona: nullableTextSchema,
    coordinador_nombre: requiredTextSchema,
  })
  .strict();

export const operationalUpdateSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("create_center"),
      values: centerValuesSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("update_center"),
      values: centerValuesSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("upsert_inventory"),
      values: z
        .object({
          centro_id: identifierSchema,
          producto_id: identifierSchema,
          sku_id: identifierSchema,
          cantidad_paquetes: nonNegativeIntegerSchema,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("upsert_need"),
      values: z
        .object({
          centro_id: identifierSchema,
          producto_id: identifierSchema,
          objetivo_unidad_base: nonNegativeNumberSchema,
          prioridad: z.number().int().min(1).max(3),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("upsert_volunteers"),
      values: z
        .object({
          centro_id: identifierSchema,
          disponibles: nonNegativeIntegerSchema,
          requeridos: nonNegativeIntegerSchema,
        })
        .strict(),
    })
    .strict(),
]);

export type OperationalUpdate = z.infer<typeof operationalUpdateSchema>;
