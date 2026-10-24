# Redes de Ayuda

Prototipo académico para coordinar centros de acopio en Cali. La persistencia operativa usa snapshots CSV/JSON locales y la autenticación administrativa es local: no requiere Supabase, PostgreSQL, Docker ni servicios externos.

No incluye importador Excel, dashboard visual, endpoints de escritura ni motor interactivo de simulación.

## Requisitos

- Node.js 24 recomendado; Next.js requiere 20.9 o superior.
- npm.
- Git.

## Instalación

```bash
git clone https://github.com/juanhoyoss-dev-UAO/Introducci-n-ingenier-a-de-datos.git
cd Introducci-n-ingenier-a-de-datos
npm ci
```

## Configuración local

Copiar `.env.example` como `.env.local`. No versionar `.env.local` ni credenciales reales.

```dotenv
ADMIN_USERNAME=
ADMIN_PASSWORD_HASH=
SESSION_SECRET=
```

El hash se genera de forma interactiva; la contraseña no se recibe como argumento ni se muestra en la terminal:

```bash
npm run auth:hash
```

Copiar únicamente el hash resultante a `ADMIN_PASSWORD_HASH`. No existen credenciales predeterminadas. `SESSION_SECRET` debe ser distinto de la contraseña y del hash.

Puede generarse un secreto aleatorio de sesión con Node.js:

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url') + '\n')"
```

## Datos CSV/JSON

- `data/templates`: ocho plantillas CSV con encabezados canónicos.
- `data/demo/snapshots`: dos snapshots demostrativos versionados.
- `data/runtime`: snapshots creados durante la ejecución; está ignorado por Git.

Cada snapshot contiene `metadata.json` y ocho CSV: centros, productos, presentaciones, inventario, necesidades, voluntarios, tiempos e intenciones. El repositorio valida campos, referencias y unicidad antes de usar o publicar un snapshot.

Las escrituras internas utilizan `data/runtime/.staging`, releen lo escrito y sólo entonces publican mediante `rename`. Un snapshot existente no se sobrescribe.

## Ejecución y autenticación

```bash
npm run dev
```

Abrir `http://localhost:3000/login`, introducir `ADMIN_USERNAME` y la contraseña original, y usar el botón de cierre de sesión cuando termine la consulta.

La sesión se conserva en una cookie firmada `HttpOnly`, `SameSite=Lax`, con cuatro horas de vigencia y `Secure` bajo HTTPS. El servidor verifica firma, vigencia, usuario y rol en cada ruta protegida. Login y logout exigen un encabezado `Origin` del mismo origen para reducir riesgos CSRF.

Ejemplo de consumo local con un archivo de cookies temporal:

```bash
curl -i -c session.txt \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  --data '{"username":"<usuario>","password":"<contraseña>"}' \
  http://localhost:3000/api/auth/login

curl -b session.txt http://localhost:3000/api/snapshots

curl -i -b session.txt -c session.txt \
  -X POST -H "Origin: http://localhost:3000" \
  http://localhost:3000/api/auth/logout
```

No versionar `session.txt`. El logout elimina la cookie del cliente; como las sesiones son firmadas y no se registran en una base central, un token copiado previamente no tiene revocación individual inmediata y continúa siendo verificable hasta vencer. Rotar `SESSION_SECRET` invalida todas las sesiones.

## API

`GET /api/health` es público. Estas rutas de autenticación son locales:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Las rutas operativas requieren una sesión administrativa válida:

- `GET /api/snapshots`
- `GET /api/snapshots/{id}`
- `GET /api/centers?snapshotId={id}`
- `GET /api/products?snapshotId={id}`
- `GET /api/travel-times?snapshotId={id}`
- `GET /api/dashboard?snapshotId={id}`

El snapshot principal es `10000000-0000-4000-8000-000000000001`. Sus seis centros y los resultados del dashboard proceden de archivos CSV reales.

## Pruebas

```bash
npm run test:unit
npm run test:csv
npm run test:http
npm run lint
npm run typecheck
npm run build
```

`test:http` crea credenciales efímeras, copia los dos snapshots a una raíz temporal ignorada, inicia un servidor Next.js en un puerto local y lo cierra al terminar. No usa mocks de repositorio, secretos reales ni `data/runtime` personal.

## Estructura y colaboración

- `src/app/api`: contratos HTTP y endpoints de autenticación/consulta.
- `src/app/login`: formulario local de login, consulta de sesión y logout.
- `src/server/auth`: hash `scrypt`, configuración, firma y autorización.
- `src/server/repositories`: interfaz de acceso y repositorio CSV.
- `src/server/storage`: lectura, serialización y controles de archivos.
- `src/contracts` y `src/domain`: validaciones, tipos y fórmulas compartidas.
- `data/templates` y `data/demo`: datos versionados; modificar sólo con revisión.
- `data/runtime`: datos locales no versionados.
- `tests`: pruebas unitarias, integración CSV y HTTP real aislado.

Los componentes visuales deben consumir servicios o endpoints; no deben leer archivos ni duplicar fórmulas.

## Estado conocido

El Bloque C2 está completo: reemplazó la autenticación Supabase por credenciales y sesiones firmadas locales. Después de una instalación limpia con `npm ci`, aprobaron 14 casos unitarios, 25 casos CSV, 12 casos HTTP reales, lint, typecheck, build y `git diff --check`. La matriz T01–T14 y la evidencia reproducible están en `docs/PRUEBAS_C2.md`.
