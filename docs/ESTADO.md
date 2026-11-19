# Estado del proyecto

## Checkpoint Fase 2.2 — multiproducto preparado localmente; Google pendiente de autorización

- Modelo retrocompatible: `donaciones_qr.csv` conserva una fila por artículo; `respuesta_origen_id` agrupa la donación y `anuncio_id` permanece como identidad estable del artículo. El anuncio monoproducto existente conserva su identificador.
- Atomicidad: una respuesta de Forms crea de uno a cinco artículos en una sola versión; el reintento compara la donación completa y no duplica filas.
- Recepción: cada artículo reutiliza la operación atómica existente, limita la cantidad al saldo pendiente y recalcula inventario, cobertura y alertas solamente al confirmar la entrega física.
- Interfaz: donaciones agrupadas y expandibles, estado general derivado de sus artículos, filtros por centro/producto/estado y cantidades separadas por producto y unidad.
- Google preparado, no ejecutado: el Apps Script reutiliza el formulario, preserva preguntas y respuestas, añade cuatro pares opcionales, migra la hoja normalizada de A:H a A:J insertando columnas y bloquea la escritura si cambian los enlaces QR.
- Verificaciones locales: 20/20 pruebas de Google/QR, 28/28 pruebas CSV, lint, typecheck y análisis sintáctico del Apps Script aprobados.
- Pendiente: autorización expresa para modificar el formulario y la hoja reales; después deben comprobarse una donación real de tres artículos y una recepción parcial por artículo. Fase 2.2 aún no terminada.

## Checkpoint Fase 2.1 — conexión real Google Sheets → Next.js completada

- Estado: Google Forms publicado, hoja vinculada, seis enlaces prerrellenados, seis PNG QR reales y sincronización autenticada desde Next.js operativos.
- Recurso Google: `Redes de Ayuda — Respuestas de donaciones`, con seis centros, 32 productos y 40 presentaciones reales de M6.5, guía y configuración operativa.
- Integración: lectura oficial de Sheets con JWT de cuenta de servicio, alcance `spreadsheets.readonly`, credencial absoluta fuera del repositorio y sincronización manual o periódica entre 30 y 60 segundos.
- Idempotencia: cada respuesta usa el ID real de Google Forms como identidad estable; los reintentos no duplican anuncios ni inventario y las filas inválidas se aíslan sin detener las demás.
- Protección: MAIN se rechaza antes de consultar Google; PRUEBAS publica versiones inmutables y conserva los anuncios separados del inventario hasta una recepción administrativa.
- Interfaz: `Sincronizar ahora` y actualización periódica integradas en Donaciones esperadas, con estado explícito de configuración pendiente o activa.
- Automatización ejecutada: `scripts/google/setup-donations-form.gs` creó/publicó el formulario, lo vinculó a la hoja, instaló el disparador idempotente y generó los seis enlaces por centro. El primer intento reveló que `getDestinationId()` lanza una excepción sin destino; el manejo fue corregido y la repetición terminó correctamente.
- QR: `data/demo/google-donations/` contiene `QR-C01.png` a `QR-C06.png` y una página HTML imprimible que identifica claramente cada centro.
- Seguridad: cuenta de servicio lectora y JSON absoluto fuera del repositorio; configuración local ignorada por Git. `.env.local` fue retirado del índice sin borrar el archivo local. Los secretos administrativos expuestos históricamente todavía deben rotarse antes de distribuir la base.
- Sincronización real: la respuesta C01 / FRIJOL-5000 / 5 paquetes se publicó desde Google Sheets en la versión PRUEBAS `2485361d-0221-5be5-a4ff-0d1d7d33cf7d`; permanece anunciada, con cero paquetes recibidos y cinco pendientes.
- Integridad: inventario y movimientos no cambiaron, MAIN permaneció idéntico y la repetición fue idempotente sin crear otra versión.
- Verificaciones: estructura de credencial válida sin exponer valores; configuración 45 s; pruebas unitarias 103/103 y ejecución real dirigida aprobada tras ajustar una comparación del arnés temporal a la reidentificación normal de filas por snapshot. Verificaciones permanentes de cierre registradas en la bitácora.
- Sin commit, push, merge o rebase; no se generó PDF por instrucción expresa de la fase.

## Checkpoint Fase 2 — Bloque 1

