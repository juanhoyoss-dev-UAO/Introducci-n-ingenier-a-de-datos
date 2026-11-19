import { describe, expect, it } from "vitest";

import type { SnapshotBundle } from "@/contracts/schemas/data";
import type { TemporalEvent } from "@/contracts/types/temporal";
import { reconstructTemporalState } from "@/domain/temporal";

const SCENARIO = "10000000-0000-4000-8000-000000000001";

function baseBundle(): SnapshotBundle {
  return {
    metadata: {
      id: SCENARIO,
      nombre: "Base temporal",
      created_at: "2026-11-15T08:00:00-05:00",
      descripcion: null,
    },
    centers: [
      {
        snapshot_id: SCENARIO,
        centro_id: "C01",
        nombre: "Centro Norte",
        estado: "activo",
        zona: null,
        coordinador_nombre: "Coordinación",
      },
    ],
    products: [
      {
        snapshot_id: SCENARIO,
        producto_id: "P01",
        nombre: "Agua",
        unidad_base: "ml",
      },
    ],
    presentations: [
      {
        snapshot_id: SCENARIO,
        sku_id: "AGUA-600",
        producto_id: "P01",
        nombre: "Botella 600 ml",
        contenido_por_paquete: 600,
      },
    ],
    inventory: [
      {
        snapshot_id: SCENARIO,
        centro_id: "C01",
        sku_id: "AGUA-600",
        cantidad_paquetes: 10,
      },
    ],
    needs: [
      {
        snapshot_id: SCENARIO,
        centro_id: "C01",
        producto_id: "P01",
        objetivo_unidad_base: 20_000,
        reserva_unidad_base: 0,
        prioridad: 1,
      },
    ],
    volunteers: [
      {
        snapshot_id: SCENARIO,
        centro_id: "C01",
        disponibles: 2,
        requeridos: 5,
      },
    ],
    travelTimes: [],
    expectedDonations: [],
    qrDonations: [],
    movements: [],
    operationalEvents: [],
  };
}

function reception(overrides: Partial<TemporalEvent> = {}): TemporalEvent {
  return {
    evento_id: "event-reception",
    operacion_id: "operation-reception",
    escenario_id: SCENARIO,
    snapshot_origen_id: SCENARIO,
    tipo: "recepcion_confirmada",
    operacion: "direct_reception",
    centro_id: "C01",
    producto_id: "P01",
    sku_id: "AGUA-600",
    ocurrido_en: "2026-11-15T09:00:00-05:00",
    registrado_en: "2026-11-15T09:30:00-05:00",
    orden: 1,
    incorporado_en_estado_inicial: false,
    payload: { cantidad_paquetes: 5, intencion_id: null },
    ...overrides,
  } as TemporalEvent;
}

function inventory(result: ReturnType<typeof reconstructTemporalState>) {
  return result.estado.inventory[0]?.cantidad_paquetes;
}

