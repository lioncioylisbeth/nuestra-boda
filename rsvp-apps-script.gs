/**
 * Receptor de confirmaciones para la boda de Lioncio & Lisbeth.
 * Este archivo debe pegarse en una secuencia de comandos vinculada a la hoja
 * "Confirmaciones" y publicarse como aplicación web.
 */

const RSVP_SHEET_NAME = 'Confirmaciones';

function doGet() {
  return json_({ ok: true, service: 'rsvp-lioncio-lisbeth' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const data = JSON.parse((e.postData && e.postData.contents) || '{}');
    const sheet = getRsvpSheet_();
    const hasGuestBreakdown = data.adults != null || data.children != null;
    const adults = clampPasses_(data.adults);
    const children = clampPasses_(data.children);
    const totalGuests = hasGuestBreakdown
      ? clampPasses_(adults + children)
      : clampPasses_(data.passes);

    const nextRow = getNextRsvpRow_(sheet);
    sheet.getRange(nextRow, 1, 1, 11).setValues([[
      data.submittedAt ? new Date(data.submittedAt) : new Date(),
      clean_(data.name),
      clean_(data.attendance),
      totalGuests,
      clean_(data.message),
      clean_(data.source) || 'Invitación web',
      'Pendiente',
      '',
      clean_(data.phone),
      hasGuestBreakdown ? adults : '',
      hasGuestBreakdown ? children : ''
    ]]);

    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, message: String(error) });
  } finally {
    lock.releaseLock();
  }
}

function getRsvpSheet_() {
  const workbook = SpreadsheetApp.getActiveSpreadsheet();
  if (!workbook) throw new Error('Vincula este proyecto de Apps Script a la hoja de confirmaciones.');
  const sheet = workbook.getSheetByName(RSVP_SHEET_NAME);
  if (!sheet) throw new Error('No se encontró la hoja "' + RSVP_SHEET_NAME + '".');
  return sheet;
}

function getNextRsvpRow_(sheet) {
  const firstDataRow = 7;
  const values = sheet.getRange(firstDataRow, 2, sheet.getMaxRows() - firstDataRow + 1, 1).getDisplayValues();
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (String(values[index][0]).trim()) return firstDataRow + index + 1;
  }
  return firstDataRow;
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
