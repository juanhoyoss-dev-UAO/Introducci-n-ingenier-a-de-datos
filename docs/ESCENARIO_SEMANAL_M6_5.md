# Escenario semanal M6.5

## Identidad y alcance

- Nombre: **Emergencia simulada de Cali - Semana del 9 al 15 de noviembre de 2026**.
- Naturaleza: terremoto completamente hipotetico. Ningun dato describe un hecho historico real.
- Zona horaria: `America/Bogota`.
- Periodo fisico: `2026-11-09T07:30:00-05:00` a `2026-11-15T23:59:00-05:00`.
- Semilla: `redes-de-ayuda-m6.5-cali-2026-v1`.
- Escenario: `65000000-0000-4000-8000-000000000001`.
- Snapshot inicial: `65000000-0000-4000-8000-000000000002`.
- Snapshot semanal completo: `65000000-0000-4000-8000-000000000003`.

El generador publica solo dos snapshots: una base inicial sin eventos y una version final con todos los eventos de la semana. M6 reconstruye cualquier corte intermedio desde la base; no se suman snapshots completos ni se crean versiones por cada evento.

## Catalogo y fuentes

El catalogo contiene 32 productos y 40 presentaciones en ocho categorias: agua, alimentos no perecederos, higiene y saneamiento, abrigo y alojamiento, primeros auxilios y proteccion, herramientas manuales, herramientas electricas, y energia y comunicacion.

Las presentaciones conservan su significado: botella, bidon, bolsa, bulto, kit, rollo, par, caja y unidad. Solo se usa una equivalencia cuando la presentacion la declara de forma explicita, por ejemplo `Caja de 12 pares` o `Bulto de 10 kits`. No se infieren pesos, capacidades ni contenidos desconocidos.

Referencias consultadas:

- IFRC, evaluacion de necesidades: https://www.ifrc.org/our-work/disasters-climate-and-crises/supporting-local-humanitarian-action/emergency-needs
- Sphere Handbook: https://spherestandards.org/handbook/
- UNGRD, Manual de donaciones: https://portal.gestiondelriesgo.gov.co/Documents/Manuales/Donaciones-UNGRD-FNGRD.pdf
- APC Colombia, orientaciones para donaciones: https://www.apccolombia.gov.co/comunicaciones/noticias/apc-colombia-emite-orientaciones-para-articular-las-donaciones-y-ayudas

El Excel `PMU HERRAMIENTAS LIMONAR CALI 10-08-2026.xlsx` no estaba disponible en el espacio de trabajo. Ningun producto se atribuye al Excel. Las herramientas incluidas se marcan como simuladas y pendientes de contraste. La configuracion versionada conserva fuente, clase de fuente y nota de procedencia por producto.

## Volumen generado

| Medida | Resultado |
| --- | ---: |
| Centros | 6 |
| Productos | 32 |
| Presentaciones | 40 |
| Eventos totales | 352 |
| Anuncios de donacion | 80 |
| Recepciones confirmadas | 90 |
| Recepciones sin anuncio | 20 |
| Despachos | 57 |
| Evaluaciones de voluntariado | 84 |
| Cambios de necesidad | 42 |
| Donaciones pendientes al cierre | 10 |
| Registros en una fecha posterior a la ocurrencia | 59 |

### Eventos por jornada y centro

| Fecha | Eventos | Centro | Eventos |
| --- | ---: | --- | ---: |
| 2026-11-09 | 46 | C01 | 64 |
| 2026-11-10 | 52 | C02 | 58 |
| 2026-11-11 | 54 | C03 | 57 |
| 2026-11-12 | 53 | C04 | 61 |
| 2026-11-13 | 54 | C05 | 56 |
| 2026-11-14 | 53 | C06 | 56 |
| 2026-11-15 | 40 |  |  |

### Resultados de donaciones

- 70 anuncios recibidos: 49 en la hora prevista, 7 anticipados y 14 tardios.
- 7 recepciones parciales y 7 superiores a la cantidad anunciada. Estas categorias pueden coincidir con la puntualidad.
- 10 anuncios permanecen pendientes al cierre.
- 20 recepciones directas no tienen anuncio previo.
- Un anuncio nunca incrementa inventario. Solo una recepcion confirmada lo hace.

## Alertas por jornada

Las alertas se calcularon con el motor M5 y con el corte simulado de cada jornada.

| Fecha | Total | Deficit | Voluntariado | Donacion tardia | Informacion desactualizada | Capacidad | Excedente |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-11-09 | 201 | 169 | 4 | 1 | 11 | 0 | 16 |
| 2026-11-10 | 213 | 166 | 3 | 0 | 25 | 0 | 19 |
| 2026-11-11 | 232 | 159 | 3 | 1 | 42 | 0 | 27 |
| 2026-11-12 | 247 | 154 | 3 | 1 | 58 | 0 | 31 |
| 2026-11-13 | 263 | 145 | 3 | 1 | 75 | 0 | 39 |
| 2026-11-14 | 272 | 136 | 2 | 2 | 85 | 0 | 47 |
| 2026-11-15 | 291 | 134 | 3 | 8 | 97 | 0 | 49 |

El aumento del total no significa deterioro uniforme: disminuyen los deficit y aumentan los excedentes y la evidencia de informacion desactualizada. La prueba comprueba que al menos una condicion activa al inicio desaparece al cierre. Capacidad permanece en cero porque no existen pesos ni capacidades validados.

## Puntos de control

Valores de referencia para C01 y agua potable en perspectiva fisica:

| Corte | Eventos aplicados | Inventario (ml) | Necesidad (ml) | Voluntarios disponibles/requeridos |
| --- | ---: | ---: | ---: | --- |
| Lunes 08:00 | 0 | 267.000 | 534.000 | 8 / 15 |
| Martes 12:00 | 66 | 442.800 | 491.280 | 11 / 15 |
| Miercoles 16:00 | 135 | 442.800 | 491.280 | 10 / 15 |
| Domingo 23:59 | 352 | 438.000 | 0 | 10 / 13 |

El objetivo de C01/agua se cierra el domingo mediante un evento explicito; no se renueva automaticamente. El inventario final reconstruido coincide fila por fila con el snapshot final. La perspectiva informativa aplica menos eventos en los cortes con registro demorado.

## Decisiones y limites

- Se amplio el contrato temporal con `anuncio_donacion`; el anuncio crea una intencion pendiente y no toca inventario.
- La confirmacion posterior cambia la intencion a recibida e incrementa el inventario una sola vez.
- Los turnos de manana y tarde son evaluaciones agregadas del centro, no listas de personas. No existe doble conteo de identidades.
- Los tiempos de traslado son valores simulados y se marcan dentro de un escenario ficticio.
- No se incluyen medicamentos controlados ni sustancias peligrosas.
- Permanecen desconocidos los pesos por presentacion, capacidades maximas, contenido no declarado de paquetes externos y las filas del Excel ausente.
- No se implementan Play, Pause, simulador interactivo, importacion desde interfaz ni graficos nuevos.

## Reproduccion

Ejecutar desde la raiz:

```powershell
npm.cmd run scenario:weekly
```

El script valida configuracion, referencias, fechas, identificadores, cantidades, no negatividad y orden temporal antes de publicar. Una segunda ejecucion compara los archivos existentes y falla si difieren; no sobrescribe silenciosamente el escenario.
