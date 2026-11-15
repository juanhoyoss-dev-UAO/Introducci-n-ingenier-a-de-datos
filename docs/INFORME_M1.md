# Redes de Ayuda - Informe de ejecución M1

**Fecha:** 2026-11-15  
**Rama:** `feature/admin-inspector`  
**Commit de partida:** `529729e`  
**Resultado:** M1 funcional completado en los componentes independientes del Excel y de la migración CSV.

## 1. Indicadores implementados

- Centros activos, calculados desde el estado de cada centro.
- Inventario confirmado, necesidad vigente y déficit confirmado por centro y producto.
- Cobertura: `inventario_confirmado / necesidad_vigente * 100`; devuelve `null` cuando la necesidad es cero.
- Donaciones pendientes separadas del inventario confirmado.
- Déficit potencial: necesidad menos inventario confirmado y donaciones esperadas, limitado a cero.
- Voluntarios disponibles, requeridos y faltantes por centro.
- Capacidad de almacenamiento con peso, porcentaje y sobrecapacidad cuando existan datos explícitos.
- Estado no calculable y lista de datos faltantes cuando no existen capacidad máxima o pesos.

Para C01 y agua en el snapshot A se verificaron 12.000 ml confirmados, 20.000 ml de necesidad, 8.000 ml de déficit confirmado, 6.000 ml esperados, 60% de cobertura y 2.000 ml de déficit potencial.

## 2. Contratos para visualizaciones

El endpoint existente `/api/dashboard` conserva sus campos y añade:

- `indicadores.centros_activos`.
- `visualizaciones.cobertura_por_centro`.
- `visualizaciones.inventario_vs_necesidad`.
- `visualizaciones.recursos_confirmados_vs_esperados`.
- `visualizaciones.voluntarios_disponibles_vs_requeridos`.

Cada registro incluye identificadores y nombres de centro y, cuando aplica, producto, valores y unidad. No se añadieron componentes gráficos ni cálculos en React.

## 3. Capacidad y compatibilidad

`calculateStorageOccupancy` implementa:

`ocupacion_porcentaje = peso_almacenado_kg / capacidad_maxima_kg * 100`

El resultado permite identificar sobrecapacidad por encima de 100%. Los datos actuales no contienen `capacidad_maxima_kg` ni `peso_kg_por_paquete`, por lo que el API informa capacidad no calculable sin inventar valores.

No se cambiaron esquemas Zod, encabezados CSV, templates ni snapshots. La migración compatible necesaria quedó documentada en `docs/MIGRACION_CAPACIDAD_M1.md`.

## 4. Archivos modificados

| Archivo | Decisión y alcance |
|---|---|
| `src/contracts/types/analytics.ts` | Contratos reutilizables para indicadores, capacidad y cuatro visualizaciones. |
| `src/domain/inventory.ts` | Fórmulas puras de cobertura, déficit potencial y ocupación. |
| `src/server/services/dashboard.ts` | Integración de indicadores y estructuras analíticas en la respuesta existente. |
| `src/app/dashboard/types.ts` | Tipos cliente compatibles con los nuevos campos; sin lógica duplicada. |
| `tests/unit/inventory.test.ts` | Cobertura, déficit potencial, capacidad no calculable y sobrecapacidad. |
| `tests/unit/dashboard-view-model.test.ts` | Fixtures actualizados al contrato compatible. |
| `tests/integration/csv-repository.test.ts` | Valores de referencia, contratos analíticos y capacidad no calculable sobre CSV real. |
| `tests/http/endpoints.test.ts` | Verificación del endpoint real y conservación de aislamiento entre snapshots. |
| `docs/REGLAS_NEGOCIO.md` | Fórmulas y política de datos faltantes. |
| `docs/MIGRACION_CAPACIDAD_M1.md` | Plan de migración protegida sin alterar datos actuales. |
| `docs/ESTADO.md` | Checkpoint M1 y resultados reales. |
| `docs/BITACORA.md` | Registro breve de implementación, pruebas y pendientes. |

## 5. Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| Pruebas focalizadas | 3 archivos, 18/18 aprobadas |
| `npm.cmd run test:unit` | 6 archivos, 25/25 aprobadas |
| `npm.cmd run test:csv` | 3 archivos, 25/25 aprobadas |
| `npm.cmd run test:http` | 1 archivo, 14/14 aprobadas |
| `npm.cmd run lint` | Aprobado |
| `npm.cmd run typecheck` | Aprobado |
| `npm.cmd run build` | Aprobado; 13 rutas/páginas |

También se verificó que el snapshot A mantiene 12.000 ml de agua en C01 y el snapshot B mantiene 2.700 ml, sin mezcla entre jornadas.

## 6. Pendientes

- M1.0: el Excel `PMU HERRAMIENTAS LIMONAR CALI 10-08-2026.xlsx` no está disponible. Quedan pendientes su perfilado y el catálogo experimental.
- Capacidad real: requiere aprobar y ejecutar la migración protegida de capacidad por centro y peso por presentación.
- Gráficos: no fueron implementados, según el alcance solicitado.
- No se implementaron simulaciones, importación Excel desde la interfaz ni cambios de autenticación.
- El riesgo previo de `.env.local` versionado continúa fuera del alcance de M1.

## 7. Preparación para M2

M2 puede construir los cuatro gráficos consumiendo directamente `visualizaciones`, sin recalcular métricas en React. También puede mostrar cobertura, déficit potencial y personal faltante con los campos del dashboard actual.

La visualización de ocupación real debe esperar la migración de capacidad/peso y datos verificados. El catálogo ampliado debe esperar la entrega del Excel de referencia.

No se ejecutaron commit, push, merge, rebase ni cambios de historial.
