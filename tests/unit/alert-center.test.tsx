import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AlertCenter } from "@/app/dashboard/components/alert-center";
import type { AlertEvaluationResult } from "@/contracts/types/alerts";

const evaluation: AlertEvaluationResult = {
  evaluado_en: "2026-11-16T10:00:00-05:00",
  referencia_tipo: "snapshot",
  referencia_id: "snapshot-pruebas",
  total: 2,
  por_severidad: {
    critica: 1,
    advertencia: 1,
    informativa: 0,
  },
  por_centro: [
    {
      centro_id: "C01",
      centro_nombre: "Centro Norte",
      total: 1,
      criticas: 1,
      advertencias: 0,
      informativas: 0,
    },
    {
      centro_id: "C02",
      centro_nombre: "Centro Sur",
      total: 1,
      criticas: 0,
      advertencias: 1,
      informativas: 0,
    },
  ],
  por_tipo: {
    deficit_cobertura: 1,
    voluntariado_insuficiente: 0,
    donacion_retrasada: 0,
    informacion_desactualizada: 0,
    capacidad: 0,
    excedente_transferible: 0,
  },
  centros_que_requieren_atencion: 2,
  informacion_temporal_desconocida: [],
  alertas: [
    {
      alerta_id: "alerta:deficit_cobertura:C01:P01",
      tipo: "deficit_cobertura",
      severidad: "critica",
      centro_id: "C01",
      centro_nombre: "Centro Norte",
      producto_id: "P01",
      producto_nombre: "Agua potable",
      titulo: "Déficit crítico oculto inicialmente",
      descripcion: "La cobertura es insuficiente.",
      valor_observado: 20,
      umbral_aplicado: 30,
      unidad: "porcentaje",
      accion_sugerida: "Revisar abastecimiento.",
      prioridad_operativa: 1,
      referencia_tipo: "snapshot",
      referencia_id: "snapshot-pruebas",
      evaluado_en: "2026-11-16T10:00:00-05:00",
      estado: "activa",
    },
    {
      alerta_id: "alerta:deficit_cobertura:C02:P01",
      tipo: "deficit_cobertura",
      severidad: "advertencia",
      centro_id: "C02",
      centro_nombre: "Centro Sur",
      producto_id: "P01",
      producto_nombre: "Agua potable",
      titulo: "Déficit del centro sur",
      descripcion: "La cobertura requiere seguimiento.",
      valor_observado: 60,
      umbral_aplicado: 70,
      unidad: "porcentaje",
      accion_sugerida: "Revisar abastecimiento.",
      prioridad_operativa: 2,
      referencia_tipo: "snapshot",
      referencia_id: "snapshot-pruebas",
      evaluado_en: "2026-11-16T10:00:00-05:00",
      estado: "activa",
    },
  ],
};

function renderCenter(
  openGroups: Array<"agua_alimentos"> = [],
  initialCenterFilter: "all" | "C01" = "all",
) {
  return renderToStaticMarkup(
      <AlertCenter
        dashboardCenters={[
          {
            snapshot_id: "snapshot-pruebas",
            centro_id: "C01",
            nombre: "Centro Norte",
            estado: "activo",
            zona: "Norte",
            coordinador_nombre: "Coordinación Norte",
            voluntarios: { disponibles: 1, requeridos: 2, faltantes: 1 },
            capacidad_almacenamiento: {
              calculable: false,
              capacidad_maxima_kg: null,
              peso_almacenado_kg: null,
              ocupacion_porcentaje: null,
              sobrecapacidad: null,
              datos_faltantes: ["capacidad_maxima_kg"],
            },
            productos: [
              {
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
              },
            ],
          },
        ]}
        evaluation={evaluation}
        initialCenterFilter={initialCenterFilter}
        latestImportResult={null}
        onImportComplete={() => undefined}
        onNavigate={() => undefined}
        onOpenGroupsChange={() => undefined}
        onSaveReception={async () => undefined}
        onResetComplete={() => undefined}
        openGroups={openGroups}
        products={[
          {
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
          },
        ]}
        resolutionSummary={null}
        snapshot={{
          id: "snapshot-pruebas",
          nombre: "PRUEBAS",
          created_at: "2026-11-16T10:00:00-05:00",
          descripcion: null,
          escenario_id: "a3000000-0000-4000-8000-000000000001",
        }}
      />,
  );
}

describe("centro de alertas A4", () => {
  it("presenta los cuatro grupos cerrados sin renderizar tarjetas individuales", () => {
    const markup = renderCenter();

    expect(markup).toContain("Agua y alimentos");
    expect(markup).toContain("Abrigo e higiene");
    expect(markup).toContain("Herramientas y apoyo");
    expect(markup).toContain("Otras alertas operativas");
    expect(markup.match(/aria-expanded="false"/g)).toHaveLength(4);
    expect(markup).not.toContain("Déficit crítico oculto inicialmente");
  });

  it("elimina la franja oscura y ofrece resolver el déficit al abrir su grupo", () => {
    const markup = renderCenter(["agua_alimentos"]);

    expect(markup).toContain("Alertas operativas");
    expect(markup).toContain("Evaluación:");
    expect(markup).not.toContain("Monitoreo derivado del snapshot");
    expect(markup).toContain("Déficit crítico oculto inicialmente");
    expect(markup).toContain("Solucionar alerta");
    expect(markup).not.toContain("Ver apartado relacionado");
  });

  it("usa el filtro global y oculta centros con atención para un centro", () => {
    const markup = renderCenter(["agua_alimentos"], "C01");

    expect(markup).toContain("Alertas activas");
    expect(markup).toContain("Críticas");
    expect(markup).toContain("Advertencias");
    expect(markup).not.toContain("Centros con atención");
    expect(markup).not.toContain(">Centro<");
    expect(markup).toContain("Déficit crítico oculto inicialmente");
    expect(markup).not.toContain("Déficit del centro sur");
    expect(markup).toMatch(/Alertas activas[\s\S]*?>1<\/p>/);
    expect(markup).toMatch(/Advertencias[\s\S]*?>0<\/p>/);
  });
});
