import { describe, expect, it } from "vitest";

import {
  calculateDeficit,
  calculateMissingVolunteers,
  calculatePackageUnits,
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
});

