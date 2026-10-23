import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CenterRecord,
  ExpectedDonationRecord,
  InventoryRecord,
  NeedRecord,
  PresentationRecord,
  ProductRecord,
  SnapshotRecord,
  TravelTimeRecord,
  VolunteerRecord,
} from "@/contracts/types/database";
import { RepositoryError } from "@/server/services/errors";

type NumericValue = number | string;

function numberValue(value: NumericValue): number {
  return typeof value === "number" ? value : Number(value);
}

function ensureNoError(error: { message: string } | null) {
  if (error) {
    throw new RepositoryError(error.message);
  }
}

export async function listSnapshots(
  supabase: SupabaseClient,
): Promise<SnapshotRecord[]> {
  const { data, error } = await supabase
    .from("snapshots")
    .select("id,nombre,created_at,descripcion")
    .order("created_at", { ascending: false });
  ensureNoError(error);
  return (data ?? []) as SnapshotRecord[];
}

export async function findSnapshot(
  supabase: SupabaseClient,
  snapshotId: string,
): Promise<SnapshotRecord | null> {
  const { data, error } = await supabase
    .from("snapshots")
    .select("id,nombre,created_at,descripcion")
    .eq("id", snapshotId)
    .maybeSingle();
  ensureNoError(error);
  return data as SnapshotRecord | null;
}

export async function listCenters(
  supabase: SupabaseClient,
  snapshotId: string,
): Promise<CenterRecord[]> {
  const { data, error } = await supabase
    .from("centros")
    .select("snapshot_id,centro_id,nombre,estado,zona,coordinador_nombre")
    .eq("snapshot_id", snapshotId)
    .order("centro_id");
  ensureNoError(error);
  return (data ?? []) as CenterRecord[];
}

export async function listProducts(
  supabase: SupabaseClient,
  snapshotId: string,
): Promise<ProductRecord[]> {
  const { data, error } = await supabase
    .from("productos")
    .select("snapshot_id,producto_id,nombre,unidad_base")
    .eq("snapshot_id", snapshotId)
    .order("producto_id");
  ensureNoError(error);
  return (data ?? []) as ProductRecord[];
}

export async function listPresentations(
  supabase: SupabaseClient,
  snapshotId: string,
): Promise<PresentationRecord[]> {
  const { data, error } = await supabase
    .from("presentaciones")
    .select(
      "snapshot_id,sku_id,producto_id,nombre,contenido_por_paquete",
    )
    .eq("snapshot_id", snapshotId)
    .order("sku_id");
  ensureNoError(error);
  return ((data ?? []) as Array<
    Omit<PresentationRecord, "contenido_por_paquete"> & {
      contenido_por_paquete: NumericValue;
    }
  >).map((row) => ({
    ...row,
    contenido_por_paquete: numberValue(row.contenido_por_paquete),
  }));
}

export async function listTravelTimes(
  supabase: SupabaseClient,
  snapshotId: string,
): Promise<TravelTimeRecord[]> {
  const { data, error } = await supabase
    .from("tiempos_traslado")
    .select("snapshot_id,origen_id,destino_id,minutos")
    .eq("snapshot_id", snapshotId)
    .order("origen_id")
    .order("destino_id");
  ensureNoError(error);
  return (data ?? []) as TravelTimeRecord[];
}

async function listInventory(
  supabase: SupabaseClient,
  snapshotId: string,
): Promise<InventoryRecord[]> {
  const { data, error } = await supabase
    .from("inventario_inicial")
    .select("snapshot_id,centro_id,sku_id,cantidad_paquetes")
    .eq("snapshot_id", snapshotId);
  ensureNoError(error);
  return (data ?? []) as InventoryRecord[];
}

async function listNeeds(
  supabase: SupabaseClient,
  snapshotId: string,
): Promise<NeedRecord[]> {
  const { data, error } = await supabase
    .from("necesidades")
    .select(
      "snapshot_id,centro_id,producto_id,objetivo_unidad_base,reserva_unidad_base,prioridad",
    )
    .eq("snapshot_id", snapshotId);
  ensureNoError(error);
  return ((data ?? []) as Array<
    Omit<NeedRecord, "objetivo_unidad_base" | "reserva_unidad_base"> & {
      objetivo_unidad_base: NumericValue;
      reserva_unidad_base: NumericValue;
    }
  >).map((row) => ({
    ...row,
    objetivo_unidad_base: numberValue(row.objetivo_unidad_base),
    reserva_unidad_base: numberValue(row.reserva_unidad_base),
  }));
}

async function listVolunteers(
  supabase: SupabaseClient,
  snapshotId: string,
): Promise<VolunteerRecord[]> {
  const { data, error } = await supabase
    .from("voluntarios")
    .select("snapshot_id,centro_id,disponibles,requeridos")
    .eq("snapshot_id", snapshotId);
  ensureNoError(error);
  return (data ?? []) as VolunteerRecord[];
}

async function listExpectedDonations(
  supabase: SupabaseClient,
  snapshotId: string,
): Promise<ExpectedDonationRecord[]> {
  const { data, error } = await supabase
    .from("donaciones_esperadas")
    .select(
      "snapshot_id,intencion_id,centro_id,sku_id,cantidad_paquetes,llegada_prevista,estado",
    )
    .eq("snapshot_id", snapshotId);
  ensureNoError(error);
  return (data ?? []) as ExpectedDonationRecord[];
}

export interface DashboardSource {
  snapshot: SnapshotRecord | null;
  centers: CenterRecord[];
  products: ProductRecord[];
  presentations: PresentationRecord[];
  inventory: InventoryRecord[];
  needs: NeedRecord[];
  volunteers: VolunteerRecord[];
  travelTimes: TravelTimeRecord[];
  expectedDonations: ExpectedDonationRecord[];
}

export async function getDashboardSource(
  supabase: SupabaseClient,
  snapshotId: string,
): Promise<DashboardSource> {
  const [
    snapshot,
    centers,
    products,
    presentations,
    inventory,
    needs,
    volunteers,
    travelTimes,
    expectedDonations,
  ] = await Promise.all([
    findSnapshot(supabase, snapshotId),
    listCenters(supabase, snapshotId),
    listProducts(supabase, snapshotId),
    listPresentations(supabase, snapshotId),
    listInventory(supabase, snapshotId),
    listNeeds(supabase, snapshotId),
    listVolunteers(supabase, snapshotId),
    listTravelTimes(supabase, snapshotId),
    listExpectedDonations(supabase, snapshotId),
  ]);

  return {
    snapshot,
    centers,
    products,
    presentations,
    inventory,
    needs,
    volunteers,
    travelTimes,
    expectedDonations,
  };
}

