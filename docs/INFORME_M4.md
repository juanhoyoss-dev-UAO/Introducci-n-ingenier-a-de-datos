# Informe de ejecución M4

Fecha: 2026-11-15  
Rama: `feature/admin-inspector`  
Commit de partida: `906ecae`

## Resultado

M4 quedó implementado con recepciones directas, confirmación de donaciones anunciadas, despachos e historial consultable. Cada operación publica una versión inmutable que mantiene sincronizados inventario, intención y movimiento. No se implementó el simulador.

## Modelo de movimientos

El historial se almacena en `movimientos.csv` dentro de cada versión. Cada fila incluye UUID de movimiento, UUID de operación, tipo, centros de origen/destino, producto, presentación, paquetes, `ocurrido_en`, `registrado_en`, intención opcional, snapshot fuente y cantidad anunciada original.

Los snapshots anteriores que no tienen el archivo continúan siendo válidos y cargan un historial vacío. Las versiones M4 lo publican junto con los demás CSV mediante staging, relectura y rename.

## Operaciones

- Confirmar donación: suma lo recibido al inventario, conserva lo anunciado, registra la diferencia y cambia la intención de `pendiente` a `recibida`.
- Recepción directa: suma paquetes sin exigir intención previa.
- Despacho: resta paquetes y rechaza la operación si produciría inventario negativo.
- Historial: consulta por snapshot, centro y periodo, ordenado por acontecimiento e identificador.

Los traslados ejecutados se dejaron pendientes para no ampliar el alcance. Las recomendaciones de traslado existentes siguen siendo informativas.

## Idempotencia y atomicidad

El UUID de operación determina de forma estable el UUID de la versión y del movimiento. Un reintento idéntico recupera la versión ya publicada sin sumar inventario otra vez. La misma clave con datos distintos produce `IDEMPOTENCY_CONFLICT`.

Inventario, estado de donación y movimiento viven en el mismo bundle. Si la publicación falla, no queda ninguno de los tres efectos parciales.

## Seguridad

- `GET/POST /api/snapshots/[id]/movements` exige administrador.
- POST valida origen exacto y JSON.
- Zod exige UUID, referencias válidas, paquetes enteros positivos y fechas con offset.
- Los despachos insuficientes producen conflicto y no publican.
- Logging conserva requestId sin exponer secretos.

## Interfaz

La pestaña “Movimientos y recepciones” permite seleccionar operación, fecha/hora de Bogotá, centro, producto, presentación y paquetes. En confirmaciones muestra el anuncio y la diferencia. El historial presenta acontecimiento, registro, demora, tipo, centro, unidad, anuncio y clave idempotente.

Tras guardar, la consola selecciona la versión nueva y recarga inventario, déficit, cobertura, donaciones y gráficos. No declara éxito antes de recibir respuesta del backend.

## Prueba de referencia

Para C01/P01, la confirmación de D01 recibe 10 paquetes de 600 ml:

- Inventario original: 12.000 ml.
- Inventario nuevo: 18.000 ml.
- Necesidad: 20.000 ml.
- Déficit nuevo: 2.000 ml.
- Cobertura nueva: 90 %.
- Anuncio original: 10 paquetes / 6.000 ml, conservado en el historial.
- Donación pendiente agregada: 0 ml para C01/P01.
- Snapshot original: sin cambios.

Repetir la misma clave no suma otros 6.000 ml.

## Archivos principales

- `src/contracts/schemas/data.ts` y `movement-operations.ts`.
- `src/server/storage/csv.ts` y `files.ts`.
- `src/server/services/movement-operations.ts` y `dashboard.ts`.
- `src/server/repositories/types.ts` y `csv-operations.ts`.
- `src/app/api/snapshots/[id]/movements/route.ts`.
- `src/app/dashboard/components/movement-editor.tsx`, `dashboard-client.tsx` y `types.ts`.
- `data/templates/movimientos.csv`.
- Pruebas CSV, HTTP y fixture unitario del dashboard.

## Verificaciones

- Unitarias: 27/27.
- CSV: 34/34.
- HTTP: 19/19 en la repetición final. La primera ejecución de cierre tuvo dos timeouts M3 de 5 s y 17 pruebas aprobadas; se asignaron 10 s a esas pruebas secuenciales.
- ESLint: aprobado.
- TypeScript: aprobado.
- Build: aprobado, 16 rutas/páginas.
- Navegador: flujo D01, historial y métricas verificados; consola sin errores.

## Preparación para M5 y M6

El modelo ya permite contar recepciones, sumar paquetes por intervalo y medir demora de registro sin mezclar unidades. M5/M6 podrán añadir agregados horarios, alertas y evolución temporal sobre `ocurrido_en`, pero deberán mantener separados conteos, paquetes y unidades base.

## Limitaciones

- No hay traslados ejecutados.
- No hay reconstrucción histórica del dashboard ni simulación interactiva.
- No hay gráficos temporales, alertas avanzadas o importación.
- La capacidad permanece no calculable sin pesos y límites reales.

No se realizaron commit, push, merge, rebase ni despliegue.
