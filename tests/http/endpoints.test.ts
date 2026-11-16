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
const WEEKLY_SCENARIO = "65000000-0000-4000-8000-000000000001";
const WEEKLY_BASE = "65000000-0000-4000-8000-000000000002";
const WEEKLY_FINAL = "65000000-0000-4000-8000-000000000003";
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

interface OperationalUpdateResponse {
  snapshot: SnapshotResponse;
  source_snapshot_id: string;
  operation: string;
}

interface MovementResponse {
  snapshot: SnapshotResponse;
  source_snapshot_id: string;
  operation: string;
  idempotent: boolean;
  movement: {
    operacion_id: string;
    tipo: "recepcion_confirmada" | "despacho";
    centro_origen_id: string | null;
    centro_destino_id: string | null;
    producto_id: string;
    sku_id: string;
    cantidad_paquetes: number;
    ocurrido_en: string;
    registrado_en: string;
    intencion_id: string | null;
    cantidad_anunciada_paquetes: number | null;
  };
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
      cobertura_porcentaje: number | null;
      deficit_potencial_unidad_base: number;
      donaciones_esperadas_unidad_base: number;
      existencias: Array<{
        sku_id: string;
        cantidad_paquetes: number;
        contenido_por_paquete: number;
      }>;
    }>;
    capacidad_almacenamiento: {
      calculable: boolean;
      ocupacion_porcentaje: number | null;
      sobrecapacidad: boolean | null;
      datos_faltantes: string[];
    };
  }>;
  indicadores: { centros_activos: number };
  visualizaciones: {
    cobertura_por_centro: Array<{
      centro_id: string;
      producto_id: string;
      cobertura_porcentaje: number | null;
      unidad: string;
    }>;
    inventario_vs_necesidad: Array<{
      centro_id: string;
      producto_id: string;
      inventario_confirmado: number;
      necesidad_vigente: number;
      unidad: string;
    }>;
    recursos_confirmados_vs_esperados: Array<{
      centro_id: string;
      producto_id: string;
      recursos_confirmados: number;
      recursos_esperados: number;
      unidad: string;
    }>;
    voluntarios_disponibles_vs_requeridos: Array<{
      centro_id: string;
      disponibles: number;
      requeridos: number;
      unidad: string;
    }>;
  };
  donaciones_esperadas: Array<{
    intencion_id: string;
    centro_id: string;
    sku_id: string;
    cantidad_paquetes: number;
    llegada_prevista: string;
    estado: string;
  }>;
  alertas: {
    evaluado_en: string;
    referencia_id: string;
    total: number;
    por_severidad: {
      critica: number;
      advertencia: number;
      informativa: number;
    };
    centros_que_requieren_atencion: number;
    alertas: Array<{
      alerta_id: string;
      tipo: string;
      severidad: string;
      centro_id: string;
      producto_id: string | null;
      titulo: string;
      valor_observado: number;
      unidad: string;
      referencia_id: string;
    }>;
  };
}

interface TemporalResponse {
  referencia: {
    snapshot_id: string;
    escenario_id: string;
    snapshot_base_id: string;
  };
  perspectiva: "fisica" | "informativa";
  corte: string;
  completitud: {
    estado: "completa" | "parcial" | "insuficiente";
    limitaciones: string[];
  };
  eventos: Array<{
    evento_id: string;
    tipo: string;
    ocurrido_en: string;
    registrado_en: string;
  }>;
  reconstruccion: {
    inventario: Array<{
      centro_id: string;
      sku_id: string;
      cantidad_paquetes: number;
    }>;
    eventos_aplicados: string[];
  };
  indicadores: {
    centros_activos: number;
    alertas: { referencia_id: string; evaluado_en: string };
  };
  series: {
    movimientos_por_hora: Array<{
      fecha_local: string;
      hora_local: number;
      recepciones: number;
      paquetes_recibidos: number;
    }>;
    desfase_registro: Array<{ desfase_minutos: number }>;
  };
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

