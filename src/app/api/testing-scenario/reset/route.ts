import { validateMutationOrigin } from "@/server/auth/session";
import { ApiError } from "@/server/services/errors";
import { successResponse, withAdministrator } from "@/server/services/http";
import { resetTestingScenario } from "@/server/services/testing-scenario";

export async function POST(request: Request) {
  return withAdministrator(request, async () => {
    if (!validateMutationOrigin(request)) {
      throw new ApiError(403, "INVALID_ORIGIN", "El origen de la solicitud no está autorizado.");
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "INVALID_REQUEST", "La solicitud no contiene JSON válido.");
    }
    const result = await resetTestingScenario(body);
    return successResponse(result, {
      snapshot_id: result.snapshot.id,
      source_snapshot_id: result.source_snapshot_id,
      idempotent: result.idempotent,
    });
  });
}
