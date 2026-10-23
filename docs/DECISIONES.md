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

## Diferencias registradas respecto al Bloque A

El contrato preliminar se amplió con snapshots, reserva, simulaciones y eventos. `coordinadores` dejó de ser entidad separada, `inventario` pasó a `inventario_inicial` e `intenciones` a `donaciones_esperadas`. Estos cambios proceden del prompt aprobado del Bloque B y no borran el historial previo de Git.

## Pendientes reales

- Aplicar y verificar la migración en Supabase local o en una instancia de desarrollo autorizada.
- Ejecutar las suites PostgreSQL/RLS/HTTP autenticadas una vez disponible esa infraestructura.
- Crear las cuentas administradoras reales mediante Supabase Auth antes de un despliegue futuro.

