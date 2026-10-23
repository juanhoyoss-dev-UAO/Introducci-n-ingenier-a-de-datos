import { beforeAll, describe, expect, it } from "vitest";

import {
  ADMIN_EMAIL,
  createSessionCookieHeader,
  integrationIsEnabled,
  recreateAuthorizationFixtures,
  TEST_PASSWORD,
  USER_EMAIL,
} from "../helpers/supabase";

const SNAPSHOT_A = "10000000-0000-4000-8000-000000000001";
const UNKNOWN_SNAPSHOT = "10000000-0000-4000-8000-000000000099";

interface ApiSuccess<T> {
  data: T;
  meta: Record<string, unknown>;
}

interface ApiFailure {
  error: { code: string; message: string; details?: unknown };
}

interface ProductResponse {
  producto_id: string;
  presentaciones: Array<{ sku_id: string }>;
}

interface DashboardResponse {
  centros: Array<{
    centro_id: string;
    productos: Array<{
      producto_id: string;
      inventario_confirmado_unidad_base: number;
      donaciones_esperadas_unidad_base: number;
      deficit_confirmado_unidad_base: number;
    }>;
  }>;
  candidatos_traslado: Array<{
    origen_id: string;
    destino_id: string;
    minutos: number;
    total_unidad_base: number;
  }>;
}

describe.runIf(integrationIsEnabled())("HTTP real", () => {
  let baseUrl: string;
  let administratorCookie: string;
  let regularUserCookie: string;

  beforeAll(async () => {
    baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
    const hostname = new URL(baseUrl).hostname;
    if (hostname !== "127.0.0.1" && hostname !== "localhost") {
      throw new Error("Las pruebas HTTP solo se permiten contra la aplicación local.");
    }

    await recreateAuthorizationFixtures();
    administratorCookie = await createSessionCookieHeader(
      ADMIN_EMAIL,
      TEST_PASSWORD,
    );
    regularUserCookie = await createSessionCookieHeader(
      USER_EMAIL,
      TEST_PASSWORD,
    );
  });

  async function request<T>(path: string, cookie?: string) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: cookie ? { cookie } : undefined,
    });
    return { response, body: (await response.json()) as T };
  }

  it("expone health sin información sensible", async () => {
    const { response, body } = await request<
      ApiSuccess<{ status: string }>
    >("/api/health");
    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { status: "ok" }, meta: {} });
  });

  it("T09 diferencia anónimo, usuario no autorizado y administrador", async () => {
    const anonymous = await request<ApiFailure>("/api/snapshots");
    const regular = await request<ApiFailure>(
      "/api/snapshots",
      regularUserCookie,
    );
    const administrator = await request<ApiSuccess<Array<{ id: string }>>>(
      "/api/snapshots",
      administratorCookie,
    );

    expect(anonymous.response.status).toBe(401);
    expect(anonymous.body.error.code).toBe("UNAUTHENTICATED");
    expect(regular.response.status).toBe(403);
    expect(regular.body.error.code).toBe("FORBIDDEN");
    expect(administrator.response.status).toBe(200);
    expect(administrator.body.data).toHaveLength(2);
  });

  it("T08 consulta snapshots, seis centros, productos y tiempos desde PostgreSQL", async () => {
    const snapshots = await request<ApiSuccess<Array<{ id: string }>>>(
      "/api/snapshots",
      administratorCookie,
    );
    const centers = await request<
      ApiSuccess<Array<{ centro_id: string }>>
    >(`/api/centers?snapshotId=${SNAPSHOT_A}`, administratorCookie);
    const products = await request<ApiSuccess<ProductResponse[]>>(
      `/api/products?snapshotId=${SNAPSHOT_A}`,
      administratorCookie,
    );
    const times = await request<
      ApiSuccess<Array<{ origen_id: string; destino_id: string }>>
    >(`/api/travel-times?snapshotId=${SNAPSHOT_A}`, administratorCookie);

    expect(snapshots.response.status).toBe(200);
    expect(snapshots.body.data).toHaveLength(2);
    expect(centers.response.status).toBe(200);
    expect(centers.body.data).toHaveLength(6);
    expect(products.response.status).toBe(200);
    expect(products.body.data).toHaveLength(5);
    expect(
      products.body.data.flatMap((product) => product.presentaciones),
    ).toHaveLength(7);
    expect(times.response.status).toBe(200);
    expect(times.body.data).toContainEqual(
      expect.objectContaining({ origen_id: "C02", destino_id: "C01" }),
    );
  });

  it("T08 entrega los cálculos obligatorios desde el dashboard backend", async () => {
    const { response, body } = await request<ApiSuccess<DashboardResponse>>(
      `/api/dashboard?snapshotId=${SNAPSHOT_A}`,
      administratorCookie,
    );
    expect(response.status).toBe(200);

    const center = body.data.centros.find((item) => item.centro_id === "C01");
    const water = center?.productos.find(
      (product) => product.producto_id === "P01",
    );
    expect(water).toMatchObject({
      inventario_confirmado_unidad_base: 12000,
      donaciones_esperadas_unidad_base: 6000,
      deficit_confirmado_unidad_base: 8000,
    });
    expect(body.data.candidatos_traslado).toContainEqual(
      expect.objectContaining({
        origen_id: "C02",
        destino_id: "C01",
        minutos: 15,
      }),
    );
  });

  it("T10 diferencia parámetros ausentes, inválidos e inexistentes", async () => {
    const missing = await request<ApiFailure>(
      "/api/centers",
      administratorCookie,
    );
    const malformed = await request<ApiFailure>(
      "/api/centers?snapshotId=no-es-uuid",
      administratorCookie,
    );
    const notFound = await request<ApiFailure>(
      `/api/centers?snapshotId=${UNKNOWN_SNAPSHOT}`,
      administratorCookie,
    );

    expect(missing.response.status).toBe(400);
    expect(missing.body.error.code).toBe("MISSING_SNAPSHOT_ID");
    expect(malformed.response.status).toBe(400);
    expect(malformed.body.error.code).toBe("INVALID_SNAPSHOT_ID");
    expect(notFound.response.status).toBe(404);
    expect(notFound.body.error.code).toBe("SNAPSHOT_NOT_FOUND");
    expect(JSON.stringify(notFound.body)).not.toMatch(/stack|postgres|supabase/i);
  });
});

