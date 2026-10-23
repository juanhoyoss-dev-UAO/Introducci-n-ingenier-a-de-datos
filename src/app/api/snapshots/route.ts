import { getSnapshots } from "@/server/services/operations";
import { successResponse, withAdministrator } from "@/server/services/http";

export async function GET() {
  return withAdministrator(async () => {
    const snapshots = await getSnapshots();
    return successResponse(snapshots, { total: snapshots.length });
  });
}

