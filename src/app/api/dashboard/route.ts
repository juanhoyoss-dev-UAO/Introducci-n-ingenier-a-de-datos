import { getDashboard } from "@/server/services/dashboard";
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
    const dashboard = await getDashboard(supabase, snapshotId);
    return successResponse(dashboard, { snapshot_id: snapshotId });
  });
}

