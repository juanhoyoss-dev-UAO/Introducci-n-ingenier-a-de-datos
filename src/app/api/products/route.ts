import { getProducts } from "@/server/services/operations";
import {
  parseSnapshotId,
  successResponse,
  withAdministrator,
} from "@/server/services/http";

export async function GET(request: Request) {
  return withAdministrator(async (supabase) => {
    const snapshotId = parseSnapshotId(
      new URL(request.url).searchParams.get("snapshotId"),
    );
    const products = await getProducts(supabase, snapshotId);
    return successResponse(products, {
      snapshot_id: snapshotId,
      total: products.length,
    });
  });
}

