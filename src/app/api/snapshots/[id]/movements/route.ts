import { snapshotIdSchema } from "@/contracts/schemas/queries";
import { validateMutationOrigin } from "@/server/auth/session";
import { setRequestSnapshot } from "@/server/observability/request-context";
import { ApiError } from "@/server/services/errors";
import { successResponse, withAdministrator } from "@/server/services/http";
import {
  applyMovementOperation,
  getMovementHistory,
} from "@/server/services/movement-operations";

interface MovementsRouteContext {
  params: Promise<{ id: string }>;
}

async function parseSnapshotId(context: MovementsRouteContext) {
  const { id } = await context.params;
  const parsed = snapshotIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(
      400,
      "INVALID_SNAPSHOT_ID",
      "El identificador del snapshot debe ser un UUID válido.",
      parsed.error.flatten(),
    );
  }
  setRequestSnapshot(parsed.data);
  return parsed.data;
}

export async function GET(request: Request, context: MovementsRouteContext) {
  return withAdministrator(request, async () => {
    const snapshotId = await parseSnapshotId(context);
    const search = new URL(request.url).searchParams;
    const movements = await getMovementHistory(snapshotId, {
      centro_id: search.get("centroId") || undefined,
      desde: search.get("desde") || undefined,
      hasta: search.get("hasta") || undefined,
    });
    return successResponse(movements, {
      snapshot_id: snapshotId,
      total: movements.length,
    });
  });
}

export async function POST(request: Request, context: MovementsRouteContext) {
  return withAdministrator(request, async () => {
    if (!validateMutationOrigin(request)) {
      throw new ApiError(
        403,
        "INVALID_ORIGIN",
        "El origen de la solicitud no está autorizado.",
      );
    }
    const snapshotId = await parseSnapshotId(context);
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
    const result = await applyMovementOperation(snapshotId, body);
    return successResponse(result, {
      snapshot_id: result.snapshot.id,
      source_snapshot_id: result.source_snapshot_id,
      idempotent: result.idempotent,
    });
  });
}
