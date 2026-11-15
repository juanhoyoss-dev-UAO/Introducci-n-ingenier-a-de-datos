# Estado del proyecto

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
