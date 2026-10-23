# Decisiones técnicas

## Aprobadas para el Bloque A

| Fecha | Decisión | Motivo |
| --- | --- | --- |
| 2026-10-23 | Usar Next.js con App Router, React, TypeScript, Tailwind CSS, ESLint y npm. | Es el stack académico aprobado. |
| 2026-10-23 | Mantener el código de aplicación bajo `src` y el alias `@/*` hacia `src/*`. | Separa configuración y código y simplifica importaciones. |
| 2026-10-23 | Mantener separadas las capas `app`, `features`, `server`, `contracts`, `domain`, `components` y `lib`. | Hace explícitas las responsabilidades sin implementar todavía módulos de negocio. |
| 2026-10-23 | Reservar PostgreSQL mediante Supabase para el Bloque B. | Evita introducir SDK, credenciales o migraciones antes de aprobar el contrato de datos. |
| 2026-10-23 | Utilizar TypeScript 5 con Next.js 16. | Es la línea declarada por la plantilla oficial de la versión seleccionada. |
| 2026-10-23 | Utilizar ESLint 10 con `eslint-config-next` 16. | ESLint 9 fue reportado fuera de soporte por npm y la configuración de Next acepta ESLint 9 o superior. |
| 2026-10-23 | Usar webpack en los scripts `dev` y `build`. | Turbopack 16.4.3 falló al iniciar el proceso de PostCSS en el entorno Windows/Node 24; webpack compiló correctamente con la misma configuración. |
| 2026-10-23 | Conservar directorios vacíos mediante `.gitkeep`. | Permite compartir la estructura sin crear módulos o rutas ficticias. |

## Cuestiones pendientes

- Aprobar el contrato de datos, tipos, claves y reglas antes de crear tablas.
- Definir autenticación y autorización del administrador y los coordinadores.
- Aprobar contratos concretos de API y manejo de errores.
- Definir formatos de Excel reales y sus mapeos explícitos.
- Elegir estrategia de pruebas cuando aparezca la primera función de negocio.
- Aprobar el inicio y alcance exacto del Bloque B.

