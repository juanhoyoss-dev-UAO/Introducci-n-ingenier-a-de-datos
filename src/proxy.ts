import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSession } from "@/server/auth/update-session";

export async function proxy(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch {
    // El Route Handler vuelve a verificar la sesión y normaliza el error.
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: ["/api/((?!health$).*)"],
};

