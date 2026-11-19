# Bitácora técnica

## 2026-11-19 - Fase 2.2 (preparación local multiproducto)

- Adoptada una migración retrocompatible sin un segundo CSV: una fila por artículo, respuesta compartida como cabecera lógica e identidad estable por artículo.
- Añadida creación atómica de donaciones de uno a cinco productos diferentes, compatibilidad con `create_announcement` y cálculo del estado general desde los artículos.
- Adaptado el lector para aceptar tanto el esquema histórico A:H como el multiproducto A:J, validar cabeceras compartidas, pares producto/cantidad e identidades de artículo.
- Agrupado el dashboard por donación con detalle expandible y recepción independiente por artículo, sin sumar unidades incompatibles.
- Preparado el Apps Script para reutilizar el formulario, retitular el primer par sin borrar respuestas, añadir cuatro pares opcionales, insertar dos columnas en la hoja normalizada y detenerse si algún enlace QR cambia.
- Pruebas dirigidas de Google/QR: 20/20. Pruebas CSV: 28/28. Lint, typecheck y sintaxis del script: aprobados.
- Google Forms y Sheets no fueron modificados en este microbloque; se requiere autorización antes de ejecutar el script real.

## 2026-11-19 - Fase 2.1 (conexión real Google Sheets → Next.js)

### Implementación y seguridad

- Creada una cuenta de servicio exclusiva para lectura, con Google Sheets API habilitada y acceso de lector únicamente al libro de respuestas.
- Guardado el JSON en una ruta absoluta externa al repositorio; ningún valor privado fue copiado a código, documentación o salidas de prueba.
- Retirado `.env.local` del índice de Git sin borrar el archivo local. La configuración nueva quedó en `.env.development.local`, ignorado por las reglas existentes y cargado por Next.js durante desarrollo.
- Configurados el ID real del libro, el rango `'Respuestas normalizadas'!A:H`, la ruta externa de credenciales y el intervalo de 45 segundos.

### Sincronización real autorizada

- Resuelta la última versión lógica de PRUEBAS: `842d768a-44f3-55c1-b0fb-4092cb4da1db`.
- Leída la respuesta real C01 / FRIJOL-5000 / 5 paquetes y publicada en `2485361d-0221-5be5-a4ff-0d1d7d33cf7d` como anuncio de Google Forms.
- Resultado persistido: cinco paquetes anunciados, cero recibidos, cinco pendientes y estado `anunciado`.
- El inventario confirmado y los movimientos conservaron sus valores operativos; la reidentificación de `snapshot_id` corresponde al versionado inmutable normal.
- MAIN permaneció idéntico. La segunda sincronización resolvió la respuesta como duplicada y no publicó otro snapshot.

### Verificaciones

- JSON externo presente y con estructura válida de cuenta de servicio, sin imprimir correo, clave privada ni tokens.
- Pruebas unitarias iniciales: 20 archivos, 103/103.
- Prueba real temporal: primera ejecución publicó correctamente y detectó una expectativa demasiado estricta sobre `snapshot_id`; corregido el arnés, la repetición aprobó y confirmó idempotencia. El archivo temporal fue eliminado.
- Pruebas permanentes dirigidas de configuración, traducción, sincronización y módulo QR: 5 archivos, 14/14.
- Lectura real no mutante del módulo Donaciones esperadas: 1/1; integración activa, intervalo de 45 segundos y anuncio C01/FRIJOL-5000 visible.
- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- Pendiente de seguridad ajeno a la conexión: rotar las credenciales administrativas que estuvieron versionadas históricamente antes de distribuir el repositorio.
- Sin commit, push, merge, rebase ni PDF.

## 2026-11-18 - Fase 2, Bloque 2 (preparación técnica)

### Objetivo

Preparar la conexión oficial entre Google Forms, Google Sheets y Donaciones esperadas, manteniendo MAIN inmutable y sin convertir anuncios en inventario.

### Implementación

