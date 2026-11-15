# Redes de Ayuda - Informe de ejecucion M0

**Fecha:** 2026-11-15  
**Alcance:** consolidacion y preparacion de M1  
**Resultado:** M0 completado. M1 no fue implementado.

## 1. Estado de Git

- Rama actual: `feature/admin-inspector`.
- Commit actual: `529729edd92bb35037ed827210aca4c7494786a8` (`E0`).
- Seguimiento remoto: `origin/feature/admin-inspector`, sin commits por enviar ni recibir (`0/0`).
- Arbol de trabajo al iniciar M0: limpio, sin cambios pendientes.
- Relacion con `origin/main`: la rama actual esta un commit por detras y cero por delante. El commit adicional de `main` es de integracion; la comparacion de archivos entre ambos extremos no presenta diferencias.
- No se ejecutaron `merge`, `rebase`, `commit`, `push` ni descartes.

## 2. Riesgos bloqueantes

### Seguridad de configuracion

El problema advertido en E0 continua:

- `.env.local` existe, esta versionado y no esta ignorado por Git.
- Contiene configuracion sensible no vacia. No se imprimieron ni copiaron sus valores.
- El archivo aparece en el historial y en ramas remotas, por lo que las credenciales y secretos deben considerarse expuestos.
- `.env.example` ya existe con marcadores vacios y seguros.

Esto bloquea una publicacion segura hasta retirar el archivo del seguimiento y rotar los secretos. El saneamiento del historial no sustituye la rotacion.

### Fuente Excel de M1

No se encontro `PMU HERRAMIENTAS LIMONAR CALI 10-08-2026.xlsx` en el repositorio ni entre los adjuntos disponibles. Esto no impide cerrar M0, pero bloquea el perfilado y mapeo concreto de la fuente al comenzar M1. El archivo debe proporcionarse para lectura; no se tratara como inventario general ni se modificara.

## 3. Resultado de verificaciones

- No habia un servidor Next.js del proyecto escuchando en el puerto 3000.
- Los procesos Node observados correspondian al entorno de Codex, no a este proyecto.
- No se encontraron indicadores de un servidor de desarrollo activo en `.next/dev`.
- No se detuvo ningun proceso.
- Se ejecuto `npm.cmd run test:http`. La prueba empleo un puerto local aleatorio, credenciales efimeras y copias temporales del runtime.
- Resultado HTTP: **1 archivo aprobado, 14 pruebas aprobadas, 0 fallidas**, duracion 37.93 s.

El fallo HTTP documentado en E0 no se reprodujo en el estado actual. No se ejecutaron suites completas adicionales porque M0 no modifica codigo y la comprobacion aislada fue proporcional al riesgo.

## 4. Correcciones propuestas

La siguiente correccion es **PROTEGIDA** y requiere aprobacion antes de aplicarse:

1. Agregar `.env*` a `.gitignore` y conservar la excepcion `!.env.example`.
2. Ejecutar `git rm --cached -- .env.local` para retirarlo del indice sin borrar el archivo local.
3. Verificar con `git status`, `git check-ignore -v .env.local` y confirmar que `git ls-files --error-unmatch .env.local` ya no lo encuentre.
4. Mantener `.env.example` unicamente con nombres de variables y valores vacios o ejemplos no sensibles.
5. Rotar la contrasena administrativa, su hash y `SESSION_SECRET`; reiniciar los entornos que los consumen. La rotacion debe realizarse aunque posteriormente se sanee el historial.
6. Revisar ramas, copias y despliegues que pudieron recibir los secretos, y revocar los valores anteriores.
7. Evaluar el saneamiento del historial remoto segun visibilidad del repositorio y politica institucional. Si se aprueba, debe planificarse con todos los colaboradores y realizarse en un microbloque independiente con reescritura y `force push` expresamente autorizados.

M0 no aplico ninguno de estos cambios, no reescribio historial y no genero commits.

## 5. Archivos estrictamente necesarios para M1

La clasificacion sigue `docs/CATALOGO_TAREAS_TECNICAS.md`. Los cambios de significado, contratos, persistencia y calculo de capacidad son protegidos; la integracion de interfaz es coordinada.

