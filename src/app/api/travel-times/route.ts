import { getTravelTimes } from "@/server/services/operations";
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
    const travelTimes = await getTravelTimes(supabase, snapshotId);
    return successResponse(travelTimes, {
      snapshot_id: snapshotId,
      total: travelTimes.length,
    });
  });
}

