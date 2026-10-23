import {
  isAuthSessionMissingError,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import { ApiError } from "@/server/services/errors";
import { createServerSupabaseClient } from "@/server/db/supabase-server";

export interface AdministratorContext {
  supabase: SupabaseClient;
  user: User;
}

export async function requireAdministrator(): Promise<AdministratorContext> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user) {
    if (
      !userError ||
      isAuthSessionMissingError(userError) ||
      userError.status === 401
    ) {
      throw new ApiError(401, "UNAUTHENTICATED", "Se requiere iniciar sesión.");
    }

    throw new ApiError(
      500,
      "AUTH_SERVICE_ERROR",
      "No fue posible verificar la sesión.",
    );
  }

  const { data: administrator, error: administratorError } = await supabase
    .from("administradores")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (administratorError) {
    throw new ApiError(
      500,
      "DATABASE_ERROR",
      "No fue posible verificar la autorización.",
    );
  }

  if (!administrator) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "El usuario no está autorizado como administrador.",
    );
  }

  return { supabase, user };
}

