import { snapshotIdSchema } from "@/contracts/schemas/queries";
import { setRequestSnapshot } from "@/server/observability/request-context";
import { ApiError } from "@/server/services/errors";
import { getSnapshot } from "@/server/services/operations";
import { successResponse, withAdministrator } from "@/server/services/http";

interface SnapshotRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: Request,
  context: SnapshotRouteContext,
) {
  return withAdministrator(request, async () => {
    const { id } = await context.params;
    const result = snapshotIdSchema.safeParse(id);
    if (!result.success) {
      throw new ApiError(
        400,
        "INVALID_SNAPSHOT_ID",
        "El identificador del snapshot debe ser un UUID válido.",
        result.error.flatten(),
      );
    }

    setRequestSnapshot(result.data);
    const snapshot = await getSnapshot(result.data);
    return successResponse(snapshot);
  });
}