- Creada una hoja nativa de Google, con catálogo M6.5 de seis centros, 32 productos y 40 presentaciones, pestañas de guía y configuración, y locale/zona horaria de Colombia.
- Añadido un adaptador de Google Sheets que obtiene un token JWT de cuenta de servicio con alcance de solo lectura, exige el JSON fuera del repositorio y no registra credenciales.
- Añadida traducción estricta de respuestas: encabezados conocidos, ID estable de Forms, fechas de `America/Bogota`, paquetes enteros positivos y resolución del producto a partir del SKU real del snapshot.
- Añadido un servicio idempotente que importa filas válidas secuencialmente sobre PRUEBAS, reporta duplicados y filas inválidas, publica versiones inmutables y bloquea MAIN antes de consultar el proveedor externo.
- Añadida ruta administrativa de sincronización y controles de interfaz manual/periódica, con intervalo configurable de 30 a 60 segundos y actualización automática de la versión lógica PRUEBAS.
- Preparado un Apps Script acotado e idempotente para crear/publicar el formulario, vincular respuestas, conservar el ID real, generar una hoja normalizada y producir seis enlaces prerrellenados por centro.
- Ejecutado el Apps Script con autorización del usuario. El primer intento falló al consultar un destino aún inexistente; se corrigió ese estado inicial y la repetición creó correctamente la vinculación, el disparador, la hoja normalizada y los seis enlaces.
- Generados `QR-C01.png` a `QR-C06.png` con las URLs devueltas por Google y una página HTML responsiva e imprimible para su presentación.
- Añadida la guía de autorización y cuenta de servicio. No se añadieron claves, correos privados ni tokens; `.env.local` no fue alterado.

### Verificaciones reales

- Filas válidas e inválidas de Forms: traducción, fechas, centro, SKU, cantidades y cabeceras comprobadas.
- Sincronización en PRUEBAS: 1 anuncio importado, 1 fila de SKU inexistente aislada, inventario sin cambios y segundo intento reconocido como duplicado sin publicar otra versión.
- MAIN rechazó la sincronización antes de invocar al lector externo.
- Configuración: credenciales relativas o dentro del repositorio rechazadas; intervalos fuera de 30–60 segundos vuelven al valor seguro de 45 segundos.
- Pruebas dirigidas Google + módulo QR: 5 archivos, 14/14.
- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- La hoja Google fue verificada por tipo nativo, metadatos, rangos, conteos y previsualizaciones del libro fuente.
- La ejecución de Apps Script terminó correctamente e informó seis enlaces por centro. La lectura posterior confirmó las pestañas `Respuestas de formulario 1`, `Respuestas normalizadas` y `Enlaces QR`, además del formulario publicado.
- Los seis PNG QR existen y la inspección visual confirmó una matriz nítida, margen blanco y color verde de alto contraste.

### Pendientes y bloqueo externo

- Crear una cuenta de servicio, compartir la hoja como lector y configurar el archivo JSON fuera del repositorio.
- Realizar un envío real del formulario y una sincronización desde PRUEBAS solamente después de configurar la credencial lectora; esta demostración corresponde al Bloque 3 y no fue iniciada.
- Retirar `.env.local` del índice y rotar secretos antes de usar configuración sensible. `.gitignore` no desrastrea archivos ya versionados.
- Bloque 3 no iniciado. No se generó PDF; no se hizo commit, push, merge ni rebase.

## 2026-11-18 - Fase 2, Bloque 1

### Objetivo

Implementar el módulo local de anuncios de donación y su confirmación física, sin depender todavía de Google Forms o Google Sheets.

### Implementación

