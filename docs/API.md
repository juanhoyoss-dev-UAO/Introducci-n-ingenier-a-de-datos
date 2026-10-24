# API

## Convenciones

Las respuestas exitosas usan `{ "data": ..., "meta": ... }`. Los errores usan `{ "error": { "code": "...", "message": "...", "details": ... } }` y no exponen rutas internas, contenido de archivos, trazas, hashes ni secretos.

`/api/health` es público. Las rutas operativas verifican en cada petición una cookie local firmada y el rol administrador: una sesión ausente o inválida recibe 401 y una sesión válida sin privilegios recibe 403.

## Autenticación local

| Método | Ruta | Autorización | Resultado |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Pública, `Origin` del mismo origen | Valida usuario/contraseña y crea cookie administrativa. |
| POST | `/api/auth/logout` | `Origin` del mismo origen | Elimina la cookie del cliente de forma idempotente. |
| GET | `/api/auth/me` | Pública | Devuelve estado de sesión; anónimo obtiene `authenticated: false`. |

Login recibe JSON estricto:

```json
{
  "username": "administrador-local",
  "password": "contraseña-no-versionada"
}
```

Un login correcto responde 200 y envía `redes_ayuda_session` con `HttpOnly`, `SameSite=Lax`, `Path=/`, `Expires`, `Max-Age` y `Secure` cuando se sirve por HTTPS. La contraseña, su hash y `SESSION_SECRET` nunca forman parte de la respuesta.

Las credenciales incorrectas usan un único mensaje `INVALID_CREDENTIALS`; no distinguen si falló usuario o contraseña. Login y logout rechazan un `Origin` ausente o diferente con 403 `INVALID_ORIGIN`.

## Endpoints operativos

| Método | Ruta | Autorización | Fuente y resultado |
| --- | --- | --- | --- |
| GET | `/api/health` | Pública | Estado básico. |
| GET | `/api/snapshots` | Administrador | Metadatos de snapshots demo y runtime. |
| GET | `/api/snapshots/[id]` | Administrador | `metadata.json` validado o 404. |
| GET | `/api/centers?snapshotId=...` | Administrador | `centros.csv`. |
| GET | `/api/products?snapshotId=...` | Administrador | Productos y presentaciones agrupados. |
| GET | `/api/travel-times?snapshotId=...` | Administrador | Tiempos dirigidos validados. |
| GET | `/api/dashboard?snapshotId=...` | Administrador | Métricas calculadas desde los ocho CSV. |

No existen endpoints de escritura, importación, avance de simulación ni recepción de donaciones; la escritura de snapshots es una capacidad interna del repositorio.

## Ejemplos

Health:

```json
{
  "data": { "status": "ok" },
  "meta": {}
}
```

Estado anónimo:

```json
{
  "data": { "authenticated": false, "user": null },
  "meta": {}
}
```

Error por parámetro ausente:

```json
{
  "error": {
    "code": "MISSING_SNAPSHOT_ID",
    "message": "El parámetro snapshotId es obligatorio."
  }
}
```

Fragmento de `/api/dashboard` para `C01` y agua del snapshot A:

```json
{
  "producto_id": "P01",
  "unidad_base": "ml",
  "inventario_confirmado_unidad_base": 12000,
  "objetivo_unidad_base": 20000,
  "deficit_confirmado_unidad_base": 8000,
  "donaciones_esperadas_unidad_base": 6000
}
```

El dashboard incluye `centros`, `donaciones_esperadas` y `candidatos_traslado`. Cada candidato identifica producto, origen, destino, minutos, paquetes completos por SKU y total en unidad base. La respuesta no modifica los CSV ni el inventario.

## Códigos de error

| HTTP | Código | Uso |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | JSON de login ausente, inválido o fuera de límites. |
| 400 | `MISSING_SNAPSHOT_ID`, `INVALID_SNAPSHOT_ID` | Parámetro ausente o inválido. |
| 401 | `INVALID_CREDENTIALS` | Login rechazado sin revelar el campo fallido. |
| 401 | `UNAUTHENTICATED` | Sesión ausente, alterada, vencida o firmada con otra clave. |
| 403 | `INVALID_ORIGIN` | Mutación de sesión sin origen local exacto. |
| 403 | `FORBIDDEN` | Sesión válida sin rol administrador o con otro sujeto. |
| 404 | `SNAPSHOT_NOT_FOUND` | UUID válido no encontrado. |
| 500 | `AUTH_CONFIGURATION_ERROR` | Configuración local ausente o inválida, sin detalles sensibles. |
| 500 | `DATABASE_ERROR`, `INTERNAL_ERROR` | Fallo controlado sin información interna. |

`DATABASE_ERROR` se conserva por compatibilidad del contrato y representa fallos del repositorio o archivos CSV; no implica una base de datos activa.

## Límite de revocación

La sesión es stateless y tiene una vida máxima de cuatro horas. Logout borra la cookie del cliente, pero no existe revocación individual inmediata de un token copiado antes del cierre. Rotar `SESSION_SECRET` invalida todas las sesiones vigentes.
