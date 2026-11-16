# Bitácora técnica

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