- Añadido un contrato estricto para anuncios QR con identificador de origen, catálogo real, cantidades, fechas, fuente y estados `anunciado`, `parcialmente_recibido`, `recibido_completo` y `cancelado`.
- Añadido `donaciones_qr.csv` opcional para lectura retrocompatible y obligatorio al publicar versiones nuevas; no se modificaron snapshots demostrativos ni eventos M6.5.
- Añadido un servicio y una ruta administrativa para consultar, crear y cancelar anuncios con referencias válidas e idempotencia por respuesta de origen y UUID de operación.
- Extendida la recepción M4 con `confirm_qr_donation`: inventario, saldo del anuncio y movimiento se publican juntos en un snapshot nuevo; los excesos y las cancelaciones posteriores a una recepción se rechazan.
- Restaurada la pestaña Donaciones esperadas con indicadores por centro, filtros, comparación en unidad base, orden, tabla y acciones parciales/completas/cancelación. MAIN solo muestra datos; PRUEBAS permite operar.
- Política de reinicio: la acción explícita existente para reiniciar PRUEBAS desde MAIN crea una rama QR vacía. Las ramas anteriores no se eliminan y conservan anuncio y movimientos enlazados, evitando registros huérfanos.

### Verificaciones reales

- Caso C01/AGUA-600: anuncio de 20 paquetes no alteró inventario; recepción de 8 agregó 4.800 ml y dejó 12 pendientes; recepción restante completó 12.000 ml totales.
- Reintentos de anuncio y recepción no duplicaron filas ni existencias; una recepción mayor al saldo fue rechazada.
- Cancelación previa a recepción aprobada; cancelación posterior rechazada; MAIN rechazó mutaciones y el reinicio dejó la rama nueva sin anuncios QR.
- Un caso P27/C01 confirmó que el anuncio no resolvía la alerta y que la entrega física completa sí la eliminaba al recalcular el dashboard.
- `npm run test:unit`: 18 archivos, 97/97.
- `npm run test:csv`: 3 archivos, 36/36.
- Pruebas dirigidas de módulo, A4 y navegación: 4 archivos, 11/11.
- Compatibilidad A3 + módulo QR: 2 archivos, 5/5. Una primera ejecución combinada agotó por milisegundos el límite histórico de 15 s de la secuencia A3; al incluir el nuevo CSV por snapshot se elevó únicamente ese margen a 20 s y la repetición terminó en 17,11 s.
- `npm run lint` y `npm run typecheck`: aprobados.
- No se ejecutaron HTTP completo, build ni verificación interactiva de navegador.

### Pendientes

- Bloque 2: autorización y configuración real de Google Forms, Google Sheets, cuenta de servicio, enlaces prerrellenados, QR y sincronización.
- Bloque 3: demostración integral solo después de confirmar la conexión real a Google.
- No se generó PDF; no se hizo commit, push, merge ni rebase.

## 2026-11-16 - Bloque A4.2

### Objetivo

Permitir registrar una recepción persistente desde una alerta de déficit, sin abandonar Alertas operativas ni crear otra lógica de inventario.

### Implementación

- Sustituida la franja oscura por una línea compacta con título y hora del escenario.
- Añadido `Solucionar alerta` solo para déficits de producto; las demás acciones permanecen sin cambios.
- Añadido un modal accesible con centro, producto, inventario, necesidad, déficit, cobertura, severidad, presentación, paquetes y fecha operativa.
- La vista previa reutiliza las fórmulas de dominio y el contenido real de la presentación para informar inventario, cobertura, déficit y excedente estimados.
- El guardado usa la recepción directa M4, mantiene el UUID en reintentos, bloquea doble envío y conserva errores recuperables.
- Tras recargar la nueva versión, el resumen compara datos reales de backend, conserva el grupo abierto y distingue alerta resuelta, severidad reducida o alerta activa.
- MAIN queda deshabilitado en la interfaz y protegido por el servicio existente. No se modificaron contratos, motor de alertas, importador Excel ni Resumen operativo.

### Verificaciones reales

- Pruebas dirigidas: 6 archivos, 33/33.
- Escenario real P27/C01: 0/12 unidades; recepción parcial de 3 produjo 25 % y déficit 9; recepción adicional de 9 produjo 100 %, déficit 0 y eliminó la alerta.
- El reintento de la segunda recepción fue idempotente y dejó exactamente dos movimientos; MAIN rechazó la operación.
- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- No se ejecutaron HTTP completo ni build porque no cambiaron rutas, servicios o contratos.
- No se realizó verificación interactiva de navegador.

