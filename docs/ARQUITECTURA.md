# Arquitectura

## Stack vigente

- Next.js 16.4.3 con App Router y Route Handlers.
- React 19.3.1 y TypeScript 5.9.3 en modo estricto.
- Zod 4.6.7 para validación de contratos y relaciones.
- `csv-parse` y `csv-stringify` para CSV conforme a formato.
- Vitest 5.0.5 para pruebas puras, de archivos y HTTP.
- Supabase JS y `@supabase/ssr` exclusivamente para Auth temporal.
- npm y webpack; se conserva webpack por la decisión del Bloque A.

PostgreSQL, PostgREST y Docker ya no forman parte de la persistencia operativa. La migración y el seed SQL permanecen como evidencia del Bloque B hasta C2.

## Flujo del backend

```text
Route Handler
  -> requireAdministrator (Supabase Auth temporal)
  -> servicio de caso de uso o agregación
  -> OperationsRepository
  -> CsvOperationsRepository
  -> data/demo + data/runtime
  -> validación Zod
```

Los Route Handlers conservan parámetros, autorización y formato HTTP. Los servicios coordinan lecturas y cálculos. El repositorio implementa la fuente CSV sin exponer rutas de archivos a la API. `src/domain` mantiene fórmulas puras sin React, Next.js ni persistencia.

## Persistencia

- `data/templates`: encabezados canónicos versionados.
- `data/demo/snapshots`: snapshots demostrativos versionados y de sólo lectura.
- `data/runtime/snapshots`: snapshots operativos ignorados por Git.
- `data/runtime/.staging`: publicación temporal validada.
- `data/runtime/simulations`: ubicación reservada; C1 no implementa persistencia de eventos.

Cada snapshot contiene `metadata.json` y ocho CSV. Las lecturas validan el bundle completo, incluidas referencias y unicidad. Demo y runtime comparten la interfaz; un UUID repetido entre ambas fuentes es un error explícito.

La escritura valida en memoria, escribe en staging, relee, comprueba que no exista destino y publica con `rename` dentro del mismo volumen. Las rutas se construyen desde raíces conocidas, UUID y nombres cerrados; se rechazan traversal y enlaces simbólicos.

## Sesión y autorización temporal

`src/proxy.ts` refresca las cookies Supabase para rutas `/api` operativas. Cada endpoint vuelve a verificar el usuario mediante Supabase Auth y consulta `administradores`. RLS se conserva mientras exista ese servicio, pero ya no protege ni suministra los archivos CSV.

La sustitución de login, cookies y autorización corresponde exclusivamente a C2. C1 no deja endpoints operativos públicos.

## Responsabilidades

| Ruta | Responsabilidad |
| --- | --- |
| `src/app/api` | Endpoints GET y respuestas HTTP existentes. |
| `src/app/login` | Login Supabase temporal; no permite registro. |
| `src/server/auth` | Sesión y comprobación administrativa temporal. |
| `src/server/db` | Cliente Supabase usado únicamente por Auth. |
| `src/server/repositories` | Interfaz operativa e implementación CSV. |
| `src/server/storage` | Parseo, serialización, rutas y archivos seguros. |
| `src/server/services` | Casos de uso, agregaciones y errores. |
| `src/contracts` | Tipos y esquemas Zod, incluido el bundle CSV. |
| `src/domain` | Inventario, déficit, voluntarios, eventos y traslados. |
| `data/templates` | Plantillas CSV canónicas. |
| `data/demo` | Dos snapshots reproducibles. |
| `data/runtime` | Datos operativos locales no versionados. |
| `supabase` | Legado de esquema/seed y soporte temporal de Auth local. |
| `tests/unit` | Reglas puras. |
| `tests/integration` | Integración CSV real y suites Supabase legadas. |
| `tests/http` | API real condicionada a Auth temporal. |

No se implementaron importador Excel, dashboard visual, mutaciones HTTP de simulación, donantes, mapas o notificaciones.
