import { NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  validateMutationOrigin,
} from "@/server/auth/session";

export async function POST(request: Request) {
  if (!validateMutationOrigin(request)) {
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
  return response;
}