| Proposito | Archivos candidatos estrictos | Clasificacion |
|---|---|---|
| Definir productos, presentaciones, unidades, peso y vigencia | `src/contracts/schemas/data.ts`, `src/contracts/types/database.ts` | PROTEGIDO |
| Persistir nuevos campos o una referencia catalogica versionada | `src/server/storage/csv.ts`, `src/server/repositories/types.ts`, `src/server/repositories/csv-operations.ts`; `src/server/storage/files.ts` solo si se agrega un archivo | PROTEGIDO |
| Ajustar plantillas, solo despues de aprobar el esquema | `data/templates/productos.csv`, `data/templates/presentaciones.csv`, `data/templates/centros.csv` | PROTEGIDO |
| Normalizar unidades y calcular consolidados, peso, capacidad y ocupacion | `src/domain/inventory.ts` o un modulo de dominio nuevo y acotado | PROTEGIDO |
| Exponer catalogo e indicadores derivados | `src/server/services/operations.ts`, `src/server/services/dashboard.ts` | PROTEGIDO |
| Mantener respuestas de API existentes | `src/app/api/products/route.ts`, `src/app/api/dashboard/route.ts`, solo si cambia la forma de respuesta | COORDINADO |
| Consumir y presentar los nuevos indicadores | `src/app/dashboard/types.ts`, `src/app/dashboard/view-model.ts`, `src/app/dashboard/dashboard-client.tsx` | COORDINADO |
| Verificar formulas, contratos, CSV y API | `tests/unit/inventory.test.ts`, `tests/unit/dashboard-view-model.test.ts`, `tests/integration/csv-validation.test.ts`, `tests/integration/csv-repository.test.ts`, `tests/integration/csv-safety.test.ts`, `tests/http/endpoints.test.ts` | PROTEGIDO / COORDINADO segun contrato afectado |
| Registrar procedencia del Excel sin convertirlo en inventario | Nuevo archivo de referencia o mapeo, con ubicacion y formato previamente aprobados | PROTEGIDO |

No hay cambios de semantica de catalogo, capacidad o vigencia que puedan tratarse como LIBRES. Solo ajustes visuales que no alteren datos ni significado serian LIBRES, y no son necesarios para preparar el nucleo de M1.

El modelo actual solo admite unidades base `ml`, `g` y `unidad`; no existe una tabla de conversion ni un peso por presentacion. La vigencia disponible es `snapshot.created_at`, mientras que las donaciones esperadas tienen `llegada_prevista`. No debe inferirse una conversion entre unidades ni interpretar la fecha del nombre del Excel como inventario o como vigencia global. M1 necesita aprobar una regla explicita de procedencia y temporalidad, preferiblemente separada de los snapshots demostrativos.

Los snapshots originales de demostracion y el Excel de referencia quedan fuera de modificacion.

## 6. Secuencia recomendada de microbloques

1. **M0.2a - higiene de secretos (PROTEGIDO):** con aprobacion, actualizar `.gitignore`, retirar `.env.local` del indice y verificar; sin commit, push ni reescritura. Rotar secretos en los entornos correspondientes.
2. **M1.0 - perfilado de la fuente:** recibir el Excel y revisar en modo lectura hojas, encabezados, productos, presentaciones, unidades, fecha y alcance local. Entregar un mapeo propuesto sin modificar datos.
3. **M1.1 - especificacion canonica:** aprobar identificadores, nombres, unidades base, reglas de presentacion, peso, procedencia y vigencia; decidir si se usa una referencia catalogica separada o una migracion de contrato.
4. **M1.2 - dominio puro:** implementar normalizacion e indicadores consolidados, capacidad maxima, peso y ocupacion con pruebas unitarias, antes de cambiar persistencia.
5. **M1.3 - contratos y almacenamiento:** migracion versionada y pruebas de esquema/CSV. No modificar los snapshots demostrativos originales.
6. **M1.4 - servicios y API:** integrar los calculos en los servicios existentes y verificar endpoints con el procedimiento HTTP aislado.
7. **M1.5 - interfaz:** coordinar tipos, view-model y presentacion de indicadores; realizar validacion funcional y visual.

Cada microbloque debe aprobarse y cerrarse antes de iniciar el siguiente.

## 7. Pruebas ejecutadas

| Verificacion | Resultado |
|---|---|
| Estado y relacion de Git | APROBADA; lectura solamente |
| Deteccion de `.env.local` versionado e ignorado | FALLA DE SEGURIDAD CONFIRMADA |
| Puertos y servidor Next.js activo | APROBADA; no se detecto servidor del proyecto |
| `npm.cmd run test:http` | APROBADA; 14/14 pruebas |
| Inspeccion del Excel de referencia | NO EJECUTADA; archivo no disponible |
| Suites completas de unitarias/integracion | NO EJECUTADAS; no hubo cambios de codigo |

## Archivos modificados por M0

- `docs/INFORME_M0.md`: informe de ejecucion y preparacion de M1.
- `output/pdf/INFORME_M0.pdf`: copia descargable del informe.

No se modificaron codigo, contratos, dependencias, archivos CSV, snapshots, Excel ni configuracion sensible. M0 se detiene aqui a la espera de autorizacion.
