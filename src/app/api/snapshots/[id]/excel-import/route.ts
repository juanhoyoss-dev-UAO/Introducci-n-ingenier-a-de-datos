import { snapshotIdSchema } from "@/contracts/schemas/queries";
import { validateMutationOrigin } from "@/server/auth/session";
import { setRequestSnapshot } from "@/server/observability/request-context";
import { ApiError } from "@/server/services/errors";
import { importExcelReceptions } from "@/server/services/excel-reception-imports";
import { readReceptionUpload } from "@/server/services/excel-upload";
import { successResponse, withAdministrator } from "@/server/services/http";

interface Context { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  return withAdministrator(request, async () => {
    if (!validateMutationOrigin(request)) {
      throw new ApiError(403, "INVALID_ORIGIN", "El origen de la solicitud no está autorizado.");
    }
    const { id } = await context.params;
    const parsed = snapshotIdSchema.safeParse(id);
    if (!parsed.success) throw new ApiError(400, "INVALID_SNAPSHOT_ID", "El snapshot no es válido.");
    setRequestSnapshot(parsed.data);
    const upload = await readReceptionUpload(request);
    const result = await importExcelReceptions(parsed.data, upload.bytes, upload.fileName);
    return successResponse(result, {
      snapshot_id: result.snapshot.id,
      source_snapshot_id: result.source_snapshot_id,
      idempotent: result.idempotent,
    });
  });
}
