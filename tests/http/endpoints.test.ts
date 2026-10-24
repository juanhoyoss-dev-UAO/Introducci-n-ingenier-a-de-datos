import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPasswordHash } from "@/server/auth/password";
import {
  SESSION_COOKIE_NAME,
  signSessionToken,
} from "@/server/auth/session";

const SNAPSHOT_A = "10000000-0000-4000-8000-000000000001";
const SNAPSHOT_B = "10000000-0000-4000-8000-000000000002";
const UNKNOWN_SNAPSHOT = "10000000-0000-4000-8000-000000000099";
const ADMIN_USERNAME = "administrador-pruebas";

interface ApiSuccess<T> {
  data: T;
  meta: Record<string, unknown>;
}

interface ApiFailure {
  error: { code: string; message: string; details?: unknown };
}

interface SnapshotResponse {
  id: string;
}

interface ProductResponse {
  producto_id: string;
  nombre: string;
  unidad_base: "ml" | "g" | "unidad";
  presentaciones: Array<{
    sku_id: string;
    producto_id: string;
    nombre: string;
    contenido_por_paquete: number;
  }>;
}

interface DashboardResponse {
  centros: Array<{
    centro_id: string;
    productos: Array<{
      producto_id: string;
      inventario_confirmado_unidad_base: number;
      objetivo_unidad_base: number;
      deficit_confirmado_unidad_base: number;
      donaciones_esperadas_unidad_base: number;
      existencias: Array<{
        sku_id: string;
        cantidad_paquetes: number;
        contenido_por_paquete: number;
      }>;
    }>;
  }>;
  donaciones_esperadas: Array<{
    intencion_id: string;
    centro_id: string;
    sku_id: string;
    cantidad_paquetes: number;
    llegada_prevista: string;
    estado: string;
  }>;
}

interface RequestOptions {
  cookie?: string;
  method?: "GET" | "POST";
  body?: unknown;
  origin?: string;
}

async function reserveLocalPort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("No fue posible reservar un puerto local para las pruebas.");
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

function waitForExit(child: ChildProcess, timeoutMs: number) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      child.removeListener("exit", onExit);
      resolve(false);
    }, timeoutMs);
    function onExit() {
      clearTimeout(timeout);
      resolve(true);
    }
    child.once("exit", onExit);
  });
}