### Pendientes

- A4.3: Excel por categoría y plantillas amigables.
- A4.4: resumen de efectos y cierre final de pruebas.
- No iniciar fases posteriores ni hacer commit, push, merge o rebase sin autorización.

## 2026-11-16 - Bloque A4.1

### Objetivo

Reemplazar la lista inicial de alertas individuales por una gestión agrupada, sin cambiar el motor, los umbrales ni las operaciones A3.

### Implementación

- Añadidos cuatro grupos accesibles y responsivos, cerrados inicialmente y ordenados por la severidad máxima y la cantidad de alertas.
- Cada grupo informa alertas activas, críticas, centros afectados y gravedad máxima; solo renderiza sus tarjetas al abrirse.
- Los 32 productos se vinculan explícitamente con las ocho categorías M6.5 y los tres grupos de abastecimiento, sin analizar palabras de los nombres.
- Las alertas no asociadas a escasez se agrupan en Otras alertas operativas; los excedentes se etiquetan como oportunidades de abastecimiento.
- Los filtros existentes de centro, severidad y tipo se conservan y no alteran el estado abierto/cerrado de los grupos.
- El importador A3 se conserva sin cambios funcionales después de la vista agrupada. Su limitación por categoría corresponde a A4.3.

### Verificaciones reales

- `npm run test:unit`: 11 archivos, 78/78.
- Prueba dirigida de alertas y agrupación: 3 archivos, 25/25.
- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- No se ejecutaron HTTP ni build porque A4.1 no modifica rutas, backend ni contratos.
- No se realizó verificación interactiva de navegador en esta ejecución.

### Pendientes

- A4.2: formulario de resolución individual.
- A4.3: importación Excel limitada por categoría y plantillas amigables.
- A4.4: resumen de efectos y cierre de pruebas dirigidas.
- No iniciar el siguiente microbloque sin autorización; no hacer commit, push, merge ni rebase.

## 2026-11-16 - Fase A3

### Objetivo

Importar recepciones confirmadas desde XLSX en un escenario PRUEBAS independiente, recalcular indicadores y alertas, y demostrar diez operaciones consecutivas sin modificar MAIN.

### Implementación

- Creada la base PRUEBAS desde el cierre M6.5 con los catálogos, necesidades e inventario finales, pero sin copiar movimientos ni eventos ya incorporados.
- Protegido MAIN contra movimientos, ediciones administrativas e importaciones Excel.
- Añadidos lectura y validación de la hoja `Recepciones`, previsualización, confirmación explícita, publicación atómica por archivo e idempotencia por UUID de operación.
- Añadidos resultado comparativo antes/después, selección automática de la versión publicada y reinicio explícito de PRUEBAS desde MAIN.
- Añadidos plantilla, diez XLSX, manifiesto, resultado reproducible y generadores para el escenario y los libros.
- El dashboard y las alertas usan la hora del snapshot/recepción, no el reloj real del equipo.

### Verificaciones reales

- `npm run test:unit`: 9 archivos, 73/73.
- Integración dirigida A3 + repositorio CSV + escenario semanal: 3 archivos, 24/24.
- Primera pasada ampliada: falló por cinco conteos históricos de snapshots y el límite global de 5 s; se actualizaron las expectativas a cinco snapshots base y se asignaron 15 s únicamente a la prueba A3. La repetición aprobó completa.
- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- XLSX: 11 libros, 12 hojas renderizadas, revisión visual aprobada y cero errores de fórmula detectados.
- Secuencia real: seis alertas resueltas, ocho reducciones de severidad, recepción múltiple en `RECEPCION_04.xlsx` y tres centros en `RECEPCION_10.xlsx`.
- Navegador: la ventana accesible correspondía a una instancia anterior en otro puerto; no se interactuó con datos y no se declara verificación visual de la interfaz A3.

### Pendientes

