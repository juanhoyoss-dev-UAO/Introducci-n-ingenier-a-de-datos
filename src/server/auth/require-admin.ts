import { cookies } from "next/headers";

import { ApiError } from "@/server/services/errors";
import { getAuthConfiguration } from "./config";
import {
  SESSION_COOKIE_NAME,
  type SessionClaims,
  verifySessionToken,
} from "./session";

export interface AdministratorContext {
  username: string;
  role: "admin";
  session: SessionClaims;
}

export async function requireAdministrator(): Promise<AdministratorContext> {
  const configuration = getAuthConfiguration();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token
    ? verifySessionToken(token, configuration.sessionSecret)
    : null;

  if (!session) {
    throw new ApiError(401, "UNAUTHENTICATED", "Se requiere iniciar sesión.");
  }

  if (
    session.role !== "admin" ||
    session.sub !== configuration.administratorUsername
  ) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "El usuario no está autorizado como administrador.",
    );
  }

  return {
    username: session.sub,
    role: "admin",
    session,
  };
}

