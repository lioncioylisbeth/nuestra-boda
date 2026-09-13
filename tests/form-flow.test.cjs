// Tests the actual browser controller against an in-memory DOM and transport.
// Never opens a browser, calls the real endpoint or writes to Google Sheets.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const core = require('../invitation-core.js');

function formApp(transport, sharedSession = new Map()) {
  const elements = new Map();
  let calls = 0;
  class Element {
    constructor(id) { this.id=id; this.value=''; this.hidden=false; this.disabled=false; this.inert=false; this.open=false; this.textContent=''; this.dataset={}; this.style={}; this.events={}; this.attrs={}; this.isConnected=true; this.classes=new Set(); this.classList={add:(...s)=>s.forEach(x=>this.classes.add(x)), remove:(...s)=>s.forEach(x=>this.classes.delete(x))}; }
    get valueAsNumber() { return this.value === '' ? NaN : Number(this.value); }
    setAttribute(name,value) { this.attrs[name]=value; }
    addEventListener(name,handler) { this.events[name]=handler; }
    setCustomValidity(value) { this.customValidity=value; }
    reportValidity() { return true; }
    focus() { document.activeElement=this; }
    scrollIntoView() {}
    querySelector() { return get(this.id+'-child'); }
    querySelectorAll() { return []; }
    getClientRects() { return [{}]; }
    contains(el) { return this === el; }
  }
  function get(id) { if(!elements.has(id)) elements.set(id,new Element(id)); return elements.get(id); }
  const document={body:get('body'),activeElement:get('initial-focus'),getElementById:get,querySelector:selector=>get(selector),querySelectorAll:()=>[],addEventListener:()=>{}};
  document.body.children=[];
  const local = new Map();
  const storage=map=>({getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)});
  sharedSession.set('wedding-music-paused','yes');
  const audio=get('bg-audio');
  audio.paused=true; audio.pause=()=>{audio.paused=true;}; audio.play=async()=>{audio.paused=false;};
  const context={document,WeddingCore:core,crypto:webcrypto,TextEncoder,AbortController,URL,Blob,setTimeout,clearTimeout,sessionStorage:storage(sharedSession),localStorage:storage(local),matchMedia:()=>({matches:true}),showNotification:()=>{},RSVP_ENDPOINT:'https://example.invalid/test-only',fetch:async(url,options)=>{calls++; assert.equal(url,'https://example.invalid/test-only'); return transport(JSON.parse(options.body),options);}};
  context.window=context;
  vm.runInNewContext(fs.readFileSync(require.resolve('../invitation.js'),'utf8'),context);
  get('guest-name').value='Solo prueba local'; get('guest-phone').value='1234567890';
  get('attendance').value=core.YES; get('adults').value='2'; get('children').value='1';
  const submit=()=>context.sendRSVP({preventDefault(){}});
  return {submit,get,calls:()=>calls,session:sharedSession,context};
}
const success=data=>({ok:true,type:'cors',json:async()=>({ok:true,requestId:data.requestId,version:3})});