- Realizar la demostración manual autenticada siguiendo `docs/DEMO_A3.md`.
- Revisar por separado las vulnerabilidades informadas por `npm audit`; no se ejecutó `audit fix` ni se alteraron versiones fuera del alcance A3.
- No iniciar M7 ni hacer commit, push, merge o rebase sin autorización.

## 2026-11-16 - Bloque M6.5

### Objetivo

Construir una semana humanitaria ficticia, reproducible y temporalmente trazable para validar dashboard, inventarios, necesidades, donaciones, voluntariado y alertas antes de M7.

### Implementación

- Añadida una configuracion versionada con semilla fija, seis centros, 32 productos, 40 presentaciones y trazabilidad de fuentes.
- Añadido un generador que valida en staging y publica una base inicial y una semana completa sin sobrescribir snapshots existentes.
- Generados 352 eventos distribuidos en siete dias: 80 anuncios, 90 recepciones, 57 despachos, 84 evaluaciones de voluntariado, 42 necesidades y 7 actualizaciones de centro.
- Ampliado el contrato temporal con anuncios de donacion pendientes; un anuncio no incrementa inventario y una recepcion lo aplica una sola vez.
- Conservadas las diferencias entre ocurrencia y registro, incluidos 59 eventos registrados en una fecha posterior.
- El visor temporal usa la fecha del snapshot como corte inicial, evitando tomar la fecha real del equipo para este escenario.
- Documentadas fuentes, decisiones, resultados diarios, puntos de control y datos desconocidos en `docs/ESCENARIO_SEMANAL_M6_5.md`.

### Verificaciones reales

- `npm.cmd run scenario:weekly`: 352 eventos reproducibles; segunda ejecucion compatible con los archivos publicados.
- `npm.cmd run test:unit`: 9 archivos, 67/67.
- `npm.cmd run test:csv`: 3 archivos, 36/36.
- `npx.cmd vitest run tests/integration/weekly-scenario.test.ts`: 5/5.
- `npm.cmd run test:http`: 1 archivo, 23/23 fuera del aislamiento de sockets. Dos intentos previos no ejecutaron casos porque `/api/health` no era accesible dentro del sandbox.
- `npm.cmd run lint`, `npm.cmd run typecheck` y `npm.cmd run build`: aprobados; 17 rutas/paginas.
- No hubo inspeccion visual de navegador en esta sesion; la evidencia de integracion proviene de consultas HTTP reales y build de produccion.

### Pendientes

- Incorporar y perfilar el Excel cuando se entregue, sin reinterpretarlo como inventario de los centros.
- Mantener ocupacion no calculable hasta contar con pesos y capacidades validados.
- M7, controles Play/Pause e importacion desde interfaz no fueron iniciados.
- No hacer commit, push, merge ni rebase sin autorizacion.

## 2026-11-15 - Bloque M5

### Objetivo

Transformar los indicadores consolidados y movimientos confirmados en alertas operativas reproducibles, consultables desde el dashboard y preparadas para recibir una hora ficticia en M7.

### Implementación

- Añadidos contratos tipados para estado de evaluación, umbrales, alertas, agregados por severidad/centro/tipo e información temporal desconocida.
- Añadido un motor puro sin reloj interno, con identificadores deterministas, deduplicación y orden estable.
- Centralizados los umbrales 30/70/100 de cobertura, 60 minutos para donaciones, 240 minutos para desactualización y 85/95/>100 para capacidad.
- La prioridad de necesidades ordena la atención sin contradecir la banda de cobertura: C01 con 60 % permanece como déficit importante.
- La evidencia temporal proviene de `registrado_en` de movimientos M4; si no existe, se informa como desconocida y no se fabrica una alerta.
- `/api/dashboard` añade alertas sin cambiar sus campos anteriores, conserva autenticación administrativa y recibe una hora de evaluación generada en el servidor.
- Añadida la pestaña “Alertas operativas” con resumen, filtros, acciones sugeridas, navegación contextual, estado vacío y diseño responsive.
- Añadidos al Resumen operativo los totales de alertas activas, críticas y centros con atención.

