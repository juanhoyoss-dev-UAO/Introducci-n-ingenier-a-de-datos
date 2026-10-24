# Redes de Ayuda

Aplicación académica local para consultar el estado de centros de acopio en Cali. Usa Next.js, React y TypeScript; almacena la información operativa en snapshots CSV/JSON y protege la consola con una cuenta administrativa local.

La versión actual permite iniciar sesión, escoger un snapshot, filtrar por centro y consultar centros, inventario físico, necesidades, voluntarios, donaciones esperadas y tiempos de traslado. No necesita Supabase, PostgreSQL, Docker ni una instalación global de Next.js.

No están implementados todavía el importador CSV/Excel, la capacidad máxima en kilogramos, las recepciones confirmadas por hora, los gráficos de evolución, endpoints de escritura ni una simulación interactiva.

## 1. Aviso de seguridad antes de compartir el repositorio

La auditoría E0 encontró que, en el commit `e662241`, `.env.local` está versionado y contiene valores no vacíos para la cuenta administrativa, el hash y el secreto de sesión. Este README no reproduce esos valores.

**No se debe distribuir ese commit como base para los compañeros hasta retirar el archivo del seguimiento y rotar las credenciales.** El líder técnico debe:

1. Generar una contraseña nueva y un `SESSION_SECRET` nuevo.
2. Añadir `.env*` y la excepción `!.env.example` a `.gitignore`.
3. Ejecutar `git rm --cached .env.local` para conservar el archivo local pero retirarlo del índice.
4. Crear un commit normal con esa retirada. E0 no requiere reescribir el historial.
5. Confirmar con `git ls-files --error-unmatch .env.local` que Git ya no lo sigue.
6. Pedir a cada integrante que cree sus propias credenciales locales.

La rotación de `SESSION_SECRET` invalida todas las sesiones firmadas con el secreto anterior. Si la contraseña asociada al hash versionado pudo ser conocida, también debe cambiarse.

## 2. Requisitos previos en Windows

Instala estas herramientas antes de clonar el proyecto:

- **Git para Windows:** <https://git-scm.com/download/win>
- **Node.js:** <https://nodejs.org/>. Next.js `16.4.3` exige Node.js `20.9.0` o posterior; se recomienda una versión LTS compatible. La auditoría utilizó Node.js `24.18.0`.
- **npm:** se instala junto con Node.js. La auditoría utilizó npm `11.16.0`.
- **Visual Studio Code**, recomendado: <https://code.visualstudio.com/>
- Un navegador moderno, por ejemplo Edge, Chrome o Firefox.
- Opcionalmente **GitHub Desktop:** <https://desktop.github.com/>

Abre PowerShell y verifica las instalaciones:

```powershell
git --version
node --version
npm.cmd --version
```

Si alguno de esos comandos no existe, cierra y vuelve a abrir la terminal después de instalar la herramienta. No instales Next.js globalmente: `npm.cmd ci` instalará la versión exacta del proyecto.

## 3. Descargar el repositorio

### Opción A: GitHub Desktop

1. Abre GitHub Desktop.
2. Elige **File → Clone repository → URL**.
3. Usa esta URL real:

   `https://github.com/juanhoyoss-dev-UAO/Introducci-n-ingenier-a-de-datos.git`

4. Elige una carpeta local y pulsa **Clone**.
5. Usa **Open in Visual Studio Code**.

### Opción B: terminal

```powershell
git clone https://github.com/juanhoyoss-dev-UAO/Introducci-n-ingenier-a-de-datos.git
cd Introducci-n-ingenier-a-de-datos
code .
```

El archivo `package.json` debe quedar en la carpeta abierta. Compruébalo con:

```powershell
Get-Item .\package.json
```

## 4. Instalar dependencias

Desde la carpeta que contiene `package.json`, ejecuta:

```powershell
npm.cmd ci
```

`npm.cmd ci` usa `package-lock.json` y reproduce las versiones aprobadas. En PowerShell se recomienda `npm.cmd` porque algunas instalaciones bloquean el script `npm.ps1`; no es necesario cambiar la política de ejecución de Windows.

## 5. Configurar la autenticación local

Cuando el líder confirme que `.env.local` ya no está versionado, crea tu copia local:

```powershell
Copy-Item .env.example .env.local
```

Si el archivo ya existe, no muestres ni compartas su contenido. Tras la rotación autorizada, reemplázalo conscientemente con:

```powershell
Copy-Item .env.example .env.local -Force
```

