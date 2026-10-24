import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "redes_ayuda_session";
export const SESSION_DURATION_SECONDS = 4 * 60 * 60;

export type SessionRole = "admin" | "viewer";

export interface SessionClaims {
  v: 1;
  sub: string;
  role: SessionRole;
  iat: number;
  exp: number;
}

interface SessionInput {
  username: string;
  role: SessionRole;
  issuedAt?: number;
  expiresAt?: number;
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest();
}

function isSessionClaims(value: unknown): value is SessionClaims {
  if (!value || typeof value !== "object") {
    return false;
  }
  const claims = value as Record<string, unknown>;
  return (
    Object.keys(claims).length === 5 &&
    claims.v === 1 &&
    typeof claims.sub === "string" &&
    claims.sub.length > 0 &&
    claims.sub.length <= 128 &&
    (claims.role === "admin" || claims.role === "viewer") &&
    Number.isSafeInteger(claims.iat) &&
    Number.isSafeInteger(claims.exp)
  );
}

export function signSessionToken(input: SessionInput, secret: string) {
  const issuedAt = input.issuedAt ?? Math.floor(Date.now() / 1000);
  const expiresAt = input.expiresAt ?? issuedAt + SESSION_DURATION_SECONDS;
  const claims: SessionClaims = {
    v: 1,
    sub: input.username,
    role: input.role,
    iat: issuedAt,
    exp: expiresAt,
  };
  const encodedPayload = Buffer.from(JSON.stringify(claims), "utf8").toString(
    "base64url",
  );
  const signature = signPayload(encodedPayload, secret).toString("base64url");
  return { token: `${encodedPayload}.${signature}`, claims };
}

export function verifySessionToken(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): SessionClaims | null {
  try {
    if (token.length > 2_048) {
      return null;
    }
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }
    const [encodedPayload, encodedSignature] = parts;
    if (
      !/^[A-Za-z0-9_-]+$/.test(encodedPayload) ||
      !/^[A-Za-z0-9_-]+$/.test(encodedSignature)
    ) {
      return null;
    }

    const receivedSignature = Buffer.from(encodedSignature, "base64url");
    if (receivedSignature.toString("base64url") !== encodedSignature) {
      return null;
    }
    const expectedSignature = signPayload(encodedPayload, secret);
    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      return null;
    }

    const decodedPayload = Buffer.from(encodedPayload, "base64url");
    if (decodedPayload.toString("base64url") !== encodedPayload) {
      return null;
    }
    const claims: unknown = JSON.parse(decodedPayload.toString("utf8"));
    if (!isSessionClaims(claims)) {
      return null;
    }
    if (
      claims.iat > now + 60 ||
      claims.exp <= now ||
      claims.exp <= claims.iat ||
      claims.exp - claims.iat > SESSION_DURATION_SECONDS
    ) {
      return null;
    }

    return claims;
  } catch {
    return null;
  }
}

export function isHttpsRequest(request: Request) {
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",", 1)[0]
    ?.trim()
    .toLowerCase();
  return (
    forwardedProtocol === "https" || new URL(request.url).protocol === "https:"
  );
}

export function sessionCookieOptions(request: Request, expiresAt: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttpsRequest(request),
    path: "/",
    expires: new Date(expiresAt * 1000),
    maxAge: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
  };
}

export function validateMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) {
    return false;
  }
  try {
    const forwardedProtocol = request.headers
      .get("x-forwarded-proto")
      ?.split(",", 1)[0]
      ?.trim()
      .toLowerCase();
    const protocol =
      forwardedProtocol === "http" || forwardedProtocol === "https"
        ? `${forwardedProtocol}:`
        : new URL(request.url).protocol;
    const expectedUrl = new URL(`${protocol}//${host}`);
    if (expectedUrl.host !== host) {
      return false;
    }
    return new URL(origin).origin === expectedUrl.origin;
  } catch {
    return false;
  }
}
