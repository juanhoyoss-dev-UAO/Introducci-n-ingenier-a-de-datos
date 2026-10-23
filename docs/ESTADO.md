# Estado del proyecto

## Fase actual

Bloque A completado el 2026-10-23. El proyecto queda detenido a la espera de aprobación; no se ha iniciado el Bloque B.

## Completado

- Inspección inicial del repositorio, Git y herramientas locales.
- Configuración base de Next.js con App Router, TypeScript, Tailwind CSS y ESLint.
- Página inicial mínima de Redes de Ayuda.
- Estructura modular reservada.
- Documentación inicial de arquitectura, datos, API, decisiones y colaboración.
- Dependencias locales instaladas y `package-lock.json` generado.
- Lint, comprobación de tipos y build de producción ejecutados correctamente.
- Servidor de desarrollo verificado con respuesta HTTP 200 y contenido esperado.

## Pendientes de aprobación

- Aprobar el inicio y alcance del siguiente microbloque.
- Aprobar el contrato preliminar antes de crear cualquier tabla o migración.

## Restricciones vigentes

- No implementar autenticación, Supabase, migraciones, importación de Excel, dashboard, simulaciones ni reglas de negocio.
- No crear datos ficticios en componentes.
- No usar intenciones esperadas como inventario confirmado.
- No realizar commits, push ni despliegues sin autorización.

## Siguiente microbloque

Tras cerrar el Bloque A, detenerse y solicitar aprobación antes de definir o iniciar el Bloque B.

## Verificación de cierre

- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- `npm run build`: aprobado con webpack.
- Servidor de desarrollo: HTTP 200 y textos esperados confirmados.
- Turbopack: se reprodujo un fallo interno al iniciar PostCSS en Windows/Node 24; se adoptó webpack como decisión de compatibilidad del Bloque A.

