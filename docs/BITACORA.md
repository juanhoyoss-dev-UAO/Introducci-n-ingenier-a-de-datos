# Bitácora técnica

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