- Estado: módulo local de Donaciones esperadas implementado; integración Google y validación integral todavía no iniciadas.
- Modelo: los anuncios QR se almacenan separados de `intenciones.csv`, con cantidades anunciada, recibida y pendiente, cuatro estados, fuente e identificador estable de origen.
- Persistencia: las versiones nuevas escriben `donaciones_qr.csv`; los snapshots anteriores sin ese archivo continúan cargando una colección vacía y los 352 eventos M6.5 permanecen intactos.
- Recepción: confirmar parcial o totalmente reutiliza el servicio M4, publica una versión atómica e idempotente, actualiza inventario y permite recalcular alertas sin incorporar anuncios antes de la entrega física.
- Interfaz: restaurada únicamente la pestaña Donaciones esperadas, con indicadores, filtros, comparación por producto/unidad, tabla, recepción parcial/completa y cancelación; MAIN se mantiene de solo lectura.
- Política de reinicio: el reinicio explícito de PRUEBAS desde MAIN abre una rama nueva sin anuncios QR ni movimientos; las versiones anteriores permanecen inmutables y conservan sus anuncios y recepciones para trazabilidad.
- Verificaciones: unitarias 97/97, CSV 36/36, módulo/A4/navegación 11/11 y compatibilidad A3 + módulo 5/5; lint y typecheck aprobados. Sin HTTP completo, build ni verificación interactiva.
- Pendiente: Bloque 2 debe configurar Google Forms, Sheets, permisos, QR y sincronización real; no hay credenciales ni recursos Google conectados todavía.
- Sin commit, push, merge o rebase; no se generó PDF por instrucción expresa de la fase.

## Checkpoint A4.2

- Estado: resolución individual de alertas de déficit implementada; A4.3, A4.4 y M7 no iniciados.
- Interfaz: retirada la franja oscura de Alertas operativas y reemplazada por título y hora de evaluación compactos.
- Recepción: cada déficit de producto en PRUEBAS abre un modal con datos precargados, presentación, paquetes enteros positivos, hora operativa y vista previa en unidad base.
- Persistencia: el formulario reutiliza `direct_reception` de M4; publica una versión atómica, registra un solo movimiento, recarga indicadores y deja que el motor determine si la alerta continúa o desaparece.
- Experiencia: el grupo abierto se conserva durante la recarga y el resultado posterior informa inventario/cobertura reales, déficit, excedente y cambio de severidad.
- Protección: MAIN no ofrece guardado y el backend mantiene `SCENARIO_READ_ONLY`; el UUID estable y el bloqueo durante el envío evitan duplicados.
- Verificaciones A4.2: 33/33 pruebas dirigidas, lint y typecheck aprobados. El caso real P27/C01 pasó de 0/12 a 3/12 y luego a 12/12, eliminando el déficit; el reintento fue idempotente.
- Sin HTTP completo, build ni verificación interactiva de navegador; sin commit, push, merge o rebase.

## Checkpoint A4.1

- Estado: agrupación visual del Centro de alertas implementada; A4.2, A4.3 y A4.4 no iniciados.
- Interfaz: cuatro grupos cerrados inicialmente, con conteos de alertas, críticas y centros, gravedad máxima, orden por severidad/volumen y detalle bajo demanda.
- Catálogo: los 32 productos M6.5 se asignan explícitamente desde sus identificadores y ocho categorías reales; no se infieren categorías a partir de nombres.
- Alertas: déficits y excedentes permanecen en el grupo de su producto; los excedentes se distinguen como oportunidades de abastecimiento y las condiciones no asociadas a escasez se concentran en Otras alertas operativas.
- Filtros: centro, severidad y tipo actualizan los cuatro grupos sin cerrar los que el administrador abrió.
- Compatibilidad: no se modificaron motor de alertas, contratos, persistencia, Resumen operativo ni importador A3.
- Verificaciones A4.1: unitarias 78/78, prueba dirigida 25/25, lint y typecheck aprobados. Sin verificación interactiva de navegador en esta ejecución.
- Sin commit, push, merge ni rebase.

## Checkpoint A3

