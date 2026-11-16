# Informe de ejecución M5

## Resultado

M5 implementa un motor reproducible de alertas operativas y un centro de monitoreo dentro del dashboard. Las alertas son derivadas, no se almacenan ni modifican snapshots, y se recalculan cada vez que cambia la versión seleccionada.

Rama de trabajo: `feature/admin-inspector`. Commit de partida: `1181a99`. No se realizaron commit, push, merge, rebase ni despliegue.

## Motor y contratos

`src/contracts/types/alerts.ts` define:

- tipos y severidades;
- umbrales configurables;
- entrada operacional independiente de React;
- evidencia temporal explícita;
- alerta con identificador, centro, producto opcional, título, descripción, valor, umbral, unidad, acción, referencia, evaluación y estado;
- agregados por severidad, centro y tipo;
- temporalidad desconocida separada de las alertas activas.

`src/domain/alerts.ts` implementa una función pura. Recibe `evaluado_en`; no consulta el reloj. El identificador usa `tipo + centro + sujeto`, por lo que una situación conserva identidad entre evaluaciones y versiones. El resultado se deduplica y ordena por severidad, prioridad, centro, producto e identificador.

## Reglas y umbrales

| Condición | Regla | Severidad |
| --- | --- | --- |
| Cobertura | menor a 30 % | crítica |
| Cobertura | desde 30 % y menor a 70 % | advertencia: déficit importante |
| Cobertura | desde 70 % y menor a 100 % | informativa: déficit moderado |
| Cobertura | 100 % o más, u objetivo cero | sin alerta |
| Voluntariado | disponibles menor que requeridos | advertencia |
| Donación | pendiente después de llegada + 60 min | advertencia |
| Desactualización | evidencia válida anterior a más de 240 min | informativa |
| Capacidad | desde 85 % | advertencia |
| Capacidad | desde 95 % | crítica |
| Capacidad | mayor a 100 % | crítica por sobrecapacidad |
| Excedente | excedente transferible positivo | informativa |

La prioridad alta ordena antes dentro de una severidad y aparece en la explicación. No altera la banda: el caso C01/agua con 60 % sigue siendo “déficit importante”.

## Consistencia temporal y operacional

- La hora normal de evaluación se crea en el servidor y la interfaz la presenta en `America/Bogota`.
- Fechas sin `Z` u offset son rechazadas o ignoradas según correspondan a evaluación o evidencia.
- `registrado_en` de movimientos M4 es la única evidencia disponible de actualización de inventario.
- Cuando no hay evidencia, el resultado declara información temporal desconocida y no fabrica una alerta.
- Cobertura, déficit, capacidad, excedente y voluntariado provienen del servicio consolidado M1.
- Donaciones pendientes no se suman al inventario y las recibidas no quedan retrasadas.
- Cada evaluación referencia un solo snapshot o escenario.

## API e interfaz

`GET /api/dashboard` conserva todos sus campos y añade `alertas`. La ruta continúa protegida por la sesión administrativa, no acepta escrituras y devuelve la misma hora en datos y metadatos.

La pestaña “Alertas operativas” incluye:

- total, críticas, advertencias y centros con atención;
- filtros por centro, severidad y tipo;
- detalle con gravedad textual, centro, producto, valor, motivo y acción sugerida;
- navegación al apartado relacionado;
- aviso de temporalidad desconocida;
- estado vacío verificable;
- presentación responsive sin depender sólo del color.

El Resumen operativo añade alertas activas, alertas críticas y centros con atención. La recarga coordinada M3/M4 selecciona la nueva versión y vuelve a consultar el dashboard, por lo que no conserva alertas obsoletas.

## Evidencia de recálculo

En el snapshot A original, agua C01 tiene 12.000 ml de 20.000 ml: cobertura 60 %, déficit 8.000 ml y alerta importante. La validación aislada confirmó D01 por 6.000 ml. La versión nueva pasó a 18.000 ml, cobertura 90 %, déficit 2.000 ml y alerta moderada. La alerta de retraso D01 desapareció y el total del snapshot bajó de 15 a 14.

El snapshot B se evaluó de forma independiente con 5 alertas. También se comprobaron filtros, estado vacío, viewport de 390 px, ausencia de desbordamiento del documento y consola sin errores.

Evidencias visuales:

- `output/screenshots/M5-alerta-recalculada.png`
- `output/screenshots/M5-alertas-responsive.png`

## Pruebas ejecutadas

| Verificación | Resultado |
| --- | --- |
| `npm.cmd run test:unit` | 7 archivos, 47/47 |
| `npm.cmd run test:csv` | 3 archivos, 34/34 |
| `npm.cmd run test:http` | 1 archivo, 20/20 en repetición final |
| `npm.cmd run lint` | aprobado |
| `npm.cmd run typecheck` | aprobado en ejecución aislada |
| `npm.cmd run build` | aprobado, 16 rutas/páginas |

Una ejecución HTTP anterior aprobó 19/20: la funcionalidad devolvió correctamente 401, pero la prueba esperaba `AUTH_REQUIRED` y el contrato existente usa `UNAUTHENTICATED`. Se corrigió únicamente la expectativa. Una ejecución de typecheck paralela al build coincidió con la regeneración de `.next/types`; la repetición aislada aprobó.

## Archivos por responsabilidad

- `src/contracts/types/alerts.ts`: contrato de entrada, salida, umbrales, alertas y agregados.
- `src/domain/alerts.ts`: reglas puras, identidad, deduplicación, orden y resumen.
- `src/server/services/dashboard.ts`: adaptación desde indicadores y movimientos hacia el motor.
- `src/app/api/dashboard/route.ts`: hora real de evaluación y metadatos.
- `src/app/dashboard/types.ts`: extensión compatible del bundle cliente.
- `src/app/dashboard/view-model.ts`: indicadores de alertas filtrados para el resumen.
- `src/app/dashboard/components/alert-center.tsx`: centro de monitoreo, filtros y navegación.
- `src/app/dashboard/components/metric-cards.tsx`: tres tarjetas nuevas.
- `src/app/dashboard/components/operational-summary.tsx`: enlace al centro de alertas.
- `src/app/dashboard/dashboard-client.tsx`: pestaña e integración con la recarga existente.
- `tests/unit/alerts.test.ts`: límites, tiempo, capacidad, identidad, unidades y configuración.
- `tests/unit/dashboard-view-model.test.ts`: contrato y resumen del cliente.
- `tests/integration/csv-repository.test.ts`: aislamiento y recálculo tras recepción.
- `tests/http/endpoints.test.ts`: autenticación y recálculo tras recepción/despacho.
- `docs/ESTADO.md`, `docs/BITACORA.md`, `docs/REGLAS_NEGOCIO.md` y `docs/CONTEXTO_IA.md`: checkpoint y reglas vigentes.

## Limitaciones y preparación

- No existe historial persistente, reconocimiento manual ni notificación externa.
- Los datos actuales no permiten calcular capacidad, así que no se muestran alertas falsas de ocupación.
- La antigüedad de necesidades y voluntariado queda desconocida porque sus registros no tienen fecha propia.
- M6 puede agregar análisis temporal usando acontecimiento, registro y evaluación como tiempos separados.
- M7 puede reutilizar el motor sin cambios de reloj, pasando `referencia_tipo = escenario` y una hora ficticia.

M5 queda completado y detenido en el alcance autorizado.
