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

## Bloque C2

| Fecha | Decisión | Motivo |
| --- | --- | --- |
| 2026-10-23 | Usar un único administrador configurado por entorno, sin valores predeterminados. | Cubre el prototipo sin autorregistro, proveedor externo ni almacén de usuarios. |
| 2026-10-23 | Derivar contraseñas con `scrypt`, sal aleatoria y formato versionado. | Evita texto plano y permite verificación segura con primitivas mantenidas por Node.js. |
| 2026-10-23 | Firmar sesiones stateless con HMAC-SHA256 y una vigencia máxima de cuatro horas. | Mantiene el despliegue local simple, sin base de sesiones, y limita la ventana de exposición. |
| 2026-10-23 | Usar cookie `HttpOnly`, `SameSite=Lax`, expirable y `Secure` bajo HTTPS. | El secreto no queda accesible a JavaScript y se reducen riesgos de robo/CSRF. |
| 2026-10-23 | Exigir `Origin` local exacto en login y logout. | Protege las operaciones que crean o eliminan la cookie. |
| 2026-10-23 | Mantener `requireAdministrator()` como control autoritativo dentro de cada Route Handler. | Evita depender de un proxy optimista y conserva la centralización 401/403/200. |
| 2026-10-23 | No añadir una dependencia de autenticación. | `node:crypto` cubre scrypt, HMAC y comparaciones seguras con menor superficie. |
| 2026-10-23 | Ejecutar HTTP contra copias CSV temporales mediante raíces configurables del proceso hijo. | Prueba el recorrido real y el error de lectura sin modificar demo ni runtime personal. |
| 2026-10-23 | Retirar Supabase sólo después de aprobar la autenticación y los endpoints locales. | Respeta una migración reversible; los checkpoints Git conservan la evidencia histórica. |

## Pendientes reales

- Definir persistencia de eventos únicamente cuando se autorice la fase correspondiente; C1 no la declara implementada.
- No iniciar importador, interfaz ni otros módulos hasta recibir aprobación.
- Revisar el Bloque C2 completo antes de continuar con otra fase.

