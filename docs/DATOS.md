# Datos

## Contrato canónico vigente

Cada importación válida crea un snapshot independiente. Los códigos se interpretan junto con `snapshot_id`; seis centros son sólo el dataset inicial. Los paquetes son enteros, los tiempos son dirigidos y las donaciones anunciadas nunca incrementan el inventario confirmado.

Los encabezados externos podrán variar, pero un adaptador deberá convertirlos explícitamente a este contrato. No se inventan equivalencias, IDs ni cantidades.

| Archivo o registro | Campos canónicos |
| --- | --- |
| `metadata.json` | `id`, `nombre`, `created_at`, `descripcion` |
| `centros.csv` | `snapshot_id`, `centro_id`, `nombre`, `estado`, `zona`, `coordinador_nombre` |
| `productos.csv` | `snapshot_id`, `producto_id`, `nombre`, `unidad_base` |
| `presentaciones.csv` | `snapshot_id`, `sku_id`, `producto_id`, `nombre`, `contenido_por_paquete` |
| `inventario.csv` | `snapshot_id`, `centro_id`, `sku_id`, `cantidad_paquetes` |
| `necesidades.csv` | `snapshot_id`, `centro_id`, `producto_id`, `objetivo_unidad_base`, `reserva_unidad_base`, `prioridad` |
| `voluntarios.csv` | `snapshot_id`, `centro_id`, `disponibles`, `requeridos` |
| `tiempos.csv` | `snapshot_id`, `origen_id`, `destino_id`, `minutos` |
| `intenciones.csv` | `snapshot_id`, `intencion_id`, `centro_id`, `sku_id`, `cantidad_paquetes`, `llegada_prevista`, `estado` |

Los tipos TypeScript continúan usando los nombres conceptuales `inventario_inicial`, `tiempos_traslado` y `donaciones_esperadas`; el repositorio mapea esos contratos a los nombres físicos de archivo.

## Valores controlados

- `unidad_base`: `ml`, `g` o `unidad`.
- `prioridad`: 1 alta, 2 media y 3 baja.
- `intenciones.estado`: `pendiente`, `recibida` o `cancelada`.
- Cantidades de paquetes: enteros; inventario no negativo e intenciones positivas.
- `contenido_por_paquete`: positivo.
- Tiempos: enteros no negativos y direccionales.
- Fechas: ISO 8601 con zona u offset.

## Validación

`src/contracts/schemas/data.ts` valida cada fila y el bundle completo:

- UUID y pertenencia al snapshot.
- Campos obligatorios y columnas estrictas.
- Conversión decimal controlada; vacíos no se convierten en cero.
- Unicidad equivalente a las claves del modelo anterior.
- Referencias entre centros, productos y SKU.
- Estados y rangos admitidos.

Los CSV se leen como UTF-8 y soportan BOM, comillas, comas, tildes y saltos de línea dentro de campos. Un snapshot se rechaza completo si cualquiera de sus archivos o relaciones es inválido.

## Ubicación y ciclo de vida

- `data/templates`: plantillas versionadas sin datos.
- `data/demo/snapshots`: datos demostrativos versionados.
- `data/runtime/snapshots`: nuevas cargas locales, ignoradas por Git.
- `data/runtime/.staging`: área transitoria para escritura validada.

Los snapshots son inmutables: una escritura con UUID existente falla. Las simulaciones deben partir de una copia lógica y no modificar estos archivos. C1 conserva la función pura de eventos, pero no declara implementada la persistencia JSON de simulaciones.

## Datos demostrativos

Los dos snapshots de `data/demo/snapshots` se derivan literalmente de `supabase/seed.sql`. El snapshot A contiene seis centros, cinco productos, siete presentaciones, inventario, necesidades, voluntarios, tiempos e intenciones. El snapshot B reutiliza `C01` con datos distintos e incluye `AGUA-330` para validar aislamiento.

- Snapshot A, C01, agua confirmada: 12.000 ml.
- Snapshot B, C01, agua confirmada: 2.700 ml.
- Snapshot A, C01, intención de agua: 6.000 ml anunciados.

El SQL queda como legado y fuente histórica; la API operativa lee CSV. Los usuarios administradores no se guardan en estos archivos: permanecen temporalmente en Supabase Auth hasta C2.
