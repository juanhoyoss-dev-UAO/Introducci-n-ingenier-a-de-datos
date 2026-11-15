import { snapshotIdSchema } from "@/contracts/schemas/queries";
import { validateMutationOrigin } from "@/server/auth/session";
import { setRequestSnapshot } from "@/server/observability/request-context";
import { ApiError } from "@/server/services/errors";
import { successResponse, withAdministrator } from "@/server/services/http";
import { applyOperationalUpdate } from "@/server/services/operational-updates";

interface OperationsRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: OperationsRouteContext) {
  return withAdministrator(request, async () => {
    if (!validateMutationOrigin(request)) {
      throw new ApiError(
        403,
        "INVALID_ORIGIN",
        "El origen de la solicitud no está autorizado.",
      );
    }

    const { id } = await context.params;
    const parsedId = snapshotIdSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiError(
        400,
        "INVALID_SNAPSHOT_ID",
        "El identificador del snapshot debe ser un UUID válido.",
        parsedId.error.flatten(),
      );
    }
    setRequestSnapshot(parsedId.data);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(
        400,
        "INVALID_REQUEST",
        "La solicitud no contiene JSON válido.",
      );
    }

    const result = await applyOperationalUpdate(parsedId.data, body);
    return successResponse(result, {
      snapshot_id: result.snapshot.id,
      source_snapshot_id: result.source_snapshot_id,
    });
  });
}
