# Google Forms y Google Sheets para donaciones esperadas

## Recurso preparado

La hoja nativa se creó en Google Drive con las pestañas `Guía`, `Configuración`, `Centros` y `Presentaciones`. Contiene los seis centros, 32 productos y 40 presentaciones del cierre M6.5.

## Paso manual mínimo

La conexión disponible no expone Google Forms ni Apps Script. Para crear el formulario sin inventar identificadores:

1. Abrir la hoja `Redes de Ayuda — Respuestas de donaciones`.
2. Abrir **Extensiones > Apps Script**.
3. Copiar el contenido de `scripts/google/setup-donations-form.gs`.
4. Ejecutar `configurarFormularioDonaciones` y autorizar únicamente Forms, Sheets y el disparador del formulario.
5. Confirmar que aparecen `Respuestas normalizadas` y `Enlaces QR`.

El script es idempotente dentro del documento: conserva el ID del formulario, evita duplicar el disparador y usa el ID real de cada respuesta de Forms. También crea seis enlaces prerrellenados, uno por centro.

Google Forms REST permite crear y actualizar formularios, pero el vínculo de respuestas con una hoja y los enlaces prerrellenados se resuelven aquí mediante el servicio oficial `FormApp`. Referencias: [Forms API](https://developers.google.com/workspace/forms/api/reference/rest) y [FormApp](https://developers.google.com/apps-script/reference/forms/form).

## Cuenta de servicio para Redes de Ayuda

1. Crear una cuenta de servicio en un proyecto de Google Cloud con Google Sheets API habilitada.
2. Guardar su JSON fuera del repositorio.
3. Compartir la hoja con el correo de la cuenta de servicio como **lector**.
4. Configurar:

```dotenv
GOOGLE_DONATIONS_SPREADSHEET_ID=
GOOGLE_DONATIONS_SHEET_RANGE='Respuestas normalizadas'!A:J
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS_FILE=C:\ruta\fuera\del\repositorio\cuenta-servicio.json
GOOGLE_DONATIONS_SYNC_INTERVAL_MS=45000
```

La configuración local de desarrollo puede guardarse en `.env.development.local`, ignorado por Git, usando una ruta absoluta externa para el JSON. `.env.local` debe permanecer fuera del índice. Los secretos administrativos que estuvieron expuestos históricamente todavía deben rotarse antes de distribuir el repositorio.

La fase multiproducto amplía la hoja normalizada a `A:J`: conserva cada respuesta como una donación y escribe una fila por artículo con identificadores compartido e individual. El lector mantiene compatibilidad con las filas históricas de ocho columnas.

## Códigos QR

Los PNG se generan únicamente después de que Google confirme los seis enlaces de `Enlaces QR`. No se deben construir URLs supuestas ni códigos QR antes de ese momento.
