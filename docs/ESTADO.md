# Estado del proyecto

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
4. No iniciar capacidad, recepciones, jornadas, importación o gráficos sin misión aprobada.
