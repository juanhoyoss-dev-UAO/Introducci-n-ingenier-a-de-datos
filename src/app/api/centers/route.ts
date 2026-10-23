import { getCenters } from "@/server/services/operations";
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
    const centers = await getCenters(supabase, snapshotId);
    return successResponse(centers, {
      snapshot_id: snapshotId,
      total: centers.length,
    });
  });
}

