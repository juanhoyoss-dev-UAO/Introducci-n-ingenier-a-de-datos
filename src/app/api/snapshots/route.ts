import { getSnapshots } from "@/server/services/operations";
import { successResponse, withAdministrator } from "@/server/services/http";

export async function GET() {
  return withAdministrator(async (supabase) => {
    const snapshots = await getSnapshots(supabase);
    return successResponse(snapshots, { total: snapshots.length });
  });
}

