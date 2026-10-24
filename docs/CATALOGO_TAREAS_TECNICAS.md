# Catálogo de tareas técnicas

## Uso

Este catálogo describe trabajo futuro; E0 no implementó ninguna tarea. Antes de elegir una misión, leer [el contexto para IA](CONTEXTO_IA.md), [el informe maestro](INFORME_TECNICO_MAESTRO.md), [las reglas de negocio](REGLAS_NEGOCIO.md) y el código vigente.

Niveles:

- Baja: cambio local con datos ya disponibles.
- Media: varios archivos o contrato coordinado.
- Alta: persistencia, seguridad, migración o reglas protegidas.

## Tareas

| ID | Objetivo funcional | Archivos afectados | Dependencias / contratos | Backend | Pruebas | Dificultad y orden | Condición observable de éxito |
|---|---|---|---|---|---|---|---|
| UI-01 | Ajustar colores, espaciado y adaptación del dashboard | `dashboard-client.tsx`, `globals.css` | Tailwind; no cambiar tipos | No | lint, typecheck, revisión 320/768/1440 px | Baja, 1 | Seis pestañas y filtros siguen utilizables sin desbordes |
| UI-02 | Extraer tablas/tarjetas reutilizables | Nuevo `src/components`, cliente | Props derivadas de tipos actuales | No | unitarias de helpers, lint, build | Media, 2 | Misma información y comportamiento con componentes aislados |
| UI-03 | Añadir filtros por producto/estado/prioridad | `types.ts`, `view-model.ts`, cliente | DashboardBundle actual | No para filtro local | unitarias combinatorias y reset al cambiar snapshot | Media, 3 | Filtros se combinan y nunca mezclan jornadas |
| UI-04 | Añadir una tarjeta calculada con datos existentes | view model, cliente, prueba | No duplicar dominio | No | unitarias del agregado | Baja, 4 | Tarjeta coincide con respuesta/fórmula documentada |
| GRA-01 | Gráfico de inventario/necesidad por centro | componente nuevo, view model, cliente | Datos de `/api/dashboard`; librería sólo con aprobación | No | transformación, vacío, filtro, revisión visual | Media, 5 | Gráfico cambia con snapshot/centro y conserva unidades |
| ALE-01 | Alertas de déficit o voluntarios | dominio/servicio si hay umbral nuevo; UI | Reglas y umbrales aprobados | Sí si crea regla | límites, cero, prioridad y snapshot | Media, 6 | Alerta aparece sólo cuando la regla protegida se cumple |
| CAP-01 | Añadir capacidad máxima en kg a centros | templates/demo nuevos, Zod, database types, CSV_COLUMNS, repo | `capacidad_max_kg > 0` | Sí | migración, encabezados, valores inválidos | Alta, 7 | Snapshot migrado carga capacidad sin asumir conversiones |
| CAP-02 | Añadir peso por paquete | presentaciones, contratos, storage, datos | `peso_kg_por_paquete > 0`; independiente de ml/g/unidad | Sí | decimales, referencias, varias presentaciones | Alta, 8 | Cada SKU tiene peso explícito validado |
| CAP-03 | Calcular ocupación y capacidad libre | nuevo módulo de dominio, dashboard service, tipos/API, UI | CAP-01 y CAP-02 | Sí | suma por SKU, sobrecapacidad, cero y redondeo | Alta, 9 | kg almacenados, libres y porcentaje coinciden con fixtures |
| CAP-04 | Alertas visuales de ocupación | view model/cliente; quizá servicio | CAP-03 y umbrales aprobados | No si umbral ya llega calculado | límites de color/estado y accesibilidad | Media, 10 | Estado no depende sólo del color y respeta el porcentaje |
| REC-01 | Modelo de recepciones confirmadas | nuevo CSV, Zod, tipos, CSV_COLUMNS y repositorio | ID, snapshot/jornada, centro, SKU, paquetes, hora, intención opcional | Sí | unicidad, FK, ISO/offset, recepción sin intención | Alta, 11 | Bundle acepta recepciones válidas y rechaza duplicados |
| REC-02 | Registrar recepciones de forma idempotente | servicio y endpoint POST protegido | REC-01, origen/CSRF, clave idempotente | Sí | 400/401/403/409, repetición y concurrencia | Alta, 12 | Repetir la misma recepción no duplica datos |
| REC-03 | Agregar recepciones por día y hora Bogotá | dominio/servicio, endpoint GET | `America/Bogota`, horas 00..23 | Sí | medianoche, offset, varios días/centros | Alta, 13 | Conteo y paquetes por hora coinciden con datos ficticios |
| REC-04 | Visualizar horas pico | tipos, view model, dashboard, gráfico | REC-03 | No adicional | filtros, vacío, empate y revisión visual | Media, 14 | Distingue conteo de recepciones y paquetes |
| JOR-01 | Publicar jornadas 2 y 3 como snapshots completos | datos de preparación, validador/CLI futuro, repositorio | UUID, metadata y ocho CSV; writeSnapshot | Sí o CLI | bundle completo, no sobrescritura, aislamiento | Alta, 15 | Tres snapshots seleccionables y ordenados por cierre |
| JOR-02 | Comparar jornadas | servicio/endpoint nuevo, tipos, view model, UI | JOR-01; unión por centro/producto | Sí | altas/bajas, unidades, orden y faltantes | Alta, 16 | Variaciones muestran base/actual sin sumar snapshots |
| GRA-02 | Evolución temporal de stock/necesidad/voluntarios | endpoint de serie, tipos, gráficos | JOR-02 | Sí | orden temporal, huecos, unidad y filtros | Alta, 17 | Serie cronológica reproducible por métrica |
| IMP-01 | Importar paquete CSV | módulo de importación, contratos, staging, servicio y UI | Ocho archivos + metadata; validación integral | Sí | archivo ausente/extra, encabezado, FK, rollback | Alta, 18 | Vista previa valida antes de publicar y no deja parciales |
| IMP-02 | Importar Excel | lector aprobado, mapeo y conversión a bundle | IMP-01; dependencia nueva requiere autorización | Sí | hojas, tipos, fechas, vacíos, fórmulas | Alta, 19 | Excel se normaliza al mismo bundle sin saltar Zod |
| IMP-03 | Mapeo manual de columnas | UI de mapeo + servicio de prevalidación | IMP-01/02, nombres canónicos | Sí | columnas duplicadas/faltantes y previsualización | Alta, 20 | Usuario resuelve mapeo antes de publicar |
| HIS-01 | Historial enriquecido de snapshots | servicio/listado y dashboard | metadata; quizá autor/origen futuro | Sí para nuevos campos | orden, empate, paginación si aplica | Media, 21 | Historial identifica fecha, nombre, origen y estado |
| EXP-01 | Exportar la vista actual | endpoint o generación cliente según alcance | Autorización, filtros, unidad y snapshot | Coordinado | escaping CSV, acentos, permisos y contenido | Media, 22 | Archivo descargado reproduce la vista y declara snapshot |

## Secuencia recomendada

1. Realizar tareas UI locales para practicar flujo de rama y pruebas.
2. Implementar capacidad en cuatro entregas pequeñas: esquema, peso, cálculo y visualización.
3. Diseñar recepciones antes de crear gráficos; resolver idempotencia y zona horaria primero.
4. Publicar las jornadas sólo después de acordar el corte temporal y migrar el esquema.
5. Construir comparación/evolución sobre snapshots válidos.
6. Implementar importación CSV antes de Excel; ambos deben producir el mismo `SnapshotBundle`.
7. Añadir exportación al final para no fijar prematuramente contratos inestables.

## Formato de entrega de una misión

Cada misión debe indicar:

- ID y condición de éxito.
- Rama y commit base.
- Archivos previstos y clasificación.
- Contratos/reglas protegidos.
- Pasos pequeños.
- Pruebas ejecutadas con resultado real.
- Captura o pasos observables.
- Riesgos, pendientes y estado Git.

No mezclar dos IDs de dificultad alta en el mismo cambio sin aprobación.