describe("HTTP real C2", () => {
  let baseUrl = "";
  let temporaryRoot = "";
  let demoRoot = "";
  let serverProcess: ChildProcess | undefined;
  let serverOutput = "";
  let administratorCookie = "";
  let administratorPassword = "";
  let rejectedPassword = "";
  let sessionSecret = "";

  async function api<T>(requestPath: string, options: RequestOptions = {}) {
    const headers: Record<string, string> = {};
    if (options.cookie) {
      headers.Cookie = options.cookie;
    }
    if (options.origin) {
      headers.Origin = options.origin;
    }
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${baseUrl}${requestPath}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return { response, body: (await response.json()) as T };
  }

  async function waitForServer() {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (
        serverProcess?.exitCode !== null ||
        serverProcess?.signalCode !== null
      ) {
        throw new Error(`Next.js terminó antes de iniciar.\n${serverOutput}`);
      }
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        if (response.ok) {
          return;
        }
      } catch {
        // El puerto todavía no está listo.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Next.js no inició dentro del plazo.\n${serverOutput}`);
  }

  async function waitForServerOutput(predicate: () => boolean) {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      if (predicate()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`No apareció la traza esperada.\n${serverOutput}`);
  }

  beforeAll(async () => {
    const runtimeTestsRoot = path.join(
      process.cwd(),
      "data",
      "runtime",
      ".http-tests",
    );
    await mkdir(runtimeTestsRoot, { recursive: true });
    temporaryRoot = await mkdtemp(path.join(runtimeTestsRoot, "c2-"));
    demoRoot = path.join(temporaryRoot, "demo", "snapshots");
    const isolatedRuntimeRoot = path.join(temporaryRoot, "runtime");
    await mkdir(path.dirname(demoRoot), { recursive: true });
    await cp(path.join(process.cwd(), "data", "demo", "snapshots"), demoRoot, {
      recursive: true,
    });

    administratorPassword = randomBytes(32).toString("base64url");
    rejectedPassword = randomBytes(32).toString("base64url");
    sessionSecret = randomBytes(48).toString("base64url");
    const administratorPasswordHash = await createPasswordHash(
      administratorPassword,
    );
    const port = await reserveLocalPort();
    baseUrl = `http://127.0.0.1:${port}`;

    const nextBinary = path.join(
      process.cwd(),
      "node_modules",
      "next",
      "dist",
      "bin",
      "next",
    );
    const childEnvironment = { ...process.env };
    for (const name of Object.keys(childEnvironment)) {
      if (name.includes("SUPABASE")) {
        delete childEnvironment[name];
      }
    }
    Object.assign(childEnvironment, {
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
      ADMIN_USERNAME,
      ADMIN_PASSWORD_HASH: administratorPasswordHash,
      SESSION_SECRET: sessionSecret,
      OPERATIONS_DEMO_ROOT: demoRoot,
      OPERATIONS_RUNTIME_ROOT: isolatedRuntimeRoot,
    });

    const child = spawn(
      process.execPath,
      [nextBinary, "dev", "--webpack", "-H", "127.0.0.1", "-p", String(port)],
      {
        cwd: process.cwd(),
        env: childEnvironment,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    serverProcess = child;
    const captureOutput = (chunk: Buffer) => {
      serverOutput = `${serverOutput}${chunk.toString("utf8")}`.slice(-20_000);
    };
    child.stdout?.on("data", captureOutput);
    child.stderr?.on("data", captureOutput);

    try {
      await waitForServer();
    } catch (error) {
      child.kill();
      throw error;
    }
  }, 120_000);

  afterAll(async () => {
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill();
      await waitForExit(serverProcess, 10_000);
    }
    if (temporaryRoot) {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }, 20_000);

  it("mantiene health público y sin información sensible", async () => {
    const { response, body } = await api<ApiSuccess<{ status: string }>>(
      "/api/health",
    );
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body).toEqual({ data: { status: "ok" }, meta: {} });
  });

  it("T01 inicia sesión y entrega una cookie con atributos seguros", async () => {
    const { response, body } = await api<
      ApiSuccess<{
        authenticated: boolean;
        user: { username: string; role: string };
      }>
    >("/api/auth/login", {
      method: "POST",
      origin: baseUrl,
      body: { username: ADMIN_USERNAME, password: administratorPassword },
    });

    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.data).toMatchObject({
      authenticated: true,
      user: { username: ADMIN_USERNAME, role: "admin" },
    });
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toMatch(/;\s*HttpOnly/i);
    expect(setCookie).toMatch(/;\s*SameSite=Lax/i);
    expect(setCookie).toMatch(/;\s*Path=\//i);
    expect(setCookie).toMatch(/;\s*Expires=/i);
    expect(setCookie).toMatch(/;\s*Max-Age=\d+/i);
    expect(setCookie).not.toMatch(/;\s*Secure/i);
    administratorCookie = setCookie?.split(";", 1)[0] ?? "";

    const me = await api<
      ApiSuccess<{
        authenticated: boolean;
        user: { username: string; role: string };
      }>
    >("/api/auth/me", { cookie: administratorCookie });
    expect(me.response.status).toBe(200);
    expect(me.body.data).toMatchObject({
      authenticated: true,
      user: { username: ADMIN_USERNAME, role: "admin" },
    });
  });

  it("D0-T01 protege el dashboard y permite entrar al administrador", async () => {
    const anonymous = await fetch(`${baseUrl}/dashboard`, {
      redirect: "manual",
    });
    const anonymousBody = await anonymous.text();
    const location = anonymous.headers.get("location");

    expect([303, 307, 308]).toContain(anonymous.status);
    expect(location).toBeTruthy();
    expect(new URL(location ?? "/", baseUrl).pathname).toBe("/login");
    expect(anonymousBody).not.toMatch(
      /Jornada demostrativa|AGUA-600|12[.,]?000|20[.,]?000/i,
    );

    const authenticated = await fetch(`${baseUrl}/dashboard`, {
      headers: { Cookie: administratorCookie },
      redirect: "manual",
    });
    const authenticatedBody = await authenticated.text();

    expect(authenticated.status).toBe(200);
    for (const section of [
      "Centros",
      "Inventario",
      "Necesidades",
      "Voluntarios",
      "Donaciones esperadas",
      "Tiempos de traslado",
    ]) {
      expect(authenticatedBody).toContain(section);
    }
  });

  it("T02 rechaza credenciales incorrectas sin revelar el campo fallido", async () => {
    const { response, body } = await api<ApiFailure>("/api/auth/login", {
      method: "POST",
      origin: baseUrl,
      body: { username: ADMIN_USERNAME, password: rejectedPassword },
    });
    expect(response.status, JSON.stringify(body)).toBe(401);
    expect(body.error).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "El usuario o la contraseña no son válidos.",
    });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rechaza mutaciones de sesión sin un Origin local exacto", async () => {
    const missingOrigin = await api<ApiFailure>("/api/auth/login", {
      method: "POST",
      body: { username: ADMIN_USERNAME, password: administratorPassword },
    });
    const foreignOrigin = await api<ApiFailure>("/api/auth/logout", {
      method: "POST",
      origin: "https://example.invalid",
      cookie: administratorCookie,
    });
    expect(missingOrigin.response.status).toBe(403);
    expect(missingOrigin.body.error.code).toBe("INVALID_ORIGIN");
    expect(foreignOrigin.response.status).toBe(403);
    expect(foreignOrigin.body.error.code).toBe("INVALID_ORIGIN");
  });

  it("T03 rechaza una sesión anónima", async () => {
    const { response, body } = await api<ApiFailure>("/api/snapshots");
    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("T04 devuelve 403 para una sesión firmada sin rol administrador", async () => {
    const { token } = signSessionToken(
      { username: "fixture-sin-privilegios", role: "viewer" },
      sessionSecret,
    );
    const { response, body } = await api<ApiFailure>("/api/snapshots", {
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
    });
    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("T05 permite al administrador consultar dos snapshots CSV", async () => {
    const [snapshots, detail] = await Promise.all([
      api<ApiSuccess<SnapshotResponse[]>>("/api/snapshots", {
        cookie: administratorCookie,
      }),
      api<ApiSuccess<SnapshotResponse>>(`/api/snapshots/${SNAPSHOT_A}`, {
        cookie: administratorCookie,
      }),
    ]);
    expect(snapshots.response.status).toBe(200);
    expect(snapshots.body.data).toHaveLength(2);
    expect(snapshots.body.data.map((snapshot) => snapshot.id).sort()).toEqual([
      SNAPSHOT_A,
      SNAPSHOT_B,
    ]);
    expect(detail.response.status).toBe(200);
    expect(detail.body.data.id).toBe(SNAPSHOT_A);
  });

  it("D0-T03 y D0-T09 recuperan el resumen y los tiempos dirigidos reales", async () => {
    const [centers, products, travelTimes] = await Promise.all([
      api<ApiSuccess<Array<{ centro_id: string }>>>(
        `/api/centers?snapshotId=${SNAPSHOT_A}`,
        { cookie: administratorCookie },
      ),
      api<ApiSuccess<ProductResponse[]>>(
        `/api/products?snapshotId=${SNAPSHOT_A}`,
        { cookie: administratorCookie },
      ),
      api<
        ApiSuccess<
          Array<{ origen_id: string; destino_id: string; minutos: number }>
        >
      >(
        `/api/travel-times?snapshotId=${SNAPSHOT_A}`,
        { cookie: administratorCookie },
      ),
    ]);
    expect(centers.response.status).toBe(200);
    expect(centers.body.data).toHaveLength(6);
    expect(centers.body.meta).toMatchObject({
      snapshot_id: SNAPSHOT_A,
      total: 6,
    });
    expect(products.response.status).toBe(200);
    expect(products.body.data).toHaveLength(5);
    expect(
      products.body.data.flatMap((product) => product.presentaciones),
    ).toHaveLength(7);
    expect(travelTimes.response.status).toBe(200);
    expect(travelTimes.body.data).toContainEqual(
      expect.objectContaining({
        origen_id: "C02",
        destino_id: "C01",
        minutos: 15,
      }),
    );
    expect(travelTimes.body.data).toContainEqual(
      expect.objectContaining({
        origen_id: "C01",
        destino_id: "C02",
        minutos: 20,
      }),
    );
  });

  it("D0-T05 a D0-T07 conserva detalle físico, necesidad y donación separados", async () => {
    const [dashboard, products] = await Promise.all([
      api<ApiSuccess<DashboardResponse>>(
        `/api/dashboard?snapshotId=${SNAPSHOT_A}`,
        { cookie: administratorCookie },
      ),
      api<ApiSuccess<ProductResponse[]>>(
        `/api/products?snapshotId=${SNAPSHOT_A}`,
        { cookie: administratorCookie },
      ),
    ]);
    expect(dashboard.response.status).toBe(200);
    expect(products.response.status).toBe(200);

    const water = dashboard.body.data.centros
      .find((center) => center.centro_id === "C01")
      ?.productos.find((product) => product.producto_id === "P01");
    expect(water).toMatchObject({
      inventario_confirmado_unidad_base: 12_000,
      objetivo_unidad_base: 20_000,
      deficit_confirmado_unidad_base: 8_000,
      donaciones_esperadas_unidad_base: 6_000,
    });
    expect(water?.existencias).toHaveLength(2);
    expect(water?.existencias).toEqual(
      expect.arrayContaining([
        {
          sku_id: "AGUA-600",
          cantidad_paquetes: 10,
          contenido_por_paquete: 600,
        },
        {
          sku_id: "AGUA-1500",
          cantidad_paquetes: 4,
          contenido_por_paquete: 1_500,
        },
      ]),
    );
    const confirmedFromPhysicalPackages =
      water?.existencias.reduce(
        (total, row) =>
          total + row.cantidad_paquetes * row.contenido_por_paquete,
        0,
      ) ?? 0;
    expect(confirmedFromPhysicalPackages).toBe(12_000);

    const announcedDonation = dashboard.body.data.donaciones_esperadas.find(
      (donation) => donation.intencion_id === "D01",
    );
    expect(announcedDonation).toMatchObject({
      centro_id: "C01",
      sku_id: "AGUA-600",
      cantidad_paquetes: 10,
      estado: "pendiente",
    });
    const announcedPresentation = products.body.data
      .flatMap((product) => product.presentaciones)
      .find((presentation) => presentation.sku_id === announcedDonation?.sku_id);
    expect(announcedPresentation?.contenido_por_paquete).toBe(600);
    expect(
      (announcedDonation?.cantidad_paquetes ?? 0) *
        (announcedPresentation?.contenido_por_paquete ?? 0),
    ).toBe(6_000);
    expect(water?.inventario_confirmado_unidad_base).toBe(12_000);
  });

  it("D0-T10 correlaciona API, servicio, repositorio y resultado", async () => {
    const { response } = await api<ApiSuccess<DashboardResponse>>(
      `/api/dashboard?snapshotId=${SNAPSHOT_A}`,
      { cookie: administratorCookie },
    );
    const requestId = response.headers.get("x-request-id");

    expect(response.status).toBe(200);
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    await waitForServerOutput(() =>
      serverOutput
        .split(/\r?\n/)
        .some(
          (line) =>
            line.includes(requestId ?? "") &&
            line.includes("[OK] [API] Petición completada"),
        ),
    );

    const trace = serverOutput
      .split(/\r?\n/)
      .filter((line) => line.includes(requestId ?? ""));
    const apiStart = trace.findIndex((line) =>
      line.includes("[INFO] [API] Petición recibida"),
    );
    const service = trace.findIndex((line) =>
      line.includes("[INFO] [SERVICE] Calculando indicadores"),
    );
    const repository = trace.findIndex((line) =>
      line.includes("[OK] [REPOSITORY] Snapshot leído"),
    );
    const result = trace.findIndex((line) =>
      line.includes("[OK] [API] Petición completada"),
    );

    expect(apiStart).toBeGreaterThanOrEqual(0);
    expect(service).toBeGreaterThan(apiStart);
    expect(repository).toBeGreaterThan(service);
    expect(result).toBeGreaterThan(repository);
    expect(trace.join("\n")).toContain(`snapshot=${SNAPSHOT_A}`);
    expect(trace.join("\n")).not.toContain(administratorPassword);
    expect(trace.join("\n")).not.toContain(sessionSecret);
    expect(trace.join("\n")).not.toMatch(
      /redes_ayuda_session|authorization|stack|\\src\\|\/src\//i,
    );
  });

  it("T08 mantiene aislados los datos de ambos snapshots", async () => {
    const [snapshotA, snapshotB] = await Promise.all([
      api<ApiSuccess<DashboardResponse>>(
        `/api/dashboard?snapshotId=${SNAPSHOT_A}`,
        { cookie: administratorCookie },
      ),
      api<ApiSuccess<DashboardResponse>>(
        `/api/dashboard?snapshotId=${SNAPSHOT_B}`,
        { cookie: administratorCookie },
      ),
    ]);
    function waterInventory(body: ApiSuccess<DashboardResponse>) {
      return body.data.centros
        .find((center) => center.centro_id === "C01")
        ?.productos.find((product) => product.producto_id === "P01")
        ?.inventario_confirmado_unidad_base;
    }
    expect(snapshotA.response.status).toBe(200);
    expect(snapshotB.response.status).toBe(200);
    expect(waterInventory(snapshotA.body)).toBe(12_000);
    expect(waterInventory(snapshotB.body)).toBe(2_700);
  });

  it("T09 rechaza alteración, firma o secreto incorrectos y expiración", async () => {
    const token = administratorCookie.slice(
      `${SESSION_COOKIE_NAME}=`.length,
    );
    const [payload, signature] = token.split(".");
    const changedPayload = `${payload[0] === "A" ? "B" : "A"}${payload.slice(1)}`;
    const changedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    const now = Math.floor(Date.now() / 1000);
    const expired = signSessionToken(
      {
        username: ADMIN_USERNAME,
        role: "admin",
        issuedAt: now - 120,
        expiresAt: now - 60,
      },
      sessionSecret,
    ).token;
    const wrongSecret = signSessionToken(
      { username: ADMIN_USERNAME, role: "admin" },
      randomBytes(48).toString("base64url"),
    ).token;
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const finalSignatureIndex = alphabet.indexOf(signature.at(-1) ?? "");
    const nonCanonicalSignature = `${signature.slice(0, -1)}${alphabet[finalSignatureIndex + 1]}`;
    const cookies = [
      `${SESSION_COOKIE_NAME}=${changedPayload}.${signature}`,
      `${SESSION_COOKIE_NAME}=${payload}.${changedSignature}`,
      `${SESSION_COOKIE_NAME}=${expired}`,
      `${SESSION_COOKIE_NAME}=${wrongSecret}`,
      `${SESSION_COOKIE_NAME}=${payload}.${nonCanonicalSignature}`,
      undefined,
    ];

    for (const cookie of cookies) {
      const result = await api<ApiFailure>("/api/snapshots", { cookie });
      expect(result.response.status).toBe(401);
      expect(result.body.error.code).toBe("UNAUTHENTICATED");
    }

    const logout = await api<ApiSuccess<{ authenticated: boolean }>>(
      "/api/auth/logout",
      {
        method: "POST",
        origin: baseUrl,
        cookie: administratorCookie,
      },
    );
    expect(logout.response.status).toBe(200);
    expect(logout.response.headers.get("set-cookie")).toMatch(
      new RegExp(`${SESSION_COOKIE_NAME}=;.*Max-Age=0`, "i"),
    );

    const afterLogout = await api<ApiFailure>("/api/snapshots");
    expect(afterLogout.response.status).toBe(401);
    expect(afterLogout.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("D0-T11 normaliza snapshots inválidos y errores sin filtrar internals", async () => {
    const missing = await api<ApiFailure>("/api/centers", {
      cookie: administratorCookie,
    });
    const malformed = await api<ApiFailure>(
      "/api/centers?snapshotId=no-es-uuid",
      { cookie: administratorCookie },
    );
    const notFound = await api<ApiFailure>(
      `/api/centers?snapshotId=${UNKNOWN_SNAPSHOT}`,
      { cookie: administratorCookie },
    );

    expect(missing.response.status).toBe(400);
    expect(missing.body.error.code).toBe("MISSING_SNAPSHOT_ID");
    expect(malformed.response.status).toBe(400);
    expect(malformed.body.error.code).toBe("INVALID_SNAPSHOT_ID");
    expect(JSON.stringify(malformed.body)).not.toMatch(
      /stack|scrypt|cookie|secret|token|\\src\\|\/src\//i,
    );
    expect(notFound.response.status).toBe(404);
    expect(notFound.body.error.code).toBe("SNAPSHOT_NOT_FOUND");
    expect(JSON.stringify(notFound.body)).not.toMatch(
      /stack|scrypt|cookie|secret|token|\\src\\|\/src\//i,
    );

    const corruptedCsv = path.join(demoRoot, SNAPSHOT_A, "productos.csv");
    await writeFile(corruptedCsv, "contenido,invalido\n", "utf8");
    const readError = await api<ApiFailure>(
      `/api/products?snapshotId=${SNAPSHOT_A}`,
      { cookie: administratorCookie },
    );
    expect(readError.response.status).toBe(500);
    expect(readError.body.error).toEqual({
      code: "DATABASE_ERROR",
      message: "No fue posible consultar la base de datos.",
    });
    const serializedError = JSON.stringify(readError.body);
    expect(serializedError).not.toContain(temporaryRoot);
    expect(serializedError).not.toContain(sessionSecret);
    expect(serializedError).not.toMatch(/stack|scrypt|supabase|\\src\\|\/src\//i);
  });
});