Edita `.env.local` en VS Code y configura:

```dotenv
ADMIN_USERNAME=ADMIN
ADMIN_PASSWORD_HASH=
SESSION_SECRET=
APP_LOG_LEVEL=INFO
NEXT_PUBLIC_APP_LOG_LEVEL=INFO
```

### Crear el hash de contraseña

Ejecuta:

```powershell
npm.cmd run auth:hash
```

El comando solicita la contraseña de forma interactiva y devuelve un hash `scrypt`. Copia el hash completo a `ADMIN_PASSWORD_HASH`.

El hash **no es la contraseña**. En `/login` debes escribir la contraseña original que elegiste, junto con el usuario `ADMIN`. Para cambiarla, vuelve a ejecutar `npm.cmd run auth:hash`, sustituye el hash y reinicia Next.js.

### Crear el secreto de sesión

Genera un valor aleatorio independiente:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Copia el resultado a `SESSION_SECRET`. Debe tener al menos 32 bytes y no debe ser la contraseña ni el hash.

Cada vez que modifiques `.env.local`, detén el servidor con `Ctrl + C` y vuelve a ejecutar `npm.cmd run dev`.

## 6. Ejecutar la aplicación

```powershell
npm.cmd run dev
```

Espera el mensaje de disponibilidad y abre <http://localhost:3000>. La ruta raíz redirige a `/dashboard`; si no existe una sesión válida, el servidor redirige a `/login`.

1. Entra con `ADMIN` y la contraseña original.
2. Al aprobarse el acceso, el navegador abre `/dashboard`.
3. Para detener la aplicación, vuelve a la terminal y pulsa `Ctrl + C`.

## 7. Uso del dashboard

El dashboard consulta endpoints reales; la interfaz no abre archivos CSV directamente.

1. **Snapshot operativo:** elige una jornada. Al cambiarla se cancelan solicitudes anteriores y se limpia el estado para evitar mezclar snapshots.
2. **Centro visible:** selecciona todos los centros o uno específico.
3. **Centros:** muestra identificador, nombre, estado, zona y coordinación.
4. **Inventario:** muestra paquetes físicos por SKU, contenido por paquete, subtotal de la presentación y total confirmado del producto.
5. **Necesidades:** compara objetivo, inventario confirmado y déficit.
6. **Voluntarios:** muestra disponibles, requeridos y faltantes.
7. **Donaciones esperadas:** muestra intenciones anunciadas por separado; una intención pendiente no aumenta el inventario confirmado.
8. **Tiempos de traslado:** muestra tiempos dirigidos; origen → destino no implica el tiempo inverso.
9. **Cerrar sesión:** elimina la cookie del navegador y vuelve a `/login`.

Los datos versionados se encuentran en `data/demo/snapshots`. Cada snapshot tiene `metadata.json` y ocho CSV. `data/runtime` está destinado a datos locales generados y no debe versionarse.

## 8. Diagnóstico

### Terminal de VS Code

Abre **Terminal → New Terminal**. Los registros usan niveles:

- `INFO`: inicio o contexto de una operación.
- `OK`: operación finalizada correctamente.
- `WARN`: rechazo o condición recuperable.
- `ERROR`: fallo no recuperado.

Los módulos son `AUTH`, `API`, `SERVICE`, `REPOSITORY` y `UI`. El servidor añade `X-Request-Id` a las respuestas instrumentadas; el mismo identificador aparece en las trazas de API, servicio y repositorio.

`APP_LOG_LEVEL` controla el servidor y `NEXT_PUBLIC_APP_LOG_LEVEL` el navegador. Admiten `INFO`, `OK`, `WARN`, `ERROR` y `OFF`. Sin configuración, desarrollo usa `INFO` y producción `WARN`.

### Console y Network del navegador

1. Pulsa `F12`.
2. Abre **Console** para ver navegación, carga, filtros y errores de UI.
3. Abre **Network**, recarga y selecciona una solicitud `/api/...`.
4. Revisa **Status**, **Response** y el encabezado `X-Request-Id`.
5. Busca ese ID en la terminal para seguir la operación completa.

## 9. Errores comunes

