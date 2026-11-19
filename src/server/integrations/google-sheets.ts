import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { ApiError } from "@/server/services/errors";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_READ_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";
const DEFAULT_SYNC_INTERVAL_MS = 45_000;
const MIN_SYNC_INTERVAL_MS = 30_000;
const MAX_SYNC_INTERVAL_MS = 60_000;

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

export interface GoogleDonationSheetsConfiguration {
  spreadsheetId: string;
  range: string;
  credentialsFile: string;
  syncIntervalMs: number;
}

interface AccessTokenCache {
  key: string;
  token: string;
  expiresAt: number;
}

let accessTokenCache: AccessTokenCache | null = null;

function requiredValue(environment: NodeJS.ProcessEnv, name: string) {
  return environment[name]?.trim() ?? "";
}

function syncInterval(environment: NodeJS.ProcessEnv) {
  const raw = requiredValue(environment, "GOOGLE_DONATIONS_SYNC_INTERVAL_MS");
  if (!raw) return DEFAULT_SYNC_INTERVAL_MS;
  const value = Number(raw);
  return Number.isInteger(value) &&
    value >= MIN_SYNC_INTERVAL_MS &&
    value <= MAX_SYNC_INTERVAL_MS
    ? value
    : DEFAULT_SYNC_INTERVAL_MS;
}

export function getGoogleDonationSheetsConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
  projectRoot = process.cwd(),
): GoogleDonationSheetsConfiguration | null {
  const spreadsheetId = requiredValue(
    environment,
    "GOOGLE_DONATIONS_SPREADSHEET_ID",
  );
  const range = requiredValue(environment, "GOOGLE_DONATIONS_SHEET_RANGE");
  const credentialsFile = requiredValue(
    environment,
    "GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_FILE",
  );
  if (!spreadsheetId || !range || !credentialsFile) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(spreadsheetId)) return null;

  const resolvedCredentials = path.resolve(credentialsFile);
  const resolvedProject = path.resolve(projectRoot);
  if (
    !path.isAbsolute(credentialsFile) ||
    resolvedCredentials === resolvedProject ||
    resolvedCredentials.startsWith(`${resolvedProject}${path.sep}`)
  ) {
    return null;
  }

  return {
    spreadsheetId,
    range,
    credentialsFile: resolvedCredentials,
    syncIntervalMs: syncInterval(environment),
  };
}

export function isGoogleDonationIntegrationConfigured(
  environment: NodeJS.ProcessEnv = process.env,
  projectRoot = process.cwd(),
) {
  return getGoogleDonationSheetsConfiguration(environment, projectRoot) !== null;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function parseCredentials(input: string): ServiceAccountCredentials {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new ApiError(
      503,
      "GOOGLE_CREDENTIALS_INVALID",
      "El archivo de credenciales de Google no contiene JSON válido.",
    );
  }
  if (
    !value ||
    typeof value !== "object" ||
    !("client_email" in value) ||
    !("private_key" in value) ||
    typeof value.client_email !== "string" ||
    typeof value.private_key !== "string" ||
    !value.client_email.trim() ||
    !value.private_key.includes("PRIVATE KEY")
  ) {
    throw new ApiError(
      503,
      "GOOGLE_CREDENTIALS_INVALID",
      "El archivo de credenciales de Google no corresponde a una cuenta de servicio válida.",
    );
  }
  return {
    client_email: value.client_email.trim(),
    private_key: value.private_key.replace(/\\n/g, "\n"),
  };
}

async function accessToken(
  credentials: ServiceAccountCredentials,
  fetchImplementation: typeof fetch,
  now = new Date(),
) {
  const cacheKey = `${credentials.client_email}:${GOOGLE_SHEETS_READ_SCOPE}`;
  if (
    accessTokenCache?.key === cacheKey &&
    accessTokenCache.expiresAt > now.getTime() + 60_000
  ) {
    return accessTokenCache.token;
  }

  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: GOOGLE_SHEETS_READ_SCOPE,
      aud: GOOGLE_TOKEN_ENDPOINT,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${base64Url(
    signer.sign(credentials.private_key),
  )}`;
  const response = await fetchImplementation(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    access_token?: unknown;
    expires_in?: unknown;
  } | null;
  if (
    !response.ok ||
    typeof body?.access_token !== "string" ||
    typeof body.expires_in !== "number"
  ) {
    throw new ApiError(
      502,
      "GOOGLE_AUTHENTICATION_FAILED",
      "Google rechazó la autenticación de la cuenta de servicio.",
    );
  }
  accessTokenCache = {
    key: cacheKey,
    token: body.access_token,
    expiresAt: now.getTime() + body.expires_in * 1000,
  };
  return body.access_token;
}

export async function readGoogleDonationSheetRows({
  environment = process.env,
  fetchImplementation = fetch,
  readFileImplementation = readFile,
  projectRoot = process.cwd(),
}: {
  environment?: NodeJS.ProcessEnv;
  fetchImplementation?: typeof fetch;
  readFileImplementation?: typeof readFile;
  projectRoot?: string;
} = {}): Promise<string[][]> {
  const configuration = getGoogleDonationSheetsConfiguration(
    environment,
    projectRoot,
  );
  if (!configuration) {
    throw new ApiError(
      503,
      "GOOGLE_INTEGRATION_NOT_CONFIGURED",
      "La integración con Google está pendiente de configuración.",
    );
  }

  let credentialsText: string;
  try {
    credentialsText = await readFileImplementation(
      configuration.credentialsFile,
      "utf8",
    );
  } catch {
    throw new ApiError(
      503,
      "GOOGLE_CREDENTIALS_UNAVAILABLE",
      "No fue posible leer las credenciales de Google fuera del repositorio.",
    );
  }
  const credentials = parseCredentials(credentialsText);
  const token = await accessToken(credentials, fetchImplementation);
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${configuration.spreadsheetId}/values/${encodeURIComponent(configuration.range)}`,
  );
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");
  const response = await fetchImplementation(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as {
    values?: unknown;
  } | null;
  if (!response.ok || !Array.isArray(body?.values)) {
    throw new ApiError(
      502,
      "GOOGLE_SHEETS_READ_FAILED",
      "No fue posible leer las respuestas autorizadas de Google Sheets.",
    );
  }
  return body.values.map((row) =>
    Array.isArray(row)
      ? row.map((value) => (value === null || value === undefined ? "" : String(value)))
      : [],
  );
}

export function googleDonationSyncInterval(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return syncInterval(environment);
}
