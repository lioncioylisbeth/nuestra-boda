(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GuestAdminCore = api;
})(typeof window !== 'undefined' ? window : this, function() {
  'use strict';
  const YES = 'Sí, asistiré con mucho gusto';
  const NO = 'Lamentablemente no podré asistir';
  const plain = value => String(value == null ? '' : value);
  const folded = value => plain(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function visible(guests, options) {
    const search = folded(options.search).trim();
    return guests.filter(g => (!search || folded(g.name + ' ' + g.phone).includes(search)) &&
      (options.attendance === 'all' || g.attendance === (options.attendance === 'yes' ? YES : NO)) &&
      (options.status === 'all' || g.status === options.status)).slice().sort((a,b) => {
      if (options.sort === 'name') return a.name.localeCompare(b.name, 'es');
      return (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || a.name.localeCompare(b.name, 'es');
    });
  }
  function totals(guests) {
    const result = {records:guests.length, attending:0, declined:0, passes:0, adults:0, children:0, incomplete:0};
    guests.forEach(g => {
      if (g.attendance === NO) result.declined++;
      if (g.attendance !== YES) return;
      result.attending++;
      result.passes += Number.isInteger(g.passes) ? g.passes : 0;
      result.adults += Number.isInteger(g.adults) ? g.adults : 0;
      result.children += Number.isInteger(g.children) ? g.children : 0;
      if (!Number.isInteger(g.adults) || !Number.isInteger(g.children) || !Number.isInteger(g.passes) || g.adults + g.children !== g.passes) result.incomplete++;
    });
    return result;
  }
  function validGuest(g) {
    return g && typeof g.id === 'string' && /^[A-Za-z0-9-]{16,80}$/.test(g.id) && /^[a-f0-9]{64}$/.test(g.revision) &&
      ['name','phone','date','attendance','status','message','notes'].every(key => typeof g[key] === 'string') &&
      ['adults','children','passes'].every(key => g[key] === null || Number.isInteger(g[key]) && g[key] >= 0);
  }
  function verified(response, body, action, requestId) {
    if (!response || !response.ok || response.type === 'opaque' || !body || body.ok !== true || body.version < 3 || body.action !== action || body.requestId !== requestId) return false;
    if (action === 'admin.list') return Array.isArray(body.guests) && body.guests.every(validGuest) && new Set(body.guests.map(g=>g.id)).size === body.guests.length;
    if (action === 'admin.update') return validGuest(body.guest);
    if (action === 'admin.delete') return body.deleted === true && typeof body.id === 'string';
    return false;
  }
  const errors = {
    unauthorized:'No se pudo validar la clave. Comprueba que sea la clave privada de este panel y que el acceso esté activado.',
    invalid_data:'Revisa los campos: nombre, celular y número de adultos y niños (máximo 10 personas).',
    invalid_request:'El receptor de Google debe actualizarse para abrir esta lista. Consulta las instrucciones de activación.',
    conflict:'Este registro cambió en Sheets o en otra sesión. Cierra esta ventana, actualiza la lista y revisa los cambios antes de editarlo de nuevo.',
    not_found:'Este registro ya no está disponible. Cierra esta ventana y actualiza la lista.',
    formula_row:'Esta fila contiene fórmulas. Edítala directamente en Google Sheets para conservarlas.',
    busy:'La hoja está ocupada. Espera un momento y pulsa Actualizar.',
    verification_failed:'No se pudo verificar el resultado. Actualiza la lista antes de volver a editar.',
    admin_unavailable:'No se pudo completar la operación en Google Sheets. Actualiza la lista para comprobar su estado.',
    unverified:'No se pudo verificar la respuesta de Google. Si estabas guardando, actualiza la lista antes de repetir la operación.',
    connection:'No se pudo verificar la conexión con Google Sheets. Revisa la conexión y la activación del receptor. Si estabas guardando, actualiza la lista antes de repetir.'
  };
  return {YES, NO, visible, totals, verified, validGuest, error:code=>errors[code] || errors.unverified};
});
