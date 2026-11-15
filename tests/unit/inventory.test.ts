import { describe, expect, it } from "vitest";

import {
  calculateCoveragePercentage,
  calculateDeficit,
  calculateMissingVolunteers,
  calculatePackageUnits,
  calculatePotentialDeficit,
  calculateStorageOccupancy,
  calculateTransferableSurplus,
} from "@/domain/inventory";

describe("reglas de inventario", () => {
  it("T01 convierte paquetes de agua a 12.000 ml", () => {
    const result = calculatePackageUnits([
      { cantidad_paquetes: 10, contenido_por_paquete: 600 },
      { cantidad_paquetes: 4, contenido_por_paquete: 1500 },
    ]);

    expect(result).toBe(12000);
  });

  it("T02 calcula déficit y lo limita a cero", () => {
    expect(calculateDeficit(12000, 20000)).toBe(8000);
    expect(calculateDeficit(22000, 20000)).toBe(0);
  });

  it("T03 mantiene una donación pendiente separada del confirmado", () => {
    const confirmed = calculatePackageUnits([
      { cantidad_paquetes: 10, contenido_por_paquete: 600 },
      { cantidad_paquetes: 4, contenido_por_paquete: 1500 },
    ]);
    const expected = calculatePackageUnits([
      { cantidad_paquetes: 10, contenido_por_paquete: 600 },
    ]);

    expect({
      confirmado: confirmed,
      esperado: expected,
      deficit_confirmado: calculateDeficit(confirmed, 20000),
    }).toEqual({
      confirmado: 12000,
      esperado: 6000,
      deficit_confirmado: 8000,
    });
  });

  it("calcula excedente transferible y voluntarios faltantes", () => {
    expect(calculateTransferableSurplus(21000, 9000, 2000)).toBe(10000);
    expect(calculateMissingVolunteers(4, 7)).toBe(3);
    expect(calculateMissingVolunteers(8, 6)).toBe(0);
  });

  it("calcula cobertura y déficit potencial sin mezclar donaciones", () => {
    expect(calculateCoveragePercentage(12_000, 20_000)).toBe(60);
    expect(calculateCoveragePercentage(0, 0)).toBeNull();
    expect(calculatePotentialDeficit(12_000, 20_000, 6_000)).toBe(2_000);
    expect(calculatePotentialDeficit(12_000, 20_000, 9_000)).toBe(0);
  });

  it("marca capacidad no calculable cuando faltan capacidad o pesos", () => {
    expect(
      calculateStorageOccupancy(
        [{ cantidad_paquetes: 2, peso_kg_por_paquete: null }],
        null,
      ),
    ).toEqual({
      calculable: false,
      capacidad_maxima_kg: null,
      peso_almacenado_kg: null,
      ocupacion_porcentaje: null,
      sobrecapacidad: null,
      datos_faltantes: ["capacidad_maxima_kg", "peso_kg_por_paquete"],
    });
    expect(
      calculateStorageOccupancy(
        [{ cantidad_paquetes: 2, peso_kg_por_paquete: null }],
        100,
      ).datos_faltantes,
    ).toEqual(["peso_kg_por_paquete"]);
  });

  it("calcula ocupación y detecta sobrecapacidad con datos explícitos", () => {
    expect(
      calculateStorageOccupancy(
        [
          { cantidad_paquetes: 10, peso_kg_por_paquete: 2 },
          { cantidad_paquetes: 3, peso_kg_por_paquete: 10 },
        ],
        40,
      ),
    ).toEqual({
      calculable: true,
      capacidad_maxima_kg: 40,
      peso_almacenado_kg: 50,
      ocupacion_porcentaje: 125,
      sobrecapacidad: true,
      datos_faltantes: [],
    });
  });
});

