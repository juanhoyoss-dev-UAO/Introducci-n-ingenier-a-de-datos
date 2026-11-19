const DONATION_FORM_TITLE = 'Redes de Ayuda — Registro de donaciones';
const NORMALIZED_RESPONSE_SHEET = 'Respuestas normalizadas';
const LINK_SHEET = 'Enlaces QR';
const CONFIGURATION_SHEET = 'Configuración';

const QUESTION_TITLES = Object.freeze({
  center: 'Centro de acopio',
  legacyPresentation: 'Producto y presentación',
  legacyQuantity: 'Cantidad anunciada en paquetes',
  presentation: (index) => `Producto ${index} y presentación`,
  quantity: (index) => `Cantidad del producto ${index} en paquetes`,
  expectedAt: 'Fecha estimada de entrega',
  donor: 'Nombre o entidad donante (opcional)',
  observations: 'Observaciones (opcional)',
});

function configurarFormularioDonaciones() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('Este script debe ejecutarse desde la hoja de respuestas autorizada.');
  }
  const centers = requireOptions_(spreadsheet, 'Centros', 'D2:D7', 6);
  const presentations = requireOptions_(spreadsheet, 'Presentaciones', 'G2:G41', 40);
  const properties = PropertiesService.getDocumentProperties();
  let form;
  const storedFormId = properties.getProperty('DONATION_FORM_ID');

  if (storedFormId) {
    form = FormApp.openById(storedFormId);
  } else {
    form = FormApp.create(DONATION_FORM_TITLE, false);
    properties.setProperty('DONATION_FORM_ID', form.getId());
  }

  form
    .setDescription('Registra hasta cinco productos que se espera entregar a un centro de acopio. Este anuncio no aumenta el inventario hasta que un administrador confirme cada recepción física.')
    .setConfirmationMessage('Donación registrada. El centro confirmará posteriormente la recepción física de cada artículo.')
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false)
    .setShowLinkToRespondAgain(true)
    .setShuffleQuestions(false);
  ensureDonationQuestions_(form, centers, presentations);

  let destinationId = null;
  try {
    destinationId = form.getDestinationId();
  } catch (error) {
    // Google lanza una excepción la primera vez, cuando aún no hay destino.
    destinationId = null;
  }
  if (destinationId !== spreadsheet.getId()) {
    form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());
  }
  form.setPublished(true).setAcceptingResponses(true);
  ensureNormalizedSheet_(spreadsheet);
  ensureSubmitTrigger_(form);
  const links = createPrefilledLinks_(form, centers);
  const linksPreserved = writeLinks_(spreadsheet, links);

  setConfiguration_(spreadsheet, 'SPREADSHEET_ID', spreadsheet.getId());
  setConfiguration_(spreadsheet, 'FORM_ID', form.getId());
  setConfiguration_(spreadsheet, 'FORM_RESPONDER_URL', form.getPublishedUrl());
  setConfiguration_(spreadsheet, 'RESPONSE_SHEET_NAME', NORMALIZED_RESPONSE_SHEET);
  setConfiguration_(spreadsheet, 'SYNC_RANGE', `'${NORMALIZED_RESPONSE_SHEET}'!A:J`);

  SpreadsheetApp.flush();
  console.log(JSON.stringify({
    formId: form.getId(),
    responderUrl: form.getPublishedUrl(),
    spreadsheetId: spreadsheet.getId(),
    responseSheet: NORMALIZED_RESPONSE_SHEET,
    centerLinks: links.length,
    centerLinksPreserved: linksPreserved,
  }));
}

function findItemByTitles_(form, type, titles) {
  return form.getItems(type).find((item) => titles.includes(item.getTitle())) || null;
}

function ensureListQuestion_(form, titles, finalTitle, choices, required) {
  const existing = findItemByTitles_(form, FormApp.ItemType.LIST, titles);
  const item = existing ? existing.asListItem() : form.addListItem();
  return item
    .setTitle(finalTitle)
    .setChoiceValues(choices)
    .setRequired(required);
}

function ensureTextQuestion_(form, titles, finalTitle, required, validation) {
  const existing = findItemByTitles_(form, FormApp.ItemType.TEXT, titles);
  const item = existing ? existing.asTextItem() : form.addTextItem();
  item.setTitle(finalTitle).setRequired(required);
  if (validation) item.setValidation(validation);
  return item;
}

