import { describe, expect, it } from "vitest";

import {
  bogotaLocalToIso,
  buildAlertResolutionSummary,
  calculateReceiptPreview,
  toBogotaLocalInput,
  validPackageQuantity,
  type PendingAlertReception,
} from "@/app/dashboard/alert-resolution";
import type { DashboardBundle } from "@/app/dashboard/types";

const pending: PendingAlertReception = {
  groupId: "herramientas_apoyo",
  centerId: "C01",
  centerName: "Centro Norte",
  productId: "P27",
  productName: "Extension electrica de 20 m",
  unit: "unidad",
  previousInventory: 0,
  previousCoverage: 0,
  previousSeverity: "critica",
  packagesReceived: 3,
  incomingBaseUnits: 3,
  presentationName: "Rollo de 20 m",
  targetSnapshotId: "snapshot-nuevo",
  idempotent: false,
};

function bundle(inventory: number, target: number, alertSeverity?: "critica" | "advertencia" | "informativa") {
  return {
    snapshot: { id: "snapshot-nuevo" },
    dashboard: {
      centros: [
        {
          centro_id: "C01",
          productos: [
            {
              producto_id: "P27",
              inventario_confirmado_unidad_base: inventory,
              objetivo_unidad_base: target,
              deficit_confirmado_unidad_base: Math.max(0, target - inventory),
              cobertura_porcentaje: target > 0 ? (inventory / target) * 100 : null,
            },
          ],
        },
      ],
      alertas: {
        alertas: alertSeverity
          ? [
              {
                tipo: "deficit_cobertura",
                centro_id: "C01",
                producto_id: "P27",
                severidad: alertSeverity,
              },
            ]
          : [],
      },
    },
  } as DashboardBundle;
}

describe("resolución individual de alertas A4.2", () => {
  it("convierte paquetes a unidad base y calcula cobertura, déficit y excedente", () => {
    expect(calculateReceiptPreview(0, 2, 1, 3)).toEqual({
      incomingBaseUnits: 3,
      estimatedInventory: 3,
      estimatedCoverage: 150,
      remainingDeficit: 0,
      grossSurplus: 1,
    });
    expect(calculateReceiptPreview(12_000, 20_000, 600, 5)).toEqual({
      incomingBaseUnits: 3_000,
      estimatedInventory: 15_000,
      estimatedCoverage: 75,
      remainingDeficit: 5_000,
      grossSurplus: 0,
    });
  });

  it("rechaza cantidades cero, negativas o fraccionarias", () => {
    expect(validPackageQuantity(0)).toBe(false);
    expect(validPackageQuantity(-1)).toBe(false);
    expect(validPackageQuantity(1.5)).toBe(false);
    expect(calculateReceiptPreview(0, 10, 1, 0)).toBeNull();
    expect(calculateReceiptPreview(0, 10, 1, 1.5)).toBeNull();
  });

  it("usa la hora operativa de Bogotá sin consultar el reloj del equipo", () => {
    expect(toBogotaLocalInput("2026-11-16T17:02:00-05:00")).toBe(
      "2026-11-16T17:02",
    );
    expect(bogotaLocalToIso("2026-11-16T17:02")).toBe(
      "2026-11-16T17:02:00-05:00",
    );
    expect(bogotaLocalToIso("fecha-invalida")).toBeNull();
  });

  it("distingue alerta activa, severidad reducida y condición resuelta con el bundle real", () => {
    expect(buildAlertResolutionSummary(bundle(3, 12, "critica"), pending)?.outcome).toBe("active");
    expect(buildAlertResolutionSummary(bundle(8, 12, "advertencia"), pending)?.outcome).toBe("reduced");
    expect(buildAlertResolutionSummary(bundle(12, 12), pending)).toMatchObject({
      outcome: "resolved",
      newInventory: 12,
      newCoverage: 100,
      remainingDeficit: 0,
      grossSurplus: 0,
    });
  });
});