describe("reconstrucción temporal M6", () => {
  it("conserva el estado inicial cuando no hay eventos", () => {
    const initial = baseBundle();
    const result = reconstructTemporalState(
      initial,
      [],
      SCENARIO,
      "2026-11-15T10:00:00-05:00",
      "fisica",
    );
    expect(inventory(result)).toBe(10);
    expect(result.eventos_aplicados).toEqual([]);
  });

  it("aplica una recepción ocurrida antes del corte", () => {
    const result = reconstructTemporalState(
      baseBundle(),
      [reception()],
      SCENARIO,
      "2026-11-15T10:00:00-05:00",
      "fisica",
    );
    expect(inventory(result)).toBe(15);
  });

  it("incorpora un anuncio antes de confirmar su recepción", () => {
    const announcement: TemporalEvent = {
      ...reception(),
      evento_id: "event-announcement",
      operacion_id: "operation-announcement",
      tipo: "anuncio_donacion",
      operacion: "announce_donation",
      ocurrido_en: "2026-11-15T08:30:00-05:00",
      registrado_en: "2026-11-15T08:30:00-05:00",
      orden: 0,
      payload: {
        intencion_id: "SIM-D001",
        cantidad_paquetes: 5,
        llegada_prevista: "2026-11-15T09:00:00-05:00",
      },
    };
    const confirmation = reception({
      operacion: "confirm_donation",
      payload: { cantidad_paquetes: 4, intencion_id: "SIM-D001" },
    });
    const result = reconstructTemporalState(
      baseBundle(),
      [confirmation, announcement],
      SCENARIO,
      "2026-11-15T10:00:00-05:00",
      "fisica",
    );
    expect(inventory(result)).toBe(14);
    expect(result.estado.expectedDonations).toContainEqual(
      expect.objectContaining({
        intencion_id: "SIM-D001",
        cantidad_paquetes: 5,
        estado: "recibida",
      }),
    );
  });

  it("no aplica una recepción posterior al corte", () => {
    const result = reconstructTemporalState(
      baseBundle(),
      [reception()],
      SCENARIO,
      "2026-11-15T08:59:59-05:00",
      "fisica",
    );
    expect(inventory(result)).toBe(10);
    expect(result.eventos_omitidos[0]?.motivo).toBe("posterior_al_corte");
  });

  it("aplica un despacho válido", () => {
    const dispatch: TemporalEvent = {
      ...reception(),
      evento_id: "event-dispatch",
      tipo: "despacho",
      operacion: "dispatch",
      payload: { cantidad_paquetes: 4 },
    };
    const result = reconstructTemporalState(
      baseBundle(),
      [dispatch],
      SCENARIO,
      "2026-11-15T10:00:00-05:00",
      "fisica",
    );
    expect(inventory(result)).toBe(6);
  });

  it("ordena eventos desordenados por hora efectiva", () => {
    const dispatch: TemporalEvent = {
      ...reception(),
      evento_id: "event-dispatch",
      tipo: "despacho",
      operacion: "dispatch",
      ocurrido_en: "2026-11-15T09:30:00-05:00",
      payload: { cantidad_paquetes: 12 },
    };
    const result = reconstructTemporalState(
      baseBundle(),
      [dispatch, reception({ ocurrido_en: "2026-11-15T09:00:00-05:00" })],
      SCENARIO,
      "2026-11-15T10:00:00-05:00",
      "fisica",
    );
    expect(inventory(result)).toBe(3);
    expect(result.eventos_aplicados).toEqual([
      "event-reception",
      "event-dispatch",
    ]);
  });

  it("ordena por instante real cuando los offsets ISO son diferentes", () => {
    const adjustment: TemporalEvent = {
      ...reception(),
      evento_id: "event-adjustment",
      operacion_id: "operation-adjustment",
      tipo: "ajuste_inventario",
      operacion: "upsert_inventory",
      ocurrido_en: "2026-11-15T17:00:00.000Z",
      payload: { cantidad_paquetes: 20 },
    };
    const laterReception = reception({
      ocurrido_en: "2026-11-15T12:30:00-05:00",
    });
    const result = reconstructTemporalState(
      baseBundle(),
      [laterReception, adjustment],
      SCENARIO,
      "2026-11-15T17:45:00.000Z",
      "fisica",
    );
    expect(inventory(result)).toBe(25);
    expect(result.eventos_aplicados).toEqual([
      "event-adjustment",
      "event-reception",
    ]);
  });

  it("desempata eventos con la misma hora usando orden estable", () => {
    const first: TemporalEvent = {
      ...reception(),
      evento_id: "event-a",
      operacion_id: "operation-a",
      tipo: "ajuste_inventario",
      operacion: "upsert_inventory",
      orden: 1,
      payload: { cantidad_paquetes: 20 },
    };
    const second: TemporalEvent = {
      ...first,
      evento_id: "event-b",
      operacion_id: "operation-b",
      orden: 2,
      payload: { cantidad_paquetes: 7 },
    };
    const result = reconstructTemporalState(
      baseBundle(),
      [second, first],
      SCENARIO,
      "2026-11-15T10:00:00-05:00",
      "fisica",
    );
    expect(inventory(result)).toBe(7);
  });

  it("mantiene aislados escenarios diferentes", () => {
    const result = reconstructTemporalState(
      baseBundle(),
      [reception({ escenario_id: "otro-escenario" })],
      SCENARIO,
      "2026-11-15T10:00:00-05:00",
      "fisica",
    );
    expect(inventory(result)).toBe(10);
    expect(result.eventos_omitidos[0]?.motivo).toBe("escenario_distinto");
  });

  it("no vuelve a aplicar eventos incorporados al estado inicial", () => {
    const result = reconstructTemporalState(
      baseBundle(),
      [reception({ incorporado_en_estado_inicial: true })],
      SCENARIO,
      "2026-11-15T10:00:00-05:00",
      "fisica",
    );
    expect(inventory(result)).toBe(10);
    expect(result.eventos_omitidos[0]?.motivo).toBe(
      "incorporado_en_estado_inicial",
    );
  });

  it("rechaza un despacho que produciría inventario negativo", () => {
    const event: TemporalEvent = {
      ...reception(),
      tipo: "despacho",
      operacion: "dispatch",
      payload: { cantidad_paquetes: 11 },
    };
    const result = reconstructTemporalState(
      baseBundle(),
      [event],
      SCENARIO,
      "2026-11-15T10:00:00-05:00",
      "fisica",
    );
    expect(inventory(result)).toBe(10);
    expect(result.completa).toBe(false);
    expect(result.eventos_omitidos[0]?.motivo).toBe(
      "inventario_insuficiente",
    );
  });

  it("separa el estado físico del informativo", () => {
    const physical = reconstructTemporalState(
      baseBundle(),
      [reception()],
      SCENARIO,
      "2026-11-15T09:15:00-05:00",
      "fisica",
    );
    const informational = reconstructTemporalState(
      baseBundle(),
      [reception()],
      SCENARIO,
      "2026-11-15T09:15:00-05:00",
      "informativa",
    );
    expect(inventory(physical)).toBe(15);
    expect(inventory(informational)).toBe(10);
  });

  it("reconstruye necesidades y voluntariado con evidencia", () => {
    const need: TemporalEvent = {
      ...reception(),
      evento_id: "event-need",
      tipo: "actualizacion_necesidad",
      operacion: "upsert_need",
      producto_id: "P01",
      sku_id: null,
      payload: {
        objetivo_unidad_base: 30_000,
        reserva_unidad_base: 0,
        prioridad: 2,
      },
    };
    const volunteers: TemporalEvent = {
      ...reception(),
      evento_id: "event-volunteers",
      tipo: "actualizacion_voluntariado",
      operacion: "upsert_volunteers",
      producto_id: null,
      sku_id: null,
      orden: 2,
      payload: { disponibles: 6, requeridos: 8 },
    };
    const result = reconstructTemporalState(
      baseBundle(),
      [volunteers, need],
      SCENARIO,
      "2026-11-15T10:00:00-05:00",
      "fisica",
    );
    expect(result.estado.needs[0]).toMatchObject({
      objetivo_unidad_base: 30_000,
      prioridad: 2,
    });
    expect(result.estado.volunteers[0]).toMatchObject({
      disponibles: 6,
      requeridos: 8,
    });
  });

  it("no modifica el estado inicial", () => {
    const initial = baseBundle();
    reconstructTemporalState(
      initial,
      [reception()],
      SCENARIO,
      "2026-11-15T10:00:00-05:00",
      "fisica",
    );
    expect(initial.inventory[0].cantidad_paquetes).toBe(10);
  });

  it("aplica activación o desactivación de centros", () => {
    const event: TemporalEvent = {
      ...reception(),
      evento_id: "event-center",
      tipo: "cambio_estado_centro",
      operacion: "update_center",
      producto_id: null,
      sku_id: null,
      payload: {
        nombre: "Centro Norte",
        estado: "inactivo",
        zona: null,
        coordinador_nombre: "Coordinación",
      },
    };
    const result = reconstructTemporalState(
      baseBundle(),
      [event],
      SCENARIO,
      "2026-11-15T10:00:00-05:00",
      "fisica",
    );
    expect(result.estado.centers[0].estado).toBe("inactivo");
  });

  it("deduplica por identificador de evento", () => {
    const result = reconstructTemporalState(
      baseBundle(),
      [reception(), reception()],
      SCENARIO,
      "2026-11-15T10:00:00-05:00",
      "fisica",
    );
    expect(inventory(result)).toBe(15);
    expect(result.eventos_omitidos).toContainEqual({
      evento_id: "event-reception",
      motivo: "evento_duplicado",
    });
  });
});
