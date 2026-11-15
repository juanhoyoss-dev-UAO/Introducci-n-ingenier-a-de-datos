# Migración pendiente de capacidad de almacenamiento

## Estado

M1 implementa el cálculo de ocupación en dominio y devuelve un indicador no calculable cuando faltan datos. No modifica persistencia. Los snapshots demostrativos continúan con sus encabezados originales.

## Datos requeridos

- Cada centro necesita `capacidad_maxima_kg`, con valor numérico mayor que cero.
- Cada presentación necesita `peso_kg_por_paquete`, con valor numérico mayor que cero e independiente de `ml`, `g` o `unidad`.
- Los valores deben provenir de una fuente explícita. No se derivarán pesos desde volumen, contenido o nombre de presentación.

## Restricción de compatibilidad

`parseCsvRows` valida que el encabezado sea exactamente igual a `CSV_COLUMNS`. Agregar columnas directamente a `centros.csv` y `presentaciones.csv` haría inválidos los dos snapshots actuales. Los esquemas Zod también son estrictos.

## Migración recomendada

1. Aprobar una versión de formato de snapshot o una detección explícita de encabezado legado y nuevo.
2. Ampliar `CenterRecord`, `PresentationRecord`, los esquemas Zod y `DashboardSource` con valores anulables durante la etapa de compatibilidad.
3. Leer el encabezado legado como datos de capacidad ausentes y validar el encabezado nuevo con valores positivos.
4. Escribir únicamente el formato nuevo para snapshots creados después de la migración.
5. Actualizar las plantillas, sin modificar los snapshots demostrativos originales.
6. Conectar los campos reales con `calculateStorageOccupancy` y retirar los valores `null` temporales del servicio.
7. Añadir pruebas para ambos encabezados, decimales, cero, negativos, pesos faltantes, suma por SKU, sobrecapacidad y relectura posterior a escritura.
8. Definir cuándo deja de admitirse el formato legado; hasta entonces, ambos formatos deben cargar sin mezclar snapshots.

## Archivos previstos

- `src/contracts/schemas/data.ts`
- `src/contracts/types/database.ts`
- `src/server/storage/csv.ts`
- `src/server/storage/files.ts`
- `src/server/repositories/types.ts`
- `src/server/repositories/csv-operations.ts`
- `data/templates/centros.csv`
- `data/templates/presentaciones.csv`
- Pruebas unitarias, de validación y repositorio CSV relacionadas.

Esta migración sigue siendo PROTEGIDA y debe ejecutarse como microbloque independiente.
