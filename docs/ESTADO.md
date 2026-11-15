# Estado del proyecto

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
