# Informe de ejecución M2

**Proyecto:** Redes de Ayuda  
**Fecha:** 15 de noviembre de 2026  
**Rama:** `feature/admin-inspector`  
**Commit de partida:** `529729e`

## 1. Resultado

M2 quedó implementado y verificado. El dashboard incorpora un resumen operativo con indicadores y cuatro visualizaciones, conserva las seis tablas originales y funciona con los dos snapshots demostrativos. No se inició M3 y no se ejecutaron commit, push ni merge.

## 2. Indicadores y visualizaciones

- Tarjetas: centros activos, centros con déficit, productos, centros con necesidades, donaciones pendientes y centros con personal faltante.
- Cobertura por centro y producto: conserva porcentajes mayores a 100 % y muestra N/D cuando el backend entrega `null`.
- Inventario frente a necesidad: compara valores en la unidad base del producto y presenta el déficit confirmado entregado por el backend.
- Recursos confirmados frente a esperados: mantiene ambos valores separados; no suma donaciones anunciadas al inventario.
- Voluntarios disponibles frente a requeridos: muestra la comparación y el faltante ya calculado por el servicio.
- Señal de atención: ordena únicamente para presentación por productos con déficit, luego por voluntarios faltantes y finalmente por identificador de centro.

## 3. Filtros y compatibilidad

- El snapshot controla todo el conjunto de datos y reinicia los filtros dependientes.
- El centro filtra tarjetas, gráficos y tablas.
- El producto se aplica solo al resumen analítico y evita mezclar unidades.
- Las tablas de centros, inventario, necesidades, voluntarios, donaciones y tiempos de traslado permanecen disponibles.
- No se modificaron autenticación, sesión, contratos CSV, snapshots, reglas de negocio ni dependencias.

## 4. Archivos de M2

### Integración y modelo de vista

- `src/app/dashboard/dashboard-client.tsx`: nueva pestaña inicial, filtros y estados reutilizables.
- `src/app/dashboard/types.ts`: pestaña `resumen` y consumo de contratos analíticos de M1.
- `src/app/dashboard/view-model.ts`: resumen operativo y transformaciones filtradas para las cuatro visualizaciones.

### Componentes reutilizables

- `src/app/dashboard/components/chart-primitives.tsx`: formato, leyendas, barras y estados vacíos.
- `src/app/dashboard/components/metric-cards.tsx`: tarjetas de indicadores.
- `src/app/dashboard/components/coverage-chart.tsx`: cobertura y casos no calculables.
- `src/app/dashboard/components/inventory-needs-chart.tsx`: inventario, necesidad y déficit.
- `src/app/dashboard/components/resources-chart.tsx`: confirmado y anunciado separados.
- `src/app/dashboard/components/volunteer-chart.tsx`: personal disponible, requerido y faltante.
- `src/app/dashboard/components/dashboard-status.tsx`: carga, error y estado vacío.
- `src/app/dashboard/components/operational-summary.tsx`: composición del resumen y accesos a tablas.

### Pruebas y documentación

- `tests/unit/dashboard-view-model.test.ts`: cobertura de tarjetas, filtros, unidades, `null` y valores de referencia C01.
- `docs/ESTADO.md`: checkpoint M2.
- `docs/BITACORA.md`: registro de ejecución y verificaciones.
- `output/screenshots/M2-resumen-operativo.jpg`: evidencia del resumen responsivo.
- `output/screenshots/M2-graficos.jpg`: evidencia de las visualizaciones.

## 5. Decisiones

- Se reutilizaron las colecciones `visualizaciones` de M1; React no recalcula cobertura, déficit potencial ni faltantes de personal.
- Los gráficos se construyeron con React y Tailwind para evitar una dependencia estructural no autorizada.
- La escala de cobertura usa el máximo visible, por lo que no recorta valores mayores a 100 %.
- La distinción de atención es relativa al snapshot y se identifica explícitamente como “mayor número de productos con déficit”; no se presenta como una nueva prioridad de negocio.

## 6. Verificaciones

| Verificación | Resultado |
|---|---|
| Pruebas unitarias | 6 archivos, 27/27 aprobadas |
| Integración CSV | 3 archivos, 25/25 aprobadas |
| Endpoints HTTP | 1 archivo, 14/14 aprobadas |
| ESLint | Aprobado |
| TypeScript | Aprobado |
| Build Next.js | Aprobado, 13 rutas/páginas |
| Navegador | Snapshots A/B, filtros, tabla original y diseño responsivo aprobados |
| Consola del navegador | Sin errores |

En snapshot A se verificó C01 con 12.000 ml confirmados, necesidad de 20.000 ml, déficit confirmado de 8.000 ml y 6.000 ml anunciados por separado. En snapshot B se verificó el reinicio de filtros y la actualización independiente de todos los valores.

## 7. Pendientes y preparación para M3

- No se implementaron simulaciones, importación Excel, persistencia adicional ni controles temporales.
- La ocupación real continúa como no calculable hasta contar con capacidad máxima por centro y pesos por presentación autorizados.
- El Excel de materiales continúa pendiente y no se interpretó como inventario general.
- La separación entre contratos analíticos, modelo de vista y componentes deja una base reutilizable para una futura misión M3.

## 8. Estado Git

Los cambios de M0 y M1 que ya estaban en el árbol se preservaron. M2 se mantiene sin commit, push ni merge, conforme a la autorización recibida.
