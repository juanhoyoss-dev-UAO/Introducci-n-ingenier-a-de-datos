import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getGoogleDonationSheetsConfiguration,
  isGoogleDonationIntegrationConfigured,
} from "@/server/integrations/google-sheets";

const projectRoot = path.resolve("C:/workspace/redes-de-ayuda");
const baseEnvironment = {
  NODE_ENV: "test" as const,
  GOOGLE_DONATIONS_SPREADSHEET_ID: "abc_123-XYZ",
  GOOGLE_DONATIONS_SHEET_RANGE: "Respuestas normalizadas!A:H",
  GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_FILE:
    "C:/credentials/redes-ayuda-google.json",
};

describe("configuración de Google Sheets", () => {
  it("solo activa la integración cuando todos los valores seguros están presentes", () => {
    expect(
      isGoogleDonationIntegrationConfigured({ NODE_ENV: "test" }, projectRoot),
    ).toBe(false);
    expect(
      getGoogleDonationSheetsConfiguration(baseEnvironment, projectRoot),
    ).toEqual({
      spreadsheetId: "abc_123-XYZ",
      range: "Respuestas normalizadas!A:H",
      credentialsFile: path.resolve(
        "C:/credentials/redes-ayuda-google.json",
      ),
      syncIntervalMs: 45_000,
    });
  });

  it("rechaza credenciales relativas o almacenadas dentro del repositorio", () => {
    expect(
      getGoogleDonationSheetsConfiguration(
        {
          ...baseEnvironment,
          GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_FILE: "credentials.json",
        },
        projectRoot,
      ),
    ).toBeNull();
    expect(
      getGoogleDonationSheetsConfiguration(
        {
          ...baseEnvironment,
          GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_FILE:
            "C:/workspace/redes-de-ayuda/secrets/google.json",
        },
        projectRoot,
      ),
    ).toBeNull();
  });

  it("acepta solamente intervalos de sincronización entre 30 y 60 segundos", () => {
    expect(
      getGoogleDonationSheetsConfiguration(
        {
          ...baseEnvironment,
          GOOGLE_DONATIONS_SYNC_INTERVAL_MS: "30000",
        },
        projectRoot,
      )?.syncIntervalMs,
    ).toBe(30_000);
    expect(
      getGoogleDonationSheetsConfiguration(
        {
          ...baseEnvironment,
          GOOGLE_DONATIONS_SYNC_INTERVAL_MS: "1000",
        },
        projectRoot,
      )?.syncIntervalMs,
    ).toBe(45_000);
  });
});
