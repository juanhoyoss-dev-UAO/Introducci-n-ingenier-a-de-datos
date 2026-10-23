# Redes de Ayuda

Prototipo académico para coordinar centros de acopio en Cali. El Bloque C1 sustituyó la persistencia operativa PostgreSQL/Supabase por snapshots CSV/JSON locales, conservando la API, las reglas de negocio y la autenticación administrativa temporal de Supabase.

No incluye importador Excel, dashboard visual, endpoints de escritura ni motor interactivo de simulación.

## Requisitos

- Node.js 24 recomendado; Next.js requiere 20.9 o superior.
- npm.
- Git.

Docker y PostgreSQL no son necesarios para leer, escribir o probar la persistencia CSV. Los endpoints protegidos y el login continúan necesitando Supabase Auth hasta C2.

## Instalación

```bash
git clone https://github.com/juanhoyoss-dev-UAO/Introducci-n-ingenier-a-de-datos.git
cd Introducci-n-ingenier-a-de-datos
npm ci
```

## Datos CSV/JSON

- `data/templates`: ocho plantillas CSV con encabezados canónicos.
- `data/demo/snapshots`: dos snapshots demostrativos versionados.
- `data/runtime`: snapshots creados durante la ejecución; está ignorado por Git.

Cada snapshot contiene `metadata.json` y ocho CSV: centros, productos, presentaciones, inventario, necesidades, voluntarios, tiempos e intenciones. El repositorio valida campos, referencias y unicidad antes de usar o publicar un snapshot.

Las escrituras utilizan `data/runtime/.staging`, releen lo escrito y sólo entonces publican mediante `rename`. Un snapshot existente no se sobrescribe.

## Autenticación temporal

Copiar `.env.example` como `.env.local` y configurar una instancia Supabase Auth autorizada:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=<API_URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY>
```

No versionar `.env.local`. La aplicación continúa verificando sesión y pertenencia a `administradores`; Supabase ya no suministra los datos operativos. La sustitución de Auth corresponde a C2.

## Pruebas

```bash
npm run test:unit
npm run test:integration
npm run lint
npm run typecheck
npm run build
```

`test:integration` ejecuta las pruebas CSV reales con directorios temporales. Las suites antiguas de PostgreSQL/RLS se mantienen como evidencia del Bloque B y se omiten salvo que `RUN_SUPABASE_INTEGRATION=true`; una prueba omitida no equivale a aprobada.

Para las pruebas HTTP autenticadas se necesita una instancia Supabase Auth y la aplicación en otra terminal:

```bash
npm run dev
npm run test:http
```

## Ejecución y API

```bash
npm run dev
```

`GET /api/health` es público. Abrir `http://localhost:3000/login` para iniciar sesión con una cuenta Supabase incluida en `administradores`. Después se conservan estas rutas:

- `GET /api/snapshots`
- `GET /api/snapshots/{id}`
- `GET /api/centers?snapshotId={id}`
- `GET /api/products?snapshotId={id}`
- `GET /api/travel-times?snapshotId={id}`
- `GET /api/dashboard?snapshotId={id}`

El snapshot principal es `10000000-0000-4000-8000-000000000001`. Sus seis centros y los resultados del dashboard proceden de archivos CSV reales.

## Estructura y colaboración

- `src/app/api`: contratos HTTP; reservado al líder técnico salvo coordinación.
- `src/server/repositories`: interfaz de acceso y repositorio CSV.
- `src/server/storage`: lectura, serialización y controles de archivos.
- `src/server/auth` y `src/server/db`: Supabase Auth temporal; se retirará en C2.
- `src/contracts` y `src/domain`: validaciones, tipos y fórmulas compartidas.
- `data/templates` y `data/demo`: datos versionados; modificar sólo con revisión.
- `data/runtime`: datos locales no versionados.
- `supabase`: legado del Bloque B conservado hasta verificar C2.
- `tests`: pruebas unitarias, integración CSV, legado Supabase y HTTP.
- `src/features/imports` y `src/features/dashboard`: puntos de integración futuros.

Los componentes visuales deben consumir servicios o endpoints; no deben leer archivos ni duplicar fórmulas.

## Estado conocido

C1 utiliza CSV/JSON como persistencia operativa y no requiere Docker ni PostgreSQL. Supabase sigue activo únicamente para autenticación, proxy de sesión y autorización administrativa. Las pruebas HTTP con administrador permanecen condicionadas a disponer de esa autenticación.
