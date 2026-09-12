/**
 * Receptor v2. Pegar en el proyecto vinculado a la hoja existente y publicar
 * una nueva versión del despliegue actual. Guardar el editor no lo despliega.
 * No cambia encabezados, formatos, resúmenes ni registros anteriores.
 */
const RSVP_SHEET_NAME = 'Confirmaciones';
const RSVP_FIRST_ROW = 7;
function doGet() {
  return json_({ok:true, service:'rsvp-lioncio-lisbeth', version:2});
}
function doPost(e) {
  let locked = false;
  const lock = LockService.getScriptLock();
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > 16000) return json_({ok:false, code:'invalid_request'});
    const data = validateRsvp_(JSON.parse(raw || '{}'));
    if (!data) return json_({ok:false, code:'invalid_data'});
    locked = lock.tryLock(10000);
    if (!locked) return json_({ok:false, code:'busy'});
    const sheet = getRsvpSheet_();
    const fingerprint = fingerprint_(data);
    const prior = findRequest_(sheet, data.requestId);
    if (prior && prior.fingerprint !== fingerprint) return json_({ok:false, code:'request_conflict'});
    if (prior && String(sheet.getRange(prior.row, 2).getDisplayValues()[0][0]).trim()) {
      return json_({ok:true, requestId:data.requestId, duplicate:true, version:2});
    }
    const row = prior ? prior.row : getNextRsvpRow_(sheet);
    if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), row - sheet.getMaxRows());
    // Reserve the row first. A retry after an interrupted write reuses it.
    const cell = sheet.getRange(row, 1);
    const oldNote = cell.getNote();
    if (!prior) cell.setNote((oldNote ? oldNote + '\n' : '') + 'RSVP-ID: ' + data.requestId + ' HASH: ' + fingerprint);
    sheet.getRange(row, 9).setNumberFormat('@');
    sheet.getRange(row, 1, 1, 11).setValues([[
      new Date(), sheetText_(data.name), data.attendance, data.passes,
      sheetText_(data.message), 'Invitación web', 'Pendiente', '',
      sheetText_(data.phone), data.adults, data.children
    ]]);
    SpreadsheetApp.flush();
    return json_({ok:true, requestId:data.requestId, duplicate:false, version:2});
  } catch (_) {
    // Do not return guest data or internal sheet errors to public visitors.
    return json_({ok:false, code:'registration_unavailable'});
  } finally {
    if (locked) lock.releaseLock();
  }
}
function validateRsvp_(data) {
  if (!data || typeof data !== 'object' || clean_(data.website)) return null;
  const name = clean_(data.name).replace(/[\r\n\t]+/g, ' ');
  const message = clean_(data.message), phone = clean_(data.phone);
  const requestId = clean_(data.requestId), attendance = clean_(data.attendance);
  if (name.length < 2 || name.length > 150 || message.length > 2000) return null;
  if (!/^\+\d{10,15}$/.test(phone) || !/^[A-Za-z0-9-]{16,80}$/.test(requestId)) return null;
  if (attendance !== 'Sí, asistiré con mucho gusto' && attendance !== 'Lamentablemente no podré asistir') return null;
  let adults = data.adults, children = data.children;
  if (attendance === 'Lamentablemente no podré asistir') { adults = 0; children = 0; }
  else if (!Number.isInteger(adults) || !Number.isInteger(children) || adults < 0 || children < 0 || adults + children < 1 || adults + children > 10) return null;
  return {name, message, phone, requestId, attendance, adults, children, passes:adults + children};
}
function getRsvpSheet_() {
  const workbook = SpreadsheetApp.getActiveSpreadsheet();
  if (!workbook) throw new Error('missing_workbook');
  const sheet = workbook.getSheetByName(RSVP_SHEET_NAME);
  if (!sheet) throw new Error('missing_sheet');
  const headers = sheet.getRange(6, 1, 1, 11).getDisplayValues()[0];
  if (headers[1] !== 'Invitado / Familia' || headers[8] !== 'Teléfono' || headers[9] !== 'Adultos' || headers[10] !== 'Niños') throw new Error('unexpected_columns');
  return sheet;
}
function findRequest_(sheet, requestId) {
  const notes = sheet.getRange(RSVP_FIRST_ROW, 1, sheet.getMaxRows() - RSVP_FIRST_ROW + 1, 1).getNotes();
  for (let index = 0; index < notes.length; index += 1) {
    const match = String(notes[index][0]).match(/(?:^|\n)RSVP-ID: ([A-Za-z0-9-]+) HASH: ([a-f0-9]{64})(?:\n|$)/);
    if (match && match[1] === requestId) return {row:RSVP_FIRST_ROW + index, fingerprint:match[2]};
  }
  return null;
}
function getNextRsvpRow_(sheet) {
  const values = sheet.getRange(RSVP_FIRST_ROW, 2, sheet.getMaxRows() - RSVP_FIRST_ROW + 1, 1).getDisplayValues();
  const notes = sheet.getRange(RSVP_FIRST_ROW, 1, sheet.getMaxRows() - RSVP_FIRST_ROW + 1, 1).getNotes();
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (String(values[index][0]).trim() || /RSVP-ID:/.test(notes[index][0])) return RSVP_FIRST_ROW + index + 1;
  }
  return RSVP_FIRST_ROW;
}
function fingerprint_(data) {
  const canonical = JSON.stringify([data.name, data.phone, data.attendance, data.adults, data.children, data.message]);
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonical, Utilities.Charset.UTF_8)
    .map(byte => ((byte + 256) % 256).toString(16).padStart(2, '0')).join('');
}
function clean_(value) { return String(value == null ? '' : value).trim(); }
function sheetText_(value) {
  // Guest-authored text must never become a spreadsheet formula.
  return /^[=+@-]/.test(value) ? "'" + value : value;
}
function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
