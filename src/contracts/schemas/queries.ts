import { z } from "zod";

export const snapshotIdSchema = z.string().uuid();

export function validateSnapshotId(value: string | null) {
  return snapshotIdSchema.safeParse(value);
}

