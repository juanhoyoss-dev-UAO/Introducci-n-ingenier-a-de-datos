# Decisiones técnicas

## Bloque A conservado

| Fecha | Decisión | Motivo |
| --- | --- | --- |
| 2026-10-23 | Next.js App Router, React, TypeScript, Tailwind, ESLint y npm. | Stack académico aprobado. |
| 2026-10-23 | Código bajo `src` con alias `@/*`. | Separación sencilla entre configuración y código. |
| 2026-10-23 | Capas `app`, `server`, `contracts`, `domain`, `components` y `lib`. | Responsabilidades explícitas sin sobreingeniería. |
| 2026-10-23 | Webpack en `dev` y `build`. | Turbopack falló al iniciar PostCSS en Windows/Node 24. |

## Bloque B

| Fecha | Decisión | Motivo |
| --- | --- | --- |
| 2026-10-23 | Usar nombres SQL canónicos en español. | No existía una convención física previa y coincide con el contrato actualizado. |
| 2026-10-23 | Claves primarias y foráneas compuestas por snapshot. | PostgreSQL impide referencias cruzadas aunque se repitan códigos como `C01`. |
| 2026-10-23 | Integrar el coordinador demostrativo como `coordinador_nombre` en centros. | El Bloque B prohíbe coordinadores autenticados y fija este campo. |
| 2026-10-23 | Prioridad 1 alta, 2 media y 3 baja. | Escala sencilla y validable requerida por el prototipo. |
| 2026-10-23 | Exponer solo SELECT a administradores autenticados. | Los endpoints autorizados son únicamente de lectura. |
| 2026-10-23 | Centralizar RLS con `es_administrador()`. | Evita duplicar la consulta de autorización y no usa service role en la aplicación. |
| 2026-10-23 | Usar `@supabase/ssr` y proxy de Next 16. | Mantiene sesiones en cookies con el mecanismo recomendado para SSR. |
| 2026-10-23 | Transferencias asignadas por menor tiempo y mayor presentación. | Produce un resultado determinista en paquetes completos sin alterar inventario. |
| 2026-10-23 | Vitest y suites separadas por tipo. | Distingue reglas puras, PostgreSQL real y HTTP real. |
| 2026-10-23 | Deshabilitar autorregistro en `supabase/config.toml`. | Solo se permiten administradores creados explícitamente. |

## Auditoría C0 y Bloque C1

| Fecha | Decisión | Motivo |
| --- | --- | --- |
| 2026-10-23 | Sustituir PostgreSQL/PostgREST por archivos CSV/JSON locales. | El prototipo necesita persistencia demostrable sin Docker ni infraestructura externa. |
| 2026-10-23 | Mantener una interfaz `OperationsRepository`. | Desacopla servicios y rutas de la fuente física. |
| 2026-10-23 | Versionar templates y demo; ignorar `data/runtime`. | Separa datos reproducibles de datos operativos locales. |
| 2026-10-23 | Usar ocho CSV por snapshot y `metadata.json`. | Conserva el contrato canónico con una estructura legible. |
| 2026-10-23 | Usar `csv-parse` y `csv-stringify`. | Evita un parser manual incapaz de manejar comillas, comas o multilinea. |
| 2026-10-23 | Validar cada fila y todas las relaciones con Zod. | Reemplaza para el prototipo los checks, unicidad y FKs que daba PostgreSQL. |
| 2026-10-23 | Publicar snapshots mediante staging, relectura y `rename`. | Evita exponer cargas parciales y prohíbe sobrescrituras. |
| 2026-10-23 | Conservar rutas y contratos HTTP del Bloque B. | Evita cambios para los compañeros del dashboard/importador. |
| 2026-10-23 | Mantener Supabase sólo para Auth durante C1. | Los endpoints no pueden quedar públicos antes de implementar C2. |
| 2026-10-23 | No persistir todavía eventos de simulación. | C1 cubre snapshots; la función pura sigue siendo la única capacidad implementada. |

## Diferencias registradas respecto al Bloque A

El contrato preliminar se amplió con snapshots, reserva, simulaciones y eventos. `coordinadores` dejó de ser entidad separada, `inventario` pasó a `inventario_inicial` e `intenciones` a `donaciones_esperadas`. Estos cambios proceden del prompt aprobado del Bloque B y no borran el historial previo de Git.

## Pendientes reales

- Ejecutar C2 únicamente con aprobación: sustituir Supabase Auth y retirar sus clientes, variables, scripts y RLS.
- Rehacer las pruebas HTTP 401/403/200 con la autenticación de C2.
- Retirar la migración y el seed SQL sólo después de verificar que no se pierde evidencia o datos necesarios.
- Definir persistencia de eventos únicamente cuando se autorice la fase correspondiente; C1 no la declara implementada.