- Estado: importación XLSX de recepciones confirmadas implementada sobre una rama de datos PRUEBAS independiente; M7 no iniciado.
- Escenarios: MAIN conserva íntegros el cierre, movimientos y eventos M6.5 y rechaza mutaciones; PRUEBAS parte del mismo inventario final con historial nuevo vacío y trazabilidad a MAIN.
- Excel: plantilla exacta y diez archivos secuenciales en `data/demo/a3/`, con horas del 16 de noviembre de 2026 en `America/Bogota`, manifiesto y resultados reales.
- Integridad: máximo 1 MB y 100 filas, hoja/columnas exactas, referencias de catálogo, UUID, fecha con `-05:00`, cantidad entera positiva, lote atómico e idempotencia por operación.
- Recalculo: cada importación publica una sola versión, usa el reloj del escenario y compara inventario, cobertura, déficit y alertas antes/después.
- Resultado secuencial: 10/10 archivos válidos, seis alertas resueltas y ocho reducciones de severidad; cada reimportación fue reconocida sin duplicar existencias y MAIN permaneció sin cambios.
- Verificaciones A3: unitarias 73/73; integración dirigida 24/24; lint y typecheck aprobados. Los 11 XLSX y sus 12 hojas fueron renderizados e inspeccionados; la interfaz A3 no se declara verificada porque la ventana accesible correspondía a una instancia anterior.
- Dependencias: `read-excel-file@9.3.14` para lectura XLSX sin ejecutar fórmulas y `vite@7.2.2` como dependencia de desarrollo requerida por Vitest.
- Demostración: `docs/DEMO_A3.md`. Sin commit, push, merge ni rebase.

## Checkpoint M6.5

- Estado: escenario semanal integral SIMULADO implementado y listo para analisis; M7 no iniciado.
- Periodo: 9 al 15 de noviembre de 2026 en `America/Bogota`, con seis centros y dos snapshots nuevos (inicio y semana completa). Los snapshots A y B permanecen intactos.
- Catalogo: 32 productos y 40 presentaciones en ocho categorias. El Excel de referencia no estaba disponible; ninguna fila se atribuye a ese archivo.
- Volumen: 352 eventos, 80 anuncios, 90 recepciones, 57 despachos, 84 evaluaciones de voluntariado y 42 cambios de necesidad.
- Temporalidad: reconstruccion fisica completa al cierre, registros demorados, perspectiva informativa diferenciada y alertas evaluadas con hora simulada.
- Generacion: configuracion versionada, semilla fija, staging, validaciones previas e idempotencia por comparacion exacta.
- Integracion: el dashboard puede seleccionar el escenario y el corte temporal se inicializa desde la fecha del snapshot, no desde el reloj real del equipo.
- Pruebas M6.5: unitarias 67/67, CSV 36/36, escenario 5/5, HTTP 23/23, lint, typecheck y build aprobados. Las dos primeras corridas HTTP no ejecutaron casos por aislamiento de sockets; la corrida fuera de ese aislamiento aprobo completa.
- Verificacion visual: no ejecutada porque esta sesion no expuso control de navegador. Las consultas HTTP reales validaron 6 centros, 32 productos, 80 intenciones y 352 eventos aplicados.
- Rama: `feature/admin-inspector`; commit de partida `0c57659`; sin commit, push, merge ni rebase.
- Informe detallado: `docs/ESCENARIO_SEMANAL_M6_5.md`.

## Checkpoint M5

- Estado: motor puro de alertas y centro de monitoreo integrados; simulación temporal e historial persistente de alertas no iniciados.
- Evaluación: cada cálculo recibe `evaluado_en` explícito y no ambiguo; el dominio no consulta el reloj del sistema. La aplicación normal inyecta la hora desde el servidor y la interfaz la presenta en `America/Bogota`.
- Reglas: cobertura por límites 30/70/100, voluntariado faltante, donaciones pendientes con 60 minutos de tolerancia, información desactualizada después de cuatro horas con evidencia válida, capacidad 85/95/>100 y excedente transferible informativo.
- Consistencia: las alertas reutilizan indicadores M1 y movimientos M4, no suman donaciones pendientes al inventario, no mezclan snapshots ni unidades y desaparecen al dejar de cumplirse.
- Identidad: los identificadores dependen de tipo, centro y sujeto operativo, no de UUID aleatorio ni de la hora de consulta; el orden es estable por severidad, prioridad, centro, producto e identificador.
- API: `/api/dashboard` conserva sus campos y añade resumen, distribución y detalle de alertas; sigue protegido por sesión administrativa y no publica datos.
- Interfaz: nueva pestaña “Alertas operativas”, filtros por centro/severidad/tipo, estado vacío, navegación contextual y tres indicadores nuevos en el resumen.
- Pruebas M5: unitarias 47/47, CSV 34/34, HTTP 20/20, lint, typecheck y build aprobados. Una corrida HTTP anterior aprobó 19/20 por esperar un nombre de error distinto; se ajustó la prueba al contrato real `UNAUTHENTICATED` sin modificar autenticación.
- Verificación visual: snapshots A/B, filtros, estado vacío y responsive comprobados. Tras confirmar D01 en runtime aislado, las alertas pasaron de 15 a 14 y agua C01 cambió de 60 %/importante a 90 %/moderado; consola sin errores.
- Evidencias: `output/screenshots/M5-alerta-recalculada.png`, `output/screenshots/M5-alertas-responsive.png` y `output/pdf/INFORME_M5.pdf`.
- Rama: `feature/admin-inspector`; commit de partida `1181a99`; M5 permanece sin commit, push ni merge.

