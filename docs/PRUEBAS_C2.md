# Pruebas del Bloque C2

## Entorno y aislamiento

- Fecha: 2026-10-23.
- Rama: `codex/c1-csv-persistence`.
- Checkpoint de partida: `1e3b9e7f6f240cd88fd99ddcfa6ade7611848d0f`.
- Node.js: `v24.18.0`.
- npm: `11.16.0`.
- Next.js: `16.4.3`.
- Credenciales de prueba: generadas sólo para el proceso hijo; no se versionaron ni registraron.
- Datos HTTP: copia temporal de `data/demo/snapshots` y runtime temporal ignorado; no se modificaron demo ni runtime personal.
- Servidor HTTP: Next.js real en un puerto local efímero, sin mocks de repositorio.

## Matriz T01–T14

| Prueba | Esperado | Obtenido | Estado |
| --- | --- | --- | --- |
| T01 — Login correcto | 200 y cookie segura | HTTP 200; cookie `redes_ayuda_session` con `HttpOnly`, `SameSite=Lax`, `Path=/`, `Expires` y `Max-Age`. En HTTP local no incluyó `Secure`; la prueba unitaria confirmó `Secure` bajo HTTPS. `/api/auth/me` confirmó administrador. | Aprobada |
| T02 — Login incorrecto | Rechazo genérico sin cookie | HTTP 401 `INVALID_CREDENTIALS`, mensaje único para usuario/contraseña y sin `Set-Cookie`. | Aprobada |
| T03 — Sesión anónima | `GET /api/snapshots` → 401 | HTTP 401 `UNAUTHENTICATED`. | Aprobada |
| T04 — Sesión sin privilegios | Sesión firmada de fixture → 403 | HTTP 403 `FORBIDDEN`; la aplicación no expone una ruta para emitirla. | Aprobada |
| T05 — Administrador autorizado | 200 y dos snapshots reales | HTTP 200, 2 snapshots CSV y detalle correcto de `GET /api/snapshots/[id]`. | Aprobada |
| T06 — Consultas CSV reales | 200, seis centros y endpoints preservados | HTTP 200; 6 centros, 5 productos, 7 presentaciones y tiempos de traslado dirigidos desde CSV. | Aprobada |
| T07 — Dashboard consistente | 12.000/20.000/8.000/6.000 ml | Inventario confirmado 12.000, objetivo 20.000, déficit 8.000 y donación anunciada 6.000. | Aprobada |
| T08 — Aislamiento | Snapshot A 12.000; B 2.700 ml | A devolvió 12.000 y B 2.700 para C01/P01, sin mezcla. | Aprobada |
| T09 — Seguridad de sesión | Alteración, mala firma, codificación no canónica, vencimiento, otro secreto, ausencia y post-logout bloqueados | Todos los intentos administrativos devolvieron 401; logout devolvió 200 y cookie con `Max-Age=0`. | Aprobada |
| T10 — Errores HTTP | 400/400/404/500 estructurados y sin filtraciones | Ausente 400, UUID inválido 400, inexistente 404 y CSV temporal corrupto 500 `DATABASE_ERROR`; sin ruta, secreto, traza ni contenido interno. | Aprobada |
| T11 — Regresión | 8 unitarias previas y 25 CSV | `test:unit`: 4 archivos/14 pruebas, incluidas las 8 previas; `test:csv`: 3 archivos/25 pruebas. | Aprobada |
| T12 — Verificaciones generales | lint, tipos, build y diff correctos | ESLint OK; TypeScript OK; build Next.js OK con 13 páginas/rutas; `git diff --check` OK. | Aprobada |
| T13 — Independencia | Sin Docker, PostgreSQL, cuenta, variables o ejecutables Supabase | Ejecución con Node/npm y CSV. `npm ls @supabase/ssr @supabase/supabase-js supabase --all` devolvió árbol vacío; no quedan imports, scripts ni variables activas Supabase. | Aprobada |
| T14 — Reproducibilidad | Instalación limpia, login y consultas reales | `npm ci` instaló 377 paquetes; después aprobaron unitarias, CSV, HTTP, lint, tipos y build. La suite HTTP arrancó el servidor, inició sesión y recuperó 2 snapshots y 6 centros desde la copia temporal. | Aprobada |

## Evidencia de comandos

| Comando | Resultado |
| --- | --- |
| `npm ci` | Exitoso; 377 paquetes instalados desde `package-lock.json`. |
| `npm ls @supabase/ssr @supabase/supabase-js supabase --all` | Árbol vacío. |
| `npm run test:unit` | 4 archivos, 14 pruebas aprobadas. |
| `npm run test:csv` | 3 archivos, 25 pruebas aprobadas. |
| `npm run test:http` | 1 archivo, 12 pruebas HTTP reales aprobadas. |
| `npm run lint` | Sin errores. |
| `npm run typecheck` | Sin errores. |
| `npm run build` | Compilación Next.js aprobada; 13 páginas/rutas generadas. |
| `git diff --check` | Sin errores. |

La primera ejecución de build dentro del sandbox de herramientas falló con EPERM al intentar escribir `.next`. La repetición fuera de ese aislamiento compiló correctamente; el permiso ampliado fue necesario por el entorno de ejecución de herramientas, no por una dependencia de la aplicación.

## Seguridad verificada

- Hash `scrypt` con sal aleatoria, parámetros versionados y comparación segura.
- Login ejecuta la derivación incluso si el usuario es incorrecto y devuelve un error genérico.
- Token firmado HMAC-SHA256 con forma y base64url canónicas, sujeto, rol, emisión, vencimiento y vida máxima.
- Cookie alterada, firma alterada, token vencido y token con otro secreto rechazados.
- `Origin` ausente o externo rechazado en login/logout.
- Configuración ausente o inválida falla de forma cerrada.
- Contraseña, hash y secreto no aparecen en respuestas ni logs de prueba.

## Reproducibilidad local

1. Ejecutar `npm ci`.
2. Copiar `.env.example` a `.env.local`.
3. Ejecutar `npm run auth:hash` y asignar el resultado a `ADMIN_PASSWORD_HASH`.
4. Definir `ADMIN_USERNAME` y un `SESSION_SECRET` aleatorio independiente de al menos 32 bytes.
5. Ejecutar `npm run dev` y abrir `/login`.
6. Consultar `/api/snapshots` y `/api/centers?snapshotId=10000000-0000-4000-8000-000000000001`.
7. Ejecutar `npm run test:unit`, `npm run test:csv`, `npm run test:http`, `npm run lint`, `npm run typecheck` y `npm run build`.

`npm run test:http` automatiza un entorno aislado con credenciales efímeras, copias CSV temporales y servidor local. No requiere configurar secretos reales.

## Limitación documentada

Las sesiones son stateless. Logout elimina la cookie del cliente, pero un token copiado previamente continúa criptográficamente válido hasta su expiración de cuatro horas. No existe revocación individual inmediata; rotar `SESSION_SECRET` invalida todas las sesiones vigentes.

## Conclusión

T01–T14 fueron ejecutadas y aprobadas. El Bloque C2 queda clasificado como **COMPLETO**, sin dependencias ejecutables de Supabase y sin regresiones detectadas en persistencia CSV ni reglas de dominio.
