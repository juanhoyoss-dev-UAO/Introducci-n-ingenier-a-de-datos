import { z } from "zod";

const identifierSchema = z
  .string()
  .trim()
  .min(1, "El identificador es obligatorio.")
  .max(64, "El identificador es demasiado largo.")
  .regex(/^[A-Za-z0-9_-]+$/, "El identificador contiene caracteres no permitidos.");
const operationIdSchema = z.string().uuid().transform((value) => value.toLowerCase());
const occurredAtSchema = z.string().datetime({ offset: true });
const packageQuantitySchema = z.number().int().positive();

const inventoryMovementValuesSchema = z
  .object({
    operacion_id: operationIdSchema,
    centro_id: identifierSchema,
    producto_id: identifierSchema,
    sku_id: identifierSchema,
    cantidad_paquetes: packageQuantitySchema,
    ocurrido_en: occurredAtSchema,
  })
  .strict();

export const movementOperationSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("confirm_donation"),
      values: z
        .object({
          operacion_id: operationIdSchema,
          intencion_id: identifierSchema,
          cantidad_paquetes: packageQuantitySchema,
          ocurrido_en: occurredAtSchema,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("direct_reception"),
      values: inventoryMovementValuesSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("dispatch"),
      values: inventoryMovementValuesSchema,
    })
    .strict(),
]);

export const movementHistoryQuerySchema = z
  .object({
    centro_id: identifierSchema.optional(),
    desde: occurredAtSchema.optional(),
    hasta: occurredAtSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.desde &&
      value.hasta &&
      new Date(value.desde).getTime() > new Date(value.hasta).getTime()
    ) {
      context.addIssue({
        code: "custom",
        path: ["hasta"],
        message: "La fecha final debe ser posterior o igual a la fecha inicial.",
      });
    }
  });

export type MovementOperation = z.infer<typeof movementOperationSchema>;
export type MovementHistoryQuery = z.infer<typeof movementHistoryQuerySchema>;
