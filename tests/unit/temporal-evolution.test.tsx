import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TemporalEvolution } from "@/app/dashboard/components/temporal-evolution";

describe("presentación del historial operativo", () => {
  it("muestra filtros operativos sin UUID ni controles temporales técnicos", () => {
    const markup = renderToStaticMarkup(
      <TemporalEvolution
        centers={[
          {
            snapshot_id: "65000000-0000-4000-8000-000000000003",
            centro_id: "C01",
            nombre: "Centro Norte",
            estado: "activo",
            zona: "Norte",
            coordinador_nombre: "Coordinación Norte",
          },
        ]}
        initialCenterFilter="C01"
        initialProductId="P01"
        products={[
          {
            snapshot_id: "65000000-0000-4000-8000-000000000003",
            producto_id: "P01",
            nombre: "Agua potable",
            unidad_base: "ml",
            presentaciones: [],
          },
        ]}
        snapshot={{
          id: "65000000-0000-4000-8000-000000000003",
          nombre: "Emergencia semanal",
          created_at: "2026-11-15T23:59:00-05:00",
          descripcion: null,
          escenario_id: "65000000-0000-4000-8000-000000000001",
        }}
      />,
    );

    expect(markup).toContain("Historial operativo");
    expect(markup).toContain("Semana del 9 al 15 de noviembre");
    expect(markup).toContain("Centro Norte");
    expect(markup).toContain("Agua potable · ml");
    expect(markup).not.toContain("65000000-0000-4000-8000-000000000001");
    expect(markup).not.toContain("ocurrido_en");
    expect(markup).not.toContain("registrado_en");
    expect(markup).not.toContain("0001-");
  });
});
