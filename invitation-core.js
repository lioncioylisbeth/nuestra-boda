(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WeddingCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const YES = 'Sí, asistiré con mucho gusto';
  const NO = 'Lamentablemente no podré asistir';
  const text = value => String(value == null ? '' : value).trim();
  function normalizePhone(value) {
    const raw = text(value);
    if (!/^[+\d()\s-]+$/.test(raw) || (raw.match(/\+/g) || []).length > 1 || (raw.includes('+') && raw[0] !== '+')) return '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) return '';
    // Un número local mexicano de diez dígitos se guarda con su lada internacional.
    return '+' + (digits.length === 10 ? '52' : '') + digits;
  }
  function validate(input) {
    const name = text(input.name).replace(/[\r\n\t]+/g, ' ');
    const phone = normalizePhone(input.phone);
    const attendance = text(input.attendance);
    const message = text(input.message);
    if (text(input.website)) return { error:'No pudimos procesar el formulario. Revisa tus datos.', field:'guest-name' };
    if (name.length < 2 || name.length > 150) return { error:'Escribe el nombre del invitado o familia (de 2 a 150 caracteres).', field:'guest-name' };
    if (!phone) return { error:'Escribe un celular válido: 10 dígitos en México o incluye tu lada internacional.', field:'guest-phone' };
    if (![YES, NO].includes(attendance)) return { error:'Selecciona si podrás acompañarnos.', field:'attendance' };
    let adults = Number(input.adults), children = Number(input.children);
    if (attendance === NO) { adults = 0; children = 0; }
    else if (text(input.adults) === '' || text(input.children) === '' || !Number.isInteger(adults) || !Number.isInteger(children) || adults < 0 || children < 0 || adults + children < 1 || adults + children > 10) {
      return { error:'Indica adultos y niños con números enteros. El total debe estar entre 1 y 10, respetando tus pases.', field:'adults' };
    }
    if (message.length > 2000) return { error:'Tu dedicatoria puede tener hasta 2,000 caracteres.', field:'message' };
    return { data:{name, phone, attendance, adults, children, passes:adults + children, message, source:'Invitación web'} };
  }
  function whatsappMessage(data) {
    return [
      '*LIONCIO & LISBETH*',
      '_Nuestra boda · 28 de noviembre de 2026_',
      '', '*CONFIRMACIÓN DE ASISTENCIA*',
      '', '*Invitado / familia*', data.name,
      '', '*Asistencia*', data.attendance,
      '', '*Personas confirmadas*',
      'Adultos: ' + data.adults + '  ·  Niños: ' + data.children,
      'Total: ' + data.passes + (data.passes === 1 ? ' persona' : ' personas'),
      '', '*Celular de contacto*', data.phone,
      ...(data.message ? ['', '*Dedicatoria para los novios*', data.message] : []),
      '', '_Con cariño, ' + data.name.replace(/[*_~`]/g, '') + '_'
    ].join('\n');
  }
  function whatsappURL(data) { return 'https://wa.me/527341128601?text=' + encodeURIComponent(whatsappMessage(data)); }
  function verifiedReceipt(response, receipt, requestId) {
    return Boolean(response && response.ok && response.type !== 'opaque' && receipt && receipt.ok === true && receipt.requestId === requestId && Number.isInteger(receipt.version) && receipt.version >= 2);
  }
  function icsEscape(value) { return text(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
  function foldLine(line) {
    let result = '', bytes = 0;
    for (const character of line) {
      const length = new TextEncoder().encode(character).length;
      if (bytes + length > 75) { result += '\r\n '; bytes = 1; }
      result += character; bytes += length;
    }
    return result;
  }
  function calendar(kind, now) {
    const events = {
      ceremony:{time:'20261128T223000Z', title:'Boda de Lioncio y Lisbeth · Ceremonia religiosa', place:'Parroquia San Miguel, C. Cobarrubias 102, Centro, 62900 Jojutla, Morelos', map:'https://maps.app.goo.gl/4BFoYmuypEhoGPe6A', local:'4:30 PM'},
      reception:{time:'20261129T000000Z', title:'Boda de Lioncio y Lisbeth · Recepción', place:'Salón Camino Real, Francisco Villa, Emiliano Zapata, 62772 Santa Rosa Treinta, Morelos', map:'https://maps.app.goo.gl/UZYhMsVtihD85hrW8', local:'6:00 PM'}
    };
    const event = events[kind];
    if (!event) throw new Error('Evento no disponible');
    const stamp = (now || new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Lioncio y Lisbeth//Nuestra boda//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
      'UID:' + kind + '-20261128@lioncioylisbeth.github.io', 'DTSTAMP:' + stamp, 'DTSTART:' + event.time,
      'SUMMARY:' + icsEscape(event.title), 'LOCATION:' + icsEscape(event.place),
      'DESCRIPTION:' + icsEscape('Sábado 28 de noviembre de 2026, ' + event.local + ' (hora local de Morelos).\n' + event.map),
      'URL:' + event.map, 'END:VEVENT', 'END:VCALENDAR'].map(foldLine).join('\r\n') + '\r\n';
  }
  return {YES, NO, normalizePhone, validate, whatsappMessage, whatsappURL, verifiedReceipt, calendar};
});
