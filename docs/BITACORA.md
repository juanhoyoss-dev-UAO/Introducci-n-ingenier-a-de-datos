# Bitácora técnica

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
