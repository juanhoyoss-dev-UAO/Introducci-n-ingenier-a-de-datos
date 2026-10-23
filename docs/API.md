# API

## Convenciones implementadas

Las respuestas exitosas tienen la forma `{ "data": ..., "meta": ... }`. Los errores usan `{ "error": { "code": "...", "message": "...", "details": ... } }`. Las rutas no devuelven trazas, credenciales ni mensajes internos de PostgreSQL.

`/api/health` es público. Los demás endpoints requieren una sesión Supabase verificada y una fila correspondiente en `administradores`: anónimo devuelve 401 y usuario autenticado no autorizado devuelve 403.

| Método | Ruta | Autorización | Resultado |
| --- | --- | --- | --- |
| GET | `/api/health` | Pública | Estado básico. |
| GET | `/api/snapshots` | Administrador | Lista de snapshots. |
| GET | `/api/snapshots/[id]` | Administrador | Detalle o 404. |
| GET | `/api/centers?snapshotId=...` | Administrador | Centros del snapshot. |
| GET | `/api/products?snapshotId=...` | Administrador | Productos con presentaciones. |
| GET | `/api/travel-times?snapshotId=...` | Administrador | Tiempos dirigidos. |
| GET | `/api/dashboard?snapshotId=...` | Administrador | Métricas calculadas y candidatos de traslado. |

No existen endpoints de escritura, importación, avance de simulación o recepción de donaciones.

## Ejemplos

Health:

```json
{
  "data": { "status": "ok" },
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

El dashboard incluye `centros`, `donaciones_esperadas` y `candidatos_traslado`. Cada candidato identifica producto, origen, destino, minutos, paquetes completos por SKU y total en unidad base. La respuesta no modifica el inventario.

## Códigos de error

| HTTP | Código | Uso |
| --- | --- | --- |
| 400 | `MISSING_SNAPSHOT_ID`, `INVALID_SNAPSHOT_ID` | Parámetro ausente o inválido. |
| 401 | `UNAUTHENTICATED` | Sesión ausente o inválida. |
| 403 | `FORBIDDEN` | Usuario autenticado sin autorización administrativa. |
| 404 | `SNAPSHOT_NOT_FOUND` | UUID válido que no existe o no es visible. |
| 500 | `AUTH_SERVICE_ERROR`, `DATABASE_ERROR`, `INTERNAL_ERROR` | Fallo controlado sin detalles sensibles. |

