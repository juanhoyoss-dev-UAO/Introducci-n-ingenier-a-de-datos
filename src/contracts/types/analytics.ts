export type ProductBaseUnit = "ml" | "g" | "unidad";

export type StorageCapacityMissingData =
  | "capacidad_maxima_kg"
  | "peso_kg_por_paquete";

export interface StorageCapacityIndicator {
  calculable: boolean;
  capacidad_maxima_kg: number | null;
  peso_almacenado_kg: number | null;
  ocupacion_porcentaje: number | null;
  sobrecapacidad: boolean | null;
  datos_faltantes: StorageCapacityMissingData[];
}

export interface DashboardIndicatorSummary {
  centros_activos: number;
}

interface CenterProductChartPoint {
  centro_id: string;
  centro_nombre: string;
  producto_id: string;
  producto_nombre: string;
}

export interface CoverageByCenterPoint extends CenterProductChartPoint {
  cobertura_porcentaje: number | null;
  unidad: "porcentaje";
  unidad_base_producto: ProductBaseUnit;
}

export interface InventoryNeedPoint extends CenterProductChartPoint {
  inventario_confirmado: number;
  necesidad_vigente: number;
  unidad: ProductBaseUnit;
}

export interface ConfirmedExpectedPoint extends CenterProductChartPoint {
  recursos_confirmados: number;
  recursos_esperados: number;
  unidad: ProductBaseUnit;
}

export interface VolunteerComparisonPoint {
  centro_id: string;
  centro_nombre: string;
  disponibles: number;
  requeridos: number;
  unidad: "persona";
}

export interface DashboardVisualizations {
  cobertura_por_centro: CoverageByCenterPoint[];
  inventario_vs_necesidad: InventoryNeedPoint[];
  recursos_confirmados_vs_esperados: ConfirmedExpectedPoint[];
  voluntarios_disponibles_vs_requeridos: VolunteerComparisonPoint[];
}