  it("T05 permite al administrador consultar los cuatro snapshots CSV", async () => {
    const [snapshots, detail] = await Promise.all([
      api<ApiSuccess<SnapshotResponse[]>>("/api/snapshots", {
        cookie: administratorCookie,
      }),
      api<ApiSuccess<SnapshotResponse>>(`/api/snapshots/${SNAPSHOT_A}`, {
        cookie: administratorCookie,
      }),
    ]);
    expect(snapshots.response.status).toBe(200);
    expect(snapshots.body.data).toHaveLength(4);
    expect(snapshots.body.data.map((snapshot) => snapshot.id).sort()).toEqual([
      SNAPSHOT_A,
      SNAPSHOT_B,
      WEEKLY_BASE,
      WEEKLY_FINAL,
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
      cobertura_porcentaje: 60,
      deficit_potencial_unidad_base: 2_000,
      donaciones_esperadas_unidad_base: 6_000,
    });
    expect(dashboard.body.data.indicadores.centros_activos).toBe(6);
    expect(
      dashboard.body.data.centros.find((center) => center.centro_id === "C01")
        ?.capacidad_almacenamiento,
    ).toMatchObject({
      calculable: false,
      ocupacion_porcentaje: null,
      sobrecapacidad: null,
    });
    expect(
      dashboard.body.data.visualizaciones.cobertura_por_centro,
    ).toContainEqual(
      expect.objectContaining({
        centro_id: "C01",
        producto_id: "P01",
        cobertura_porcentaje: 60,
        unidad: "porcentaje",
      }),
    );
    expect(
      dashboard.body.data.visualizaciones.voluntarios_disponibles_vs_requeridos,
    ).toContainEqual(
      expect.objectContaining({
        centro_id: "C01",
        disponibles: 4,
        requeridos: 7,
        unidad: "persona",
      }),
    );
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
    expect(dashboard.body.data.alertas.alertas).toContainEqual(
      expect.objectContaining({
        alerta_id: "alerta:deficit_cobertura:C01:P01",
        titulo: "Déficit importante",
        severidad: "advertencia",
        valor_observado: 60,
        unidad: "porcentaje",
        referencia_id: SNAPSHOT_A,
      }),
    );
    expect(dashboard.body.meta.evaluado_en).toBe(
      dashboard.body.data.alertas.evaluado_en,
    );
  });

