import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdministrativeEditor } from "@/app/dashboard/components/administrative-editor";
import type { DashboardBundle, DashboardCenter } from "@/app/dashboard/types";

const snapshot = {
  id: "snapshot-pruebas",
  nombre: "PRUEBAS",
  created_at: "2026-11-18T10:00:00-05:00",
  descripcion: null,
};

function center(
  centro_id: string,
  nombre: string,
  disponibles: number,
  requeridos: number,
): DashboardCenter {
  return {
    snapshot_id: snapshot.id,
    centro_id,
    nombre,
    estado: "activo",
    zona: null,
    coordinador_nombre: `Coordinación ${centro_id}`,
    voluntarios: {
      disponibles,
      requeridos,
      faltantes: Math.max(0, requeridos - disponibles),
    },
    capacidad_almacenamiento: {
      calculable: false,
      capacidad_maxima_kg: null,
      peso_almacenado_kg: null,
      ocupacion_porcentaje: null,
      sobrecapacidad: null,
      datos_faltantes: ["capacidad_maxima_kg"],
    },
    productos: [],
  };
}

const dashboardCenters = [
  center("C01", "Centro Uno", 2, 4),
  center("C03", "Centro Tres", 7, 11),
];

const bundle: DashboardBundle = {
  snapshot,
  centers: dashboardCenters.map((item) => ({
    snapshot_id: item.snapshot_id,
    centro_id: item.centro_id,
    nombre: item.nombre,
    estado: item.estado,
    zona: item.zona,
    coordinador_nombre: item.coordinador_nombre,
  })),
  products: [],
  travelTimes: [],
  dashboard: {
    snapshot,
    centros: dashboardCenters,
    indicadores: { centros_activos: 2 },
    visualizaciones: {
      cobertura_por_centro: [],
      inventario_vs_necesidad: [],
      recursos_confirmados_vs_esperados: [],
      voluntarios_disponibles_vs_requeridos: [],
    },
    donaciones_esperadas: [],
    movimientos: [],
    alertas: {
      evaluado_en: snapshot.created_at,
      referencia_tipo: "snapshot",
      referencia_id: snapshot.id,
      total: 0,
      por_severidad: { critica: 0, advertencia: 0, informativa: 0 },
      por_centro: [],
      por_tipo: {
        deficit_cobertura: 0,
        voluntariado_insuficiente: 0,
        donacion_retrasada: 0,
        informacion_desactualizada: 0,
        capacidad: 0,
        excedente_transferible: 0,
      },
      centros_que_requieren_atencion: 0,
      informacion_temporal_desconocida: [],
      alertas: [],
    },
    candidatos_traslado: [],
  },
};

describe("editor administrativo contextual", () => {
  it("abre Voluntarios con el centro global y sus valores actuales", () => {
    const markup = renderToStaticMarkup(
      <AdministrativeEditor
        activeTab="voluntarios"
        bundle={bundle}
        initialCenterId="C03"
        onSave={async () => undefined}
      />,
    );

    expect(markup).toContain(
      '<option value="C03" selected="">C03 · Centro Tres</option>',
    );
    expect(markup).toMatch(/Disponibles[\s\S]*?value="7"/);
    expect(markup).toMatch(/Requeridos[\s\S]*?value="11"/);
    expect(markup).toContain("Personal faltante calculado");
    expect(markup).toContain(">4</strong>");
  });
});
