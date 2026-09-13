/**
 * Receptor v4. Pegar en el proyecto vinculado a la hoja existente y publicar
 * una nueva versión del despliegue actual. Guardar el editor no lo despliega.
 * No cambia encabezados, formatos, resúmenes ni registros anteriores.
 */
const RSVP_SHEET_NAME = 'Confirmaciones';
const RSVP_FIRST_ROW = 7;
function doGet() {
  // Never return guest data or access credentials from a public GET.
  return json_({ok:true, service:'rsvp-lioncio-lisbeth', version:4});
}
function doPost(e) {
  let locked = false;
  let stage = 'read';
  const lock = LockService.getScriptLock();
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > 16000) return json_({ok:false, code:'invalid_request'});
    const input = JSON.parse(raw || '{}');
    if (input && input.action) return adminRequest_(input);
    const data = validateRsvp_(input);
    if (!data) return json_({ok:false, code:'invalid_data'});
    locked = lock.tryLock(10000);
    if (!locked) return json_({ok:false, code:'busy'});
    const sheet = getRsvpSheet_();
    const fingerprint = fingerprint_(data);
    const prior = findRequest_(sheet, data.requestId);
    if (prior && prior.fingerprint !== fingerprint) return json_({ok:false, code:'request_conflict'});
    if (prior && /GUEST-DELETED:|GUEST-ARCHIVE-PENDING:/.test(sheet.getRange(prior.row, 1).getNote())) {
      return json_({ok:false, code:'archived_request'});
    }
    if (prior && String(sheet.getRange(prior.row, 2).getDisplayValues()[0][0]).trim()) {
      // A name alone is not evidence that the complete response was saved.
      // Never overwrite an existing or subsequently edited guest on a retry.
      if (!rsvpRowMatches_(sheet, prior.row, data)) return json_({ok:false, code:'registration_review_required'});
      return json_({ok:true, requestId:data.requestId, duplicate:true, version:4});
    }
    const row = prior ? prior.row : getNextRsvpRow_(sheet);
    if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), row - sheet.getMaxRows());
    // Reserve the row first. A retry after an interrupted write reuses it.
    stage = 'reserve';
    const cell = sheet.getRange(row, 1);
    const oldNote = cell.getNote();
    if (!prior) cell.setNote((oldNote ? oldNote + '\n' : '') + 'RSVP-ID: ' + data.requestId + ' HASH: ' + fingerprint);
    stage = 'write';
    // The existing table owns its formats. Escape phone/text as literals instead
    // of changing a typed column's number format during every registration.
    sheet.getRange(row, 1, 1, 11).setValues([[
      new Date(), sheetText_(data.name), data.attendance, data.passes,
      sheetText_(data.message), 'Invitación web', 'Pendiente', '',
      sheetText_(data.phone), data.adults, data.children
    ]]);
    stage = 'verify';
    SpreadsheetApp.flush();
    if (!rsvpRowMatches_(sheet, row, data)) return json_({ok:false, code:'registration_verify_failed'});
    return json_({ok:true, requestId:data.requestId, duplicate:false, version:4});
  } catch (error) {
    // Details stay in the owner's Apps Script execution log, never in the public
    // response. Do not log the request body, key, phone or dedication separately.
    console.error('RSVP v4, etapa ' + stage + ': ' + String(error && error.message || error));
    return json_({ok:false, code:'registration_' + stage + '_failed'});
  } finally {
    if (locked) lock.releaseLock();
  }
}
function rsvpRowMatches_(sheet, row, data) {
  const range = sheet.getRange(row, 1, 1, 11);
  const values = range.getValues()[0];
  if (range.getFormulas()[0].some(Boolean)) return false;
  if (!values[0] || typeof values[0].getTime !== 'function' || !Number.isFinite(values[0].getTime())) return false;
  return values[1] === data.name && values[2] === data.attendance && values[3] === data.passes
    && values[4] === data.message && values[5] === 'Invitación web'
    && values[8] === data.phone && values[9] === data.adults && values[10] === data.children;
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
  const id = PropertiesService.getScriptProperties().getProperty('RSVP_SPREADSHEET_ID');
  const workbook = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
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
    if (String(values[index][0]).trim() || /RSVP-ID:|GUEST-ID:/.test(notes[index][0])) return RSVP_FIRST_ROW + index + 1;
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

/** Run ONLY in the Apps Script editor. Running again revokes the previous key. */
function configurarAccesoInvitados() {
  const workbook = SpreadsheetApp.getActiveSpreadsheet();
  if (!workbook || !workbook.getSheetByName(RSVP_SHEET_NAME)) throw new Error('Ejecuta esta función desde el proyecto vinculado a la hoja de Confirmaciones.');
  PropertiesService.getScriptProperties().setProperty('RSVP_SPREADSHEET_ID', workbook.getId());
  const key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('GUEST_ADMIN_KEY_SHA256', digest_(key));
  console.log('Copia esta clave privada en tu gestor de contraseñas. No la publiques ni la compartas con invitados: ' + key);
}
function digest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(byte => ((byte + 256) % 256).toString(16).padStart(2, '0')).join('');
}
function adminAuthorized_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('GUEST_ADMIN_KEY_SHA256');
  if (!expected || !/^[a-f0-9]{64}$/.test(String(key || ''))) return false;
  const actual = digest_(key);
  let difference = actual.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return difference === 0;
}
function adminRequest_(input) {
  const response = payload => json_(Object.assign({version:4, action:input.action, requestId:input.requestId}, payload));
  // Validate the secret before opening or scanning the workbook.
  if (!adminAuthorized_(input.key)) return response({ok:false, code:'unauthorized'});
  if (!['admin.list','admin.update','admin.delete'].includes(input.action) || !/^[A-Za-z0-9-]{16,80}$/.test(input.requestId || '')) {
    return response({ok:false, code:'invalid_request'});
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return response({ok:false, code:'busy'});
  try {
    const sheet = getRsvpSheet_();
    const entries = guestEntries_(sheet);
    if (input.action === 'admin.list') {
      return response({ok:true, guests:entries.filter(entry => entry.values[1] && !entry.deleted).map(guestView_), updatedAt:new Date().toISOString(), spreadsheetUrl:sheet.getParent().getUrl()});
    }
    const entry = entries.find(item => item.id === input.id);
    if (!entry) return response({ok:false, code:'not_found'});
    if (entry.deleted && input.action === 'admin.delete') return response({ok:true, id:entry.id, deleted:true, duplicate:true});
    if (entry.pendingArchive && input.action === 'admin.delete' && !entry.values[1]) {
      sheet.getRange(entry.row,1).setNote(entry.note + '\nGUEST-DELETED: ' + entry.id);
      SpreadsheetApp.flush();
      return response({ok:true, id:entry.id, deleted:true, duplicate:true});
    }
    if (entry.deleted || !entry.values[1]) return response({ok:false, code:'not_found'});
    if (input.revision !== entry.revision) return response({ok:false, code:'conflict'});
    if (readGuestEntry_(sheet, entry.row, entry.id).revision !== entry.revision) return response({ok:false, code:'conflict'});
    // Formula-backed entries remain editable in Sheets, not overwritten by the web editor.
    if (entry.formulas.some(Boolean)) return response({ok:false, code:'formula_row'});
    if (input.action === 'admin.update') {
      const update = validateGuestEdit_(input.guest);
      if (!update) return response({ok:false, code:'invalid_data'});
      const values = entry.values.slice();
      values[1] = sheetText_(update.name); values[2] = update.attendance; values[3] = update.adults + update.children;
      values[4] = sheetText_(update.message); values[6] = update.status; values[7] = sheetText_(update.notes);
      values[8] = sheetText_(update.phone); values[9] = update.adults; values[10] = update.children;
      // Preserve the table's existing phone format; sheetText_ keeps it literal.
      // One range write; preserve date and source, and never re-evaluate stored text.
      sheet.getRange(entry.row, 1, 1, 11).setValues([values.map((value,index) =>
        (index === 0 || index === 5) && typeof value === 'string' ? sheetText_(value) : value)]);
      SpreadsheetApp.flush();
      const saved = readGuestEntry_(sheet, entry.row, entry.id);
      const view = guestView_(saved);
      if (!guestMatches_(view, update)) return response({ok:false, code:'verification_failed'});
      return response({ok:true, guest:view});
    }
    archiveGuest_(sheet, entry);
    return response({ok:true, id:entry.id, deleted:true});
  } catch (_) {
    return response({ok:false, code:'admin_unavailable'});
  } finally {
    lock.releaseLock();
  }
}
function guestEntries_(sheet) {
  const count = sheet.getMaxRows() - RSVP_FIRST_ROW + 1;
  const values = sheet.getRange(RSVP_FIRST_ROW, 1, count, 11).getValues();
  const formulas = sheet.getRange(RSVP_FIRST_ROW, 1, count, 11).getFormulas();
  const notes = sheet.getRange(RSVP_FIRST_ROW, 1, count, 1).getNotes();
  const entries = [], seen = {};
  values.forEach((line, index) => {
    let note = String(notes[index][0] || '');
    if (!line[1] && !/GUEST-DELETED:|GUEST-ARCHIVE-PENDING:/.test(note)) return;
    let match = note.match(/(?:^|\n)GUEST-ID: ([A-Za-z0-9-]+)(?:\n|$)/);
    let id = match && match[1];
    // Detect duplicated notes caused by copying rows; never identify by row number alone.
    if (!id || seen[id]) {
      id = Utilities.getUuid();
      note = note.replace(/(?:^|\n)GUEST-ID: [A-Za-z0-9-]+(?=\n|$)/g, '') + '\nGUEST-ID: ' + id;
      sheet.getRange(RSVP_FIRST_ROW + index, 1).setNote(note.trim());
    }
    seen[id] = true;
    entries.push({id, row:RSVP_FIRST_ROW + index, values:line, formulas:formulas[index], note,
      revision:digest_(JSON.stringify([line, formulas[index]])), deleted:/GUEST-DELETED:/.test(note), pendingArchive:/GUEST-ARCHIVE-PENDING:/.test(note)});
  });
  return entries;
}
function readGuestEntry_(sheet, row, id) {
  const range = sheet.getRange(row, 1, 1, 11), values = range.getValues()[0], formulas = range.getFormulas()[0];
  return {id, row, values, formulas, revision:digest_(JSON.stringify([values, formulas]))};
}
function guestView_(entry) {
  const v = entry.values;
  const count = value => value !== '' && Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const date = v[0] && typeof v[0].toISOString === 'function' ? v[0].toISOString() : clean_(v[0]);
  return {id:entry.id, revision:entry.revision, date, name:clean_(v[1]), attendance:clean_(v[2]), passes:count(v[3]),
    message:clean_(v[4]), source:clean_(v[5]), status:clean_(v[6]), notes:clean_(v[7]), phone:clean_(v[8]),
    adults:count(v[9]), children:count(v[10]), formulaRow:entry.formulas.some(Boolean)};
}
function validateGuestEdit_(value) {
  if (!value || typeof value !== 'object') return null;
  const name = clean_(value.name).replace(/[\r\n\t]+/g, ' '), phone = clean_(value.phone);
  const message = clean_(value.message), notes = clean_(value.notes), status = clean_(value.status);
  const attendance = clean_(value.attendance);
  if (name.length < 2 || name.length > 150 || message.length > 2000 || notes.length > 1000) return null;
  if (phone && !/^\+\d{10,15}$/.test(phone)) return null;
  if (!['Pendiente','Confirmado','Contactado'].includes(status)) return null;
  if (!['Sí, asistiré con mucho gusto','Lamentablemente no podré asistir'].includes(attendance)) return null;
  let adults = value.adults, children = value.children;
  if (attendance === 'Lamentablemente no podré asistir') { adults = 0; children = 0; }
  if (!Number.isInteger(adults) || !Number.isInteger(children) || adults < 0 || children < 0 || adults + children > 10 || (attendance === 'Sí, asistiré con mucho gusto' && adults + children < 1)) return null;
  return {name, phone, message, notes, status, attendance, adults, children};
}
function guestMatches_(guest, update) {
  return Object.keys(update).every(key => guest[key] === update[key]);
}
function archiveGuest_(sheet, entry) {
  const book = sheet.getParent();
  const name = 'Archivo de invitados';
  let archive = book.getSheetByName(name);
  if (!archive) {
    archive = book.insertSheet(name);
    archive.getRange(1,1,1,15).setValues([['Archivado el','ID','Versión','Nota original','Fecha y hora','Invitado / Familia','¿Asistirá?','Pases','Dedicatoria','Origen','Estado','Observaciones','Teléfono','Adultos','Niños']]);
    archive.getRange(1,1,1,15).setBackground('#061126').setFontColor('#e2c575').setFontWeight('bold');
    archive.setFrozenRows(1);
  }
  const last = archive.getLastRow();
  const archived = last > 1 && archive.getRange(2,2,last-1,2).getValues().some(v => v[0] === entry.id && v[1] === entry.revision);
  if (!archived) {
    const row = last + 1;
    if (row > archive.getMaxRows()) archive.insertRowsAfter(archive.getMaxRows(), row - archive.getMaxRows());
    const safe = entry.values.map(value => typeof value === 'string' ? sheetText_(value) : value);
    archive.getRange(row,13).setNumberFormat('@');
    archive.getRange(row,1,1,15).setValues([[new Date(),entry.id,entry.revision,sheetText_(entry.note)].concat(safe)]);
    SpreadsheetApp.flush();
    if (archive.getRange(row,2).getValues()[0][0] !== entry.id) throw new Error('archive_not_verified');
  }
  // Clear only the data cells; deleting a sheet row would damage the summary at the right.
  sheet.getRange(entry.row,1).setNote(entry.note + '\nGUEST-ARCHIVE-PENDING: ' + entry.id);
  SpreadsheetApp.flush();
  sheet.getRange(entry.row,1,1,11).clearContent();
  sheet.getRange(entry.row,1).setNote(entry.note + '\nGUEST-DELETED: ' + entry.id);
  SpreadsheetApp.flush();
  if (sheet.getRange(entry.row,2).getValues()[0][0]) throw new Error('delete_not_verified');
}
