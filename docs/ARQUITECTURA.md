# Arquitectura

## Propósito y alcance actual

Redes de Ayuda es un prototipo académico para coordinar centros de acopio en Cali. En el Bloque A solo existe la base técnica y documental; todavía no hay autenticación, base de datos, endpoints de negocio, importaciones, dashboard ni simulaciones.

## Stack aprobado

- Next.js 16 con App Router.
- React 19.
- TypeScript 5 en modo estricto.
- Tailwind CSS 4.
- ESLint 10 con la configuración de Next.js.
- npm como gestor de paquetes.
- PostgreSQL mediante Supabase queda reservado para el Bloque B y aún no tiene SDK ni credenciales configuradas.

Las versiones efectivas instaladas quedan fijadas en `package-lock.json` y se verifican con `npm list --depth=0`.

| Componente | Versión efectiva del Bloque A |
| --- | --- |
| Node.js | 24.18.0 |
| npm | 11.16.0 |
| Next.js / `eslint-config-next` | 16.4.3 |
| React / React DOM | 19.3.1 |
| TypeScript | 5.9.3 |
| Tailwind CSS / `@tailwindcss/postcss` | 4.3.3 |
| ESLint | 10.13.0 |

## Flujo previsto

El flujo futuro seguirá esta dirección:

```text
Frontend (app/features)
        -> API (app/api)
        -> servicios backend (server/services)
        -> repositorios (server/repositories)
        -> PostgreSQL mediante Supabase
```

Las rutas solo reciben y presentan solicitudes. Los servicios coordinan casos de uso. Los repositorios aíslan la persistencia. Las reglas que no dependen de infraestructura pertenecen a `domain`. Este flujo es una guía aprobada; sus interfaces concretas se definirán en microbloques posteriores.

## Carpetas y responsabilidades

| Ruta | Responsabilidad |
| --- | --- |
| `src/app` | Rutas, layouts, páginas y futuros controladores HTTP con App Router. |
| `src/features` | Módulos funcionales organizados por capacidad de usuario. |
| `src/server` | Acceso a datos, autenticación futura, repositorios y servicios backend. |
| `src/contracts` | Esquemas y tipos compartidos en los límites del sistema. |
| `src/domain` | Reglas de negocio puras, sin dependencias de framework o persistencia. |
| `src/components` | Componentes visuales reutilizables. |
| `src/lib` | Utilidades técnicas compartidas que no pertenecen a una feature. |
| `supabase` | Futuras migraciones versionadas de PostgreSQL. |
| `data` | Plantillas de entrada y datos de demostración sin secretos. |
| `tests` | Pruebas automatizadas cuando existan comportamientos verificables. |
| `docs` | Contratos, decisiones, estado y bitácora del proyecto. |

