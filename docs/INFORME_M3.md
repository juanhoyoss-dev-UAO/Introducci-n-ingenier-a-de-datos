# Informe de ejecución M3

Fecha: 2026-11-15  
Rama: `feature/admin-inspector`  
Commit de partida: `906ecae`

## Resultado

M3 quedó implementado como actualización administrativa por versiones inmutables. Cada guardado parte del snapshot seleccionado, crea una versión operativa nueva, valida el conjunto de datos antes de publicarlo y mantiene sin cambios el snapshot fuente. M4 no fue iniciado.

## Estrategia de versionado

1. El cliente envía una operación tipada y el identificador del snapshot fuente.
2. La API exige sesión administrativa, origen válido, UUID y cuerpo Zod estricto.
3. El servicio obtiene y clona el bundle completo.
4. Se genera un UUID nuevo y se registra en la descripción el snapshot del que deriva.
5. Se aplica una sola operación y se validan todas las entidades y referencias.
6. El repositorio publica atómicamente en `data/runtime` usando el mecanismo CSV existente.
7. El cliente recibe la nueva metadata, selecciona la versión y recarga tablas, tarjetas y gráficos.

Esta estrategia no agrega campos a los CSV ni sobrescribe snapshots demostrativos.

## Funciones incorporadas

- Centros: crear, editar, activar o desactivar. No se permite eliminación y la desactivación preserva relaciones.
- Inventario: actualizar paquetes físicos confirmados por centro y presentación. Las donaciones esperadas no se incorporan al inventario.
- Necesidades: actualizar objetivo y prioridad; objetivo cero representa una necesidad cerrada.
- Voluntariado: actualizar disponibles y requeridos; el déficit se recalcula en dominio.

Los formularios muestran estados de guardado, errores normalizados y confirmación de éxito. Un guardado exitoso selecciona automáticamente la versión creada y conserva filtros que siguen siendo válidos.

## Contratos y API

- Contrato: unión discriminada `OperationalUpdate` con validación estricta y cantidades no negativas.
- Endpoint: `POST /api/snapshots/[id]/operations`.
- Respuesta: metadata de la versión publicada y referencia explícita al snapshot fuente.
- Rechazos sin publicación: sesión ausente, origen foráneo, UUID inválido, operación inválida, referencia inexistente o error de persistencia.

## Archivos de implementación

- `src/contracts/schemas/operational-updates.ts`: contrato y validaciones.
- `src/server/services/operational-updates.ts`: clonación, reglas referenciales y publicación.
- `src/server/repositories/types.ts` y `csv-operations.ts`: lectura interna del bundle para versionado.
- `src/app/api/snapshots/[id]/operations/route.ts`: API protegida.
- `src/app/dashboard/components/administrative-editor.tsx`: formularios administrativos.
- `src/app/dashboard/dashboard-client.tsx`, `types.ts` y `components/dashboard-status.tsx`: integración, recarga y estados.
- `tests/integration/csv-repository.test.ts` y `tests/http/endpoints.test.ts`: cobertura de persistencia, API y seguridad.

## Verificación

- Unitarias: 27/27.
- Integración CSV: 29/29.
- HTTP: 16/16 en repetición aislada. La ejecución inmediatamente anterior tuvo cinco timeouts de 5 s; once pruebas pasaron y no se registró ninguna aserción funcional fallida.
- Lint: aprobado.
- TypeScript: aprobado.
- Build Next.js: aprobado, 15 rutas/páginas.
- Navegador: versión creada y seleccionada, mensaje de éxito, actualización analítica y consola sin errores.

El caso de referencia C01/agua confirma que una versión nueva puede consolidar 18.000 ml, necesidad de 20.000 ml, déficit de 2.000 ml y cobertura de 90 %, mientras el snapshot fuente conserva 12.000 ml, déficit de 8.000 ml y la donación anunciada de 6.000 ml separada.

## Limitaciones y preparación para M4

- No hay historial de eventos separado del historial de snapshots.
- No hay operaciones masivas, importación Excel desde la interfaz ni edición de catálogos.
- La capacidad de almacenamiento sigue como no calculable hasta recibir capacidad por centro y pesos por presentación.
- M4 puede consumir las versiones publicadas sin cambiar los contratos analíticos existentes, pero requiere una misión aprobada antes de iniciar.

## Evidencia visual

- `output/screenshots/M3-inventario-guardado.png`
- `output/screenshots/M3-graficos-actualizados.png`

No se realizaron commit, push, merge ni despliegue.
