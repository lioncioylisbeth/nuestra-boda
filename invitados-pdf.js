(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.GuestPDF = factory(root.jspdf.jsPDF, root.GuestAdminCore, root.GuestPdfFonts);
})(typeof window !== 'undefined' ? window : this, function(jsPDF, core, fonts) {
  'use strict';
  const zone = 'America/Mexico_City';
  function filename(date = new Date()) {
    const parts = new Intl.DateTimeFormat('es-MX', {timeZone:zone, day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(date);
    const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `Lista de invitados LyL [${p.day}-${p.month}-${p.year} ${p.hour}-${p.minute}].pdf`;
  }
  function dateLabel(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-MX', {timeZone:zone, dateStyle:'short', timeStyle:'short'}).format(date);
  }
  // The embedded font subsets cover Latin text and punctuation. Replace symbols
  // outside this repertoire individually instead of emitting broken glyphs.
  function text(value) {
    return String(value == null ? '' : value).normalize('NFC')
      .replace(/\r\n?/g, '\n').replace(/[^\u0020-\u024f\u2000-\u206f\n]/gu, '?');
  }
  function create(guests, settings = {}) {
    const rows = core.visible(guests, settings.filters || {search:'', attendance:'all', status:'all', sort:'newest'});
    if (!rows.length) throw new Error('empty_list');
    const totals = core.totals(rows), now = settings.now || new Date();
    const doc = new jsPDF({orientation:'landscape', unit:'mm', format:'a4', compress:true, putOnlyUsedFonts:true});
    for (const [key,family,style] of [['sans','LyLSans','normal'],['bold','LyLSans','bold'],['serif','LyLSerif','normal']]) {
      doc.addFileToVFS(key+'.ttf',fonts[key]);doc.addFont(key+'.ttf',family,style);
    }
    const name = filename(now);
    doc.setProperties({title:name.slice(0, -4), subject:'Lista de invitados de la boda de Lioncio y Lisbeth', author:'Lioncio & Lisbeth', creator:'Invitación Lioncio & Lisbeth'});
    const navy = [19,34,59], gold = [164,133,60];
    const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
    const margin = 14, available = width - margin * 2, center = width / 2;
    function label(value, x, y, size = 9, font = 'LyLSans', style = 'normal', align = 'left', color = navy) {
      doc.setFont(font, style).setFontSize(size).setTextColor(...color);
      doc.text(text(value), x, y, {align});
    }
    doc.setDrawColor(...gold).setLineWidth(.45);
    doc.ellipse(center-2.8, 15, 4.5, 5); doc.ellipse(center+2.8, 15, 4.5, 5);
    label('NUESTRA BODA  ·  28 DE NOVIEMBRE DE 2026', center, 26, 8, 'LyLSans', 'normal', 'center', gold);
    label('Lioncio & Lisbeth', center, 39, 30, 'LyLSerif', 'normal', 'center');
    label('LISTA DE INVITADOS', center, 47, 10, 'LyLSans', 'normal', 'center');
    const gap = 4, cardWidth = (available - gap * 3) / 4;
    [['REGISTROS',rows.length], ['PERSONAS',totals.passes], ['ADULTOS',totals.adults], ['NIÑOS',totals.children]].forEach(([title,total], i) => {
      const x = margin + i * (cardWidth + gap);
      doc.setFillColor(251,248,238).setDrawColor(219,202,161).setLineWidth(.2);
      doc.roundedRect(x, 54, cardWidth, 19, 1.5, 1.5, 'FD');
      label(title, x+cardWidth/2, 60, 8, 'LyLSans', 'normal', 'center', gold);
      label(total, x+cardWidth/2, 69, 21, 'LyLSerif', 'normal', 'center');
    });
    const filters = settings.filters || {};
    const attendance = filters.attendance === 'yes' ? 'Sí asistirán' : filters.attendance === 'no' ? 'No asistirán' : 'Todas las respuestas';
    const summary = `Lista filtrada · ${attendance} · ${filters.status && filters.status !== 'all' ? filters.status : 'Todos los estados'}${filters.search ? ' · Búsqueda: '+filters.search : ''}`;
    doc.setFont('LyLSans', 'normal').setFontSize(8);
    const context = doc.splitTextToSize(text(summary), available);
    label(context.join('\n'), center, 80, 8, 'LyLSans', 'normal', 'center');
    let startY = 80 + context.length * 4;
    label('Actualizada: '+dateLabel(settings.updatedAt || now), center, startY, 8, 'LyLSans', 'normal', 'center');
    if (totals.incomplete) {
      startY += 5;
      label(`${totals.incomplete} registro(s) con desglose por revisar. Solo se suman las cantidades informadas.`, center, startY, 8, 'LyLSans', 'normal', 'center');
    }
    startY += 7;
    const count = value => value === null ? '-' : String(value);
    const body = [];
    rows.forEach(g => {
      body.push([text(g.name)+'\n'+dateLabel(g.date), text(g.phone || '-'), g.attendance === core.YES ? 'Sí asistirá' : g.attendance === core.NO ? 'No asistirá' : 'Revisar', count(g.adults), count(g.children), count(g.passes), text(g.status || 'Sin estado')]);
      if (settings.includeMessages && g.message) body.push([{content:text('Dedicatoria de '+g.name+': '+g.message), colSpan:7, styles:{font:'LyLSerif', fontStyle:'normal', fontSize:10, fillColor:[250,248,242]}}]);
    });
    doc.autoTable({
      startY, margin:{left:margin, right:margin, top:25, bottom:18}, tableWidth:available,
      head:[['Invitado / Familia','Celular','Asistencia','Adultos','Niños','Total','Seguimiento']], body,
      foot:[[{content:'TOTALES DE ASISTENTES', colSpan:3}, String(totals.adults), String(totals.children), String(totals.passes), '']],
      showHead:'everyPage', showFoot:'lastPage', rowPageBreak:'avoid', theme:'striped',
      styles:{font:'LyLSans', fontSize:9, textColor:navy, cellPadding:3, overflow:'linebreak', valign:'middle', lineColor:[232,225,209], lineWidth:{bottom:.15}},
      headStyles:{fillColor:navy, textColor:[255,250,232], fontStyle:'bold'},
      footStyles:{fillColor:[247,240,222], textColor:navy, fontStyle:'bold'},
      alternateRowStyles:{fillColor:[251,249,244]},
      columnStyles:{0:{cellWidth:available*.27}, 1:{cellWidth:available*.17}, 2:{cellWidth:available*.15}, 3:{cellWidth:available*.075,halign:'center'}, 4:{cellWidth:available*.075,halign:'center'}, 5:{cellWidth:available*.075,halign:'center',fontStyle:'bold'}, 6:{cellWidth:available*.185}},
      didParseCell(data) { if (data.section !== 'body' && [3,4,5].includes(data.column.index)) data.cell.styles.halign = 'center'; },
      willDrawPage(data) {
        if (data.pageNumber > 1) {label('Lioncio & Lisbeth', margin, 16, 17, 'LyLSerif');label('LISTA DE INVITADOS · CONTINUACIÓN', width-margin, 16, 8, 'LyLSans', 'normal', 'right');}
      }
    });
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page).setDrawColor(...gold).setLineWidth(.2).line(margin,height-13,width-margin,height-13);
      label('Lioncio & Lisbeth · 28.11.2026', margin, height-8, 8);
      label(`Página ${page} de ${pages}`, width-margin, height-8, 8, 'LyLSans', 'normal', 'right');
    }
    return {blob:doc.output('blob'), filename:name};
  }
  return {create, filename};
});