## Checkpoint M4

- Estado: recepciones, confirmación de donaciones, despachos e historial de movimientos implementados; simulación temporal no iniciada.
- Persistencia: las versiones nuevas incluyen `movimientos.csv`; los datasets anteriores sin ese archivo cargan un historial vacío y no fueron modificados.
- Atomicidad: inventario, estado de la intención y movimiento se validan y publican dentro del mismo snapshot mediante staging y rename.
- Idempotencia: el UUID de operación determina de forma estable el UUID de la versión; repetir la misma solicitud devuelve la versión existente y reutilizar la clave con otros datos se rechaza.
- Donaciones: una confirmación conserva cantidad anunciada, cantidad recibida y diferencia; la intención cambia a `recibida` y deja de agregarse como pendiente.
- Interfaz: nueva pestaña “Movimientos y recepciones” para confirmar anuncios, registrar recepciones directas, despachos y consultar historial por centro/fecha.
- Fechas: se distinguen `ocurrido_en` y `registrado_en`; la interfaz registra acontecimientos con offset de `America/Bogota`.
- Alcance: traslados ejecutados, simulación, alertas y gráficos históricos permanecen pendientes.
- Pruebas M4: unitarias 27/27, CSV 34/34, HTTP 19/19, lint, typecheck y build aprobados. La primera ejecución HTTP tuvo dos timeouts M3 de 5 s; se ajustaron esas pruebas secuenciales a 10 s y la repetición aprobó completa.
- Verificación visual: confirmación D01 comprobada en runtime aislado; inventario 18.000 ml, déficit 2.000 ml, cobertura 90 % y una donación pendiente; consola sin errores.
- Evidencias: `output/screenshots/M4-movimiento-confirmado.png`, `output/screenshots/M4-indicadores-actualizados.png` y `output/pdf/INFORME_M4.pdf`.
- Rama: `feature/admin-inspector`; commit de partida `906ecae`; M3 y M4 permanecen sin commit, push ni merge.

## Checkpoint M3

- Estado: actualización operativa administrativa implementada mediante versiones inmutables; M4 no iniciado.
- Persistencia: cada operación clona el snapshot seleccionado, asigna un UUID nuevo, aplica un único cambio, valida el conjunto completo y lo publica atómicamente en `data/runtime`; el snapshot fuente permanece intacto.
- Operaciones: creación/edición/activación de centros, actualización de paquetes confirmados, actualización o cierre de necesidades con objetivo cero y actualización de voluntarios disponibles/requeridos.
- Seguridad: `POST /api/snapshots/[id]/operations` exige sesión administrativa, origen válido, UUID y cuerpo Zod estricto; las referencias inexistentes y cantidades negativas se rechazan sin publicar datos parciales.
- Interfaz: formularios administrativos integrados en las tablas, estados de guardado/error/éxito, selección automática de la nueva versión y recarga coordinada de tablas, tarjetas y gráficos.
- Compatibilidad: no se modificaron esquemas CSV, snapshots demostrativos, autenticación, fórmulas M1/M2 ni dependencias.
- Pruebas M3: unitarias 27/27, CSV 29/29, HTTP 16/16 en repetición aislada, lint, typecheck y build aprobados. Una ejecución HTTP previa agotó 5 s en cinco casos sin fallos de aserción.
- Verificación visual: guardado de inventario y resumen actualizado comprobados en un runtime aislado; consola sin errores y datos QA eliminados al terminar.
- Evidencias: `output/screenshots/M3-inventario-guardado.png`, `output/screenshots/M3-graficos-actualizados.png` y `output/pdf/INFORME_M3.pdf`.
- Rama: `feature/admin-inspector`; commit de partida `906ecae`; sin commit, push ni merge de M3.

