# Estado del proyecto

## Fase actual

Bloque B parcial al 2026-10-23. El código, migración, seed, endpoints y pruebas están preparados; falta ejecutar PostgreSQL/Supabase real porque Docker Desktop no pudo iniciar su motor local.

## Completado y verificado

- Modelo relacional y RLS escritos como migración versionada.
- Dos snapshots y dataset demostrativo determinista en `seed.sql`.
- Clientes SSR, renovación de cookies y autorización administrativa.
- Repositorios, servicios y cálculos puros.
- Siete endpoints autorizados y página mínima de login.
- Ocho pruebas unitarias aprobadas.
- Lint, TypeScript y build de producción aprobados.
- `/api/health` verificado con HTTP 200.
- Acceso anónimo a `/api/snapshots` verificado con HTTP 401.

## Preparado pero no verificado contra PostgreSQL

- Aplicación desde cero de la migración y el seed.
- Restricciones SQL, aislamiento compuesto y reproducibilidad.
- RLS para usuario no autorizado y administrador.
- Lecturas HTTP autenticadas provenientes de PostgreSQL.
- Respuesta 500 ante pérdida controlada de PostgREST.

Las suites correspondientes se omiten automáticamente salvo que `RUN_SUPABASE_INTEGRATION=true`; una omisión no se considera aprobación.

## Bloqueo de entorno

Docker Desktop 4.80.0 falla al iniciar por un reparse point antiguo en `C:\Users\hoyos\AppData\Local\Docker\run\dockerInference`. Windows negó moverlo incluso con permisos ampliados. No se usó “Reset to factory defaults”, no se ejecutó `supabase db reset` y no se tocó ningún proyecto remoto.

## Siguiente microbloque

Recuperar Docker Desktop fuera de este repositorio o proporcionar credenciales de una instancia Supabase de desarrollo aislada. Después: iniciar Supabase local, ejecutar `npm run supabase:reset`, cargar fixtures de Auth y correr las suites de integración y HTTP. No iniciar importación Excel ni dashboard visual sin nueva aprobación.

