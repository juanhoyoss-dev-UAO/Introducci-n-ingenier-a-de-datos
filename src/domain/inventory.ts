export interface PackageLine {
  cantidad_paquetes: number;
  contenido_por_paquete: number;
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

