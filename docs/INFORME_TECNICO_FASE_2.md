# Redes de Ayuda — Informe técnico de la Fase 2

Fecha de revisión: 18 de noviembre de 2026  
Alcance: diagnóstico de solo lectura del módulo Donaciones esperadas, Google Forms, Google Sheets, QR y confirmación de entregas.

## A. Resumen ejecutivo

La Fase 2 no está terminada de extremo a extremo.

Funcionan realmente:

- Google Form existe, está publicado y acepta respuestas.
- La hoja está vinculada al formulario.
- El disparador de Apps Script copia las respuestas a `Respuestas normalizadas`.
- Los seis QR apuntan a enlaces prerrellenados reales.
- El modelo local, persistencia CSV, recepciones, cancelación e idempotencia están implementados y probados de manera aislada.

No funciona todavía:

- Next.js no tiene configurado el acceso autenticado a Google Sheets.
- Por ello no se ejecuta la sincronización manual ni automática.
- La respuesta enviada no llegó a `donaciones_qr.csv`.
- No se ha validado un recorrido real desde Google hasta inventario y alertas.
- Una donación con varios productos no está implementada.

La respuesta de prueba sí aparece en la hoja original y en `Respuestas normalizadas`: C01, `FRIJOL-5000`, 5 paquetes, registrada el 18 de noviembre de 2026 a las 15:34. Esto confirma que Forms → Sheets → Apps Script funciona.

