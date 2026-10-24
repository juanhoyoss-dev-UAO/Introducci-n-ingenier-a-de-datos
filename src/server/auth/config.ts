import { assertValidPasswordHash } from "./password";

export class AuthConfigurationError extends Error {
  constructor() {
    super("La autenticación local no está configurada correctamente.");
    this.name = "AuthConfigurationError";
  }
}

export interface AuthConfiguration {
  administratorUsername: string;
  administratorPasswordHash: string;
  sessionSecret: string;
}

function requireEnvironmentValue(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new AuthConfigurationError();
  }
  return value;
}

export function getAuthConfiguration(): AuthConfiguration {
  const administratorUsername = requireEnvironmentValue("ADMIN_USERNAME");
  const administratorPasswordHash = requireEnvironmentValue(
    "ADMIN_PASSWORD_HASH",
  );
  const sessionSecret = requireEnvironmentValue("SESSION_SECRET");

  if (
    administratorUsername.length > 128 ||
    Buffer.byteLength(sessionSecret, "utf8") < 32
  ) {
    throw new AuthConfigurationError();
  }

  try {
    assertValidPasswordHash(administratorPasswordHash);
  } catch {
    throw new AuthConfigurationError();
  }

  return {
    administratorUsername,
    administratorPasswordHash,
    sessionSecret,
  };
}