### Verificaciones reales

- `npm.cmd run test:unit`: 7 archivos, 47/47.
- `npm.cmd run test:csv`: 3 archivos, 34/34.
- `npm.cmd run test:http`: 1 archivo, 20/20 en repetición final. La primera corrida M5 aprobó 19/20 y reveló que el contrato real usa `UNAUTHENTICATED`; se corrigió solamente la expectativa.
- `npm.cmd run lint`: aprobado.
- `npm.cmd run typecheck`: aprobado en ejecución aislada. Una corrida previa paralela al build falló porque ambos procesos regeneraron `.next/types`; no fue un fallo de código.
- `npm.cmd run build`: aprobado; 16 rutas/páginas.
- Navegador: snapshot A con 15 alertas, snapshot B con 5, filtros y estado vacío comprobados. Después de confirmar D01, la versión nueva tuvo 14 alertas, eliminó el retraso de D01 y cambió agua C01 de 60 %/importante a 90 %/moderado.
- Responsive: viewport de 390 px sin desbordamiento del documento; consola del navegador sin errores.

### Pendientes

- No existe almacenamiento histórico independiente, reconocimiento de alertas ni notificación externa.
- Capacidad seguirá sin alertas en los datos actuales mientras falten capacidad máxima y pesos validados.
- M6 puede agregar análisis temporal sobre `ocurrido_en`, `registrado_en` y `evaluado_en`; M7 puede reutilizar el motor pasando la hora simulada.
- El runtime aislado de QA fue eliminado; no se tocaron snapshots demostrativos.
- No hacer commit, push ni merge sin autorización.

## 2026-11-15 - Bloque M4

### Objetivo

Registrar recepciones y despachos con fecha/hora, sincronizando historial, inventario y donaciones dentro de versiones operativas inmutables e idempotentes.

### Implementación

- Añadido `movimientos.csv` compatible: su ausencia en snapshots previos equivale a historial vacío y las versiones M4 lo publican con el resto del bundle.
- Añadidos contratos para recepción directa, confirmación de donación y despacho, con paquetes enteros positivos e ISO 8601 con offset.
- Cada movimiento conserva UUID, operación idempotente, tipo, centros, producto, presentación, cantidades, `ocurrido_en`, `registrado_en`, snapshot fuente e intención opcional.
- La confirmación conserva el anuncio original y cambia la intención a `recibida`; el despacho rechaza existencias insuficientes.
- El UUID de operación produce una versión determinista y permite reintentos sin doble incremento.
- Añadido `GET/POST /api/snapshots/[id]/movements`, protegido por sesión administrativa y validación de origen.
- Añadida la pestaña administrativa con formularios, diferencia anunciada/recibida e historial filtrable.
- Los traslados ejecutados se pospusieron; no se implementó simulador, alertas ni gráficos históricos.

### Verificaciones reales

- `npm.cmd run test:unit`: 6 archivos, 27/27.
- `npm.cmd run test:csv`: 3 archivos, 34/34.
- `npm.cmd run test:http`: 1 archivo, 19/19 tras ajustar a 10 s dos pruebas M3 con múltiples solicitudes secuenciales. La ejecución previa aprobó 17/19 y tuvo únicamente dos timeouts de 5 s.
- `npm.cmd run lint`: aprobado.
- `npm.cmd run typecheck`: aprobado.
- `npm.cmd run build`: aprobado; 16 rutas/páginas.
- Navegador: D01 confirmada con 10 paquetes; historial, versión seleccionada, inventario 18.000 ml, déficit 2.000 ml, cobertura 90 % y agregado pendiente actualizado; consola sin errores.

### Pendientes

- Traslados entre centros como movimiento ejecutado.
- Agregados horarios y gráficos históricos para M5/M6.
- El runtime aislado de QA fue eliminado; no se tocaron snapshots demostrativos.
- No hacer commit, push ni merge sin autorización.

## 2026-11-15 - Bloque M3

### Objetivo

