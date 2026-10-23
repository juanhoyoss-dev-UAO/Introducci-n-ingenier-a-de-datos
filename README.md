# Redes de Ayuda

Backend académico para coordinar centros de acopio en Cali. El Bloque B incluye modelo relacional, migraciones Supabase, datos demostrativos, autenticación administrativa, endpoints de lectura y reglas de inventario. No incluye importador Excel, dashboard visual ni motor interactivo de simulación.

## Requisitos

- Node.js 24 recomendado; Next.js requiere 20.9 o superior.
- npm.
- Docker Desktop funcionando.
- Git.

## Instalación

```bash
git clone https://github.com/juanhoyoss-dev-UAO/Introducci-n-ingenier-a-de-datos.git
cd Introducci-n-ingenier-a-de-datos
npm ci
```

## Supabase local

```bash
npm run supabase:start
npm run supabase:reset
npx supabase status -o env
```

`supabase:reset` incluye `--local`: reconstruye únicamente la base local descartable, aplica las migraciones y carga `supabase/seed.sql`. No utilizar `--linked` sin autorización expresa.

Copiar `.env.example` como `.env.local` y mapear la salida de `supabase status`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=<API_URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY-o-ANON_KEY-local>
RUN_SUPABASE_INTEGRATION=true
SUPABASE_TEST_URL=<API_URL>
SUPABASE_TEST_PUBLISHABLE_KEY=<PUBLISHABLE_KEY-o-ANON_KEY-local>
SUPABASE_TEST_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY-local>
TEST_BASE_URL=http://127.0.0.1:3000
```

No versionar `.env.local`. La service role es exclusiva de fixtures de pruebas locales y nunca debe llegar al navegador ni usarse en las consultas normales.

## Pruebas

```bash
npm run test:unit
npm run test:integration
npm run lint
npm run typecheck
npm run build
```

Las pruebas de integración se omiten si `RUN_SUPABASE_INTEGRATION` no es `true`. Una prueba omitida no equivale a aprobada. La suite de integración crea dos usuarios locales reproducibles:

- Administrador: `admin@redes-ayuda.local`
- Usuario no autorizado: `usuario@redes-ayuda.local`
- Contraseña local compartida: `RedesAyuda-Local-2026!`

Para la suite HTTP, mantener la aplicación ejecutándose en otra terminal:

```bash
npm run dev
npm run test:http
```

## Ejecución y login

```bash
npm run dev
```

Abrir `http://localhost:3000/login` e iniciar sesión con el administrador local creado por las pruebas. La aplicación no ofrece autorregistro.

## Consultar la API

Primero consultar `GET /api/snapshots` con la sesión administrativa y copiar un `id`. Después utilizarlo como `snapshotId`:

- `GET /api/health`
- `GET /api/snapshots`
- `GET /api/snapshots/{id}`
- `GET /api/centers?snapshotId={id}`
- `GET /api/products?snapshotId={id}`
- `GET /api/travel-times?snapshotId={id}`
- `GET /api/dashboard?snapshotId={id}`

El snapshot demostrativo principal es `10000000-0000-4000-8000-000000000001`. Las rutas operativas usan las cookies creadas por el login; una solicitud anónima recibe 401.

## Estructura y colaboración

- `src/app/api`: contratos HTTP implementados; reservado al líder técnico salvo coordinación.
- `src/server`: autenticación, acceso a datos y servicios; reservado al líder técnico.
- `src/contracts` y `src/domain`: tipos y fórmulas reutilizables; cambiar solo con revisión.
- `supabase`: esquema, RLS y seed; no modificar ni aplicar remotamente sin autorización.
- `tests`: pruebas unitarias, PostgreSQL y HTTP.
- `src/features/imports`: punto futuro para el compañero del importador Excel.
- `src/features/dashboard`: punto futuro para el compañero del dashboard visual.

Los compañeros deben consumir los endpoints y funciones existentes; no deben duplicar fórmulas dentro de componentes React. Antes de cada tarea se deben leer `AGENTS.md` y `docs/ESTADO.md`.

## Estado conocido

El código, las pruebas unitarias y el build están verificados. En el entorno donde se implementó el Bloque B, Docker Desktop no pudo iniciar por un socket local obsoleto; por ello las migraciones y pruebas autenticadas no se declararon aprobadas. Consulte `docs/PRUEBAS_B.md` para la evidencia exacta.
