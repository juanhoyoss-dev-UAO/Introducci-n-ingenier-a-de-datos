import { describe, expect, it } from "vitest";

import { getDashboard } from "@/server/services/dashboard";
import { getTemporalAnalysis } from "@/server/services/temporal";
import { CsvOperationsRepository } from "@/server/repositories/csv-operations";

const SCENARIO = "65000000-0000-4000-8000-000000000001";
const BASE = "65000000-0000-4000-8000-000000000002";
const FINAL = "65000000-0000-4000-8000-000000000003";

function repository() {
  return new CsvOperationsRepository();
}

describe("escenario semanal M6.5", () => {
  it("publica dos snapshots aislados y validos", async () => {
    const repo = repository();
    const [base, final, snapshots] = await Promise.all([
      repo.getSnapshotBundle(BASE),
      repo.getSnapshotBundle(FINAL),
      repo.listSnapshots(),
    ]);
    expect(base).not.toBeNull();
    expect(final).not.toBeNull();
    expect(snapshots.map((row) => row.id)).toEqual(
      expect.arrayContaining([
        "10000000-0000-4000-8000-000000000001",
        "10000000-0000-4000-8000-000000000002",
        BASE,
        FINAL,
      ]),
    );
    expect(final?.metadata).toMatchObject({
      escenario_id: SCENARIO,
      snapshot_base_id: BASE,
      snapshot_origen_id: BASE,
    });
    expect(final?.centers).toHaveLength(6);
    expect(final?.products).toHaveLength(32);
    expect(final?.presentations).toHaveLength(40);
    expect(final?.movements).toHaveLength(147);
    expect(final?.operationalEvents).toHaveLength(205);
  });

  it("reconstruye inicio, mitad y cierre sin duplicar recepciones", async () => {
    const repo = repository();
    const checkpoints = [
      "2026-11-09T08:00:00-05:00",
      "2026-11-10T12:00:00-05:00",
      "2026-11-11T16:00:00-05:00",
      "2026-11-15T23:59:00-05:00",
    ];
    const results = await Promise.all(
      checkpoints.map((cutoff) =>
        getTemporalAnalysis(
          FINAL,
          {
            escenario_id: SCENARIO,
            centro_id: "C01",
            producto_id: "P01",
            corte: cutoff,
            perspectiva: "fisica",
          },
          repo,
        ),
      ),
    );
    const finalBundle = await repo.getSnapshotBundle(FINAL);
    const waterSkus = new Map(
      finalBundle!.presentations
        .filter((row) => row.producto_id === "P01")
        .map((row) => [row.sku_id, row.contenido_por_paquete]),
    );
    expect(results.every((result) => result.completitud.estado === "completa")).toBe(true);
    expect(results[0]?.eventos.length).toBeLessThan(results[3]!.eventos.length);
    const normalized = (rows: Array<{ centro_id: string; sku_id: string; cantidad_paquetes: number }>) =>
      rows
        .map(({ centro_id, sku_id, cantidad_paquetes }) => ({ centro_id, sku_id, cantidad_paquetes }))
        .sort((left, right) => `${left.centro_id}:${left.sku_id}`.localeCompare(`${right.centro_id}:${right.sku_id}`));
    expect(normalized(results[3]!.reconstruccion.inventario)).toEqual(
      normalized(finalBundle!.inventory),
    );
    const references = results.map((result) => ({
      cutoff: result.corte,
      applied: result.reconstruccion.eventos_aplicados.length,
      inventoryRows: result.reconstruccion.inventario.length,
      waterInventory: result.reconstruccion.inventario
        .filter((row) => row.centro_id === "C01" && waterSkus.has(row.sku_id))
        .reduce(
          (total, row) => total + row.cantidad_paquetes * waterSkus.get(row.sku_id)!,
          0,
        ),
      need: result.reconstruccion.necesidades.find((row) => row.centro_id === "C01" && row.producto_id === "P01")?.objetivo_unidad_base,
      volunteers: result.reconstruccion.voluntarios.find((row) => row.centro_id === "C01"),
      alerts: result.indicadores.alertas.alertas.length,
    }));
    expect(references).toEqual([
      { cutoff: "2026-11-09T08:00:00-05:00", applied: 0, inventoryRows: 126, waterInventory: 267_000, need: 534_000, volunteers: { centro_id: "C01", disponibles: 8, requeridos: 15 }, alerts: 189 },
      { cutoff: "2026-11-10T12:00:00-05:00", applied: 66, inventoryRows: 128, waterInventory: 442_800, need: 491_280, volunteers: { centro_id: "C01", disponibles: 11, requeridos: 15 }, alerts: 208 },
      { cutoff: "2026-11-11T16:00:00-05:00", applied: 135, inventoryRows: 136, waterInventory: 442_800, need: 491_280, volunteers: { centro_id: "C01", disponibles: 10, requeridos: 15 }, alerts: 227 },
      { cutoff: "2026-11-15T23:59:00-05:00", applied: 352, inventoryRows: 157, waterInventory: 438_000, need: 0, volunteers: { centro_id: "C01", disponibles: 10, requeridos: 13 }, alerts: 291 },
    ]);
  });

  it("distingue hora fisica e informativa y excluye eventos posteriores", async () => {
    const repo = repository();
    const cutoff = "2026-11-11T16:00:00-05:00";
    const [physical, informational, before] = await Promise.all([
      getTemporalAnalysis(FINAL, { escenario_id: SCENARIO, corte: cutoff, perspectiva: "fisica" }, repo),
      getTemporalAnalysis(FINAL, { escenario_id: SCENARIO, corte: cutoff, perspectiva: "informativa" }, repo),
      getTemporalAnalysis(FINAL, { escenario_id: SCENARIO, corte: "2026-11-09T08:00:00-05:00", perspectiva: "fisica" }, repo),
    ]);
    expect(physical.reconstruccion.eventos_aplicados.length).toBeGreaterThan(informational.reconstruccion.eventos_aplicados.length);
    expect(before.reconstruccion.eventos_aplicados.length).toBeLessThan(physical.reconstruccion.eventos_aplicados.length);
    expect(
      physical.series.desfase_registro.some(
        (row) => row.ocurrido_en.slice(0, 10) !== row.registrado_en.slice(0, 10),
      ),
    ).toBe(true);
  });

  it("expone estados comparables de todos los centros sin mezclarlos", async () => {
    const analysis = await getTemporalAnalysis(
      FINAL,
      {
        escenario_id: SCENARIO,
        producto_id: "P01",
        desde: "2026-11-09T00:00:00-05:00",
        hasta: "2026-11-15T23:59:59-05:00",
        corte: "2026-11-15T23:59:59-05:00",
        perspectiva: "fisica",
      },
      repository(),
    );
    const firstInstant = analysis.series.inventario_necesidad_deficit[0]?.instante;
    const rowsAtFirstInstant = analysis.series.inventario_necesidad_deficit.filter(
      (row) => row.instante === firstInstant,
    );

    expect(firstInstant).toBeTruthy();
    expect(rowsAtFirstInstant).toHaveLength(6);
    expect(new Set(rowsAtFirstInstant.map((row) => row.centro_id)).size).toBe(6);
    expect(new Set(rowsAtFirstInstant.map((row) => row.unidad))).toEqual(
      new Set(["ml"]),
    );
  });

  it("calcula alertas con la hora simulada y resuelve al menos una condicion", async () => {
    const repo = repository();
    const [start, end, dashboard] = await Promise.all([
      getTemporalAnalysis(FINAL, { escenario_id: SCENARIO, corte: "2026-11-09T08:00:00-05:00", perspectiva: "fisica" }, repo),
      getTemporalAnalysis(FINAL, { escenario_id: SCENARIO, corte: "2026-11-15T23:59:00-05:00", perspectiva: "fisica" }, repo),
      getDashboard(FINAL, repo, "2026-11-15T23:59:00-05:00"),
    ]);
    const endIds = new Set(end.indicadores.alertas.alertas.map((row) => row.alerta_id));
    expect(start.indicadores.alertas.alertas.some((row) => !endIds.has(row.alerta_id))).toBe(true);
    expect(end.indicadores.alertas.evaluado_en).toBe("2026-11-15T23:59:00-05:00");
    expect(dashboard.alertas.evaluado_en).toBe("2026-11-15T23:59:00-05:00");
    expect(end.indicadores.alertas.alertas.some((row) => row.tipo === "donacion_retrasada")).toBe(true);
    expect(end.indicadores.alertas.alertas.every((row) => row.tipo !== "capacidad")).toBe(true);
  });

  it("consolida alertas por jornada con el reloj del escenario", async () => {
    const repo = repository();
    const rows = [];
    for (let day = 9; day <= 15; day += 1) {
      const cutoff = `2026-11-${String(day).padStart(2, "0")}T23:59:00-05:00`;
      const analysis = await getTemporalAnalysis(
        FINAL,
        { escenario_id: SCENARIO, corte: cutoff, perspectiva: "fisica" },
        repo,
      );
      rows.push({ date: cutoff.slice(0, 10), total: analysis.indicadores.alertas.total, types: analysis.indicadores.alertas.por_tipo });
    }
    expect(rows).toEqual([
      { date: "2026-11-09", total: 201, types: { deficit_cobertura: 169, voluntariado_insuficiente: 4, donacion_retrasada: 1, informacion_desactualizada: 11, capacidad: 0, excedente_transferible: 16 } },
      { date: "2026-11-10", total: 213, types: { deficit_cobertura: 166, voluntariado_insuficiente: 3, donacion_retrasada: 0, informacion_desactualizada: 25, capacidad: 0, excedente_transferible: 19 } },
      { date: "2026-11-11", total: 232, types: { deficit_cobertura: 159, voluntariado_insuficiente: 3, donacion_retrasada: 1, informacion_desactualizada: 42, capacidad: 0, excedente_transferible: 27 } },
      { date: "2026-11-12", total: 247, types: { deficit_cobertura: 154, voluntariado_insuficiente: 3, donacion_retrasada: 1, informacion_desactualizada: 58, capacidad: 0, excedente_transferible: 31 } },
      { date: "2026-11-13", total: 263, types: { deficit_cobertura: 145, voluntariado_insuficiente: 3, donacion_retrasada: 1, informacion_desactualizada: 75, capacidad: 0, excedente_transferible: 39 } },
      { date: "2026-11-14", total: 272, types: { deficit_cobertura: 136, voluntariado_insuficiente: 2, donacion_retrasada: 2, informacion_desactualizada: 85, capacidad: 0, excedente_transferible: 47 } },
      { date: "2026-11-15", total: 291, types: { deficit_cobertura: 134, voluntariado_insuficiente: 3, donacion_retrasada: 8, informacion_desactualizada: 97, capacidad: 0, excedente_transferible: 49 } },
    ]);
  });
});
