# API

## Convenciones

Las respuestas exitosas usan `{ "data": ..., "meta": ... }`. Los errores usan `{ "error": { "code": "...", "message": "...", "details": ... } }` y no exponen rutas internas, contenido de archivos, trazas ni credenciales.

`/api/health` es público. Los demás endpoints mantienen la sesión Supabase y la autorización mediante `administradores`: anónimo recibe 401 y un autenticado no autorizado 403. La autenticación se reemplazará en C2.

| Método | Ruta | Autorización | Fuente y resultado |
| --- | --- | --- | --- |
| GET | `/api/health` | Pública | Estado básico. |
| GET | `/api/snapshots` | Administrador | Metadatos de snapshots demo y runtime. |
| GET | `/api/snapshots/[id]` | Administrador | `metadata.json` validado o 404. |
| GET | `/api/centers?snapshotId=...` | Administrador | `centros.csv`. |
| GET | `/api/products?snapshotId=...` | Administrador | Productos y presentaciones agrupados. |
| GET | `/api/travel-times?snapshotId=...` | Administrador | Tiempos dirigidos validados. |
| GET | `/api/dashboard?snapshotId=...` | Administrador | Métricas calculadas desde los ocho CSV. |

Las rutas y formas de respuesta no cambiaron en C1. No existen endpoints de escritura, importación, avance de simulación ni recepción de donaciones; la escritura de snapshots es una capacidad interna del repositorio.

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

El dashboard incluye `centros`, `donaciones_esperadas` y `candidatos_traslado`. Cada candidato identifica producto, origen, destino, minutos, paquetes completos por SKU y total en unidad base. La respuesta no modifica los CSV ni el inventario.

## Códigos de error

| HTTP | Código | Uso |
| --- | --- | --- |
| 400 | `MISSING_SNAPSHOT_ID`, `INVALID_SNAPSHOT_ID` | Parámetro ausente o inválido. |
| 401 | `UNAUTHENTICATED` | Sesión ausente o inválida. |
| 403 | `FORBIDDEN` | Usuario autenticado sin autorización. |
| 404 | `SNAPSHOT_NOT_FOUND` | UUID válido no encontrado. |
| 500 | `AUTH_SERVICE_ERROR`, `DATABASE_ERROR`, `INTERNAL_ERROR` | Fallo controlado sin información interna. |

`DATABASE_ERROR` se conserva temporalmente por compatibilidad del contrato; en C1 también representa fallos del repositorio o archivos CSV.

Las respuestas administrativas 200 todavía dependen de disponer de Supabase Auth. Las pruebas de servicio/repositorio demuestran los cálculos CSV, pero no se presentan como pruebas HTTP autenticadas.