Permitir actualizaciones operativas desde el dashboard administrativo sin sobrescribir snapshots ni ampliar el alcance hacia M4.

### Implementación

- Añadido un contrato Zod discriminado para centros, inventario, necesidades y voluntariado.
- Añadido un servicio transaccional que clona la versión seleccionada, aplica una operación, valida el bundle y lo publica con UUID y metadatos nuevos mediante el repositorio CSV existente.
- Añadido `POST /api/snapshots/[id]/operations` con sesión administrativa, validación de origen y errores normalizados.
- Añadidos formularios en las secciones correspondientes, con estados de guardado, error y confirmación.
- Tras una respuesta exitosa, el dashboard selecciona la versión nueva y recarga datos analíticos y tabulares conservando filtros todavía válidos.
- La desactivación de centros preserva relaciones; una necesidad se cierra con objetivo cero; las donaciones anunciadas siguen separadas del inventario confirmado.
- No se modificaron esquemas CSV, snapshots demostrativos, autenticación ni dependencias.

### Verificaciones reales

- `npm.cmd run test:unit`: 6 archivos, 27/27.
- `npm.cmd run test:csv`: 3 archivos, 29/29.
- `npm.cmd run test:http`: 1 archivo, 16/16 en repetición aislada. Una ejecución anterior tuvo cinco timeouts de 5 s y 11 pruebas aprobadas; no hubo aserciones funcionales fallidas.
- `npm.cmd run lint`: aprobado.
- `npm.cmd run typecheck`: aprobado.
- `npm.cmd run build`: aprobado; 15 rutas/páginas, incluida la ruta de operaciones.
- Navegador: publicación, selección automática, inventario actualizado y resumen visual comprobados en un runtime temporal; consola sin errores.
- Caso C01/agua: la prueba cambia la presentación de 600 ml de 10 a 20 paquetes; la versión nueva consolida 18.000 ml confirmados, 20.000 ml requeridos, déficit de 2.000 ml y cobertura de 90 %, mientras el snapshot fuente conserva 12.000/20.000/8.000 y la donación esperada permanece separada.

### Pendientes

- No existe todavía historial de eventos independiente de snapshots ni edición masiva.
- La ocupación continúa no calculable hasta contar con capacidad por centro y peso por presentación.
- M4 no fue iniciado.
- No hacer commit, push ni merge sin autorización.

## 2026-11-15 - Bloque M2

### Objetivo

Construir el primer dashboard analítico y visual sobre los contratos de M1, manteniendo las tablas existentes y sin introducir simulaciones, importación Excel ni cambios de persistencia.

### Implementación

- Añadido un resumen operativo inicial con seis indicadores y una señal de atención basada en el número de productos con déficit.
- Añadidos gráficos accesibles y responsivos para cobertura, inventario frente a necesidad, recursos confirmados frente a esperados y voluntarios disponibles frente a requeridos.
- Añadidos filtros coordinados por snapshot, centro y producto; los filtros dependientes se reinician al cambiar de snapshot.
- Los valores no calculables, porcentajes superiores a 100 % y unidades de producto se preservan explícitamente.
- Las transformaciones de presentación se mantuvieron en el modelo de vista y los gráficos se dividieron en componentes reutilizables, sin dependencias nuevas.
- Se conservaron las seis tablas originales y los dos snapshots demostrativos.

### Verificaciones reales

- `npm.cmd run test:unit`: 6 archivos, 27/27.
- `npm.cmd run test:csv`: 3 archivos, 25/25.
- `npm.cmd run test:http`: 1 archivo, 14/14.
- `npm.cmd run lint`: aprobado.
- `npm.cmd run typecheck`: aprobado.
- `npm.cmd run build`: aprobado; 13 rutas/páginas.
- Navegador: snapshots A y B, filtros, tabla de inventario y diseño responsivo comprobados; consola sin errores.
- Referencia C01 en snapshot A: 12.000 ml confirmados, 20.000 ml requeridos, déficit de 8.000 ml y 6.000 ml anunciados separados.

