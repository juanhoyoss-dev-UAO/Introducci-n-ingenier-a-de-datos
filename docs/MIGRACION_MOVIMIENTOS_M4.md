# Migración compatible de movimientos M4

## Objetivo

Agregar historial persistente de recepciones y despachos sin modificar los snapshots demostrativos ni romper datasets creados antes de M4.

## Estrategia

- Archivo nuevo: `movimientos.csv`.
- Los snapshots antiguos pueden omitirlo; el lector los normaliza a `movements: []`.
- Toda versión publicada desde M4 escribe el archivo con encabezado canónico, aunque no tenga movimientos.
- El archivo participa en la validación integral, staging, relectura y publicación atómica del snapshot.
- No se ejecuta una migración destructiva ni se reescriben datos originales.

## Columnas

1. `snapshot_id`
2. `movimiento_id`
3. `operacion_id`
4. `tipo`
5. `centro_origen_id`
6. `centro_destino_id`
7. `producto_id`
8. `sku_id`
9. `cantidad_paquetes`
10. `ocurrido_en`
11. `registrado_en`
12. `intencion_id`
13. `snapshot_origen_id`
14. `cantidad_anunciada_paquetes`

## Compatibilidad e integridad

- `recepcion_confirmada` exige destino y no origen; `despacho` exige origen y no destino.
- Producto, SKU, centros e intención opcional deben existir en la versión.
- `movimiento_id` y `operacion_id` son únicos dentro del snapshot.
- La cantidad de paquetes es un entero positivo.
- Las fechas son ISO 8601 con offset explícito.
- El producto del movimiento debe coincidir con el producto de la presentación.

## Rollback

Si la validación, escritura o relectura falla, el staging se elimina y no se publica ni inventario ni movimiento. Los snapshots fuente permanecen intactos.
