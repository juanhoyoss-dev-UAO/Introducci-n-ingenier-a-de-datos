import { NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  validateMutationOrigin,
} from "@/server/auth/session";
import { serverLog } from "@/server/observability/request-context";
import { withHttpRequest } from "@/server/services/http";

async function handleLogout(request: Request) {
  if (!validateMutationOrigin(request)) {
    serverLog("WARN", "AUTH", "Cierre de sesión rechazado", {
      reason: "invalid_origin",
    });
    return NextResponse.json(
      {
        error: {
          code: "INVALID_ORIGIN",
          message: "El origen de la solicitud no está autorizado.",
        },
      },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const response = NextResponse.json(
    { data: { authenticated: false }, meta: {} },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(
    SESSION_COOKIE_NAME,
    "",
    sessionCookieOptions(request, 0),
  );
  serverLog("OK", "AUTH", "Sesión cerrada");
  return response;
}

export function POST(request: Request) {
  return withHttpRequest(request, "AUTH", () => handleLogout(request));
}
