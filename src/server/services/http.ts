import { NextResponse } from "next/server";

import type {
  ErrorResponse,
  SuccessResponse,
} from "@/contracts/types/api";
import { validateSnapshotId } from "@/contracts/schemas/queries";
import type { LogModule } from "@/lib/logger";
import { requireAdministrator } from "@/server/auth/require-admin";
import {
  getRequestId,
  runWithRequestContext,
  serverLog,
  setRequestSnapshot,
} from "@/server/observability/request-context";
import { ApiError, RepositoryError } from "./errors";

export function successResponse<T>(
  data: T,
  meta: Record<string, unknown> = {},
) {
  return NextResponse.json<SuccessResponse<T>>({ data, meta }, { status: 200 });
}

export function parseSnapshotId(value: string | null): string {
  if (!value) {
    throw new ApiError(
      400,
      "MISSING_SNAPSHOT_ID",
      "El parámetro snapshotId es obligatorio.",
    );
  }

  const result = validateSnapshotId(value);
  if (!result.success) {
    throw new ApiError(
      400,
      "INVALID_SNAPSHOT_ID",
      "El parámetro snapshotId debe ser un UUID válido.",
      result.error.flatten(),
    );
  }

  setRequestSnapshot(result.data);
  return result.data;
}

function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof RepositoryError) {
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: "DATABASE_ERROR",
          message: "No fue posible consultar la base de datos.",
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json<ErrorResponse>(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Ocurrió un error inesperado.",
      },
    },
    { status: 500 },
  );
}

function durationSince(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

export async function withHttpRequest(
  request: Request,
  module: LogModule,
  action: () => Promise<NextResponse>,
) {
  return runWithRequestContext(request, async () => {
    const startedAt = performance.now();
    serverLog("INFO", module, "Petición recibida");

    try {
      const response = await action();
      const requestId = getRequestId();
      if (requestId) {
        response.headers.set("X-Request-Id", requestId);
      }

      const level =
        response.status >= 500
          ? "ERROR"
          : response.status >= 400
            ? "WARN"
            : "OK";
      serverLog(level, module, "Petición completada", {
        durationMs: durationSince(startedAt),
        result: response.ok ? "ok" : "error",
        status: response.status,
      });
      return response;
    } catch (error) {
      const response = errorResponse(error);
      const requestId = getRequestId();
      if (requestId) {
        response.headers.set("X-Request-Id", requestId);
      }
      serverLog("ERROR", module, "Petición fallida", {
        durationMs: durationSince(startedAt),
        result: "error",
        status: response.status,
      });
      return response;
    }
  });
}

export async function withAdministrator(
  request: Request,
  action: () => Promise<NextResponse>,
) {
  return withHttpRequest(request, "API", async () => {
    try {
      await requireAdministrator();
      return await action();
    } catch (error) {
      return errorResponse(error);
    }
  });
}

