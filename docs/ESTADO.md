# Estado del proyecto

## Fase actual

Bloque C2 **COMPLETO** al 2026-10-23. La persistencia operativa continúa en CSV/JSON y la autenticación administrativa es local. El recorrido administrador → sesión verificada → endpoint → servicio → repositorio CSV → respuesta HTTP quedó demostrado sin Supabase, PostgreSQL, Docker ni servicios externos.

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

## Verificación final

- `npm ci`: exitoso; instaló 377 paquetes desde el lockfile final.
- `npm ls @supabase/ssr @supabase/supabase-js supabase --all`: árbol vacío.
- `npm run test:unit`: 4 archivos y 14 pruebas aprobadas; incluye las 8 reglas previas y 6 casos de autenticación.
- `npm run test:csv`: 3 archivos y 25 pruebas aprobadas.
- `npm run test:http`: 1 archivo y 12 pruebas reales aprobadas contra Next.js y copias CSV temporales.
- HTTP demostró login, cookie, logout, `Origin`, 401, 403 y 200.
- La consulta administrativa devolvió dos snapshots y seis centros.
- El dashboard confirmó 12.000 ml de inventario, 20.000 ml de objetivo, 8.000 ml de déficit y 6.000 ml anunciados.
- El aislamiento devolvió 12.000 ml para el snapshot A y 2.700 ml para el B.
- `npm run lint`, `npm run typecheck`, `npm run build` y `git diff --check`: aprobados.
- El build generó correctamente 13 páginas/rutas. La primera ejecución dentro del sandbox de herramientas recibió EPERM al escribir `.next`; fuera de ese aislamiento compiló, por lo que no representa una dependencia ni un fallo del proyecto.

La evidencia detallada T01–T14 se encuentra en `docs/PRUEBAS_C2.md`.

## Limitaciones conocidas

- Las sesiones firmadas no tienen revocación individual inmediata; logout elimina la cookie del cliente y la rotación de `SESSION_SECRET` invalida todas.
- `data/runtime/` está pensado para una sola instancia del proceso, no para concurrencia distribuida.
- La persistencia de eventos de simulación no forma parte de C2; la simulación continúa como cálculo puro.
- No se han iniciado importación Excel, interfaz visual ni dashboard interactivo.

## Siguiente acción

Solicitar revisión del Bloque C2. No iniciar módulos posteriores sin aprobación.
