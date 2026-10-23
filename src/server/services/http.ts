import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type {
  ErrorResponse,
  SuccessResponse,
} from "@/contracts/types/api";
import { validateSnapshotId } from "@/contracts/schemas/queries";
import { requireAdministrator } from "@/server/auth/require-admin";
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

export async function withAdministrator(
  action: (supabase: SupabaseClient) => Promise<NextResponse>,
) {
  try {
    const { supabase } = await requireAdministrator();
    return await action(supabase);
  } catch (error) {
    return errorResponse(error);
  }
}