### Pendientes

- El catálogo experimental basado en Excel y la ocupación calculable siguen condicionados a recibir datos reales.
- M3, simulaciones e importación desde interfaz no se iniciaron.
- No hacer commit, push ni merge sin autorización.

## 2026-11-15 - Bloque M1

### Objetivo

Ampliar los indicadores del dashboard, preparar contratos de datos para cuatro visualizaciones y dejar listo el cálculo de capacidad sin alterar la persistencia CSV.

### Implementación

- Añadidas fórmulas de cobertura, déficit potencial y ocupación en dominio.
- El dashboard expone centros activos, métricas por centro/producto, voluntariado y colecciones tipadas para visualizaciones.
- La capacidad actual se informa como no calculable con datos faltantes explícitos.
- Se preservaron inventario confirmado, donaciones esperadas e independencia entre snapshots.
- Se documentó la migración protegida necesaria para capacidad y peso.
- El Excel de referencia no estaba disponible; no se creó un catálogo experimental.

### Verificaciones reales

- `npm.cmd run test:unit`: 6 archivos, 25/25.
- `npm.cmd run test:csv`: 3 archivos, 25/25.
- `npm.cmd run test:http`: 1 archivo, 14/14.
- `npm.cmd run lint`: aprobado.
- `npm.cmd run typecheck`: aprobado.
- `npm.cmd run build`: aprobado; 13 rutas/páginas.

### Pendientes

- Recibir y perfilar el Excel de referencia en modo lectura.
- Aprobar y ejecutar la migración de capacidad/peso antes de calcular ocupación real.
- Construir gráficos en M2 usando los contratos ya expuestos.
- No hacer commit, push ni merge sin autorización.

## 2026-10-24 - Bloque E0

### Objetivo

Crear una referencia maestra para programadores y asistentes de IA, un catálogo de ampliaciones y un README reproducible en Windows, sin implementar negocio nuevo.

### Auditoría

- Se inspeccionaron 84 archivos técnicos versionados en los directorios solicitados y ocho artefactos de configuración/control.
- Se contrastaron diez endpoints, contratos Zod, encabezados de ocho CSV, dos snapshots, servicios, repositorio, frontend y pruebas.
- Se confirmó que varios documentos históricos citados por el encargo no existían en el commit de partida.
- Se confirmó sin revelar valores que `.env.local` está versionado y contiene configuración sensible no vacía.

### Documentos

- Creado `docs/INFORME_TECNICO_MAESTRO.md`.
- Creado `docs/CONTEXTO_IA.md`.
- Creado `docs/CATALOGO_TAREAS_TECNICAS.md`.
- Reescrito `README.md`.
- Creado `docs/ESTADO.md`.
- Creado `docs/BITACORA.md`.
- Generadas y verificadas las copias PDF del informe maestro y del resumen E0.

### Decisiones

- Markdown es la fuente principal.
- La interfaz continúa sin acceso directo a archivos.
- Funcionalidad actual y propuestas futuras se documentan por separado.
- E0 no modifica contratos, datos demostrativos, dependencias ni código de negocio.
- El saneamiento de secretos se documenta, pero se reserva al líder porque requiere rotación y una decisión Git explícita.

### Verificaciones reales

- `npm.cmd run test:unit`: 6 archivos, 22/22.
- `npm.cmd run test:csv`: 3 archivos, 25/25.
- `npm.cmd run lint`: aprobado.
- `npm.cmd run typecheck`: aprobado.
- `npm.cmd run build`: aprobado; 13 rutas/páginas.
- `npm.cmd run test:http`: la ejecución normal fue bloqueada por otro `next dev` del mismo proyecto. En una copia aislada se ejecutaron los casos, pero hubo timeouts de 5 s: primer intento 13/14 y segundo 12/14. No se declara aprobada.

### Pendientes

- Retirar y rotar `.env.local` antes de compartir.
- Repetir HTTP en un entorno sin servidor activo y con condiciones de arranque normales.
- No hacer commit ni push sin autorización.
