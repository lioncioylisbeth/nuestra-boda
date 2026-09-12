(function() {
  'use strict';
  const core = window.GuestAdminCore;
  const endpoint = 'https://script.google.com/macros/s/AKfycbyaJB2eZqEIr6udAGmWQyleb9RmuE4RrZpKcCC3CCnpuGLzWL9Abd8bkq2X3gKEAsx1/exec';
  const $ = id => document.getElementById(id);
  let key = '', guests = [], current = null, refreshing = false, writing = false, opening = false;
  let generation = 0, lastActivity = Date.now(), loadedAt = '', listFresh = false;
  const activeRequests = new Set();
  function status(id, message, kind) {
    $(id).textContent = message; $(id).className = 'status' + (kind ? ' ' + kind : '');
  }
  function makeError(code) { const error = new Error(core.error(code)); error.code = code; return error; }
  async function api(action, data, accessKey) {
    const requestId = crypto.randomUUID(), epoch = generation;
    const controller = new AbortController(); activeRequests.add(controller);
    const timer = setTimeout(()=>controller.abort(), 25000);
    try {
      const response = await fetch(endpoint, {method:'POST', mode:'cors', credentials:'omit', cache:'no-store',
        headers:{'Content-Type':'text/plain;charset=utf-8'}, signal:controller.signal,
        body:JSON.stringify(Object.assign({}, data, {action, requestId, key:accessKey || key}))});
      if (epoch !== generation) throw makeError('unauthorized');
      if (!response.ok || response.type === 'opaque') throw makeError('unverified');
      const body = await response.json();
      if (epoch !== generation) throw makeError('unauthorized');
      if (body && body.ok === false) throw makeError(body.code || 'unverified');
      if (!core.verified(response, body, action, requestId)) throw makeError('unverified');
      if (action === 'admin.update' && body.guest.id !== data.id || action === 'admin.delete' && body.id !== data.id) throw makeError('unverified');
      return body;
    } catch(error) {
      if (error.code) throw error;
      throw makeError('connection');
    } finally { clearTimeout(timer); activeRequests.delete(controller); }
  }
  function lock(message) {
    generation++; key=''; guests=[]; current=null; listFresh=false; loadedAt='';
    activeRequests.forEach(controller=>controller.abort());
    $('dashboard').hidden=true; $('access').hidden=false; $('logout').hidden=true;
    $('guest-rows').replaceChildren(); $('access-key').value=''; $('print').disabled=true;
    ['total-records','total-passes','total-adults','total-children'].forEach(id=>$(id).textContent='—');
    ['edit-dialog','delete-dialog'].forEach(id=>{if($(id).open) $(id).close();});
    $('edit-form').reset(); $('delete-name').textContent=''; $('print-context').textContent='';
    $('open-sheets').href='https://docs.google.com/spreadsheets/';
    status('access-status',message || '',message ? 'error' : '');
  }
  function sessionError(error, target) {
    if (error.code === 'unauthorized') { lock(error.message); $('access-key').focus(); }
    else status(target,error.message,'error');
  }
  function options() {return {search:$('search').value,attendance:$('filter-attendance').value,status:$('filter-status').value,sort:$('sort').value};}
  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? (value || 'Sin fecha') : new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Mexico_City'}).format(date);
  }
  function el(tag, text, className) {
    const node=document.createElement(tag);
    if(text!=null) node.textContent=text;
    if(className) node.className=className;
    return node;
  }
  function pencil() {
    const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg'), path=document.createElementNS(ns,'path');
    svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true');
    path.setAttribute('d','m15 4 5 5M4 20l5-1L20 8a2.1 2.1 0 0 0-5-5L4 15Z'); svg.append(path); return svg;
  }
  function render() {
    const totals=core.totals(guests), filtered=core.visible(guests,options());
    for(const [id,field] of [['total-records','records'],['total-passes','passes'],['total-adults','adults'],['total-children','children']]) $(id).textContent=totals[field];
    $('attendance-summary').textContent=totals.attending+' registros sí · '+totals.declined+' no';
    $('incomplete-counts').hidden=!totals.incomplete;
    $('incomplete-counts').textContent=totals.incomplete+' registro(s) requieren revisar el desglose de adultos y niños. Los totales solo suman las cantidades informadas.';
    $('visible-count').textContent=filtered.length+' de '+guests.length+' registros';
    const fragment=document.createDocumentFragment();
    filtered.forEach(g=>{
      const row=el('tr'), name=el('td');
      name.append(el('span',g.name,'guest-name'),el('span',formatDate(g.date),'guest-date')); row.append(name);
      const phone=el('td');
      if(/^\+\d{10,15}$/.test(g.phone)) {const link=el('a',g.phone,'phone'); link.href='tel:'+g.phone;phone.append(link);}
      else phone.textContent=g.phone || '—';
      row.append(phone);
      const attendance=el('td');attendance.append(el('span',g.attendance===core.YES?'Sí asistirá':g.attendance===core.NO?'No asistirá':'Revisar','badge '+(g.attendance===core.YES?'yes':g.attendance===core.NO?'no':'')));row.append(attendance);
      for(const field of ['adults','children','passes']) row.append(el('td',g[field]===null?'—':g[field], 'number'+(field==='passes'?' total-cell':'')));
      const tracking=el('td');tracking.append(el('span',g.status||'Sin estado','badge'+(g.status==='Confirmado'?' confirmed':'')));row.append(tracking);
      const actions=el('td',null,'actions-column'), buttons=el('div',null,'row-actions');
      const edit=el('button',null,'icon-button');edit.type='button';edit.append(pencil());edit.setAttribute('aria-label','Editar a '+g.name);edit.title='Editar';edit.addEventListener('click',()=>openEditor(g));
      const remove=el('button','×','icon-button delete');remove.type='button';remove.setAttribute('aria-label','Retirar a '+g.name);remove.title='Retirar y archivar';remove.addEventListener('click',()=>openDelete(g));
      edit.disabled=writing;remove.disabled=writing;buttons.append(edit,remove);actions.append(buttons);row.append(actions);fragment.append(row);
      if(g.message) {const detail=el('tr',null,'message-row'), cell=el('td','Dedicatoria de '+g.name+': '+g.message);cell.colSpan=7;detail.append(cell);fragment.append(detail);}
    });
    $('guest-rows').replaceChildren(fragment);
    $('empty-state').hidden=filtered.length>0;
    $('empty-title').textContent=guests.length?'No hay coincidencias':'Aún no hay confirmaciones';
    $('empty-description').textContent=guests.length?'Prueba otro nombre o cambia los filtros.':'Los registros aparecerán aquí cuando los invitados confirmen.';
    $('print').disabled=!filtered.length || !listFresh || writing;
    const subset=core.totals(filtered);
    $('print-context').textContent=filtered.length+' registros · '+subset.passes+' asistentes · '+subset.adults+' adultos · '+subset.children+' niños'+(subset.incomplete?' · '+subset.incomplete+' desglose(s) por revisar':'')+'\nLista filtrada · '+$('filter-attendance').selectedOptions[0].textContent+' · '+$('filter-status').selectedOptions[0].textContent+(options().search?' · Búsqueda: '+options().search:'')+' · Actualizada: '+formatDate(loadedAt);
  }
  async function refresh(manual) {
    if(!key || refreshing || writing || $('edit-dialog').open || $('delete-dialog').open) return;
    refreshing=true; $('refresh').disabled=true;
    if(manual) status('sync-status','Consultando Google Sheets…');
    try {const result=await api('admin.list',{});guests=result.guests;loadedAt=result.updatedAt;listFresh=true;render();status('sync-status','Sincronizado · '+formatDate(loadedAt),'success');}
    catch(error) {listFresh=false;$('print').disabled=true;sessionError(error,'sync-status');}
    finally {refreshing=false;$('refresh').disabled=false;}
  }
  function openEditor(guest) {
    if(writing || refreshing || !key) return;
    current=guest;
    for(const name of ['name','phone','attendance','adults','children','status','message','notes']) $('edit-'+name).value=guest[name]===null?'':guest[name];
    if(!guest.status) $('edit-status').value='Pendiente';
    status('edit-status-message',guest.formulaRow?core.error('formula_row'):'',guest.formulaRow?'error':'');
    $('save-edit').disabled=!!guest.formulaRow;
    counts();$('edit-dialog').showModal();$('edit-name').focus();
  }
  function counts() {
    const no=$('edit-attendance').value===core.NO;
    for(const id of ['edit-adults','edit-children']) $(id).disabled=no;
    $('edit-total').textContent=no?'0':Number($('edit-adults').value)+Number($('edit-children').value);
  }
  function closeEditor() {if(!writing){$('edit-dialog').close();current=null;$('edit-form').reset();}}
  function openDelete(guest) {
    if(writing || refreshing || !key) return;
    current=guest;$('delete-name').textContent=guest.name;
    status('delete-status',guest.formulaRow?core.error('formula_row'):'',guest.formulaRow?'error':'');
    $('confirm-delete').disabled=!!guest.formulaRow;$('delete-dialog').showModal();$('cancel-delete').focus();
  }
  function closeDelete() {if(!writing){$('delete-dialog').close();current=null;$('delete-name').textContent='';}}
  function busy(value) {
    writing=value;
    for(const id of ['save-edit','cancel-edit','close-edit','confirm-delete','cancel-delete','print','refresh']) $(id).disabled=value;
    for(const name of ['name','phone','attendance','adults','children','status','message','notes']) $('edit-'+name).disabled=value;
    if(!value) counts();
  }
  $('access-form').addEventListener('submit',async event=>{
    event.preventDefault();if(opening) return;
    const candidate=$('access-key').value.trim();
    if(!/^[a-f0-9]{64}$/.test(candidate)) {status('access-status','Pega la clave privada completa generada por el administrador.','error');return;}
    opening=true;$('access-submit').disabled=true;status('access-status','Validando el acceso y consultando Sheets…');
    try {const result=await api('admin.list',{},candidate);key=candidate;guests=result.guests;loadedAt=result.updatedAt;listFresh=true;lastActivity=Date.now();
      $('open-sheets').href=/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+\//.test(result.spreadsheetUrl||'')?result.spreadsheetUrl:'https://docs.google.com/spreadsheets/';
      $('access-key').value='';$('access').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;render();status('sync-status','Sincronizado · '+formatDate(loadedAt),'success');$('search').focus();}
    catch(error){status('access-status',error.code==='invalid_data'?core.error('invalid_request'):error.message,'error');}
    finally {opening=false;$('access-submit').disabled=false;}
  });
  $('edit-form').addEventListener('submit',async event=>{
    event.preventDefault();if(writing || !current || !key || current.formulaRow) return;
    const rawPhone=$('edit-phone').value.trim(), phone=rawPhone?window.WeddingCore.normalizePhone(rawPhone):'';
    if(rawPhone && !phone) {status('edit-status-message','Escribe un celular válido; para otro país incluye + y su lada.','error');return;}
    const no=$('edit-attendance').value===core.NO;
    const guest={name:$('edit-name').value.trim(),phone,attendance:$('edit-attendance').value,
      adults:no?0:Number($('edit-adults').value),children:no?0:Number($('edit-children').value),status:$('edit-status').value,
      message:$('edit-message').value.trim(),notes:$('edit-notes').value.trim()};
    if(!no && (guest.adults+guest.children<1 || guest.adults+guest.children>10)) {status('edit-status-message','El total debe ser de 1 a 10 personas.','error');return;}
    busy(true);status('edit-status-message','Guardando los cambios en Google Sheets…');
    let saved=false;
    try {const result=await api('admin.update',{id:current.id,revision:current.revision,guest});guests=guests.map(g=>g.id===result.guest.id?result.guest:g);saved=true;$('edit-dialog').close();current=null;$('edit-form').reset();status('sync-status','Cambio guardado y verificado en Google Sheets.','success');}
    catch(error){listFresh=false;sessionError(error,'edit-status-message');}
    finally {busy(false);if(key)render();}
    if(saved) await refresh(false);
  });
  $('confirm-delete').addEventListener('click',async()=>{
    if(writing || !current || !key || current.formulaRow) return;
    busy(true);status('delete-status','Guardando una copia y retirando el registro…');let saved=false;
    try {const result=await api('admin.delete',{id:current.id,revision:current.revision});guests=guests.filter(g=>g.id!==result.id);saved=true;$('delete-dialog').close();current=null;status('sync-status','Registro retirado y archivado en Google Sheets.','success');}
    catch(error){listFresh=false;sessionError(error,'delete-status');}
    finally {busy(false);if(key)render();}
    if(saved) await refresh(false);
  });
  for(const id of ['search','filter-attendance','filter-status','sort']) $(id).addEventListener(id==='search'?'input':'change',render);
  for(const id of ['edit-adults','edit-children','edit-attendance']) $(id).addEventListener('input',counts);
  $('close-edit').addEventListener('click',closeEditor);$('cancel-edit').addEventListener('click',closeEditor);$('cancel-delete').addEventListener('click',closeDelete);
  for(const id of ['edit-dialog','delete-dialog']) $(id).addEventListener('cancel',event=>{if(writing)event.preventDefault();});
  $('refresh').addEventListener('click',()=>refresh(true));
  $('logout').addEventListener('click',()=>{lock();$('access-key').focus();});
  $('print').addEventListener('click',()=>{if(!key || !listFresh || writing)return;render();document.body.classList.toggle('print-messages',$('print-messages').checked);window.print();});
  window.addEventListener('beforeprint',()=>{if(key){render();document.body.classList.toggle('print-messages',$('print-messages').checked);}});
  window.addEventListener('pagehide',()=>lock());
  for(const event of ['pointerdown','keydown']) document.addEventListener(event,()=>{lastActivity=Date.now();},{passive:true});
  setInterval(()=>{if(key && Date.now()-lastActivity>30*60*1000){lock('La sesión se cerró por inactividad. Ingresa tu clave para continuar.');return;}if(!document.hidden)refresh(false);},60000);
})();
