import { getDashboard } from "@/server/services/dashboard";
import {
  parseSnapshotId,
  successResponse,
  withAdministrator,
} from "@/server/services/http";

export async function GET(request: Request) {
  return withAdministrator(request, async () => {
    const snapshotId = parseSnapshotId(
      new URL(request.url).searchParams.get("snapshotId"),
    );
    const evaluatedAt = new Date().toISOString();
    const dashboard = await getDashboard(snapshotId, undefined, evaluatedAt);
    return successResponse(dashboard, {
      snapshot_id: snapshotId,
      evaluado_en: evaluatedAt,
    });
  });
}

