import { describe, expect, it } from "vitest";

import {
  PasswordHashConfigurationError,
  createPasswordHash,
  verifyPassword,
} from "@/server/auth/password";
import {
  SESSION_DURATION_SECONDS,
  sessionCookieOptions,
  signSessionToken,
  validateMutationOrigin,
  verifySessionToken,
} from "@/server/auth/session";

const SESSION_SECRET = "test-session-secret-with-at-least-32-bytes";

describe("autenticación local", () => {
  it("genera hashes scrypt con sal aleatoria y verifica la contraseña", async () => {
    const firstHash = await createPasswordHash("correct horse battery staple");
    const secondHash = await createPasswordHash("correct horse battery staple");

    expect(firstHash).not.toBe(secondHash);
    await expect(
      verifyPassword("correct horse battery staple", firstHash),
    ).resolves.toBe(true);
    await expect(verifyPassword("contraseña incorrecta", firstHash)).resolves.toBe(
      false,
    );
  });

  it("rechaza hashes que no respetan el formato versionado", async () => {
    await expect(verifyPassword("cualquiera", "hash-inválido")).rejects.toBeInstanceOf(
      PasswordHashConfigurationError,
    );
  });

  it("firma y verifica una sesión administrativa dentro de su vigencia", () => {
    const issuedAt = 1_800_000_000;
    const { token } = signSessionToken(
      { username: "admin", role: "admin", issuedAt },
      SESSION_SECRET,
    );

    expect(verifySessionToken(token, SESSION_SECRET, issuedAt + 1)).toMatchObject({
      sub: "admin",
      role: "admin",
      iat: issuedAt,
      exp: issuedAt + SESSION_DURATION_SECONDS,
    });
  });

  it("rechaza sesión alterada, con otra clave, vencida o con vida excesiva", () => {
    const issuedAt = 1_800_000_000;
    const valid = signSessionToken(
      { username: "admin", role: "admin", issuedAt },
      SESSION_SECRET,
    ).token;
    const altered = `${valid.slice(0, -1)}${valid.endsWith("a") ? "b" : "a"}`;
    const [payload, signature] = valid.split(".");
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const finalIndex = alphabet.indexOf(signature.at(-1) ?? "");
    const nonCanonicalSignature = `${signature.slice(0, -1)}${alphabet[finalIndex + 1]}`;
    const nonCanonical = `${payload}.${nonCanonicalSignature}`;
    const expired = signSessionToken(
      {
        username: "admin",
        role: "admin",
        issuedAt: issuedAt - 10,
        expiresAt: issuedAt - 1,
      },
      SESSION_SECRET,
    ).token;
    const excessive = signSessionToken(
      {
        username: "admin",
        role: "admin",
        issuedAt,
        expiresAt: issuedAt + SESSION_DURATION_SECONDS + 1,
      },
      SESSION_SECRET,
    ).token;

    expect(verifySessionToken(altered, SESSION_SECRET, issuedAt + 1)).toBeNull();
    expect(
      Buffer.from(nonCanonicalSignature, "base64url").equals(
        Buffer.from(signature, "base64url"),
      ),
    ).toBe(true);
    expect(
      verifySessionToken(nonCanonical, SESSION_SECRET, issuedAt + 1),
    ).toBeNull();
    expect(
      verifySessionToken(valid, "different-test-secret-with-at-least-32-bytes", issuedAt + 1),
    ).toBeNull();
    expect(verifySessionToken(expired, SESSION_SECRET, issuedAt)).toBeNull();
    expect(verifySessionToken(excessive, SESSION_SECRET, issuedAt)).toBeNull();
  });

  it("configura cookie segura solo cuando la petición usa HTTPS", () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const httpOptions = sessionCookieOptions(
      new Request("http://127.0.0.1:3000/api/auth/login"),
      expiresAt,
    );
    const httpsOptions = sessionCookieOptions(
      new Request("https://example.test/api/auth/login"),
      expiresAt,
    );

    expect(httpOptions).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    expect(httpsOptions.secure).toBe(true);
  });

  it("acepta únicamente el Origin exacto en mutaciones de sesión", () => {
    expect(
      validateMutationOrigin(
        new Request("http://127.0.0.1:3000/api/auth/login", {
          method: "POST",
          headers: {
            Host: "127.0.0.1:3000",
            Origin: "http://127.0.0.1:3000",
          },
        }),
      ),
    ).toBe(true);
    expect(
      validateMutationOrigin(
        new Request("http://127.0.0.1:3000/api/auth/login", {
          method: "POST",
          headers: {
            Host: "127.0.0.1:3000",
            Origin: "https://attacker.test",
          },
        }),
      ),
    ).toBe(false);
    expect(
      validateMutationOrigin(
        new Request("http://127.0.0.1:3000/api/auth/login", {
          method: "POST",
        }),
      ),
    ).toBe(false);
  });
});