  it("M5 protege la consulta de alertas integrada al dashboard", async () => {
    const anonymous = await api<ApiFailure>(
      `/api/dashboard?snapshotId=${SNAPSHOT_A}`,
    );
    expect(anonymous.response.status).toBe(401);
    expect(anonymous.body.error.code).toBe("UNAUTHENTICATED");
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

  it("M3 publica inventario por API y actualiza las visualizaciones", async () => {
    const update = await api<ApiSuccess<OperationalUpdateResponse>>(
      `/api/snapshots/${SNAPSHOT_A}/operations`,
      {
        method: "POST",
        origin: baseUrl,
        cookie: administratorCookie,
        body: {
          operation: "upsert_inventory",
          values: {
            centro_id: "C01",
            producto_id: "P01",
            sku_id: "AGUA-600",
            cantidad_paquetes: 20,
          },
        },
      },
    );
    expect(update.response.status, JSON.stringify(update.body)).toBe(200);
    expect(update.body.data).toMatchObject({
      source_snapshot_id: SNAPSHOT_A,
      operation: "upsert_inventory",
    });
    const operationalId = update.body.data.snapshot.id;
    expect(operationalId).not.toBe(SNAPSHOT_A);

    const [original, operational] = await Promise.all([
      api<ApiSuccess<DashboardResponse>>(
        `/api/dashboard?snapshotId=${SNAPSHOT_A}`,
        { cookie: administratorCookie },
      ),
      api<ApiSuccess<DashboardResponse>>(
        `/api/dashboard?snapshotId=${operationalId}`,
        { cookie: administratorCookie },
      ),
    ]);
    const water = (body: ApiSuccess<DashboardResponse>) =>
      body.data.centros
        .find((center) => center.centro_id === "C01")
        ?.productos.find((product) => product.producto_id === "P01");
    expect(water(original.body)).toMatchObject({
      inventario_confirmado_unidad_base: 12_000,
      deficit_confirmado_unidad_base: 8_000,
    });
    expect(water(operational.body)).toMatchObject({
      inventario_confirmado_unidad_base: 18_000,
      deficit_confirmado_unidad_base: 2_000,
      cobertura_porcentaje: 90,
    });
    expect(
      operational.body.data.visualizaciones.inventario_vs_necesidad,
    ).toContainEqual(
      expect.objectContaining({
        centro_id: "C01",
        producto_id: "P01",
        inventario_confirmado: 18_000,
      }),
    );
  }, 10_000);

  it("M3 protege y valida las operaciones de escritura", async () => {
    const anonymous = await api<ApiFailure>(
      `/api/snapshots/${SNAPSHOT_A}/operations`,
      {
        method: "POST",
        origin: baseUrl,
        body: {
          operation: "upsert_volunteers",
          values: { centro_id: "C01", disponibles: 1, requeridos: 2 },
        },
      },
    );
    const foreignOrigin = await api<ApiFailure>(
      `/api/snapshots/${SNAPSHOT_A}/operations`,
      {
        method: "POST",
        origin: "https://example.invalid",
        cookie: administratorCookie,
        body: {
          operation: "upsert_volunteers",
          values: { centro_id: "C01", disponibles: 1, requeridos: 2 },
        },
      },
    );
    const negative = await api<ApiFailure>(
      `/api/snapshots/${SNAPSHOT_A}/operations`,
      {
        method: "POST",
        origin: baseUrl,
        cookie: administratorCookie,
        body: {
          operation: "upsert_inventory",
          values: {
            centro_id: "C01",
            producto_id: "P01",
            sku_id: "AGUA-600",
            cantidad_paquetes: -1,
          },
        },
      },
    );
    const missingReference = await api<ApiFailure>(
      `/api/snapshots/${SNAPSHOT_A}/operations`,
      {
        method: "POST",
        origin: baseUrl,
        cookie: administratorCookie,
        body: {
          operation: "upsert_need",
          values: {
            centro_id: "C01",
            producto_id: "P99",
            objetivo_unidad_base: 10,
            prioridad: 1,
          },
        },
      },
    );

    expect(anonymous.response.status).toBe(401);
    expect(anonymous.body.error.code).toBe("UNAUTHENTICATED");
    expect(foreignOrigin.response.status).toBe(403);
    expect(foreignOrigin.body.error.code).toBe("INVALID_ORIGIN");
    expect(negative.response.status).toBe(400);
    expect(negative.body.error.code).toBe("INVALID_OPERATION");
    expect(missingReference.response.status).toBe(400);
    expect(missingReference.body.error.code).toBe("INVALID_REFERENCE");
  }, 10_000);

  it("M4 confirma una donación por API, conserva el anuncio y es idempotente", async () => {
    const payload = {
      operation: "confirm_donation",
      values: {
        operacion_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
        intencion_id: "D01",
        cantidad_paquetes: 10,
        ocurrido_en: "2026-11-15T11:00:00-05:00",
      },
    };
    const first = await api<ApiSuccess<MovementResponse>>(
      `/api/snapshots/${SNAPSHOT_A}/movements`,
      {
        method: "POST",
        origin: baseUrl,
        cookie: administratorCookie,
        body: payload,
      },
    );
    const repeated = await api<ApiSuccess<MovementResponse>>(
      `/api/snapshots/${SNAPSHOT_A}/movements`,
      {
        method: "POST",
        origin: baseUrl,
        cookie: administratorCookie,
        body: payload,
      },
    );
    expect(first.response.status, JSON.stringify(first.body)).toBe(200);
    expect(repeated.response.status, JSON.stringify(repeated.body)).toBe(200);
    expect(first.body.data.idempotent).toBe(false);
    expect(repeated.body.data.idempotent).toBe(true);
    expect(repeated.body.data.snapshot.id).toBe(first.body.data.snapshot.id);
    expect(first.body.data.movement).toMatchObject({
      intencion_id: "D01",
      cantidad_paquetes: 10,
      cantidad_anunciada_paquetes: 10,
      ocurrido_en: "2026-11-15T11:00:00-05:00",
    });

    const operationalId = first.body.data.snapshot.id;
    const [original, operational, history] = await Promise.all([
      api<ApiSuccess<DashboardResponse>>(
        `/api/dashboard?snapshotId=${SNAPSHOT_A}`,
        { cookie: administratorCookie },
      ),
      api<ApiSuccess<DashboardResponse>>(
        `/api/dashboard?snapshotId=${operationalId}`,
        { cookie: administratorCookie },
      ),
      api<ApiSuccess<MovementResponse["movement"][]>>(
        `/api/snapshots/${operationalId}/movements?centroId=C01&desde=${encodeURIComponent("2026-11-15T10:00:00-05:00")}&hasta=${encodeURIComponent("2026-11-15T12:00:00-05:00")}`,
        { cookie: administratorCookie },
      ),
    ]);
    const water = (body: ApiSuccess<DashboardResponse>) =>
      body.data.centros
        .find((center) => center.centro_id === "C01")
        ?.productos.find((product) => product.producto_id === "P01");
    expect(water(original.body)).toMatchObject({
      inventario_confirmado_unidad_base: 12_000,
      deficit_confirmado_unidad_base: 8_000,
      donaciones_esperadas_unidad_base: 6_000,
    });
    expect(water(operational.body)).toMatchObject({
      inventario_confirmado_unidad_base: 18_000,
      deficit_confirmado_unidad_base: 2_000,
      donaciones_esperadas_unidad_base: 0,
    });
    expect(history.response.status).toBe(200);
    expect(history.body.data).toHaveLength(1);
  }, 10_000);

  it("M4 registra recepción directa y despacho en versiones sucesivas", async () => {
    const reception = await api<ApiSuccess<MovementResponse>>(
      `/api/snapshots/${SNAPSHOT_A}/movements`,
      {
        method: "POST",
        origin: baseUrl,
        cookie: administratorCookie,
        body: {
          operation: "direct_reception",
          values: {
            operacion_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
            centro_id: "C01",
            producto_id: "P01",
            sku_id: "AGUA-600",
            cantidad_paquetes: 5,
            ocurrido_en: "2026-11-15T12:00:00-05:00",
          },
        },
      },
    );
    expect(reception.response.status, JSON.stringify(reception.body)).toBe(200);
    const dispatch = await api<ApiSuccess<MovementResponse>>(
      `/api/snapshots/${reception.body.data.snapshot.id}/movements`,
      {
        method: "POST",
        origin: baseUrl,
        cookie: administratorCookie,
        body: {
          operation: "dispatch",
          values: {
            operacion_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3",
            centro_id: "C01",
            producto_id: "P01",
            sku_id: "AGUA-600",
            cantidad_paquetes: 3,
            ocurrido_en: "2026-11-15T13:00:00-05:00",
          },
        },
      },
    );
    expect(dispatch.response.status, JSON.stringify(dispatch.body)).toBe(200);
    const [receptionDashboard, dashboard, history] = await Promise.all([
      api<ApiSuccess<DashboardResponse>>(
        `/api/dashboard?snapshotId=${reception.body.data.snapshot.id}`,
        { cookie: administratorCookie },
      ),
      api<ApiSuccess<DashboardResponse>>(
        `/api/dashboard?snapshotId=${dispatch.body.data.snapshot.id}`,
        { cookie: administratorCookie },
      ),
      api<ApiSuccess<MovementResponse["movement"][]>>(
        `/api/snapshots/${dispatch.body.data.snapshot.id}/movements`,
        { cookie: administratorCookie },
      ),
    ]);
    const water = dashboard.body.data.centros
      .find((center) => center.centro_id === "C01")
      ?.productos.find((product) => product.producto_id === "P01");
    expect(water?.existencias).toContainEqual(
      expect.objectContaining({ sku_id: "AGUA-600", cantidad_paquetes: 12 }),
    );
    expect(history.body.data).toHaveLength(2);
    expect(history.body.data.map((row) => row.tipo)).toEqual([
      "despacho",
      "recepcion_confirmada",
    ]);
    const coverageAlert = (body: ApiSuccess<DashboardResponse>) =>
      body.data.alertas.alertas.find(
        (alert) =>
          alert.tipo === "deficit_cobertura" &&
          alert.centro_id === "C01" &&
          alert.producto_id === "P01",
      );
    expect(coverageAlert(receptionDashboard.body)).toMatchObject({
      titulo: "Déficit moderado",
      valor_observado: 75,
    });
    expect(coverageAlert(dashboard.body)).toMatchObject({
      titulo: "Déficit importante",
      valor_observado: 66,
    });
  }, 10_000);

  it("M4 protege, valida y evita despachos por encima del inventario", async () => {
    const path = `/api/snapshots/${SNAPSHOT_A}/movements`;
    const anonymous = await api<ApiFailure>(path, {
      method: "POST",
      origin: baseUrl,
      body: {
        operation: "direct_reception",
        values: {
          operacion_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4",
          centro_id: "C01",
          producto_id: "P01",
          sku_id: "AGUA-600",
          cantidad_paquetes: 1,
          ocurrido_en: "2026-11-15T14:00:00-05:00",
        },
      },
    });
    const fractional = await api<ApiFailure>(path, {
      method: "POST",
      origin: baseUrl,
      cookie: administratorCookie,
      body: {
        operation: "direct_reception",
        values: {
          operacion_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5",
          centro_id: "C01",
          producto_id: "P01",
          sku_id: "AGUA-600",
          cantidad_paquetes: 1.5,
          ocurrido_en: "2026-11-15T14:00:00-05:00",
        },
      },
    });
    const insufficient = await api<ApiFailure>(path, {
      method: "POST",
      origin: baseUrl,
      cookie: administratorCookie,
      body: {
        operation: "dispatch",
        values: {
          operacion_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6",
          centro_id: "C01",
          producto_id: "P01",
          sku_id: "AGUA-600",
          cantidad_paquetes: 11,
          ocurrido_en: "2026-11-15T14:00:00-05:00",
        },
      },
    });
    expect(anonymous.response.status).toBe(401);
    expect(fractional.response.status).toBe(400);
    expect(fractional.body.error.code).toBe("INVALID_MOVEMENT_OPERATION");
    expect(insufficient.response.status).toBe(409);
    expect(insufficient.body.error.code).toBe("INSUFFICIENT_INVENTORY");
  }, 10_000);

  it("M6 protege la consulta temporal y reconstruye sin modificar snapshots", async () => {
    const anonymous = await api<ApiFailure>(
      `/api/snapshots/${SNAPSHOT_A}/temporal?corte=${encodeURIComponent("2026-11-15T23:00:00-05:00")}`,
    );
    expect(anonymous.response.status).toBe(401);
    expect(anonymous.body.error.code).toBe("UNAUTHENTICATED");

    const reception = await api<ApiSuccess<MovementResponse>>(
      `/api/snapshots/${SNAPSHOT_A}/movements`,
      {
        method: "POST",
        origin: baseUrl,
        cookie: administratorCookie,
        body: {
          operation: "direct_reception",
          values: {
            operacion_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7",
            centro_id: "C01",
            producto_id: "P01",
            sku_id: "AGUA-600",
            cantidad_paquetes: 5,
            ocurrido_en: "2026-11-15T10:00:00-05:00",
          },
        },
      },
    );
    expect(reception.response.status, JSON.stringify(reception.body)).toBe(200);
    const snapshotId = reception.body.data.snapshot.id;
    const before = await api<ApiSuccess<SnapshotResponse[]>>("/api/snapshots", {
      cookie: administratorCookie,
    });
    const cutoff = "2026-11-15T23:00:00-05:00";
    const temporal = await api<ApiSuccess<TemporalResponse>>(
      `/api/snapshots/${snapshotId}/temporal?centroId=C01&productoId=P01&perspectiva=fisica&corte=${encodeURIComponent(cutoff)}`,
      { cookie: administratorCookie },
    );
    const after = await api<ApiSuccess<SnapshotResponse[]>>("/api/snapshots", {
      cookie: administratorCookie,
    });
    const dashboard = await api<ApiSuccess<DashboardResponse>>(
      `/api/dashboard?snapshotId=${snapshotId}`,
      { cookie: administratorCookie },
    );

    expect(temporal.response.status, JSON.stringify(temporal.body)).toBe(200);
    expect(temporal.body.data).toMatchObject({
      referencia: {
        snapshot_id: snapshotId,
        escenario_id: SNAPSHOT_A,
        snapshot_base_id: SNAPSHOT_A,
      },
      perspectiva: "fisica",
      corte: cutoff,
      completitud: { estado: "completa", limitaciones: [] },
    });
    expect(temporal.body.data.eventos).toHaveLength(1);
    expect(temporal.body.data.reconstruccion.inventario).toContainEqual(
      expect.objectContaining({
        centro_id: "C01",
        sku_id: "AGUA-600",
        cantidad_paquetes: 15,
      }),
    );
    expect(temporal.body.data.series.movimientos_por_hora).toContainEqual(
      expect.objectContaining({
        fecha_local: "2026-11-15",
        hora_local: 10,
        recepciones: 1,
        paquetes_recibidos: 5,
      }),
    );
    expect(temporal.body.data.indicadores.alertas).toMatchObject({
      referencia_id: SNAPSHOT_A,
      evaluado_en: cutoff,
    });
    expect(after.body.data.map((snapshot) => snapshot.id).sort()).toEqual(
      before.body.data.map((snapshot) => snapshot.id).sort(),
    );
    expect(
      dashboard.body.data.centros
        .find((center) => center.centro_id === "C01")
        ?.productos.find((product) => product.producto_id === "P01")
        ?.existencias,
    ).toContainEqual(
      expect.objectContaining({ sku_id: "AGUA-600", cantidad_paquetes: 15 }),
    );
  }, 15_000);

  it("M6 valida escenario y periodo temporal", async () => {
    const mismatch = await api<ApiFailure>(
      `/api/snapshots/${SNAPSHOT_A}/temporal?escenarioId=${SNAPSHOT_B}&corte=${encodeURIComponent("2026-11-15T23:00:00-05:00")}`,
      { cookie: administratorCookie },
    );
    const invalidPeriod = await api<ApiFailure>(
      `/api/snapshots/${SNAPSHOT_A}/temporal?desde=${encodeURIComponent("2026-11-15T12:00:00-05:00")}&hasta=${encodeURIComponent("2026-11-15T11:00:00-05:00")}&corte=${encodeURIComponent("2026-11-15T13:00:00-05:00")}`,
      { cookie: administratorCookie },
    );
    expect(mismatch.response.status).toBe(400);
    expect(mismatch.body.error.code).toBe("SCENARIO_MISMATCH");
    expect(invalidPeriod.response.status).toBe(400);
    expect(invalidPeriod.body.error.code).toBe("INVALID_TEMPORAL_QUERY");
  });

  it("M6.5 consulta la semana completa sin mezclar los snapshots A y B", async () => {
    const cutoff = "2026-11-15T23:59:00-05:00";
    const [temporal, dashboard] = await Promise.all([
      api<ApiSuccess<TemporalResponse>>(
        `/api/snapshots/${WEEKLY_FINAL}/temporal?escenarioId=${WEEKLY_SCENARIO}&perspectiva=fisica&corte=${encodeURIComponent(cutoff)}`,
        { cookie: administratorCookie },
      ),
      api<ApiSuccess<DashboardResponse>>(
        `/api/dashboard?snapshotId=${WEEKLY_FINAL}`,
        { cookie: administratorCookie },
      ),
    ]);
    expect(temporal.response.status, JSON.stringify(temporal.body)).toBe(200);
    expect(temporal.body.data).toMatchObject({
      referencia: {
        snapshot_id: WEEKLY_FINAL,
        escenario_id: WEEKLY_SCENARIO,
        snapshot_base_id: WEEKLY_BASE,
      },
      completitud: { estado: "completa", limitaciones: [] },
    });
    expect(temporal.body.data.eventos).toHaveLength(352);
    expect(temporal.body.data.reconstruccion.eventos_aplicados).toHaveLength(352);
    expect(dashboard.response.status, JSON.stringify(dashboard.body)).toBe(200);
    expect(dashboard.body.data.centros).toHaveLength(6);
    expect(dashboard.body.data.centros[0]?.productos).toHaveLength(32);
    expect(dashboard.body.data.donaciones_esperadas).toHaveLength(80);
  }, 20_000);

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