function ensureDonationQuestions_(form, centers, presentations) {
  const quantityValidation = FormApp.createTextValidation()
    .requireWholeNumber()
    .requireNumberGreaterThan(0)
    .setHelpText('Ingresa un número entero mayor que cero cuando selecciones un producto.')
    .build();
  const center = ensureListQuestion_(
    form,
    [QUESTION_TITLES.center],
    QUESTION_TITLES.center,
    centers,
    true,
  );
  const donor = ensureTextQuestion_(
    form,
    [QUESTION_TITLES.donor],
    QUESTION_TITLES.donor,
    false,
    null,
  );
  const expectedExisting = findItemByTitles_(
    form,
    FormApp.ItemType.DATE,
    [QUESTION_TITLES.expectedAt],
  );
  const expectedAt = (expectedExisting
    ? expectedExisting.asDateItem()
    : form.addDateItem())
    .setTitle(QUESTION_TITLES.expectedAt)
    .setIncludesYear(true)
    .setRequired(true);
  const observationsExisting = findItemByTitles_(
    form,
    FormApp.ItemType.PARAGRAPH_TEXT,
    [QUESTION_TITLES.observations],
  );
  const observations = (observationsExisting
    ? observationsExisting.asParagraphTextItem()
    : form.addParagraphTextItem())
    .setTitle(QUESTION_TITLES.observations)
    .setRequired(false);

  const ordered = [center, donor, expectedAt, observations];
  for (let index = 1; index <= 5; index += 1) {
    const presentationTitle = QUESTION_TITLES.presentation(index);
    const quantityTitle = QUESTION_TITLES.quantity(index);
    const presentationAliases = index === 1
      ? [presentationTitle, QUESTION_TITLES.legacyPresentation]
      : [presentationTitle];
    const quantityAliases = index === 1
      ? [quantityTitle, QUESTION_TITLES.legacyQuantity]
      : [quantityTitle];
    ordered.push(
      ensureListQuestion_(
        form,
        presentationAliases,
        presentationTitle,
        presentations,
        index === 1,
      ),
      ensureTextQuestion_(
        form,
        quantityAliases,
        quantityTitle,
        index === 1,
        quantityValidation,
      ),
    );
  }
  ordered.forEach((item, index) => {
    const currentIndex = form.getItems().findIndex(
      (candidate) => candidate.getId() === item.getId(),
    );
    if (currentIndex < 0) {
      throw new Error(`No se encontró la pregunta ${item.getTitle()} para reordenarla.`);
    }
    form.moveItem(currentIndex, index);
  });
}

function registrarDonacionEsperada(event) {
  if (!event || !event.response) {
    throw new Error('La función requiere un evento real de envío de Google Forms.');
  }
  const properties = PropertiesService.getDocumentProperties();
  const spreadsheetId = properties.getProperty('DONATION_SPREADSHEET_ID');
  if (!spreadsheetId) {
    throw new Error('No se encontró la hoja autorizada en las propiedades del script.');
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ensureNormalizedSheet_(spreadsheet);
  const responseId = event.response.getId();
  if (sheet.getLastRow() > 1) {
    const existing = sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 1)
      .createTextFinder(responseId)
      .matchEntireCell(true)
      .findNext();
    if (existing) return;
  }
  const answers = Object.fromEntries(
    event.response.getItemResponses().map((itemResponse) => [
      itemResponse.getItem().getTitle(),
      itemResponse.getResponse(),
    ]),
  );
  const items = [];
  for (let index = 1; index <= 5; index += 1) {
    const presentation = String(answers[QUESTION_TITLES.presentation(index)] || '').trim();
    const rawQuantity = String(answers[QUESTION_TITLES.quantity(index)] || '').trim();
    if (!presentation && !rawQuantity) continue;
    if (!presentation || !rawQuantity) {
      throw new Error(`El producto ${index} requiere presentación y cantidad.`);
    }
    const quantity = Number(rawQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`La cantidad del producto ${index} debe ser un entero positivo.`);
    }
    items.push({ index, presentation, quantity });
  }
  if (items.length === 0) {
    throw new Error('La donación debe incluir al menos un producto.');
  }
  const rows = items.map((item) => [
    responseId,
    responseId,
    `${responseId}:item:${item.index}`,
    event.response.getTimestamp(),
    answers[QUESTION_TITLES.center] || '',
    item.presentation,
    item.quantity,
    answers[QUESTION_TITLES.expectedAt] || '',
    answers[QUESTION_TITLES.donor] || '',
    answers[QUESTION_TITLES.observations] || '',
  ]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 10).setValues(rows);
}

function requireOptions_(spreadsheet, sheetName, rangeA1, expectedCount) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error(`No existe la hoja ${sheetName}.`);
  const values = sheet.getRange(rangeA1).getDisplayValues().flat().filter(String);
  if (values.length !== expectedCount) {
    throw new Error(`${sheetName} debe contener exactamente ${expectedCount} opciones.`);
  }
  return values;
}

function ensureNormalizedSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(NORMALIZED_RESPONSE_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(NORMALIZED_RESPONSE_SHEET);
  const headers = [
    'ID de respuesta',
    'ID de donación',
    'ID del artículo',
    'Marca temporal',
    QUESTION_TITLES.center,
    QUESTION_TITLES.legacyPresentation,
    QUESTION_TITLES.legacyQuantity,
    QUESTION_TITLES.expectedAt,
    QUESTION_TITLES.donor,
    QUESTION_TITLES.observations,
  ];
  const legacyHeaders = [
    'ID de respuesta',
    'Marca temporal',
    QUESTION_TITLES.center,
    QUESTION_TITLES.legacyPresentation,
    QUESTION_TITLES.legacyQuantity,
    QUESTION_TITLES.expectedAt,
    QUESTION_TITLES.donor,
    QUESTION_TITLES.observations,
  ];
  const currentWidth = Math.max(sheet.getLastColumn(), legacyHeaders.length);
  const currentHeaders = sheet.getRange(1, 1, 1, currentWidth)
    .getDisplayValues()[0]
    .slice(0, currentWidth);
  const hasData = sheet.getLastRow() > 1;
  const isEmpty = currentHeaders.every((value) => !value);
  const isLegacy = legacyHeaders.every(
    (value, index) => currentHeaders[index] === value,
  ) && currentHeaders.slice(legacyHeaders.length).every((value) => !value);
  const isCurrent = headers.every(
    (value, index) => currentHeaders[index] === value,
  );
  if (!isEmpty && !isLegacy && !isCurrent) {
    throw new Error('La hoja normalizada tiene una cabecera desconocida; no fue modificada.');
  }
  if (isLegacy) {
    sheet.insertColumnsAfter(1, 2);
    if (hasData) {
      const responseIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
        .getDisplayValues()
        .flat();
      sheet.getRange(2, 2, responseIds.length, 2).setValues(
        responseIds.map((responseId) => [
          responseId,
          `${responseId}:item:1`,
        ]),
      );
    }
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#E5E7EB')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.autoResizeColumns(1, headers.length);
  return sheet;
}

function ensureSubmitTrigger_(form) {
  const exists = ScriptApp.getProjectTriggers().some(
    (trigger) => trigger.getHandlerFunction() === 'registrarDonacionEsperada',
  );
  if (!exists) {
    ScriptApp.newTrigger('registrarDonacionEsperada').forForm(form).onFormSubmit().create();
  }
  PropertiesService.getDocumentProperties().setProperty(
    'DONATION_SPREADSHEET_ID',
    SpreadsheetApp.getActiveSpreadsheet().getId(),
  );
}

function createPrefilledLinks_(form, centers) {
  const centerItem = form
    .getItems(FormApp.ItemType.LIST)
    .map((item) => item.asListItem())
    .find((item) => item.getTitle() === QUESTION_TITLES.center);
  if (!centerItem) throw new Error('No se encontró la pregunta de centro.');
  return centers.map((center) => ({
    center,
    url: form
      .createResponse()
      .withItemResponse(centerItem.createResponse(center))
      .toPrefilledUrl(),
  }));
}

function writeLinks_(spreadsheet, links) {
  let sheet = spreadsheet.getSheetByName(LINK_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(LINK_SHEET);
  const previousLinks = new Map();
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 3)
      .getDisplayValues()
      .forEach((row) => previousLinks.set(row[0], row[2]));
  }
  const changed = links.filter(({ center, url }) => {
    const centerId = center.split(' — ')[0];
    return previousLinks.has(centerId) && previousLinks.get(centerId) !== url;
  });
  if (changed.length > 0) {
    throw new Error('Los enlaces prerrellenados cambiaron; Enlaces QR no fue sobrescrita. Verifica los QR antes de continuar.');
  }
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 4).setValues([
    ['centro_id', 'Centro', 'Enlace prerrellenado', 'Archivo QR esperado'],
  ]);
  sheet.getRange(2, 1, links.length, 4).setValues(
    links.map(({ center, url }) => {
      const parts = center.split(' — ');
      return [parts[0], parts.slice(1).join(' — '), url, `QR-${parts[0]}.png`];
    }),
  );
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 4)
    .setBackground('#E5E7EB')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.autoResizeColumns(1, 4);
  return previousLinks.size === 0 || changed.length === 0;
}

function setConfiguration_(spreadsheet, key, value) {
  const sheet = spreadsheet.getSheetByName(CONFIGURATION_SHEET);
  if (!sheet) throw new Error(`No existe la hoja ${CONFIGURATION_SHEET}.`);
  const match = sheet.getRange('A:A').createTextFinder(key).matchEntireCell(true).findNext();
  if (!match) throw new Error(`No existe la clave de configuración ${key}.`);
  sheet.getRange(match.getRow(), 2).setValue(value);
}