test('successful response renders a verified summary, a WhatsApp link and no automatic navigation', async()=>{
  const app=formApp(success);
  await app.submit();
  assert.equal(app.calls(),1);
  assert.equal(app.get('rsvp-save-state').dataset.state,'saved');
  assert.equal(app.get('rsvp-summary').hidden,false);
  assert.equal(app.get('summary-total').textContent,'3 personas');
  assert.match(app.get('rsvp-whatsapp').href,/^https:\/\/wa\.me\/527341128601\?text=/);
  assert.equal(app.get('rsvp-submit').disabled,false);
});
test('double clicks and a repeated same-session submission produce only one request', async()=>{
  let resolve;
  const pending=new Promise(done=>{resolve=done;});
  const app=formApp(async data=>{await pending;return success(data);});
  const first=app.submit(); const second=app.submit();
  resolve(); await Promise.all([first,second]); await app.submit();
  assert.equal(app.calls(),1);
  const afterReload=formApp(success,app.session);
  await afterReload.submit(); assert.equal(afterReload.calls(),0);
  assert.equal(afterReload.get('rsvp-save-state').dataset.state,'saved');
  assert.ok(!JSON.stringify([...app.session]).includes('Solo prueba local'));
  assert.ok(!JSON.stringify([...app.session]).includes('1234567890'));
});
test('network failure and opaque receipt stay unverified and are not retried automatically', async()=>{
  for(const transport of [async()=>{throw new Error('offline');},async()=>({ok:false,type:'opaque',json:async()=>({ok:true})}),async()=>({ok:true,type:'cors',json:async()=>{throw new Error('invalid JSON');}})]) {
    const app=formApp(transport); await app.submit(); await app.submit();
    assert.equal(app.calls(),1); assert.equal(app.get('rsvp-save-state').dataset.state,'unknown');
    assert.match(app.get('rsvp-save-state').textContent,/No pudimos verificar/);
    assert.ok(app.get('rsvp-whatsapp').href);
  }
});
test('server rejection never appears as saved and validation avoids network entirely', async()=>{
  const rejected=formApp(async()=>({ok:true,json:async()=>({ok:false})}));
  await rejected.submit(); assert.equal(rejected.get('rsvp-save-state').dataset.state,'rejected');
  const invalid=formApp(success); invalid.get('adults').value='11'; await invalid.submit();
  assert.equal(invalid.calls(),0); assert.equal(invalid.get('rsvp-error').hidden,false);
});
test('Google write failures explain the blockage without exposing server exception text', async()=>{
  for(const code of ['registration_unavailable','registration_read_failed','registration_reserve_failed','registration_write_failed','registration_verify_failed']){
    const app=formApp(async()=>({ok:true,json:async()=>({ok:false,code,message:'private Google error'})}));
    await app.submit();
    assert.equal(app.get('rsvp-save-state').dataset.state,'rejected');
    assert.match(app.get('rsvp-save-state').textContent,/Referencia: RSVP-/);
    assert.doesNotMatch(app.get('rsvp-save-state').textContent,/private Google error/);
    assert.equal(app.get('rsvp-retry').textContent,'Reintentar cuando se haya corregido');
    assert.equal(app.calls(),1);
  }
});
test('an incomplete or changed row requires organizer review instead of another write', async()=>{
  const app=formApp(async()=>({ok:true,json:async()=>({ok:false,code:'registration_review_required'})}));
  await app.submit();assert.equal(app.get('rsvp-retry').hidden,true);
  await app.get('rsvp-retry').events.click();assert.equal(app.calls(),1);
  assert.match(app.get('rsvp-save-state').textContent,/necesita revisión/);
});
test('an old failed attempt can be explicitly retried after activation with the same request ID', async()=>{
  let originalId;
  const before=formApp(async data=>{originalId=data.requestId;return {ok:true,type:'cors',json:async()=>({ok:false,code:'registration_unavailable'})};});
  await before.submit();
  const after=formApp(data=>{assert.equal(data.requestId,originalId);return success(data);},before.session);
  await after.submit();
  assert.equal(after.calls(),0,'reloading never submits automatically');
  assert.equal(after.get('rsvp-save-state').dataset.state,'rejected');
  assert.equal(after.get('rsvp-retry').hidden,false);
  await after.get('rsvp-retry').events.click();
  assert.equal(after.calls(),1);
  assert.equal(after.get('rsvp-save-state').dataset.state,'saved');
  assert.equal(after.get('rsvp-retry').hidden,true);
});
test('edited response is a new request while decline sends zero people', async()=>{
  const payloads=[];
  const app=formApp(data=>{payloads.push(data);return success(data);});
  await app.submit(); app.get('attendance').value=core.NO; await app.submit();
  assert.equal(app.calls(),2); assert.equal(payloads[1].passes,0);
  assert.equal(payloads[1].adults,0); assert.equal(payloads[1].children,0);
  assert.notEqual(payloads[0].requestId,payloads[1].requestId);
});
test('explicit retry after a lost reply recovers one record and ignores double clicks', async()=>{
  const records=new Set();
  let resolve;
  const pending=new Promise(done=>{resolve=done;});
  const app=formApp(async data=>{
    if (!records.has(data.requestId)) {records.add(data.requestId);throw new Error('reply lost after save');}
    await pending;
    return {ok:true,type:'cors',json:async()=>({ok:true,requestId:data.requestId,version:3,duplicate:true})};
  });
  await app.submit();
  assert.equal(app.get('rsvp-save-state').dataset.state,'unknown');
  const retry=app.get('rsvp-retry').events.click();
  const repeated=app.get('rsvp-retry').events.click();
  assert.equal(app.get('rsvp-new').disabled,true);
  app.get('rsvp-new').events.click();
  assert.equal(app.get('guest-name').value,'Solo prueba local');
  resolve();await Promise.all([retry,repeated]);
  assert.equal(app.calls(),2);
  assert.equal(records.size,1);
  assert.equal(app.get('rsvp-save-state').dataset.state,'saved');
  await app.get('rsvp-retry').events.click();assert.equal(app.calls(),2);
});
test('another guest starts a clean form and uses a different ID, keeping the previous receipt', async()=>{
  const payloads=[];
  const app=formApp(data=>{payloads.push(data);return success(data);});
  app.get('attendance').value=core.NO;app.context.syncAttendanceCounts();
  app.get('message').value='Mensaje anterior';
  await app.submit();
  app.get('rsvp-new').events.click();
  assert.equal(app.calls(),1);
  assert.equal(app.get('guest-name').value,'');assert.equal(app.get('guest-phone').value,'');
  assert.equal(app.get('message').value,'');assert.equal(app.get('rsvp-form').hidden,false);
  assert.equal(app.get('rsvp-summary').hidden,true);assert.equal(app.get('adults').disabled,false);
  assert.equal(Number(app.get('adults').value),1);assert.equal(Number(app.get('children').value),0);
  app.get('guest-name').value='Otro invitado local';app.get('guest-phone').value='1234567891';
  await app.submit();
  assert.equal(payloads.length,2);assert.notEqual(payloads[0].requestId,payloads[1].requestId);
  assert.equal(payloads[1].adults,1);assert.equal(payloads[1].message,'');
  const previous=formApp(success,app.session);
  previous.get('attendance').value=core.NO;previous.get('message').value='Mensaje anterior';
  await previous.submit();assert.equal(previous.calls(),0);
});
test('old receipts without IDs and archived records never claim success or offer a duplicate-prone retry', async()=>{
  for (const receipt of [{ok:true},{ok:true,requestId:'wrong',version:3},{ok:false,code:'archived_request'}]) {
    const app=formApp(async()=>({ok:true,type:'cors',json:async()=>receipt}));
    await app.submit();
    assert.notEqual(app.get('rsvp-save-state').dataset.state,'saved');
    assert.equal(app.get('rsvp-retry').hidden,true);
    await app.get('rsvp-retry').events.click();assert.equal(app.calls(),1);
  }
});
