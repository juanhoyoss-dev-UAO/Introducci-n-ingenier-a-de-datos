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

