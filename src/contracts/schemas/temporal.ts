import { z } from "zod";

const identifierSchema = z.string().trim().min(1).max(64);
const timestampSchema = z.string().datetime({ offset: true });
const uuidSchema = z.string().uuid().transform((value) => value.toLowerCase());

export const operationalTemporalPayloadSchema = z.discriminatedUnion(
  "operacion",
  [
    z.object({
      operacion: z.literal("upsert_inventory"),
      cantidad_paquetes: z.number().int().nonnegative(),
    }),
    z.object({
      operacion: z.literal("upsert_need"),
      objetivo_unidad_base: z.number().nonnegative(),
      reserva_unidad_base: z.number().nonnegative(),
      prioridad: z.number().int().min(1).max(3),
    }),
    z.object({
      operacion: z.literal("upsert_volunteers"),
      disponibles: z.number().int().nonnegative(),
      requeridos: z.number().int().nonnegative(),
    }),
    z.object({
      operacion: z.enum(["create_center", "update_center"]),
      nombre: z.string().trim().min(1).max(160),
      estado: z.enum(["activo", "inactivo"]),
      zona: z.string().trim().max(160).nullable(),
      coordinador_nombre: z.string().trim().min(1).max(160),
    }),
  ],
);

export const temporalQuerySchema = z
  .object({
    escenario_id: uuidSchema.optional(),
    centro_id: identifierSchema.optional(),
    producto_id: identifierSchema.optional(),
    desde: timestampSchema.optional(),
    hasta: timestampSchema.optional(),
    corte: timestampSchema,
    perspectiva: z.enum(["fisica", "informativa"]).default("fisica"),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.desde &&
      value.hasta &&
      Date.parse(value.desde) > Date.parse(value.hasta)
    ) {
      context.addIssue({
        code: "custom",
        path: ["hasta"],
        message: "La fecha final debe ser posterior o igual a la inicial.",
      });
    }
    if (value.hasta && Date.parse(value.corte) < Date.parse(value.hasta)) {
      context.addIssue({
        code: "custom",
        path: ["corte"],
        message: "El corte no puede ser anterior al final del periodo.",
      });
    }
  });

export type OperationalTemporalPayload = z.infer<
  typeof operationalTemporalPayloadSchema
>;
export type TemporalQuery = z.infer<typeof temporalQuerySchema>;
