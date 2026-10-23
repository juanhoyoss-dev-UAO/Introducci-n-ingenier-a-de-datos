# Pruebas del Bloque B

## Regla de reporte

Se distingue entre pruebas puras, HTTP sin base y pruebas que requieren Supabase/PostgreSQL real. Las suites condicionadas por `RUN_SUPABASE_INTEGRATION` fueron cargadas por Vitest pero quedaron omitidas; no se consideran aprobadas.

| ID | Prueba | Resultado esperado | Resultado obtenido | Estado |
| --- | --- | --- | --- | --- |
| T01 | Conversión | 12.000 ml | `10×600 + 4×1500 = 12000` | Aprobada, unitaria |
| T02 | Déficit | 8.000 ml y mínimo cero | 8.000; caso con 22.000 devuelve 0 | Aprobada, unitaria |
| T03 | Donación pendiente | 12.000 confirmado, 6.000 esperado, 8.000 déficit | Valores exactos obtenidos sin sumar intención al confirmado | Aprobada, unitaria |
| T04 | Aislamiento | Consultas separadas y FK cruzada rechazada | Suite escrita; PostgreSQL no disponible | Omitida |
| T05 | Simulaciones | Primera +3.000 ml; segunda y snapshot sin cambio | 15 paquetes frente a 10; entrada original sigue en 10. Comprobación con registro SQL omitida | Parcial |
| T06 | Traslado | Paquetes enteros, sentido correcto, límites y sin mutación | 5 paquetes de 1.500 ml = 7.500 ml, C02→C01, 15 min; sin tiempo devuelve lista vacía | Aprobada, unitaria |
| T07 | Validaciones SQL | Rechazo de checks, FKs y duplicados | Siete inserciones inválidas preparadas con códigos esperados 23514/23503/23505 | Omitida |
| T08 | HTTP con datos | 2 snapshots, 6 centros y dashboard consistente | Suite escrita; requiere Auth y PostgreSQL real | Omitida |
| T09 | Autorización | 401, 403 y 200; RLS directo | Anónimo HTTP obtuvo 401. Casos 403/200 y RLS directo requieren Supabase | Parcial |
| T10 | Errores | 400, 404 y 500 diferenciados | Contratos y casos escritos; ejecución autenticada y pérdida de PostgREST no disponibles | Omitida |
| T11 | Compilación | lint, tipos, build y diff sin errores | Los cuatro comandos finalizaron correctamente | Aprobada |
| T12 | Reproducibilidad | Migración + seed desde cero | `supabase:reset --local` preparado pero no ejecutado | Omitida |

## Comandos y evidencia

```text
npm run test:unit
Test Files 3 passed (3)
Tests 8 passed (8)

npm run test:integration
Test Files 2 skipped (2)
Tests 8 skipped (8)

npm run test:http
Test Files 1 skipped (1)
Tests 5 skipped (5)

npm run build
Compiled successfully
Rutas dinámicas: centers, dashboard, health, products, snapshots,
snapshots/[id] y travel-times; /login estática.

git diff --check
Sin errores de espacios en blanco.

npx supabase start
DockerLifecycleInspectError: no fue posible conectar con dockerDesktopLinuxEngine.
```

Verificación HTTP ejecutada con el servidor local y configuración pública de marcador:

```text
GET /api/health     -> 200 {"data":{"status":"ok"},"meta":{}}
GET /api/snapshots  -> 401 {"error":{"code":"UNAUTHENTICATED",...}}
```

Estas dos respuestas no demuestran consultas PostgreSQL. Las pruebas T04, T07, T08, el resto de T09, T10 y T12 deben repetirse con la pila local activa.

## Bloqueo observado

Docker Desktop mostró: `starting services: initializing Inference manager ... dockerInference: El sistema no tiene acceso al archivo`. El objeto señalado es un reparse point antiguo bajo `AppData\Local\Docker\run`. Se intentó moverlo a una copia recuperable después de autorización, pero Windows negó el acceso. No se usó el restablecimiento de fábrica ni se ejecutó una operación destructiva.

