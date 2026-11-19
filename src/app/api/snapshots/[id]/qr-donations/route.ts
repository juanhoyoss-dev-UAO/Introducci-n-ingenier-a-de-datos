import { snapshotIdSchema } from "@/contracts/schemas/queries";
import { validateMutationOrigin } from "@/server/auth/session";
import { setRequestSnapshot } from "@/server/observability/request-context";
import { ApiError } from "@/server/services/errors";
import { successResponse, withAdministrator } from "@/server/services/http";
import {
  applyQrDonationOperation,
  getQrDonationModule,
} from "@/server/services/qr-donations";

interface Context {
  params: Promise<{ id: string }>;
}

async function parseId(context: Context) {
  const { id } = await context.params;
  const parsed = snapshotIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError(400, "INVALID_SNAPSHOT_ID", "El snapshot no es válido.");
  }
  setRequestSnapshot(parsed.data);
  return parsed.data;
}

export async function GET(request: Request, context: Context) {
  return withAdministrator(request, async () => {
    const snapshotId = await parseId(context);
    return successResponse(await getQrDonationModule(snapshotId), {
      snapshot_id: snapshotId,
    });
  });
}

export async function POST(request: Request, context: Context) {
  return withAdministrator(request, async () => {
    if (!validateMutationOrigin(request)) {
      throw new ApiError(403, "INVALID_ORIGIN", "El origen no está autorizado.");
    }
    const snapshotId = await parseId(context);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "INVALID_REQUEST", "La solicitud no contiene JSON válido.");
    }
    const result = await applyQrDonationOperation(snapshotId, body);
    return successResponse(result, {
      snapshot_id: result.snapshot.id,
      source_snapshot_id: result.source_snapshot_id,
      idempotent: result.idempotent,
    });
  });
}
