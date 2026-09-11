/**
 * Receptor de confirmaciones para la boda de Lioncio & Lisbeth.
 * Este archivo debe pegarse en una secuencia de comandos vinculada a la hoja
 * "Confirmaciones" y publicarse como aplicación web.
 */

const RSVP_SHEET_NAME = 'Confirmaciones';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const data = JSON.parse((e.postData && e.postData.contents) || '{}');
    const sheet = getOrPrepareRsvpSheet_();

    sheet.appendRow([
      data.submittedAt ? new Date(data.submittedAt) : new Date(),
      clean_(data.name),
      clean_(data.attendance),
      clampPasses_(data.passes),
      clean_(data.message),
      clean_(data.source) || 'Invitación web',
      'Pendiente',
      ''
    ]);

    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, message: String(error) });
  } finally {
    lock.releaseLock();
  }
}

function setupRsvpSheet() {
  getOrPrepareRsvpSheet_();
}

function getOrPrepareRsvpSheet_() {
  const workbook = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = workbook.getSheetByName(RSVP_SHEET_NAME);
  if (!sheet) sheet = workbook.insertSheet(RSVP_SHEET_NAME);

  const headers = [
    'Fecha y hora',
    'Invitado / Familia',
    '¿Asistirá?',
    'Pases',
    'Dedicatoria',
    'Origen',
    'Estado',
    'Observaciones'
  ];

  if (sheet.getRange('A6').getValue() !== headers[0]) {
    sheet.getRange(6, 1, 1, headers.length).setValues([headers]);
  }

  sheet.setFrozenRows(6);
  sheet.setFrozenColumns(2);
  sheet.setHiddenGridlines(true);
  sheet.getRange('A6:H6')
    .setBackground('#07122A')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange('A6:H6').setBorder(false, false, true, false, false, false, '#D4AF37', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.getRange('A7:A').setNumberFormat('dd/mm/yyyy hh:mm');
  sheet.getRange('D7:D').setNumberFormat('0');
  sheet.getRange('A7:H').setVerticalAlignment('middle');
  sheet.getRange('E7:E').setWrap(true);

  const widths = [150, 220, 195, 70, 300, 120, 115, 220];
  widths.forEach((width, index) => sheet.setColumnWidth(index + 1, width));

  const attendanceRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Sí, asistiré con mucho gusto', 'Lamentablemente no podré asistir'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('C7:C').setDataValidation(attendanceRule);

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Pendiente', 'Confirmado', 'Contactado'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('G7:G').setDataValidation(statusRule);

  return sheet;
}

function clean_(value) {
  return String(value == null ? '' : value).trim().slice(0, 2000);
}

function clampPasses_(value) {
  const passes = Number(value);
  if (!Number.isFinite(passes)) return 0;
  return Math.max(0, Math.min(10, Math.round(passes)));
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
