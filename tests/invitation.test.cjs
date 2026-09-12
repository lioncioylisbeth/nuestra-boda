// Local-only tests. No network requests, guest records, or WhatsApp messages.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const core = require('../invitation-core.js');
const valid = {name:'Prueba local', phone:'123 456 7890', attendance:core.YES, adults:2, children:1, message:'¡Felicidades!'};

test('normalizes Mexican and international phone numbers without guessing sender identity', () => {
  assert.equal(core.normalizePhone('123 456 7890'), '+521234567890');
  assert.equal(core.normalizePhone('+34 612 345 678'), '+34612345678');
  for (const input of ['1234', '1234567890123456', 'abc1234567890', '++521234567890','52+1234567890']) assert.equal(core.normalizePhone(input), '');
});
test('validates attendance, counts, honeypot and message boundaries', () => {
  const good = core.validate(valid).data;
  assert.equal(good.passes, 3);
  assert.equal(core.validate({...valid, attendance:core.NO, adults:2, children:4}).data.passes, 0);
  for (const patch of [{adults:0, children:0},{adults:11},{adults:-1},{children:1.5},{adults:''},{name:'A'},{message:'a'.repeat(2001)},{attendance:'tal vez'},{website:'spam'}]) assert.ok(core.validate({...valid,...patch}).error);
});
test('WhatsApp text keeps Unicode, adults/children, contact and recipient', () => {
  const data = core.validate({...valid, name:'Familia Muñoz', message:'Cariño, alegría y bendición. 💛'}).data;
  const url = new URL(core.whatsappURL(data));
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/527341128601');
  assert.equal(url.searchParams.get('text'), core.whatsappMessage(data));
  assert.match(url.searchParams.get('text'), /Adultos: 2  ·  Niños: 1/);
  assert.ok(!url.searchParams.get('text').includes('\uFFFD'));
});
test('an opaque response, HTTP failure or mismatched ID never means saved', () => {
  assert.equal(core.verifiedReceipt({ok:true,type:'cors'}, {ok:true}, 'id'), true);
  assert.equal(core.verifiedReceipt({ok:true}, {ok:true,requestId:'id'}, 'id'), true);
  for (const [response,receipt] of [[{ok:false},{ok:true}],[{ok:true,type:'opaque'},{ok:true}],[{ok:true},{ok:false}],[{ok:true},{ok:'true'}],[{ok:true},{ok:true,requestId:'different'}],[{ok:true},null]]) assert.equal(core.verifiedReceipt(response,receipt,'id'), false);
});
test('calendar dates use Morelos time, correct next-day UTC, and RFC line folding', () => {
  const ceremony = core.calendar('ceremony', new Date('2026-09-12T00:00:00Z'));
  const reception = core.calendar('reception');
  assert.match(ceremony, /DTSTART:20261128T223000Z/);
  assert.match(reception, /DTSTART:20261129T000000Z/);
  assert.match(ceremony.replace(/\r\n /g,''), /C\. Cobarrubias 102\\, Centro/);
  for (const line of (ceremony + reception).split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  assert.ok(!ceremony.includes('DTEND'));
  assert.throws(() => core.calendar('unknown'));
});
test('HTML preserves wedding details, thumbnail and veil without the rosary', () => {
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate IDs');
  for (const id of ['rsvp-form','rsvp-summary','adults','children','guest-phone','dedication-tools','questions','appearance-menu','bg-audio']) assert.ok(ids.includes(id), id);
  assert.match(html, /og-wedding-square-v3\.jpg\?v=4/);
  assert.match(html, /class="bridal-veil"/);
  assert.doesNotMatch(html, /rosario/i);
  assert.doesNotMatch(html, /Boda Civil|por el Civil/i);
  for (const source of [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]) new vm.Script(source[1]);
  new vm.Script(fs.readFileSync(require.resolve('../invitation.js'),'utf8'));
  assert.doesNotMatch(fs.readFileSync(require.resolve('../invitation.js'),'utf8'), /no-cors/);
});

function backend() {
  let maxRows=20, locked=false, writes=0, failWrite=false;
  const cells=new Map(), notes=new Map();
  const key=(r,c)=>r+','+c;
  const headers=['Fecha y hora','Invitado / Familia','¿Asistirá?','Pases','Dedicatoria','Origen','Estado','Observaciones','Teléfono','Adultos','Niños'];
  headers.forEach((value,i)=>cells.set(key(6,i+1),value));
  cells.set(key(7,2),'Registro anterior preservado');
  cells.set(key(7,12),'Resumen a la derecha preservado');
  const sheet={
    getMaxRows:()=>maxRows,
    insertRowsAfter:(_,count)=>{maxRows+=count;},
    getRange(row,col,height=1,width=1) {
      const matrix=map=>Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>String(map.get(key(row+r,col+c))??'')));
      return {
        getDisplayValues:()=>matrix(cells), getNotes:()=>matrix(notes),
        getNote:()=>notes.get(key(row,col))||'',
        setNote:value=>notes.set(key(row,col),value),
        setNumberFormat:()=>{},
        setValues:values=>{
          if(failWrite){failWrite=false;throw new Error('simulated interruption');}
          writes++;
          values.forEach((line,r)=>line.forEach((value,c)=>cells.set(key(row+r,col+c),value)));
        }
      };
    }
  };
  const context=vm.createContext({
    LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=true;return true;},releaseLock:()=>{locked=false;}})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>sheet}),flush:()=>{}},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:content=>({setMimeType:()=>JSON.parse(content)})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,text)=>[...crypto.createHash('sha256').update(text).digest()]}
  });
  vm.runInContext(fs.readFileSync(require.resolve('../rsvp-apps-script.gs'),'utf8'),context);
  const data={...core.validate(valid).data,requestId:'test-request-000000000001'};
  return {post:(patch={})=>context.doPost({postData:{contents:JSON.stringify({...data,...patch})}}),get:(r,c)=>cells.get(key(r,c)),writes:()=>writes,fail:()=>{failWrite=true;},lock:()=>{locked=true;},health:()=>context.doGet()};
}
test('receiver saves all 11 fields, normalizes counts and preserves existing data and summaries', () => {
  const b=backend();
  assert.equal(b.health().version,2);
  assert.equal(b.post().ok,true);
  assert.equal(b.get(8,4),3); assert.equal(b.get(8,10),2); assert.equal(b.get(8,11),1);
  assert.equal(b.get(8,9), "'+521234567890");
  assert.equal(b.get(7,2),'Registro anterior preservado');
  assert.equal(b.get(7,12),'Resumen a la derecha preservado');
});
test('receiver deduplicates request IDs and rejects conflicting reuse', () => {
  const b=backend();
  assert.equal(b.post().ok,true); assert.equal(b.post().duplicate,true);
  assert.equal(b.writes(),1);
  assert.equal(b.post({adults:3}).code,'request_conflict');
  assert.equal(b.writes(),1);
});
test('receiver validates before writing and never evaluates guest text as formulas', () => {
  const b=backend();
  for(const patch of [{adults:'2'},{children:-1},{message:'x'.repeat(2001)},{phone:'123'},{requestId:''},{website:'spam'}]) assert.equal(b.post(patch).ok,false);
  assert.equal(b.writes(),0);
  assert.equal(b.post({name:'=1+1',message:'@unsafe formula'}).ok,true);
  assert.equal(b.get(8,2),"'=1+1"); assert.equal(b.get(8,5),"'@unsafe formula");
});
test('receiver uses zero guests for a decline', () => {
  const b=backend();
  assert.equal(b.post({attendance:core.NO,adults:9,children:1}).ok,true);
  assert.equal(b.get(8,4),0); assert.equal(b.get(8,10),0); assert.equal(b.get(8,11),0);
});
test('receiver reuses its reserved row after an interrupted write', () => {
  const b=backend(); b.fail();
  assert.equal(b.post().ok,false); assert.equal(b.writes(),0);
  assert.equal(b.post().ok,true); assert.equal(b.writes(),1);
  assert.equal(b.get(8,2),'Prueba local'); assert.equal(b.get(9,2),undefined);
});
test('receiver reports lock contention without a write', () => {
  const b=backend(); b.lock(); assert.equal(b.post().code,'busy'); assert.equal(b.writes(),0);
});
