import { snapshotIdSchema } from "@/contracts/schemas/queries";
import { setRequestSnapshot } from "@/server/observability/request-context";
import { ApiError } from "@/server/services/errors";
import { successResponse, withAdministrator } from "@/server/services/http";
import { getTemporalAnalysis } from "@/server/services/temporal";

interface TemporalRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: TemporalRouteContext) {
  return withAdministrator(request, async () => {
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
    const search = new URL(request.url).searchParams;
    const cutoff = search.get("corte") || new Date().toISOString();
    const result = await getTemporalAnalysis(parsedId.data, {
      escenario_id: search.get("escenarioId") || undefined,
      centro_id: search.get("centroId") || undefined,
      producto_id: search.get("productoId") || undefined,
      desde: search.get("desde") || undefined,
      hasta: search.get("hasta") || undefined,
      corte: cutoff,
      perspectiva: search.get("perspectiva") || undefined,
    });
    return successResponse(result, {
      snapshot_id: parsedId.data,
      escenario_id: result.referencia.escenario_id,
      perspectiva: result.perspectiva,
      corte: result.corte,
    });
  });
}
