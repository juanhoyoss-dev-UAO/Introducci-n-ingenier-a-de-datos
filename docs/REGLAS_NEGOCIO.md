# Reglas de negocio

## Inventario y unidades

- El inventario confirmado se calcula como `SUM(cantidad_paquetes × contenido_por_paquete)`.
- Los paquetes siempre son cantidades enteras; su contenido se expresa en la unidad base del producto.
- Déficit: `max(0, objetivo_unidad_base - inventario_confirmado)`.
- Excedente transferible: `max(0, inventario_confirmado - objetivo_unidad_base - reserva_unidad_base)`.
- Donación esperada: suma de paquetes anunciados con estado `pendiente`, calculada aparte del inventario confirmado.
- Voluntarios faltantes: `max(0, requeridos - disponibles)`.

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

## Datos obligatorios de referencia

En el snapshot A, `C01` tiene 10 botellas de 600 ml y 4 de 1.500 ml: 12.000 ml confirmados. Su objetivo es 20.000 ml, por lo que el déficit confirmado es 8.000 ml. La intención pendiente de 10 botellas de 600 ml equivale a 6.000 ml esperados y no reduce ese déficit confirmado.