## Checkpoint M2

- Estado: dashboard analítico y visual implementado sobre los contratos de M1; M3 no iniciado.
- Interfaz: nuevo resumen operativo con seis tarjetas, cuatro gráficos comparativos y filtros por snapshot, centro y producto.
- Compatibilidad: las seis secciones tabulares originales continúan disponibles y ambos snapshots demostrativos funcionan sin alterar sus datos.
- Reglas visuales: cobertura no calculable se muestra como N/D, valores superiores a 100 % se conservan y recursos anunciados permanecen separados del inventario confirmado.
- Arquitectura: transformaciones de presentación centralizadas en el modelo de vista y componentes gráficos reutilizables, sin dependencias nuevas ni fórmulas de negocio duplicadas en React.
- Pruebas M2: unitarias 27/27, CSV 25/25, HTTP 14/14, lint, typecheck y build aprobados; validación visual sin errores de consola.
- Evidencias: `output/screenshots/M2-resumen-operativo.jpg`, `output/screenshots/M2-graficos.jpg` e `output/pdf/INFORME_M2.pdf`.
- Rama: `feature/admin-inspector`; commit de partida `529729e`; sin commit, push ni merge de M2.

## Checkpoint M1

- Estado: indicadores analíticos y contratos para visualizaciones implementados; gráficos no implementados.
- API de dashboard: conserva los campos anteriores y añade centros activos, cobertura, déficit potencial, capacidad y cuatro colecciones para visualizaciones futuras.
- Capacidad: cálculo de dominio listo; todos los centros actuales informan estado no calculable porque los CSV todavía no contienen capacidad máxima ni peso por presentación.
- Persistencia: sin cambios en esquemas, encabezados, templates ni snapshots. La migración protegida está descrita en `docs/MIGRACION_CAPACIDAD_M1.md`.
- Excel `PMU HERRAMIENTAS LIMONAR CALI 10-08-2026.xlsx`: no disponible en el espacio de trabajo; catálogo experimental pendiente.
- Pruebas M1: unitarias 25/25, CSV 25/25, HTTP 14/14, lint, typecheck y build aprobados.
- Rama: `feature/admin-inspector`; commit de partida `529729e`; sin commit, push ni merge de M1.

## Checkpoint E0

- Estado: documentación técnica completada; verificación HTTP con incidencia de entorno/tiempo.
- Rama auditada: `feature/admin-inspector`.
- Commit de partida: `e662241`.
- Aplicación: Next.js 16.4.3, React 19.3.1, TypeScript, Tailwind y persistencia CSV/JSON.
- Datos: dos snapshots demostrativos independientes.
- Seguridad: autenticación local con scrypt, cookie firmada y guard administrativo.
- Interfaz: dashboard protegido con seis secciones, snapshot y filtro de centro.
- API: health, autenticación y seis consultas operativas.
- Pruebas E0: unitarias 22/22, CSV 25/25, lint, typecheck y build aprobados. HTTP no aprobado en esta ejecución por bloqueo de servidor activo y timeouts de 5 s en copia aislada.

## Documentación vigente

- `README.md`: instalación y uso en Windows.
- `docs/INFORME_TECNICO_MAESTRO.md`: referencia principal.
- `docs/CONTEXTO_IA.md`: entrada para asistentes.
- `docs/CATALOGO_TAREAS_TECNICAS.md`: misiones futuras.
- `docs/REGLAS_NEGOCIO.md`: reglas implementadas.

## Riesgo bloqueante antes de entregar a compañeros

`.env.local` está versionado y contiene credenciales/configuración no vacías. El líder debe retirar el archivo del índice, añadir reglas de ignore y rotar el secreto y la contraseña antes de distribuir la base. E0 no expuso valores ni ejecutó la corrección.

## Pendiente de decisión

1. Saneamiento de `.env.local` y selección de un commit común seguro.
2. Repetir `test:http` en un checkout sin otro servidor Next activo.
3. Asignar una tarea del catálogo a cada compañero.
4. No iniciar capacidad, recepciones, jornadas, importación ni M3 sin misión aprobada.