| Síntoma | Causa probable | Solución verificable |
|---|---|---|
| `npm.ps1 cannot be loaded` | PowerShell bloquea scripts `.ps1` | Usa `npm.cmd ci` y `npm.cmd run dev`; no cambies la política del sistema. |
| `node`, `npm.cmd` o `git` no se reconoce | Herramienta no instalada o terminal antigua | Instala la herramienta, reinicia la terminal y verifica su versión. |
| `Cannot find module` | Dependencias ausentes o incompletas | Ejecuta `npm.cmd ci` desde la carpeta de `package.json`. |
| `.env.local` no existe | No se copió la plantilla | Ejecuta `Copy-Item .env.example .env.local` después de la corrección de seguridad. |
| Aparece `.env.local.txt` | Windows ocultó la extensión | Activa **Extensiones de nombre de archivo** y renombra el archivo exactamente a `.env.local`. |
| `AUTH_CONFIGURATION_ERROR` | Falta una variable, el hash es inválido o el secreto es corto | Revisa los tres campos, genera de nuevo hash y secreto, y reinicia el servidor. |
| `401 INVALID_CREDENTIALS` | Usuario o contraseña incorrectos | Usa `ADMIN` y la contraseña original, no el hash. Regenera el hash si es necesario. |
| Puerto 3000 ocupado | Otro proceso usa el puerto | Detén el servidor anterior con `Ctrl + C`; evita finalizar procesos desconocidos. |
| `DATABASE_ERROR` o CSV inválido | Encabezado, fila, referencia o estructura incorrecta | Revisa la terminal y valida los ocho CSV contra `src/contracts/schemas/data.ts`. |
| `SNAPSHOT_NOT_FOUND` | UUID válido pero inexistente | Selecciona un snapshot listado por `/api/snapshots` y verifica su directorio. |
| `INVALID_SNAPSHOT_ID` | UUID ausente o mal formado | Envía un UUID válido en `snapshotId` o en la ruta. |
| Error de compilación | Tipo, import o sintaxis incorrectos | Ejecuta `npm.cmd run typecheck`, `npm.cmd run lint` y lee el primer error. |

## 10. Pruebas y verificaciones

Los nombres exactos definidos en `package.json` son:

```powershell
npm.cmd run test:unit
npm.cmd run test:csv
npm.cmd run test:http
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

- `test:unit`: dominio, autenticación, logger y modelos de vista.
- `test:csv`: lectura, escritura, integridad y seguridad de rutas.
- `test:http`: servidor Next.js real, credenciales efímeras y copias temporales de los snapshots.
- `lint`: reglas ESLint/Next.
- `typecheck`: compilación TypeScript sin emitir archivos.
- `build`: compilación optimizada de producción.

Para ejecutar un archivo específico:

```powershell
npx.cmd vitest run tests/unit/inventory.test.ts
```

No declares una prueba aprobada si fue omitida, agotó el tiempo o no pudo iniciar el servidor.

## 11. Trabajo con ramas

Una rama es una línea aislada de cambios. Cada compañero debe partir del commit común aprobado por el líder y no trabajar directamente sobre `main`.

```powershell
git status
git branch --show-current
git switch -c feature/nombre-de-la-mision
```

Después de una modificación pequeña y validada:

```powershell
git diff
git status
git add ruta\del\archivo
git commit -m "Describe el cambio"
```

Compara tu rama con la base acordada:

```powershell
git diff main...HEAD
```

Antes de tocar archivos clasificados como **COORDINADO** o **PROTEGIDO**, solicita revisión del líder. Entrega el objetivo, archivos modificados, pruebas ejecutadas y capturas o pasos observables. No hagas merge ni push si la misión no lo autoriza.

## 12. Mapa del proyecto

- `src/app`: páginas, dashboard y endpoints App Router.
- `src/contracts`: esquemas Zod y tipos compartidos.
- `src/domain`: fórmulas puras de inventario, eventos y traslados.
- `src/server/auth`: configuración, scrypt, tokens y autorización.
- `src/server/services`: casos de uso y adaptación HTTP.
- `src/server/repositories`: interfaz y persistencia CSV activa.
- `src/server/storage`: lectura/escritura segura de archivos.
- `src/lib/logger.ts`: registro centralizado.
- `data/templates`: encabezados canónicos.
- `data/demo/snapshots`: dos jornadas demostrativas versionadas.
- `data/runtime`: datos locales ignorados por Git.
- `tests`: suites unitarias, CSV y HTTP.
- `scripts/generate-admin-password-hash.mjs`: generación interactiva del hash.

Lee primero [el contexto para IA](docs/CONTEXTO_IA.md), después [el informe técnico maestro](docs/INFORME_TECNICO_MAESTRO.md) y finalmente [el catálogo de tareas](docs/CATALOGO_TAREAS_TECNICAS.md) antes de pedir cambios a un asistente.
