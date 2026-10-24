# Arquitectura

## Stack vigente

- Next.js 16.4.3 con App Router y Route Handlers.
- React 19.3.1 y TypeScript en modo estricto.
- Zod 4.6.7 para validación de contratos y relaciones.
- `csv-parse` y `csv-stringify` para CSV conforme a formato.
- Primitivas criptográficas de Node.js para `scrypt` y HMAC-SHA256.
- Vitest 5.0.5 para pruebas puras, de archivos y HTTP real.
- npm y webpack; se conserva webpack por la decisión del Bloque A.

La aplicación activa no utiliza Supabase, PostgreSQL, PostgREST, Docker ni servicios de autenticación externos. El esquema y seed del Bloque B continúan recuperables desde el checkpoint Git, pero no forman parte del árbol ejecutable.

## Flujo del backend

```text
Route Handler
  -> requireAdministrator
  -> cookie de sesión firmada y vigente
  -> servicio de caso de uso o agregación
  -> OperationsRepository
  -> CsvOperationsRepository
  -> data/demo + data/runtime
  -> validación Zod
```

## Flujo de la consola D0

```text
/dashboard (Server Component protegido)
  -> DashboardClient
  -> Route Handlers GET
  -> servicios existentes
  -> OperationsRepository
  -> CsvOperationsRepository
  -> snapshot CSV/JSON validado
```

La página servidor exige administrador antes de entregar la consola. El componente cliente coordina las consultas, cancela cargas obsoletas y compone modelos de vista sin leer archivos ni recalcular fórmulas de negocio. `view-model.ts` sólo aplana, relaciona y filtra datos ya calculados por el backend.

## Diagnóstico D0

`src/lib/logger.ts` concentra el formato, niveles, módulos, umbral y sanitización. En el servidor, `AsyncLocalStorage` conserva un `requestId` generado localmente y el snapshot de la operación sin cambiar las interfaces de servicios o repositorios. Las respuestas instrumentadas exponen `X-Request-Id`; los logs permanecen en consola y nunca incluyen cuerpos, cookies, tokens, hashes, secretos, rutas absolutas ni archivos CSV completos.

Los Route Handlers conservan parámetros, autorización y formato HTTP. Los servicios coordinan lecturas y cálculos. El repositorio implementa la fuente CSV sin exponer rutas de archivos a la API. `src/domain` mantiene fórmulas puras sin React, Next.js ni persistencia.

## Autenticación y autorización local

`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` y `SESSION_SECRET` se leen en el servidor sólo cuando una petición de autenticación o una ruta protegida los necesita. No existen valores predeterminados y un error de configuración falla de forma cerrada.

La contraseña se deriva con `scrypt`, sal aleatoria y parámetros versionados; la comparación usa `timingSafeEqual`. El login siempre ejecuta la derivación aunque el usuario sea incorrecto y responde con un único error genérico.

La sesión contiene únicamente versión, sujeto, rol, emisión y vencimiento. El servidor firma el payload con HMAC-SHA256 y valida firma, forma, usuario, rol, tiempo de emisión, vencimiento y vida máxima en cada petición protegida. La cookie es `HttpOnly`, `SameSite=Lax`, `Path=/`, tiene `Expires`/`Max-Age` y añade `Secure` bajo HTTPS. Su vida máxima es de cuatro horas.

`POST /api/auth/login` y `POST /api/auth/logout` requieren un `Origin` exactamente igual al origen servido. `GET /api/auth/me` permite consultar el estado sin exponer hash ni secreto. No existe una ruta productiva para emitir sesiones no administrativas; el caso 403 se construye únicamente en la fixture HTTP aislada.

No se usa proxy para mantener sesión: cada Route Handler operativo llama a `requireAdministrator()`, que es la autoridad central. El logout elimina la cookie, pero una sesión stateless copiada previamente no puede revocarse de forma individual antes de vencer; rotar `SESSION_SECRET` invalida todas.

## Persistencia

- `data/templates`: encabezados canónicos versionados.
- `data/demo/snapshots`: snapshots demostrativos versionados y de sólo lectura.
- `data/runtime/snapshots`: snapshots operativos ignorados por Git.
- `data/runtime/.staging`: publicación temporal validada.
- `data/runtime/simulations`: ubicación reservada; C2 no implementa persistencia de eventos.

Cada snapshot contiene `metadata.json` y ocho CSV. Las lecturas validan el bundle completo, incluidas referencias y unicidad. Demo y runtime comparten la interfaz; un UUID repetido entre ambas fuentes es un error explícito.

La escritura valida en memoria, escribe en staging, relee, comprueba que no exista destino y publica con `rename` dentro del mismo volumen. Las rutas se construyen desde raíces conocidas, UUID y nombres cerrados; se rechazan traversal y enlaces simbólicos.

`OPERATIONS_DEMO_ROOT` y `OPERATIONS_RUNTIME_ROOT` permiten que la suite HTTP apunte el proceso hijo a copias temporales. No son credenciales ni son necesarias para la ejecución normal.

## Responsabilidades

| Ruta | Responsabilidad |
| --- | --- |
| `src/app/api/auth` | Login, logout y consulta de sesión local. |
| `src/app/api` | Endpoints GET y respuestas HTTP existentes. |
| `src/app/login` | Formulario local; no permite registro. |
| `src/app/dashboard` | Consola administrativa protegida y modelos de vista. |
| `src/lib/logger.ts` | Formato, niveles, módulos y sanitización de diagnóstico. |
| `src/server/observability` | Contexto y correlación de peticiones HTTP. |
| `src/server/auth` | Configuración, hash, firma, cookie y comprobación administrativa. |
| `src/server/repositories` | Interfaz operativa e implementación CSV. |
| `src/server/storage` | Parseo, serialización, rutas y archivos seguros. |
| `src/server/services` | Casos de uso, agregaciones y errores. |
| `src/contracts` | Tipos y esquemas Zod, incluido el bundle CSV. |
| `src/domain` | Inventario, déficit, voluntarios, eventos y traslados. |
| `data/templates` | Plantillas CSV canónicas. |
| `data/demo` | Dos snapshots reproducibles. |
| `data/runtime` | Datos operativos locales no versionados. |
| `tests/unit` | Reglas puras y primitivas de autenticación. |
| `tests/integration` | Integración CSV real. |
| `tests/http` | API real con servidor y datos temporales aislados. |

No se implementaron importador Excel, dashboard definitivo con gráficos, mutaciones HTTP de simulación, donantes, mapas o notificaciones.
