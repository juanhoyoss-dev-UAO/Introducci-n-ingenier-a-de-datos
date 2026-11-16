import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildWeeklyScenario } from "../../scripts/generate-weekly-scenario";

async function config() {
  return JSON.parse(
    await readFile(
      path.join(
        process.cwd(),
        "data",
        "scenarios",
        "emergencia-cali-semana-2026",
        "scenario.config.json",
      ),
      "utf8",
    ),
  );
}

describe("generador semanal M6.5", () => {
  it("produce exactamente el mismo escenario con la misma semilla", async () => {
    const input = await config();
    expect(buildWeeklyScenario(input)).toEqual(buildWeeklyScenario(input));
  });

  it("genera catalogo, centros y volumen temporal dentro del contrato", async () => {
    const result = buildWeeklyScenario(await config());
    expect(result.summary).toMatchObject({
      simulated: true,
      products: 32,
      presentations: 40,
      centers: 6,
      events_total: 352,
      donation_announcements: 80,
      receptions_confirmed: 90,
      dispatches: 57,
      donations_pending_at_close: 10,
      volunteer_evaluations: 84,
    });
    expect(Object.keys(result.summary.events_by_day as object)).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
    expect(new Set(result.final.products.map((row) => row.producto_id)).size).toBe(32);
    expect(new Set(result.final.presentations.map((row) => row.sku_id)).size).toBe(40);
  });

  it("mantiene anuncios separados, movimientos unicos e inventario no negativo", async () => {
    const result = buildWeeklyScenario(await config());
    expect(result.base.expectedDonations).toHaveLength(8);
    expect(result.final.expectedDonations).toHaveLength(80);
    expect(result.final.movements).toHaveLength(147);
    expect(result.final.operationalEvents).toHaveLength(205);
    expect(result.final.inventory.every((row) => Number(row.cantidad_paquetes) >= 0)).toBe(true);
    expect(new Set(result.final.movements.map((row) => row.movimiento_id)).size).toBe(147);
    expect(new Set(result.final.operationalEvents.map((row) => row.evento_id)).size).toBe(205);
  });

  it("no modifica ni referencia los snapshots demostrativos A y B", async () => {
    const serialized = JSON.stringify(buildWeeklyScenario(await config()));
    expect(serialized).not.toContain("10000000-0000-4000-8000-000000000001");
    expect(serialized).not.toContain("10000000-0000-4000-8000-000000000002");
  });
});
