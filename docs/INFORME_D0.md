# Informe D0 — Consola administrativa y diagnóstico

## 1. Estado del bloque

**COMPLETO** al 2026-10-24.

La consola administrativa funciona con autenticación local, explora los dos snapshots CSV, muestra seis secciones de lectura, filtra por centro y produce trazas correlacionadas. Se comprobó en un navegador real. No se inició D1 ni se añadieron funciones de escritura.

## 2. Rama y punto de partida

- Rama activa: `feature/admin-inspector`.
- Commit de partida C2: `6398a345718d9f9c41609707267d66abe63385e2` (`Bloque C completo`).
- El árbol estaba limpio antes de crear la rama.
- No se realizó commit, push, merge ni rebase.

## 3. Archivos

### Creados

- `src/app/dashboard/page.tsx`
- `src/app/dashboard/dashboard-client.tsx`
- `src/app/dashboard/types.ts`
- `src/app/dashboard/view-model.ts`
- `src/lib/logger.ts`
- `src/server/observability/request-context.ts`
- `tests/unit/dashboard-view-model.test.ts`
- `tests/unit/logger.test.ts`
- `docs/INFORME_D0.md`
- `docs/INFORME_D0.pdf`

### Modificados

- `.env.example`, `README.md`
- `docs/API.md`, `docs/ARQUITECTURA.md`, `docs/BITACORA.md`, `docs/DECISIONES.md`, `docs/ESTADO.md`
- `src/app/page.tsx`, `src/app/login/page.tsx`
- Rutas bajo `src/app/api/auth`, `health`, `snapshots`, `centers`, `products`, `travel-times` y `dashboard`
- `src/server/auth/require-admin.ts`
- `src/server/repositories/csv-operations.ts`
- `src/server/services/dashboard.ts`, `http.ts`, `operations.ts`
- `src/server/storage/files.ts`
- `tests/http/endpoints.test.ts`

No se eliminaron archivos versionados ni se modificaron los CSV demostrativos.

## 4. Lógica implementada

- `/dashboard` verifica al administrador en servidor y redirige a `/login` antes de mostrar datos si la sesión no es válida.
- `/` conduce al dashboard; el login navega al dashboard y el logout vuelve a `/login`.
- El cliente consulta health, sesión, snapshots, detalle, centros, productos/presentaciones, tiempos y dashboard reales.
- Los snapshots se ordenan por fecha ascendente e ID; el dataset A se selecciona primero sin fijar su UUID en el componente.
- Cada cambio cancela la carga anterior, borra el bundle visible, restablece el centro y comprueba que las respuestas correspondan al snapshot solicitado.
- El resumen deriva centros, productos, presentaciones, centros con necesidades, centros con déficit e intenciones desde el backend.
- El inventario muestra paquetes y contenido físico, subtotal por presentación y total agregado por producto. Las donaciones anunciadas permanecen separadas.
- Las seis secciones son Centros, Inventario, Necesidades, Voluntarios, Donaciones esperadas y Tiempos de traslado.
- El filtro acepta todos los centros o uno específico; en tiempos conserva ambas direcciones únicamente cuando existen.
- El logger central aplica niveles `INFO`, `OK`, `WARN`, `ERROR`; módulos `AUTH`, `API`, `SERVICE`, `REPOSITORY`, `UI`; umbral configurable y sanitización de secretos.
- `AsyncLocalStorage` propaga un `requestId` generado por el servidor y las respuestas incluyen `X-Request-Id`.

## 5. Endpoints utilizados

