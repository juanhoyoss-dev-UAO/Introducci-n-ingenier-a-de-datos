import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { OperationalSummary } from "@/app/dashboard/components/operational-summary";
import type { DashboardBundle } from "@/app/dashboard/types";
import {
  ALL_PRODUCTS_FILTER,
  coverageMatrixRows,
  productCoverageRows,
  WEEKLY_OPERATIONAL_SNAPSHOT_ID,
  WEEKLY_SCENARIO_ID,
} from "@/app/dashboard/view-model";
import { CsvOperationsRepository } from "@/server/repositories/csv-operations";
import { getDashboard } from "@/server/services/dashboard";

describe("resumen operativo del escenario semanal", () => {
  it("proyecta 32 productos por seis centros con indicadores auténticos", async () => {
    const repository = new CsvOperationsRepository();
    const [source, dashboard] = await Promise.all([
      repository.getSnapshotBundle(WEEKLY_OPERATIONAL_SNAPSHOT_ID),
      getDashboard(
        WEEKLY_OPERATIONAL_SNAPSHOT_ID,
        repository,
        "2026-11-15T23:59:00-05:00",
      ),
    ]);

    expect(source).not.toBeNull();
    expect(source?.metadata).toMatchObject({
      id: WEEKLY_OPERATIONAL_SNAPSHOT_ID,
      escenario_id: WEEKLY_SCENARIO_ID,
    });

    const bundle: DashboardBundle = {
      snapshot: source!.metadata,
      centers: source!.centers,
      products: source!.products.map((product) => ({
        ...product,
        presentaciones: source!.presentations.filter(
          (presentation) =>
            presentation.producto_id === product.producto_id,
        ),
      })),
      travelTimes: source!.travelTimes,
      dashboard,
    };
    const matrix = coverageMatrixRows(bundle, "all");
    const cells = matrix.filas.flatMap((row) => row.celdas);

    expect(matrix.centros).toHaveLength(6);
    expect(matrix.filas).toHaveLength(32);
    expect(matrix.filas.every((row) => row.celdas.length === 6)).toBe(true);
    expect(cells).toHaveLength(192);
    expect(cells.some((cell) => cell?.estado === "deficit_importante")).toBe(
      true,
    );
    expect(cells.some((cell) => cell?.estado === "deficit_parcial")).toBe(
      true,
    );
    expect(cells.some((cell) => cell?.estado === "cubierta")).toBe(true);
    expect(cells.some((cell) => cell?.estado === "excedente")).toBe(true);
    expect(cells.some((cell) => cell?.estado === "sin_necesidad")).toBe(true);
    expect(
      cells
        .filter((cell) => cell?.objetivo_unidad_base === 0)
        .every((cell) => cell?.cobertura_porcentaje === null),
    ).toBe(true);

    const filtered = coverageMatrixRows(bundle, matrix.centros[0]!.centro_id);
    expect(filtered.centros).toHaveLength(1);
    expect(filtered.filas).toHaveLength(32);
    expect(filtered.filas.every((row) => row.celdas.length === 1)).toBe(true);

    const productCoverage = productCoverageRows(
      bundle,
      matrix.centros[0]!.centro_id,
    );
    expect(productCoverage).toHaveLength(32);
    expect(
      productCoverage.findIndex(
        (row) => row.deficit_confirmado_unidad_base === 0,
      ),
    ).toBeGreaterThan(
      productCoverage.findIndex(
        (row) => row.deficit_confirmado_unidad_base > 0,
      ),
    );

    const renderSummary = (centerFilter: string, productId: string) =>
      renderToStaticMarkup(
        createElement(OperationalSummary, {
          bundle,
          centerFilter,
          productId,
        }),
      );
    const allCentersAllProducts = renderSummary(
      "all",
      ALL_PRODUCTS_FILTER,
    );
    expect(allCentersAllProducts).toContain(
      "Matriz de cobertura por producto y centro",
    );
    expect(allCentersAllProducts).toContain("Disponibilidad de voluntarios");
    expect(allCentersAllProducts).not.toContain(">Cobertura por centro<");
    expect(allCentersAllProducts).not.toContain(
      ">Recursos confirmados frente a esperados<",
    );

    const oneCenterAllProducts = renderSummary("C01", ALL_PRODUCTS_FILTER);
    expect(oneCenterAllProducts).toContain(">Cobertura por producto<");
    expect(oneCenterAllProducts).toContain("Disponibilidad de voluntarios");
    expect(oneCenterAllProducts).not.toContain(
      "Matriz de cobertura por producto y centro",
    );
    expect(oneCenterAllProducts).not.toContain(
      ">Recursos confirmados frente a esperados<",
    );
    expect(oneCenterAllProducts).toContain("Sin necesidad declarada");

    for (const centerFilter of ["all", "C01"]) {
      const oneProduct = renderSummary(centerFilter, "P01");
      expect(oneProduct).toContain(">Cobertura por centro<");
      expect(oneProduct).toContain(">Inventario frente a necesidades<");
      expect(oneProduct).toContain(
        ">Recursos confirmados frente a esperados<",
      );
      expect(oneProduct).not.toContain("Disponibilidad de voluntarios");
      expect(oneProduct).not.toContain(
        "Matriz de cobertura por producto y centro",
      );
      expect(oneProduct).not.toContain(">Cobertura por producto<");
    }
  });
});
