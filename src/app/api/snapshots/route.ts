import { getSnapshots } from "@/server/services/operations";
import { successResponse, withAdministrator } from "@/server/services/http";

export async function GET(request: Request) {
  return withAdministrator(request, async () => {
    const snapshots = await getSnapshots();
    return successResponse(snapshots, { total: snapshots.length });
  });
}

