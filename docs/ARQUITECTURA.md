# Arquitectura

## Stack vigente

- Next.js 16.4.3 con App Router y Route Handlers.
- React 19.3.1 y TypeScript 5.9.3 en modo estricto.
- Tailwind CSS 4.3.3 y ESLint 10.13.0.
- Supabase JS 2.118.0 y `@supabase/ssr` 0.12.7.
- PostgreSQL 17 en la configuración local de Supabase.
- Zod 4.6.7 para contratos de entrada y payloads.
- Vitest 5.0.5 para pruebas puras, de integración y HTTP.
- npm y webpack; se conserva webpack por el fallo de Turbopack registrado en el Bloque A.

Node.js 24.18.0, npm 11.16.0, Git 2.53.0.windows.3 y Supabase CLI 2.122.0 fueron las herramientas detectadas.

## Flujo del backend

```text
Route Handler
  -> validación y requireAdministrator
  -> servicio de caso de uso o agregación
  -> repositorio
  -> cliente Supabase con sesión en cookies
  -> PostgREST / PostgreSQL con RLS
```

Los Route Handlers se limitan a parámetros, autorización y formato HTTP. Los servicios coordinan lecturas y cálculos. Los repositorios contienen consultas Supabase. `src/domain` mantiene fórmulas puras sin React, Next.js ni conexión a datos.

## Sesión y autorización

`src/proxy.ts` refresca tokens únicamente para rutas `/api` operativas. `@supabase/ssr` lee y escribe las cookies de sesión. Cada endpoint vuelve a verificar el usuario mediante Supabase Auth y consulta `administradores`. RLS permite lecturas operativas solo cuando `auth.uid()` pertenece a esa tabla.

La clave pública o publishable es la única credencial utilizada por la aplicación. La service role se reserva para la preparación de fixtures en pruebas locales aisladas y nunca forma parte del frontend ni de las consultas normales.

## Responsabilidades

| Ruta | Responsabilidad |
| --- | --- |
| `src/app/api` | Endpoints GET y respuestas HTTP. |
| `src/app/login` | Formulario mínimo de acceso; no permite registro. |
| `src/server/auth` | Renovación de sesión y comprobación de administrador. |
| `src/server/db` | Configuración y cliente Supabase del servidor. |
| `src/server/repositories` | Consultas filtradas por snapshot. |
| `src/server/services` | Casos de uso, agregaciones y manejo seguro de errores. |
| `src/contracts` | Tipos y validaciones compartidas. |
| `src/domain` | Inventario, déficit, excedente, voluntarios, eventos y traslados. |
| `supabase/migrations` | Esquema, relaciones, permisos y RLS versionados. |
| `supabase/seed.sql` | Dataset demostrativo determinista. |
| `tests/unit` | Reglas puras. |
| `tests/integration` | PostgreSQL, restricciones y RLS reales. |
| `tests/http` | API real con tres estados de autorización. |

No se implementaron importador Excel, dashboard visual, mutaciones de simulación, donantes, mapas o notificaciones.

