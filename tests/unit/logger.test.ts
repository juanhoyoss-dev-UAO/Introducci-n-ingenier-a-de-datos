import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatLogMessage,
  logger,
  resolveMinimumLogLevel,
} from "@/lib/logger";

describe("logger D0", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("usa niveles explícitos y el formato breve por módulo", () => {
    vi.stubEnv("APP_LOG_LEVEL", "INFO");
    const output = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logger.ok("SERVICE", "Indicadores calculados", {
      registros: 6,
      snapshot: "snapshot-a",
    });

    expect(output).toHaveBeenCalledWith(
      "[OK] [SERVICE] Indicadores calculados | registros=6 snapshot=snapshot-a",
    );
  });

  it("permite reducir o desactivar el diagnóstico", () => {
    vi.stubEnv("APP_LOG_LEVEL", "OFF");
    const output = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logger.info("API", "Petición recibida");

    expect(output).not.toHaveBeenCalled();
    expect(resolveMinimumLogLevel(undefined, "production")).toBe("WARN");
    expect(resolveMinimumLogLevel(undefined, "development")).toBe("INFO");
  });

  it("omite secretos y no serializa errores ni colecciones completas", () => {
    const formatted = formatLogMessage("ERROR", "AUTH", "Falló\nla consulta", {
      cookie: "cookie-privada",
      password: "clave-privada",
      rows: [{ centro_id: "C01" }],
      error: new Error("ruta interna C:\\privado"),
      errorCode: "INVALID_REQUEST",
    });

    expect(formatted).toContain("[ERROR] [AUTH] Falló la consulta");
    expect(formatted).toContain("error=[Error]");
    expect(formatted).toContain("rows=[array:1]");
    expect(formatted).toContain("errorCode=INVALID_REQUEST");
    expect(formatted).not.toMatch(/cookie-privada|clave-privada|centro_id|privado/);
  });
});
