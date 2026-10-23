import type { SupabaseClient } from "@supabase/supabase-js";

import {
  findSnapshot,
  listCenters,
  listPresentations,
  listProducts,
  listSnapshots,
  listTravelTimes,
} from "@/server/repositories/operations";
import { ApiError } from "./errors";

async function requireSnapshot(supabase: SupabaseClient, snapshotId: string) {
  const snapshot = await findSnapshot(supabase, snapshotId);
  if (!snapshot) {
    throw new ApiError(404, "SNAPSHOT_NOT_FOUND", "El snapshot no existe.");
  }
  return snapshot;
}

export async function getSnapshots(supabase: SupabaseClient) {
  return listSnapshots(supabase);
}

export async function getSnapshot(
  supabase: SupabaseClient,
  snapshotId: string,
) {
  return requireSnapshot(supabase, snapshotId);
}

export async function getCenters(
  supabase: SupabaseClient,
  snapshotId: string,
) {
  await requireSnapshot(supabase, snapshotId);
  return listCenters(supabase, snapshotId);
}

export async function getProducts(
  supabase: SupabaseClient,
  snapshotId: string,
) {
  await requireSnapshot(supabase, snapshotId);
  const [products, presentations] = await Promise.all([
    listProducts(supabase, snapshotId),
    listPresentations(supabase, snapshotId),
  ]);

  return products.map((product) => ({
    ...product,
    presentaciones: presentations.filter(
      (presentation) => presentation.producto_id === product.producto_id,
    ),
  }));
}

export async function getTravelTimes(
  supabase: SupabaseClient,
  snapshotId: string,
) {
  await requireSnapshot(supabase, snapshotId);
  return listTravelTimes(supabase, snapshotId);
}

