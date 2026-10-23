# Datos

## Principios del contrato

Los archivos externos, incluidos los Excel, pueden utilizar encabezados y formatos diferentes. Cada importación futura deberá mapear sus columnas de forma explícita hacia un formato interno estándar. Nunca se inventarán equivalencias, identificadores ni cantidades cuando la fuente no los proporcione o el mapeo no haya sido aprobado.

Una importación válida creará un snapshot independiente y trazable. Las intenciones de donación representan cantidades esperadas y nunca se suman al inventario confirmado. Los traslados serán recomendaciones, no movimientos automáticos. Estas reglas se documentan ahora, pero todavía no están implementadas.

Los paquetes se expresan como números enteros de una presentación. Cada presentación establece `contenido_por_paquete` en la unidad base de su producto. El dataset inicial tendrá seis centros ficticios, pero el código no impondrá seis como límite. Los tiempos de traslado son dirigidos: el tiempo de A a B puede ser distinto del tiempo de B a A.

## Contrato interno preliminar

Todos los campos y entidades siguientes son preliminares y deben aprobarse antes de crear tablas o migraciones.

### centros

| Campo | Significado preliminar |
| --- | --- |
| `centro_id` | Identificador interno del centro. |
| `nombre` | Nombre legible del centro. |
| `estado` | Estado operativo del centro. |

### coordinadores

| Campo | Significado preliminar |
| --- | --- |
| `coordinador_id` | Identificador interno del coordinador. |
| `centro_id` | Centro al que está asociado. |
| `nombre` | Nombre del coordinador. |

### productos

| Campo | Significado preliminar |
| --- | --- |
| `producto_id` | Identificador del producto normalizado. |
| `nombre` | Nombre legible del producto. |
| `unidad_base` | Unidad en la que se comparan existencias y necesidades. |

### presentaciones

| Campo | Significado preliminar |
| --- | --- |
| `sku_id` | Identificador de la presentación. |
| `producto_id` | Producto al que pertenece. |
| `contenido_por_paquete` | Cantidad de unidad base contenida en un paquete. |

### inventario

| Campo | Significado preliminar |
| --- | --- |
| `centro_id` | Centro que confirma la existencia. |
| `sku_id` | Presentación almacenada. |
| `cantidad_paquetes` | Número entero de paquetes confirmados. |

### necesidades

| Campo | Significado preliminar |
| --- | --- |
| `centro_id` | Centro que registra la necesidad. |
| `producto_id` | Producto requerido. |
| `objetivo_unidad_base` | Objetivo expresado en la unidad base del producto. |
| `prioridad` | Nivel de prioridad por definir. |

### voluntarios

| Campo | Significado preliminar |
| --- | --- |
| `centro_id` | Centro al que corresponde el conteo. |
| `disponibles` | Cantidad de voluntarios disponibles. |
| `requeridos` | Cantidad de voluntarios requeridos. |

### tiempos

| Campo | Significado preliminar |
| --- | --- |
| `origen_id` | Centro de origen. |
| `destino_id` | Centro de destino. |
| `minutos` | Tiempo dirigido de traslado en minutos. |

### intenciones

| Campo | Significado preliminar |
| --- | --- |
| `intencion_id` | Identificador de la intención esperada. |
| `centro_id` | Centro receptor previsto. |
| `sku_id` | Presentación ofrecida. |
| `cantidad_paquetes` | Número entero de paquetes esperados. |
| `llegada_prevista` | Fecha y hora estimadas de llegada. |

## Pendientes de aprobación

- Tipos SQL, nulabilidad, claves, estados permitidos y reglas de unicidad.
- Metadatos de origen, auditoría y composición de cada snapshot.
- Reglas de validación de unidades, prioridades y fechas.
- Catálogo de mapeos por cada formato externo real.

