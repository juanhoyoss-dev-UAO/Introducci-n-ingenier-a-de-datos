import type {
  StorageCapacityIndicator,
  StorageCapacityMissingData,
} from "@/contracts/types/analytics";

export interface PackageLine {
  cantidad_paquetes: number;
  contenido_por_paquete: number;
}

export interface WeightedPackageLine {
  cantidad_paquetes: number;
  peso_kg_por_paquete: number | null;
}

export function calculatePackageUnits(lines: readonly PackageLine[]): number {
  return lines.reduce(
    (total, line) =>
      total + line.cantidad_paquetes * line.contenido_por_paquete,
    0,
  );
}

export function calculateDeficit(
  confirmedUnits: number,
  targetUnits: number,
): number {
  return Math.max(0, targetUnits - confirmedUnits);
}

export function calculateCoveragePercentage(
  confirmedUnits: number,
  targetUnits: number,
): number | null {
  if (targetUnits <= 0) {
    return null;
  }

  return (confirmedUnits / targetUnits) * 100;
}

export function calculatePotentialDeficit(
  confirmedUnits: number,
  targetUnits: number,
  expectedUnits: number,
): number {
  return Math.max(0, targetUnits - confirmedUnits - expectedUnits);
}

export function calculateTransferableSurplus(
  confirmedUnits: number,
  targetUnits: number,
  reserveUnits: number,
): number {
  return Math.max(0, confirmedUnits - targetUnits - reserveUnits);
}

export function calculateMissingVolunteers(
  available: number,
  required: number,
): number {
  return Math.max(0, required - available);
}

export function calculateStorageOccupancy(
  lines: readonly WeightedPackageLine[],
  maximumCapacityKg: number | null,
): StorageCapacityIndicator {
  const relevantLines = lines.filter((line) => line.cantidad_paquetes > 0);
  const missingData: StorageCapacityMissingData[] = [];

  if (maximumCapacityKg === null || maximumCapacityKg <= 0) {
    missingData.push("capacidad_maxima_kg");
  }
  if (
    relevantLines.some(
      (line) =>
        line.peso_kg_por_paquete === null || line.peso_kg_por_paquete <= 0,
    )
  ) {
    missingData.push("peso_kg_por_paquete");
  }

  if (missingData.length > 0 || maximumCapacityKg === null) {
    return {
      calculable: false,
      capacidad_maxima_kg:
        maximumCapacityKg !== null && maximumCapacityKg > 0
          ? maximumCapacityKg
          : null,
      peso_almacenado_kg: null,
      ocupacion_porcentaje: null,
      sobrecapacidad: null,
      datos_faltantes: missingData,
    };
  }

  const storedWeightKg = relevantLines.reduce(
    (total, line) =>
      total + line.cantidad_paquetes * (line.peso_kg_por_paquete ?? 0),
    0,
  );
  const occupancyPercentage = (storedWeightKg / maximumCapacityKg) * 100;

  return {
    calculable: true,
    capacidad_maxima_kg: maximumCapacityKg,
    peso_almacenado_kg: storedWeightKg,
    ocupacion_porcentaje: occupancyPercentage,
    sobrecapacidad: occupancyPercentage > 100,
    datos_faltantes: [],
  };
}

