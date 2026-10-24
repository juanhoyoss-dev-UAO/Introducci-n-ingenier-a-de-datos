# Estado del proyecto

## Fase actual

Bloque D0 **COMPLETO** al 2026-10-24. La aplicación dispone de una consola administrativa protegida y de sólo lectura para inspeccionar los dos snapshots CSV, sus seis secciones y trazas correlacionadas. El recorrido navegador → API → servicio → repositorio CSV → resultado fue comprobado sin Supabase, PostgreSQL, Docker ni servicios externos.

## C1 preservado

- `OperationsRepository` desacopla los servicios de la tecnología de persistencia.
- `CsvOperationsRepository` lee y escribe `metadata.json` y ocho archivos CSV por snapshot.
- `data/templates/` define cabeceras, `data/demo/snapshots/` conserva dos snapshots reproducibles y `data/runtime/` queda ignorado por Git.
- Zod valida tipos, unicidad, referencias y valores controlados.
- Staging y `rename` impiden publicar snapshots parciales o sobrescribir UUID existentes.
- Las fórmulas y contratos HTTP operativos no cambiaron en C2.

## C2 implementado

- `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` y `SESSION_SECRET` sustituyen la cuenta externa.
- La contraseña usa `scrypt` con sal aleatoria, formato versionado y comparación segura.
- `npm run auth:hash` solicita la contraseña sin eco ni argumento de proceso.
- La sesión se firma con HMAC-SHA256, vence en cuatro horas y se verifica en cada endpoint protegido.
- La cookie usa `HttpOnly`, `SameSite=Lax`, expiración, ruta raíz y `Secure` bajo HTTPS.
- Login/logout validan `Origin`; `/api/auth/me` permite consultar el estado.
- `requireAdministrator()` centraliza 401, 403 y autorización administrativa.
- No existe ruta productiva para emitir una sesión sin privilegios.
- Se retiraron clientes, proxy, variables, scripts, fixtures, suites y directorio activo de Supabase; la evidencia B/C1 continúa en Git.

## D0 implementado

- `/` conduce a `/dashboard`; una sesión ausente o inválida se redirige a `/login` antes de renderizar datos operativos.
- La consola consulta health, sesión, snapshots, detalle, centros, productos/presentaciones, tiempos y dashboard mediante los endpoints reales.
- El primer snapshot se elige por fecha ascendente e identificador, sin fijar un UUID en el componente.
- El cambio de snapshot cancela peticiones anteriores, limpia datos y restablece el filtro para impedir mezclas.
- Se muestran centros, inventario físico y agregado, necesidades, voluntarios, donaciones esperadas separadas y tiempos dirigidos.
- Un filtro sencillo alterna todos los centros o uno específico.
- El logger central usa niveles `INFO`, `OK`, `WARN`, `ERROR`, módulos cerrados y `requestId` por petición; se configura por entorno y omite secretos.
- No se ampliaron contratos de datos, archivos CSV ni dependencias.

## Verificación final

- `npm ci`: exitoso; instaló 377 paquetes desde el lockfile final.
- `npm ls @supabase/ssr @supabase/supabase-js supabase --all`: árbol vacío.
- `npm run test:unit`: 6 archivos y 22 pruebas aprobadas.
- `npm run test:csv`: 3 archivos y 25 pruebas aprobadas.
- `npm run test:http`: 1 archivo y 14 pruebas reales aprobadas contra Next.js y copias CSV temporales.
- HTTP demostró login, cookie, logout, `Origin`, 401, 403 y 200.
- La consulta administrativa devolvió dos snapshots y seis centros.
- El dashboard confirmó 12.000 ml de inventario, 20.000 ml de objetivo, 8.000 ml de déficit y 6.000 ml anunciados.
- El aislamiento devolvió 12.000 ml para el snapshot A y 2.700 ml para el B.
- Las trazas demostraron el mismo `requestId` en API, servicio, repositorio y resultado.
- Un navegador real verificó login, logout, ambos snapshots, seis secciones, filtro, tablas y consola del navegador/servidor.
- `npm run lint`, `npm run typecheck`, `npm run build` y `git diff --check`: aprobados.
- El build generó correctamente 13 páginas/rutas. La primera ejecución dentro del sandbox de herramientas recibió EPERM al escribir `.next`; fuera de ese aislamiento compiló, por lo que no representa una dependencia ni un fallo del proyecto.

La evidencia detallada T01–T14 se encuentra en `docs/PRUEBAS_C2.md`.

## Limitaciones conocidas

- Las sesiones firmadas no tienen revocación individual inmediata; logout elimina la cookie del cliente y la rotación de `SESSION_SECRET` invalida todas.
- `data/runtime/` está pensado para una sola instancia del proceso, no para concurrencia distribuida.
- La persistencia de eventos de simulación no forma parte de C2; la simulación continúa como cálculo puro.
- D0 no implementa edición, importación Excel, gráficos, mapas ni simulación interactiva.

## Siguiente acción

Solicitar revisión del Bloque D0. No iniciar D1 ni módulos posteriores sin aprobación.
