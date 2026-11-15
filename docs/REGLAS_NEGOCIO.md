# Reglas de negocio

## Inventario y unidades

- El inventario confirmado se calcula como `SUM(cantidad_paquetes × contenido_por_paquete)`.
- Los paquetes siempre son cantidades enteras; su contenido se expresa en la unidad base del producto.
- Déficit: `max(0, objetivo_unidad_base - inventario_confirmado)`.
- Cobertura: `inventario_confirmado / objetivo_unidad_base * 100`. Si el objetivo es cero, la cobertura no es calculable y se representa como `null`.
- Excedente transferible: `max(0, inventario_confirmado - objetivo_unidad_base - reserva_unidad_base)`.
- Donación esperada: suma de paquetes anunciados con estado `pendiente`, calculada aparte del inventario confirmado.
- Déficit potencial: `max(0, objetivo_unidad_base - inventario_confirmado - donaciones_esperadas)`. No reemplaza el déficit confirmado.
- Voluntarios faltantes: `max(0, requeridos - disponibles)`.

## Capacidad de almacenamiento

- Peso almacenado: `SUM(cantidad_paquetes × peso_kg_por_paquete)`.
- Ocupación: `peso_almacenado_kg / capacidad_maxima_kg * 100`.
- Existe sobrecapacidad cuando la ocupación es mayor que 100%.
- Si falta la capacidad del centro o el peso de una presentación con inventario positivo, el indicador no es calculable. Los valores faltantes no se sustituyen por cero ni se infieren desde `ml`, `g`, `unidad` o el nombre del producto.

La prioridad usa la escala `1 = alta`, `2 = media`, `3 = baja`.

## Snapshots

Cada snapshot es inmutable desde el punto de vista de las simulaciones. Los códigos de centros, productos, SKU e intenciones pueden repetirse en snapshots diferentes sin mezclar información. Las claves compuestas de PostgreSQL refuerzan esta separación.

## Traslados recomendados

Una recomendación requiere origen con excedente, destino con déficit del mismo producto, inventario físico identificado y un tiempo dirigido conocido. El algoritmo:

1. Considera primero los tiempos conocidos más cortos.
2. Limita las unidades por excedente, déficit e inventario físico restante.
3. Selecciona presentaciones de mayor contenido primero.
4. Propone únicamente paquetes enteros y acepta resultados parciales.
5. No inventa tiempos ni modifica los datos de inventario recibidos.

La recomendación es informativa. No representa vehículo, ruta real, capacidad logística ni movimiento ejecutado.

## Eventos de simulación

`applyConfirmedReceptions` recibe un inventario inicial, eventos y una simulación seleccionada. Solo aplica eventos `recepcion_confirmada` de esa simulación, con payload confirmado y cuya hora de ocurrencia no sea posterior a la hora actual. La función devuelve una copia; no modifica el snapshot ni otra simulación.

El evento conserva `ocurrido_en` y `registrado_en` para distinguir el hecho físico de su registro. No existe endpoint para crear o avanzar eventos en este bloque.

## Movimientos operativos M4

- Una recepción incrementa paquetes exactamente una vez y un despacho los disminuye sin permitir inventario negativo.
- Inventario, intención y movimiento se publican en una misma versión operativa; no se guarda un movimiento si falla la publicación completa.
- `operacion_id` es una clave idempotente global. Repetir la misma solicitud recupera su versión; reutilizarla con otros datos produce conflicto.
- Una donación confirmada conserva su cantidad anunciada, registra la recibida y cambia a `recibida`, por lo que deja de formar parte del agregado pendiente.
- `ocurrido_en` representa el hecho físico y `registrado_en` el momento del registro. Ambos usan ISO 8601 con zona explícita; la interfaz interpreta la jornada en `America/Bogota`.
- Los movimientos se ordenan por `ocurrido_en` y UUID. Conteo de movimientos y suma de paquetes son métricas distintas.
- Los traslados ejecutados todavía no están habilitados; las recomendaciones existentes continúan siendo informativas.

## Datos obligatorios de referencia

En el snapshot A, `C01` tiene 10 botellas de 600 ml y 4 de 1.500 ml: 12.000 ml confirmados. Su objetivo es 20.000 ml, por lo que el déficit confirmado es 8.000 ml. La intención pendiente de 10 botellas de 600 ml equivale a 6.000 ml esperados y no reduce ese déficit confirmado.

