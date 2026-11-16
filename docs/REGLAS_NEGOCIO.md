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

## Alertas operativas M5

- El motor recibe `evaluado_en` explícito con zona u offset; no consulta `Date.now()` ni sustituye esa hora por la del snapshot.
- Cobertura menor a 30 % es crítica; desde 30 % y menor a 70 % es importante; desde 70 % y menor a 100 % es moderada; 100 % o más no produce alerta de déficit. Objetivos cero tampoco generan alerta.
- La prioridad `1 = alta` interviene en el orden operativo y en la explicación, pero no crea una segunda alerta ni cambia la banda de cobertura del mismo centro/producto.
- Hay alerta de voluntariado cuando disponibles es menor que requeridos y el valor observado son las personas faltantes.
- Una donación pendiente se considera retrasada sólo cuando la evaluación supera su llegada prevista más 60 minutos. Recibidas y canceladas no generan retraso.
- Información desactualizada requiere una fecha válida de actualización de la entidad y más de 240 minutos. Sin evidencia se informa temporalidad desconocida, no ocupación o antigüedad inventada.
- Capacidad calculable desde 85 % genera advertencia, desde 95 % es crítica y mayor a 100 % indica sobrecapacidad. Capacidad no calculable no equivale a cero.
- Excedente transferible positivo puede generar una alerta informativa; continúa siendo recomendación y nunca una orden automática de traslado.
- Los identificadores de condición se forman de manera determinista por tipo, centro y sujeto. Una condición resuelta desaparece en la evaluación siguiente.
- El orden es severidad, prioridad, centro, producto e identificador. Las alertas no mezclan snapshots, productos ni unidades y no suman donaciones pendientes al inventario confirmado.

## Reconstruccion temporal M6 y escenario semanal M6.5

- Toda reconstruccion comienza en `snapshot_base_id` y aplica eventos una sola vez; nunca suma inventarios completos de snapshots sucesivos.
- La perspectiva fisica ordena y corta por `ocurrido_en`; la informativa usa `registrado_en`. Los empates se resuelven con orden, operacion e identificador deterministas.
- `registrado_en` nunca puede ser anterior a `ocurrido_en`. Un registro posterior, incluso al dia siguiente, no cambia la hora fisica del hecho.
- `anuncio_donacion` crea una intencion pendiente con centro, SKU, cantidad y llegada prevista. No modifica inventario.
- Una recepcion asociada requiere que el anuncio exista en ese corte, incrementa paquetes exactamente una vez y cambia la intencion a `recibida`.
- Las actualizaciones de voluntariado representan el total disponible y requerido en ese momento del turno; no se suman turnos ni se duplican personas.
- Las necesidades son objetivos vigentes. No se renuevan por dia y solo cambian mediante un evento explicito.
- El escenario M6.5 es completamente simulado, usa `America/Bogota` y no consulta el reloj del sistema para generar datos ni evaluar alertas historicas.
- Capacidad permanece no calculable mientras falten pesos por presentacion y capacidad maxima por centro.

## Datos obligatorios de referencia

En el snapshot A, `C01` tiene 10 botellas de 600 ml y 4 de 1.500 ml: 12.000 ml confirmados. Su objetivo es 20.000 ml, por lo que el déficit confirmado es 8.000 ml. La intención pendiente de 10 botellas de 600 ml equivale a 6.000 ml esperados y no reduce ese déficit confirmado.

