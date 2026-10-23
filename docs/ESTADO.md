# Estado del proyecto

## Fase actual

Bloque C1 implementado al 2026-10-23. La persistencia operativa usa archivos CSV/JSON locales; las rutas y los contratos HTTP del Bloque B se conservan.

## C1 implementado

- `OperationsRepository` desacopla los servicios de la tecnología de persistencia.
- `CsvOperationsRepository` lee y escribe un bundle formado por `metadata.json` y ocho archivos CSV.
- `data/templates/` define las cabeceras, `data/demo/snapshots/` contiene los dos snapshots demostrativos versionados y `data/runtime/` queda reservado para ejecución local e ignorado por Git.
- La carga convierte y valida el bundle completo con esquemas Zod, incluyendo unicidad, referencias y valores controlados.
- Las escrituras usan un directorio de staging y un rename final; no exponen un snapshot parcialmente escrito.
- Los servicios y endpoints operativos ya no consultan Supabase/PostgREST. Las fórmulas y reglas de negocio no cambiaron.
- La migración y el seed SQL quedan como legado y checkpoint reproducible del Bloque B, no como persistencia activa de C1.

## Verificación registrada

- Las tres suites reales de integración CSV aprobaron 25 pruebas mediante `npm run test:csv`.
- Las dos suites antiguas de integración Supabase/PostgreSQL quedaron omitidas: 8 pruebas omitidas no equivalen a pruebas aprobadas.
- `npm run lint`, `npm run typecheck` y `npm run build` aprobaron para C1.
- Se conservan las ocho pruebas unitarias de dominio del Bloque B.
- `GET /api/health` respondió HTTP 200 con `{ "data": { "status": "ok" }, "meta": {} }`.
- `GET /api/snapshots` sin sesión respondió HTTP 401 con código `UNAUTHENTICATED`.
- No se ejecutó una lectura HTTP administrativa con 200 porque requiere una sesión y cuenta Supabase reales.

## Dependencias temporales

Supabase sigue siendo necesario únicamente para autenticación administrativa durante C1:

- login y sesión;
- proxy y renovación de cookies;
- tabla `administradores` y sus políticas RLS.

Los endpoints protegidos continúan exigiendo una sesión Supabase válida. La sustitución de este mecanismo pertenece a C2 y no está implementada. Por ello tampoco se declara una lectura HTTP administrativa autenticada con 200 como verificada en C1.

## Limitaciones conocidas

- La persistencia de eventos de simulación no forma parte de C1; la simulación continúa como cálculo puro.
- `data/runtime/` es almacenamiento local pensado para una sola instancia del proceso, no para concurrencia distribuida.
- No se han iniciado importación Excel, interfaz visual ni dashboard interactivo.

## Siguiente microbloque

Completar la verificación HTTP administrativa pendiente cuando exista una sesión Supabase real. No iniciar C2 ni retirar los componentes temporales de Supabase sin aprobación explícita.
