import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AlertResolutionModal } from "@/app/dashboard/components/alert-resolution-modal";

describe("formulario de resolución A4.2", () => {
  it("precarga datos operativos, presentación, hora del escenario y vista previa", () => {
    const markup = renderToStaticMarkup(
      <AlertResolutionModal
        alert={{
          alerta_id: "alerta:deficit_cobertura:C01:P01",
          tipo: "deficit_cobertura",
          severidad: "critica",
          centro_id: "C01",
          centro_nombre: "Centro Norte",
          producto_id: "P01",
          producto_nombre: "Agua potable",
          titulo: "Déficit crítico",
          descripcion: "Cobertura insuficiente",
          valor_observado: 20,
          umbral_aplicado: 30,
          unidad: "porcentaje",
          accion_sugerida: "Registrar recepción",
          prioridad_operativa: 1,
          referencia_tipo: "snapshot",
          referencia_id: "snapshot-pruebas",
          evaluado_en: "2026-11-16T17:02:00-05:00",
          estado: "activa",
        }}
        dashboardProduct={{
          producto_id: "P01",
          nombre: "Agua potable",
          unidad_base: "ml",
          inventario_confirmado_unidad_base: 2_000,
          objetivo_unidad_base: 10_000,
          reserva_unidad_base: 0,
          prioridad: 1,
          deficit_confirmado_unidad_base: 8_000,
          cobertura_porcentaje: 20,
          deficit_potencial_unidad_base: 8_000,
          excedente_transferible_unidad_base: 0,
          donaciones_esperadas_unidad_base: 0,
          existencias: [],
        }}
        evaluationTime="2026-11-16T17:02:00-05:00"
        onCancel={() => undefined}
        onSave={async () => undefined}
        product={{
          snapshot_id: "snapshot-pruebas",
          producto_id: "P01",
          nombre: "Agua potable",
          unidad_base: "ml",
          presentaciones: [
            {
              snapshot_id: "snapshot-pruebas",
              sku_id: "AGUA-600",
              producto_id: "P01",
              nombre: "Botella de 600 ml",
              contenido_por_paquete: 600,
            },
          ],
        }}
      />,
    );

    expect(markup).toContain("Solucionar alerta");
    expect(markup).toContain("Centro Norte · Agua potable");
    expect(markup).toContain("2.000 ml");
    expect(markup).toContain("10.000 ml");
    expect(markup).toContain("8.000 ml");
    expect(markup).toContain("20 %");
    expect(markup).toContain("Botella de 600 ml");
    expect(markup).toContain('value="2026-11-16T17:02"');
    expect(markup).toContain("2.600 ml");
    expect(markup).toContain("Guardar recepción");
    expect(markup).toContain("Cancelar");
  });
});