Hoja inspeccionada: [Redes de Ayuda — Respuestas de donaciones](https://docs.google.com/spreadsheets/d/1F6kZeJZEvas5seX100USOUMwQV0X3SgDb6CJJzvJW14/edit).

No se modificaron código, datos ni configuraciones durante el diagnóstico.

## B. Tabla de implementación

| Funcionalidad | Estado real | Archivo responsable | Evidencia |
|---|---|---|---|
| Módulo Donaciones esperadas | Implementado; verificado localmente, no con Google real | `src/app/dashboard/components/qr-donations-module.tsx` | Renderiza indicadores, filtros, anuncios y acciones |
| Modelo de anuncios | Implementado y probado aisladamente | `src/contracts/schemas/qr-donations.ts` | Un registro representa un único producto/SKU |
| Persistencia | Implementada y probada en repositorios temporales | `src/server/storage/csv.ts` | Usa `donaciones_qr.csv` por snapshot |
| Google Form | Creado y funcionando realmente | `scripts/google/setup-donations-form.gs` | Existe una respuesta real |
| Hoja vinculada | Funcionando realmente | `scripts/google/setup-donations-form.gs` | Respuesta presente en hoja original y normalizada |
| Códigos QR | Generados con enlaces reales; escaneo de los seis no documentado | `data/demo/google-donations/` | Seis PNG de 600 × 600 px |
| Acceso autenticado de Next.js a Sheets | Pendiente de configuración | `src/server/integrations/google-sheets.ts` | Las cuatro variables Google están vacías o ausentes |
| Sincronización manual | Código implementado; no operativa realmente | `src/app/api/snapshots/[id]/qr-donations/sync/route.ts` | Sin cuenta de servicio, el botón no aparece |
| Sincronización automática | Código implementado; no operativa realmente | `src/app/dashboard/components/qr-donations-module.tsx` | Polling solo si está configurado, en PRUEBAS y con el módulo abierto |
| Recepción parcial/completa | Implementada y verificada en pruebas aisladas | `src/server/services/movement-operations.ts` | Controla saldo e inventario por producto |
| Cancelación | Implementada y verificada aisladamente | `src/server/services/qr-donations.ts` | No permite cancelar después de recibir |
| Inventario y alertas | Verificados con datos locales simulados | `tests/integration/qr-donations.test.ts` | No existe validación real Google → alertas |
| Aislamiento MAIN/PRUEBAS | Implementado y probado localmente | `src/server/services/scenario-protection.ts` | MAIN rechaza escrituras |
| Varios productos por donación | No implementado | Modelo completo | Formulario, importador y backend son monoproducto |

Las pruebas de Google existentes usan filas inyectadas en memoria, no una cuenta de servicio ni la hoja real.

## C. Arquitectura

El recorrido implementado es:

```text
Google Forms
    ↓ envío
Hoja “Respuestas de formulario 1”
    ↓ trigger registrarDonacionEsperada
Hoja “Respuestas normalizadas”
    ↓ lectura API Sheets con cuenta de servicio
POST /api/snapshots/[id]/qr-donations/sync
    ↓ validación y traducción
syncGoogleDonations
    ↓ operación idempotente
applyQrDonationOperation
    ↓ nuevo snapshot
donaciones_qr.csv
    ↓ consulta administrativa
GET /api/snapshots/[id]/qr-donations
    ↓
Módulo Donaciones esperadas
```

### Google Forms

`configurarFormularioDonaciones`, en `scripts/google/setup-donations-form.gs`, crea seis preguntas y una sola pareja producto/cantidad. Produce una respuesta en la hoja vinculada. Google gestiona automáticamente esa primera escritura.

### Normalización en Sheets

`registrarDonacionEsperada` recibe el evento de envío, obtiene el ID real de Forms y crea una fila con ocho columnas. El trigger funcionó realmente: la respuesta examinada está tanto en la hoja original como en `Respuestas normalizadas`.

### Lectura desde Next.js

`readGoogleDonationSheetRows`, en `src/server/integrations/google-sheets.ts`, requiere:

- `GOOGLE_DONATIONS_SPREADSHEET_ID`
- `GOOGLE_DONATIONS_SHEET_RANGE`
- `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_FILE`
- Opcional: `GOOGLE_DONATIONS_SYNC_INTERVAL_MS`

La cuenta debe tener alcance `spreadsheets.readonly`, el JSON debe estar fuera del repositorio y la hoja debe estar compartida con su correo.

Actualmente esas variables no están configuradas en los archivos de entorno locales. Por el flujo estándar de Next.js, `integracion_google_configurada` resulta falso.

### Validación

`parseGoogleDonationSheetRows` valida:

- Ocho encabezados reconocidos.
- ID de respuesta.
- Centro.
- SKU.
- Cantidad entera positiva.
- Fecha de registro.
- Fecha estimada.

La respuesta observada cumple esas reglas: C01 existe, `FRIJOL-5000` pertenece a P06, la cantidad 5 es válida y las fechas tienen formatos admitidos.

### Persistencia

`syncGoogleDonations` transforma cada fila válida en una operación. `applyQrDonationOperation` clona el snapshot seleccionado, agrega el anuncio y publica una versión nueva en `data/runtime`.

No existe ningún identificador `forms:` en los snapshots actuales. La respuesta real nunca llegó a persistencia local.

### Rutas reales

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/snapshots/[id]/qr-donations` | Consulta anuncios del snapshot |
| POST | `/api/snapshots/[id]/qr-donations` | Crea o cancela un anuncio mediante operación interna |
| POST | `/api/snapshots/[id]/qr-donations/sync` | Lee Sheets e importa respuestas |
| GET | `/api/snapshots/[id]/movements` | Consulta movimientos |
| POST | `/api/snapshots/[id]/movements` | Confirma recepción parcial o completa |

Todas requieren sesión administrativa. Las operaciones POST también validan el origen HTTP.

## D. Diagnóstico del formulario enviado

| Paso | Resultado |
|---|---|
| 1. Envío de Forms | Confirmado |
| 2. Respuesta en Sheets | Confirmado |
| 3. Next.js accede a Sheets | No configurado |
| 4. Sincronizador identifica la fila | No ejecutado realmente |
| 5. La fila supera validaciones | Debería superarlas; datos y catálogo coinciden |
| 6. Se guarda el anuncio | No ocurrió |
| 7. El módulo lo muestra | Imposible porque no fue persistido |

Causa confirmada: falta la configuración autenticada de Next.js hacia Google Sheets.

No es un problema causado por encabezados, centro, SKU, cantidad, fecha o filtros. Esos datos son válidos y los filtros no pueden ocultar un registro que nunca fue persistido.

Factores adicionales:

- Si está seleccionado MAIN, la sincronización se rechaza antes de leer Google.
- El escenario correcto es PRUEBAS.
- Los filtros predeterminados son todos los productos y todos los estados.
- El filtro global de centro podría ocultar C01, pero solamente después de importar el anuncio.
- La actualización automática solo funciona mientras la pestaña Donaciones esperadas está montada.
- El intervalo previsto es 45 segundos, no un proceso permanente del servidor.
- La interfaz muestra errores generales, pero reduce los errores de filas inválidas a un conteo.
- No se encontraron registros persistentes de errores de integración.

Existe un defecto secundario: la celda `SYNC_RANGE` de la hoja muestra `Respuestas normalizadas'!A:H`, con una comilla desbalanceada. No es la causa actual porque ninguna variable está configurada. El valor correcto es:

```dotenv
GOOGLE_DONATIONS_SHEET_RANGE='Respuestas normalizadas'!A:H
```

## E. Donaciones de múltiples productos

La limitación monoproducto está presente en todas las capas:

- Google Form crea una sola pregunta de presentación.
- Crea una sola pregunta de cantidad.
- La hoja normalizada contiene una sola pareja SKU/cantidad.
- El importador produce una sola operación por respuesta.
- `respuesta_origen_id` debe ser único.
- `donaciones_qr.csv` representa anuncio y producto en la misma fila.
- La recepción apunta a un anuncio correspondiente a un único SKU.

### Alternativas

| Criterio | A. Bloques opcionales en Google Forms | B. Formulario web propio |
|---|---|---|
| Productos dinámicos | No; exige fijar un máximo | Sí, con “Agregar otro producto” |
| Experiencia | Repetitiva y larga | Clara y dinámica |
| Validación SKU/cantidad | Limitada | Completa en backend |
| Estructura en Sheets | Muy ancha | Sheets puede quedar como auditoría opcional |
| Cambios de catálogo | Requiere regenerar preguntas | Puede consultar el catálogo actual |
| Mantenimiento | Aumenta con cada bloque | Mayor inversión inicial, mejor evolución |
| Seguridad | Gestionada parcialmente por Google | Requiere endpoint público, límites y protección antiabuso |

Recomendación: alternativa B, formulario web propio de Next.js.

Modelo recomendado:

```text
donacion
- donacion_id
- respuesta_origen_id
- centro_id
- donante
- fecha estimada
- observaciones
- estado general

donacion_item
- item_id
- donacion_id
- producto_id
- sku_id
- cantidad anunciada
- cantidad recibida
- cantidad pendiente
- estado
```

La alternativa A solo es razonable como solución temporal si se define un máximo pequeño, por ejemplo cinco productos.

## F. Confirmación de entregas

Actualmente cada anuncio corresponde a un solo producto.

Una recepción:

1. Recibe `anuncio_id`, cantidad y fecha.
2. Comprueba que el anuncio esté pendiente.
3. Rechaza cantidades superiores al saldo.
4. Incrementa únicamente el SKU del anuncio.
5. Actualiza cantidades recibida y pendiente.
6. Calcula `parcialmente_recibido` o `recibido_completo`.
7. Registra un movimiento.
8. Publica un snapshot nuevo.
9. El dashboard recalcula inventario y alertas.

Se permiten varias recepciones mientras quede saldo. Cada una tiene UUID de operación e idempotencia.

Para admitir varios productos:

- La recepción debe apuntar a `donacion_item_id`.
- Inventario debe actualizarse únicamente para ese artículo.
- Los movimientos deben conservar `donacion_id` e `item_id`.
- El estado general debe calcularse desde los artículos.
- Debe decidirse si se cancela toda la donación o artículos individuales.

## G. Problemas prioritarios

1. Next.js no tiene conexión autenticada con Sheets.
2. No existe una prueba real Google → PRUEBAS → dashboard.
3. El requisito multiproducto no está representado en el modelo.
4. La celda informativa `SYNC_RANGE` contiene una comilla incorrecta.
5. Los errores por fila no se muestran con suficiente detalle.
6. El polling depende de mantener abierto el módulo.
7. `.env.local` continúa rastreado por Git y no debe recibir secretos.
8. Toda la Fase 2 permanece sin commit, conforme a instrucciones anteriores.

## H. Plan mínimo de corrección

Para cerrar la versión actual monoproducto:

1. Crear una cuenta de servicio y habilitar Google Sheets API.
2. Compartir la hoja con esa cuenta como lectora.
3. Guardar el JSON fuera del repositorio.
4. Configurar las variables en un archivo ignorado, preferentemente `.env.development.local`.
5. Usar exactamente `'Respuestas normalizadas'!A:H`.
6. Reiniciar Next.js.
7. Seleccionar PRUEBAS y abrir Donaciones esperadas.
8. Confirmar que aparece el estado de integración activa.
9. Ejecutar “Sincronizar ahora”.
10. Verificar que se importa la respuesta sin modificar inventario.
11. Ejecutar después la recepción parcial, completa, alertas, idempotencia y aislamiento MAIN.

Para multiproducto se necesita un microbloque separado:

1. Aprobar el modelo cabecera/artículos.
2. Diseñar una migración retrocompatible.
3. Implementar el formulario web.
4. Adaptar persistencia, sincronización, interfaz y movimientos.
5. Agregar pruebas de recepciones independientes por artículo.

## I. Datos requeridos del usuario

Para finalizar la conexión monoproducto:

- Confirmación de que Google Sheets API está habilitada.
- Confirmación de que la hoja fue compartida como lectora con la cuenta de servicio.
- Ruta local absoluta del JSON, sin copiar su contenido ni la clave privada.
- Autorización para usar `.env.development.local`.
- Confirmación de que la prueba integral debe ejecutarse sobre PRUEBAS.

Para el requisito nuevo:

- Elegir entre formulario web propio —recomendado— o Google Forms con un máximo fijo.
- Si se elige Google Forms, indicar el máximo de productos permitidos.
- Definir si se permite cancelar un artículo individual después de recibir otros artículos de la misma donación.

## Conclusión

La Fase 2 monoproducto está implementada localmente, pero le falta conexión autenticada y validación integral. El requisito multiproducto supone una ampliación significativa del modelo; no es un ajuste únicamente visual del formulario.
