# Contexto inicial para asistentes de IA

## Qué es Redes de Ayuda

Redes de Ayuda es una aplicación académica local para inspeccionar centros de acopio. El frontend y la API usan Next.js App Router, React y TypeScript. La autenticación es local; los datos operativos se guardan en snapshots CSV/JSON y se validan con Zod.

Antes de programar, leer:

1. [README](../README.md) para instalación y ejecución.
2. [Informe técnico maestro](INFORME_TECNICO_MAESTRO.md) para arquitectura, contratos, inventario y riesgos.
3. [Catálogo de tareas](CATALOGO_TAREAS_TECNICAS.md) para localizar la misión.
4. [Reglas de negocio](REGLAS_NEGOCIO.md) para fórmulas.
5. Los archivos reales y pruebas implicados.

La descripción técnica orienta, pero no sustituye revisar el código vigente.

## Estado implementado

- Login de un administrador con scrypt.
- Sesión HMAC en cookie HttpOnly.
- Dashboard protegido con selector de snapshot y centro.
- Seis secciones: centros, inventario, necesidades, voluntarios, donaciones esperadas y tiempos.
- Dos snapshots demostrativos.
- API de sólo lectura para la consola.
- Repositorio CSV con validación y publicación interna segura.
- Logger correlacionado mediante requestId.
- Pruebas unitarias, CSV y HTTP.

No afirmar que existen capacidad, recepciones horarias, importación, gráficos, comparación de jornadas, endpoints de escritura o simulación interactiva.

## Arquitectura resumida

```text
React -> Route Handler -> autorización -> servicio -> OperationsRepository
      -> CsvOperationsRepository -> storage -> CSV/JSON
```

- `src/app`: páginas, componentes del dashboard y API.
- `src/contracts`: Zod y tipos.
- `src/domain`: reglas puras.
- `src/server/auth`: credenciales, hash, sesión y guard.
- `src/server/services`: casos de uso y HTTP.
- `src/server/repositories`: interfaz y CSV.
- `src/server/storage`: archivos y encabezados.
- `data`: templates, demo y runtime.
- `tests`: unitarias, integración y HTTP.

## Reglas protegidas

No modificar sin autorización:

- hash scrypt, firma o cookie de sesión;
- `requireAdministrator`;
- esquemas y encabezados CSV;
- aislamiento por `snapshot_id`;
- referencias y unicidad del bundle;
- fórmulas de inventario, déficit, excedente y voluntarios;
- separación entre inventario confirmado y donaciones pendientes;
- publicación mediante staging, relectura y rename;
- sanitización del logger.

La UI no lee archivos. Las reglas nuevas pertenecen al dominio/servicio y deben llegar por API.

## Convenciones

- TypeScript estricto; alias `@/`.
- App Router y Route Handlers.
- Respuesta de éxito: `{ data, meta }`.
- Error: `{ error: { code, message, details? } }`.
- UUID para snapshot; IDs de negocio aislados por snapshot.
- Funciones puras para transformaciones comprobables.
- Pruebas junto al nivel que protegen.
- Registros breves, sin contraseñas, cookies, hashes ni secretos.
- No añadir dependencias sin aprobación.

## Clasificación de edición

- **LIBRE:** estilo y presentación local sin alterar datos.
- **COORDINADO:** componentes compartidos, view models, tipos cliente, rutas y documentación.
- **PROTEGIDO:** auth, contratos, dominio, servicios, repositorios, storage y datos.
- **GENERADO/PRIVADO:** entorno, runtime, build, dependencias, cobertura y logs.

Los compañeros pueden experimentar en ramas personales, pero el núcleo protegido requiere revisión.

## Git

- Comprobar `git status`, rama y commit antes de editar.
- Partir de la base aprobada por el líder.
- No trabajar en `main`.
- No mezclar misiones.
- No ejecutar merge, rebase, push o acciones destructivas sin autorización.
- Preservar cambios ajenos.

Riesgo actual: el commit auditado versiona `.env.local` con valores no vacíos. No mostrar sus valores. La base no debe entregarse hasta que el líder lo retire del índice y rote credenciales.

## Pruebas obligatorias

Escoger las proporcionales y reportar sólo resultados ejecutados:

```powershell
npm.cmd run test:unit
npm.cmd run test:csv
npm.cmd run test:http
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Cambios visuales requieren validación en navegador. Cambios de contratos/persistencia requieren pruebas CSV. Cambios de ruta requieren HTTP. Auth requiere unitarias y HTTP.

## Método de trabajo para una modificación

1. Repetir el objetivo y la condición observable.
2. Inspeccionar los archivos y dependencias directas.
3. Identificar clasificación y reglas protegidas.
4. Proponer el cambio mínimo.
5. Implementar en pasos pequeños.
6. Ejecutar pruebas.
7. Revisar `git diff` y secretos.
8. Entregar informe por archivo y detenerse.

## Plantilla de solicitud

> Estoy trabajando en la misión X de Redes de Ayuda.
>
> Te adjunto el informe técnico maestro y el catálogo de tareas.
>
> Soy principiante. Quiero modificar [funcionalidad].
>
> Antes de escribir código:
>
> 1. Identifica los archivos concretos.
> 2. Explica qué hace cada uno.
> 3. Indica qué datos utiliza.
> 4. Describe cómo se relaciona el cambio con el backend.
> 5. Señala qué riesgos existen.
> 6. Explica qué debería observar en pantalla.
>
> Después implementa el cambio en pasos pequeños, ejecuta las pruebas necesarias y dame un informe de archivos modificados.
>
> No modifiques contratos ni reglas protegidas sin autorización.
>
> No hagas push ni merge.
>
> No avances a otra tarea.

## Cómo preguntar por errores

Adjuntar:

- comando exacto;
- mensaje completo, sin secretos;
- rama y commit;
- archivo y línea si aparecen;
- qué se esperaba y qué ocurrió;
- pasos para reproducir;
- status/response/requestId de Network para errores HTTP;
- captura sólo si no expone credenciales.

Preguntas útiles:

- ¿Qué componente renderiza esta sección y de qué endpoint obtiene datos?
- ¿Esta cifra viene del backend o de un view model?
- ¿Qué prueba protege esta regla?
- ¿El cambio es LIBRE, COORDINADO o PROTEGIDO?
- ¿Cómo sigo este requestId entre navegador y terminal?
- ¿Qué contrato falló y qué fila/encabezado esperaba?

No pegar `.env.local`, cookies, tokens, contraseñas ni hashes en un chat.
