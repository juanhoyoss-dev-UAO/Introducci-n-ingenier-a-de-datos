import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuthConfiguration } from "@/server/auth/config";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/server/auth/session";
import { serverLog } from "@/server/observability/request-context";
import { withHttpRequest } from "@/server/services/http";

async function handleSessionStatus() {
  try {
    const configuration = getAuthConfiguration();
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = token
      ? verifySessionToken(token, configuration.sessionSecret)
      : null;

    const response = NextResponse.json(
      {
        data: session
          ? {
              authenticated: true,
              user: { username: session.sub, role: session.role },
              expires_at: new Date(session.exp * 1000).toISOString(),
            }
          : { authenticated: false, user: null },
        meta: {},
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
    serverLog("OK", "AUTH", "Estado de sesión consultado", {
      authenticated: Boolean(session),
    });
    return response;
  } catch {
    serverLog("ERROR", "AUTH", "Estado de sesión no disponible", {
      errorCode: "AUTH_CONFIGURATION_ERROR",
    });
    return NextResponse.json(
      {
        error: {
          code: "AUTH_CONFIGURATION_ERROR",
          message: "La autenticación local no está disponible.",
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export function GET(request: Request) {
  return withHttpRequest(request, "AUTH", handleSessionStatus);
}