- `GET /api/health`
- `GET /api/auth/me`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/snapshots`
- `GET /api/snapshots/[id]`
- `GET /api/centers?snapshotId=...`
- `GET /api/products?snapshotId=...`
- `GET /api/travel-times?snapshotId=...`
- `GET /api/dashboard?snapshotId=...`

No fue necesario ampliar los cuerpos de respuesta ni crear endpoints. D0 sólo añadió diagnóstico y el header `X-Request-Id`.

## 6. Pruebas ejecutadas

| Verificación | Resultado real |
| --- | --- |
| `npm run test:unit` | 6 archivos, 22/22 pruebas aprobadas |
| `npm run test:csv` | 3 archivos, 25/25 pruebas aprobadas |
| `npm run test:http` | 1 archivo, 14/14 pruebas aprobadas |
| `npm run lint` | Aprobado |
| `npm run typecheck` | Aprobado |
| `npm run build` | Aprobado; 13 rutas/páginas generadas |
| `git diff --check` | Aprobado; sólo avisos informativos LF/CRLF |

Evidencia funcional:

- Acceso anónimo a `/dashboard`: redirección a `/login` sin datos operativos.
- Acceso administrador: dashboard HTTP 200 y seis secciones.
- Snapshot A: 6 centros, 5 productos, 7 presentaciones.
- C01/P01: `10 × 600 ml + 4 × 1.500 ml = 12.000 ml`.
- Necesidad C01/P01: objetivo 20.000 ml, confirmado 12.000 ml, déficit 8.000 ml.
- Donación D01: 6.000 ml anunciados, separada del inventario.
- Snapshot B: C01/P01 = 2.700 ml, sin conservar los 12.000 ml de A.
- Tiempo dirigido: C02 → C01 = 15 min y C01 → C02 = 20 min como filas independientes.
- Trazabilidad: API → SERVICE → REPOSITORY → resultado con el mismo `requestId`.
- Snapshot malformado o inexistente: 400/404 controlado sin rutas, stacks ni secretos; la UI limpia el bundle y ofrece reintento ante errores de carga.

## 7. Validación visual real

Se usó un navegador real contra `http://localhost:3000` y credenciales efímeras no versionadas. Se comprobó:

- redirección anónima a login;
- login y logout;
- selección inicial de Jornada demostrativa A;
- resumen 6/5/7;
- apertura de las seis secciones;
- inventario físico con dos presentaciones y total 12.000 ml;
- necesidad 20.000/12.000/8.000;
- donación D01 de 6.000 ml;
- tiempo C02 → C01 de 15 minutos;
- filtro C01 y regreso a todos los centros;
- cambio a Jornada B con 2 centros y 2.700 ml, sin mezcla;
- eventos `UI` en la consola del navegador;
- trazas correlacionadas y conteos CSV en la terminal del servidor.

La credencial efímera y el lanzador temporal fueron eliminados al terminar. La captura local de verificación quedó en `data/runtime/D0-dashboard-validacion.png`, directorio ignorado por Git.

## 8. Errores encontrados y soluciones

- La suite HTTP no pudo conectarse al servidor hijo dentro del sandbox aunque Next estuviera listo. Se reejecutó fuera de ese aislamiento y aprobó 14/14.
- El navegador no alcanzó un servidor iniciado dentro del sandbox. Se inició el mismo servidor local fuera del aislamiento para la inspección visual.
- La primera revisión detectó que Inventario mostraba subtotales de 6.000 ml pero no el agregado 12.000 ml. Se añadieron columnas separadas de subtotal por presentación y total por producto, con prueba de dos presentaciones.
- La primera revisión detectó que `/api/health` no formaba parte del arranque del cliente. Se añadió a la carga inicial y se valida `status=ok`.
- La prueba heredada guardaba una contraseña fija. Ahora las credenciales HTTP se generan aleatoriamente en cada ejecución.

## 9. Pendientes

- Revisión humana del diff y de este informe.
- Crear commit o push sólo cuando el responsable lo autorice.
- No se realizó una inyección visual de UUID inválido porque el selector sólo ofrece snapshots válidos; la respuesta 400/404 y la ausencia de filtraciones sí quedaron verificadas por HTTP real.
- No iniciar D1, importación, edición, simulación, gráficos, mapas ni notificaciones.

## 10. Revisión manual

1. Copiar `.env.example` como `.env.local`.
2. Establecer `ADMIN_USERNAME=ADMIN`.
3. Ejecutar `npm run auth:hash` y copiar el hash a `ADMIN_PASSWORD_HASH`.
4. Generar un `SESSION_SECRET` aleatorio e independiente.
5. Ejecutar `npm run dev`.
6. Abrir `http://localhost:3000`, iniciar sesión y confirmar `/dashboard`.
7. Recorrer ambos snapshots, las seis pestañas y el filtro de centro.
8. Revisar la consola del navegador y la terminal sin encontrar credenciales o cookies.
9. Cerrar sesión y confirmar el regreso a `/login`.

## 11. Estado de Git

- Rama: `feature/admin-inspector`.
- Base: `6398a345718d9f9c41609707267d66abe63385e2`.
- D0 permanece sin commit y sin push, tal como fue solicitado.
- No hay cambios ajenos descartados ni operaciones destructivas.
