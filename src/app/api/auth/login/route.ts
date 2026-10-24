import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthConfiguration } from "@/server/auth/config";
import {
  constantTimeTextEqual,
  verifyPassword,
} from "@/server/auth/password";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  signSessionToken,
  validateMutationOrigin,
} from "@/server/auth/session";
import { serverLog } from "@/server/observability/request-context";
import { withHttpRequest } from "@/server/services/http";

const loginRequestSchema = z
  .object({
    username: z.string().min(1).max(128),
    password: z.string().min(1).max(1_024),
  })
  .strict();

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function handleLogin(request: Request) {
  if (!validateMutationOrigin(request)) {
    serverLog("WARN", "AUTH", "Inicio de sesión rechazado", {
      reason: "invalid_origin",
    });
    return errorResponse(
      403,
      "INVALID_ORIGIN",
      "El origen de la solicitud no está autorizado.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    serverLog("WARN", "AUTH", "Inicio de sesión rechazado", {
      reason: "invalid_request",
    });
    return errorResponse(400, "INVALID_REQUEST", "La solicitud no es válida.");
  }

  const parsedBody = loginRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    serverLog("WARN", "AUTH", "Inicio de sesión rechazado", {
      reason: "invalid_request",
    });
    return errorResponse(400, "INVALID_REQUEST", "La solicitud no es válida.");
  }

  try {
    const configuration = getAuthConfiguration();
    const passwordIsValid = await verifyPassword(
      parsedBody.data.password,
      configuration.administratorPasswordHash,
    );
    const usernameIsValid = constantTimeTextEqual(
      parsedBody.data.username,
      configuration.administratorUsername,
    );

    if (!passwordIsValid || !usernameIsValid) {
      serverLog("WARN", "AUTH", "Inicio de sesión rechazado", {
        reason: "invalid_credentials",
      });
      return errorResponse(
        401,
        "INVALID_CREDENTIALS",
        "El usuario o la contraseña no son válidos.",
      );
    }

    const { token, claims } = signSessionToken(
      {
        username: configuration.administratorUsername,
        role: "admin",
      },
      configuration.sessionSecret,
    );
    const response = NextResponse.json(
      {
        data: {
          authenticated: true,
          user: { username: claims.sub, role: claims.role },
          expires_at: new Date(claims.exp * 1000).toISOString(),
        },
        meta: {},
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(
      SESSION_COOKIE_NAME,
      token,
      sessionCookieOptions(request, claims.exp),
    );
    serverLog("OK", "AUTH", "Inicio de sesión aceptado", {
      role: claims.role,
    });
    return response;
  } catch {
    serverLog("ERROR", "AUTH", "Autenticación no disponible", {
      errorCode: "AUTH_CONFIGURATION_ERROR",
    });
    return errorResponse(
      500,
      "AUTH_CONFIGURATION_ERROR",
      "La autenticación local no está disponible.",
    );
  }
}

export function POST(request: Request) {
  return withHttpRequest(request, "AUTH", () => handleLogin(request));
}
