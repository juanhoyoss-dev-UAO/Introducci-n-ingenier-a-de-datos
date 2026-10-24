import { z } from "zod";

export const confirmedReceptionPayloadSchema = z.object({
  centro_id: z.string().min(1),
  sku_id: z.string().min(1),
  cantidad_paquetes: z.number().int().positive(),
  estado: z.literal("confirmada"),
});

export type ConfirmedReceptionPayload = z.infer<
  typeof confirmedReceptionPayloadSchema
>;

