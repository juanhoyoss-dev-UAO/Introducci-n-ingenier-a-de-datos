# Bitácora

## 2026-10-23 — Bloque B

### B1 — Modelo

- Se definieron las once entidades funcionales y `administradores` como tabla técnica.
- Las claves compuestas preservan el aislamiento entre snapshots.
- Se añadieron checks, unicidad, claves foráneas, índices mínimos y diagrama ER.
- Estado: implementado en migración, pendiente de aplicación real.

### B2 — Supabase

- Se instaló la CLI local, `@supabase/supabase-js` y `@supabase/ssr`.
- Se generó `supabase/config.toml`, se deshabilitó autorregistro y se documentaron variables sin secretos.
- Se implementaron clientes SSR, cookies, proxy y RLS.
- Estado: código listo; pila local bloqueada por Docker Desktop.

### B3 — Demostración

- Se creó un seed con dos snapshots, seis centros principales, cinco productos, siete presentaciones principales, inventario, necesidades, voluntarios, tiempos, donaciones y dos simulaciones.
- `C01` existe en ambos snapshots con 12.000 ml y 2.700 ml respectivamente.
- Estado: seed listo, no cargado en PostgreSQL por el bloqueo local.

### B4 — Servicios y cálculos

- Se implementaron fórmulas puras, eventos de recepción y recomendaciones en paquetes enteros.
- El dashboard backend compone consultas de repositorio y no usa objetos estáticos como fuente.
- Ocho pruebas unitarias pasaron.
- Estado: verificado localmente a nivel puro y de compilación.

### B5 — Auth y API

- Se implementó login mínimo, verificación de sesión, autorización administrativa y siete Route Handlers.
- Health respondió 200 y una solicitud anónima operativa respondió 401.
- Estado: flujo anónimo verificado; roles autenticados pendientes de Supabase real.

### B6 — Pruebas

- Vitest separa pruebas unitarias, integración PostgreSQL y HTTP.
- Las suites de integración compilan, pero se ejecutaron como omitidas porque `RUN_SUPABASE_INTEGRATION` permaneció desactivado.
- TypeScript, ESLint y build con webpack fueron aprobados.
- No se declaró como aprobada ninguna prueba no ejecutada.

## 2026-10-23 — Auditoría C0 y checkpoint

- Se auditó el acoplamiento a Supabase/PostgreSQL y se delimitó la migración de persistencia sin cambiar contratos ni reglas de negocio.
- El Bloque B quedó preservado en la rama `codex/c1-csv-persistence`, commit `16553db246a627fdd0227c074aac081f0f64f4b3` (`checkpoint: bloque B backend Supabase`).
- La migración y el seed SQL se conservaron como evidencia histórica y referencia del dataset, no como fuente operativa de C1.

## 2026-10-23 — Bloque C1

### C1.1 — Persistencia CSV/JSON

- Se introdujo `OperationsRepository` y una implementación `CsvOperationsRepository` para retirar las consultas operativas a Supabase/PostgREST.
- Cada snapshot se almacena como `metadata.json` más ocho archivos CSV.
- Se versionaron cabeceras en `data/templates/` y dos snapshots deterministas en `data/demo/snapshots/`.
- `data/runtime/` quedó ignorado por Git para datos locales mutables.

### C1.2 — Integridad y escritura

- Esquemas Zod validan tipos, valores controlados, unicidad y referencias del bundle completo.
- Las escrituras se preparan en staging y se publican mediante rename para evitar snapshots parciales.
- Se añadieron controles de identificadores, rutas y enlaces simbólicos.

### C1.3 — Servicios, API y Auth

- Los servicios y Route Handlers conservan las fórmulas, endpoints y envolturas de respuesta existentes, pero leen la persistencia CSV/JSON.
- Supabase permanece temporalmente solo para login, sesión, proxy, tabla `administradores` y RLS hasta C2.
- Los endpoints protegidos todavía requieren Supabase Auth; no se declaró un HTTP 200 administrativo autenticado.
- La persistencia de eventos de simulación no se añadió: el cálculo sigue siendo puro.

### C1.4 — Verificación

- `npm run test:csv` aprobó 3 archivos y 25 pruebas reales sobre la persistencia CSV.
- Las dos suites legadas de Supabase/PostgreSQL permanecieron omitidas, con 8 pruebas omitidas.
- `npm run lint`, `npm run typecheck` y `npm run build` aprobaron.
- `GET /api/health` respondió HTTP 200 con `{ "data": { "status": "ok" }, "meta": {} }`.
- `GET /api/snapshots` sin sesión respondió HTTP 401 con código `UNAUTHENTICATED`.
- No se ejecutó un HTTP 200 administrativo autenticado porque requiere una sesión y cuenta Supabase reales.
- Ninguna prueba omitida o no ejecutada se contó como aprobada.

## 2026-10-23 — Bloque C2

### C2.1 — Autenticación local

- Se sustituyeron usuario externo, proxy y consulta de administradores por `ADMIN_USERNAME`, un hash `scrypt` versionado y `SESSION_SECRET`.
- Se añadió generación interactiva de hash sin contraseña en argumentos ni eco.
- Las sesiones usan payload mínimo firmado con HMAC-SHA256, cuatro horas de vigencia y cookie `HttpOnly`, `SameSite=Lax`, expirable y `Secure` bajo HTTPS.
- `requireAdministrator()` comprueba firma, vencimiento, sujeto y rol en cada endpoint.

### C2.2 — Login, logout y protección

- Se añadieron `POST /api/auth/login`, `POST /api/auth/logout` y `GET /api/auth/me`.
- Login y logout exigen `Origin` local exacto; las credenciales inválidas reciben un único mensaje genérico.
- La página `/login` permite entrar, consultar la sesión activa y cerrar sesión sin `localStorage`.
- No existe una ruta productiva para emitir roles no administrativos.

### C2.3 — Retirada controlada

- La autenticación y la lectura CSV se demostraron mediante HTTP real antes de retirar Supabase.
- Se retiraron paquetes, scripts, clientes, proxy, variables, fixtures, suites condicionadas y el árbol activo `supabase/`.
- La migración, seed y decisiones B/C1 continúan recuperables desde los checkpoints Git.
- No se añadieron dependencias de autenticación ni se modificaron fórmulas o contratos operativos.

### C2.4 — Verificación final

- `npm run test:unit` aprobó 14 pruebas: las 8 previas y 6 de autenticación.
- `npm run test:csv` conservó 25 pruebas aprobadas.
- `npm run test:http` aprobó 12 pruebas reales sobre un servidor Next.js y copias CSV temporales.
- Se verificaron 401, 403 y 200; dos snapshots; seis centros; métricas 12.000/20.000/8.000/6.000; aislamiento 12.000/2.700; logout y rechazo de tokens inválidos.
- `npm ci` instaló 377 paquetes desde el lockfile final y `npm ls @supabase/ssr @supabase/supabase-js supabase --all` quedó vacío.
- Después de la instalación limpia volvieron a aprobar unitarias, CSV, HTTP, lint y typecheck.
- El build de Next.js aprobó con 13 páginas/rutas y `git diff --check` no detectó errores.
- El sandbox de herramientas bloqueó inicialmente la escritura de `.next` con EPERM; el mismo build ejecutado fuera de ese aislamiento compiló correctamente. No es un requisito ni un fallo del proyecto.
- Estado: C2 completo, pendiente únicamente de revisión humana y sin iniciar módulos posteriores.
