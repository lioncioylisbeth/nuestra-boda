// In-memory tests only. Never send a confirmation or modify the real workbook.
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), crypto=require('node:crypto');
const core=require('../invitados-core.js');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const KEY='b'.repeat(64), RID='local-admin-request-000001';
const edited={name:'Familia de prueba',phone:'+521234567890',attendance:core.YES,adults:2,children:1,status:'Confirmado',message:'¡Felicidades!',notes:'Prueba exclusivamente local'};
function backend(){
  const tables=new Map();let opens=0,locked=false,failClear=false,failFinalNote=false;
  function sheet(name){
    const cells=new Map(),notes=new Map(),formulas=new Map();let rows=25;
    const key=(r,c)=>r+','+c;
    const api={cells,notes,formulas,get:(r,c)=>cells.get(key(r,c)),set:(r,c,v)=>cells.set(key(r,c),v),
      getMaxRows:()=>rows,insertRowsAfter:(_,n)=>{rows+=n;},getParent:()=>book,setFrozenRows:()=>{},
      getLastRow:()=>Math.max(0,...[...cells].filter(([,v])=>v!=='').map(([k])=>Number(k.split(',')[0]))),
      getRange(row,col,height=1,width=1){
        const matrix=(map,display=false)=>Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>{const v=map.get(key(row+r,col+c))??'';return display?String(v):v;}));
        const range={getValues:()=>matrix(cells),getDisplayValues:()=>matrix(cells,true),getFormulas:()=>matrix(formulas),getNotes:()=>matrix(notes),
          getNote:()=>notes.get(key(row,col))||'',setNote:value=>{if(failFinalNote&&value.includes('GUEST-DELETED:')){failFinalNote=false;throw Error('interrupted');}notes.set(key(row,col),value);return range;},
          setNumberFormat:()=>range,setBackground:()=>range,setFontColor:()=>range,setFontWeight:()=>range,
          setValues:values=>{values.forEach((line,r)=>line.forEach((v,c)=>cells.set(key(row+r,col+c),typeof v==='string'&&v.startsWith("'")?v.slice(1):v)));return range;},
          clearContent:()=>{if(failClear){failClear=false;throw Error('clear interrupted');}for(let r=0;r<height;r++)for(let c=0;c<width;c++)cells.delete(key(row+r,col+c));return range;}};
        return range;
      }
    };tables.set(name,api);return api;
  }
  const book={getSheetByName:name=>tables.get(name)||null,insertSheet:name=>sheet(name),getUrl:()=> 'https://docs.google.com/spreadsheets/d/local-workbook-00001/edit'};
  const s=sheet('Confirmaciones');
  ['Fecha y hora','Invitado / Familia','¿Asistirá?','Pases','Dedicatoria','Origen','Estado','Observaciones','Teléfono','Adultos','Niños'].forEach((v,i)=>s.set(6,i+1,v));
  [new Date('2026-09-12T12:00:00Z'),'Prueba local',core.YES,3,'Dedicatoria original','Invitación web','Pendiente','','+521234567890',2,1].forEach((v,i)=>s.set(7,i+1,v));
  s.set(7,12,'Resumen intacto');
  const context=vm.createContext({console:{log:()=>{}},
    PropertiesService:{getScriptProperties:()=>({getProperty:name=>name==='RSVP_SPREADSHEET_ID'?'local-workbook-00001':sha(KEY)})},
    LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=true;return true;},releaseLock:()=>{locked=false;}})},
    SpreadsheetApp:{openById:id=>{assert.equal(id,'local-workbook-00001');opens++;return book;},flush:()=>{}},
    Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,value)=>[...crypto.createHash('sha256').update(value).digest()]},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}});
  vm.runInContext(fs.readFileSync(require.resolve('../rsvp-apps-script.gs'),'utf8'),context);
  const post=data=>context.doPost({postData:{contents:JSON.stringify(data)}});
  return {s,book,post,health:()=>context.doGet(),opens:()=>opens,
    admin:(action='admin.list',data={})=>post({action,key:KEY,requestId:RID,...data}),failClear:()=>{failClear=true;},failFinalNote:()=>{failFinalNote=true;}};
}
test('admin requires a strong key before opening Sheets; GET never returns guests',()=>{
  const b=backend();
  for(const key of ['',null,'wrong','a'.repeat(64)]) assert.equal(b.admin('admin.list',{key}).code,'unauthorized');
  assert.equal(b.opens(),0);assert.equal(b.health().version,3);assert.equal(b.health().guests,undefined);
});
test('list uses stable IDs for old rows, preserves notes and reads later changes from the same sheet',()=>{
  const b=backend();b.s.notes.set('7,1','Nota del propietario');
  const first=b.admin();assert.equal(first.ok,true);assert.equal(first.guests.length,1);
  const g=first.guests[0];assert.ok(core.validGuest(g));assert.match(b.s.notes.get('7,1'),/^Nota del propietario/);
  b.s.set(7,2,'Nombre editado directamente en Sheets');
  const next=b.admin().guests[0];assert.equal(next.id,g.id);assert.equal(next.name,'Nombre editado directamente en Sheets');assert.notEqual(next.revision,g.revision);
  assert.equal(b.s.get(7,12),'Resumen intacto');
});
test('edits are persisted and read back; original date/source survive and hostile text is literal',()=>{
  const b=backend(),g=b.admin().guests[0], before=b.s.get(7,1);
  const result=b.admin('admin.update',{id:g.id,revision:g.revision,guest:{...edited,name:'=IMPORTXML("test")',message:'<img src=x onerror=alert(1)>'}});
  assert.equal(result.ok,true);assert.equal(result.guest.name,'=IMPORTXML("test")');assert.equal(result.guest.phone,edited.phone);
  assert.equal(b.s.get(7,1),before);assert.equal(b.s.get(7,6),'Invitación web');assert.equal(b.s.get(7,10),2);assert.equal(b.s.get(7,11),1);
  assert.equal(b.admin().guests[0].revision,result.guest.revision);assert.equal(b.s.get(7,12),'Resumen intacto');
});
test('stale revisions, formula rows and invalid edits do not overwrite existing rows',()=>{
  const b=backend(),g=b.admin().guests[0];b.s.set(7,8,'Cambio posterior');
  assert.equal(b.admin('admin.update',{id:g.id,revision:g.revision,guest:edited}).code,'conflict');
  assert.equal(b.admin('admin.delete',{id:g.id,revision:g.revision}).code,'conflict');
  const fresh=b.admin().guests[0];
  for(const patch of [{adults:11},{children:-1},{adults:'2'},{phone:'123'},{status:'inventado'},{name:'A'}]) assert.equal(b.admin('admin.update',{id:fresh.id,revision:fresh.revision,guest:{...edited,...patch}}).code,'invalid_data');
  b.s.formulas.set('7,4','=J7+K7');const withFormula=b.admin().guests[0];
  assert.equal(b.admin('admin.update',{id:withFormula.id,revision:withFormula.revision,guest:edited}).code,'formula_row');
  assert.equal(b.s.get(7,8),'Cambio posterior');
});
test('delete archives the full row once, clears A:K only and tolerates a repeated request',()=>{
  const b=backend(),g=b.admin().guests[0], args={id:g.id,revision:g.revision};
  assert.equal(b.admin('admin.delete',args).ok,true);
  assert.equal(b.s.get(7,2),undefined);assert.equal(b.s.get(7,12),'Resumen intacto');
  const a=b.book.getSheetByName('Archivo de invitados');assert.equal(a.get(2,6),'Prueba local');assert.equal(a.get(2,13),edited.phone);
  assert.equal(b.admin().guests.length,0);assert.equal(b.admin('admin.delete',args).duplicate,true);assert.equal(a.getLastRow(),2);
});
test('archive survives failures before clearing or after clearing; retry never duplicates the archive',()=>{
  for(const fault of ['failClear','failFinalNote']){
    const b=backend(),g=b.admin().guests[0],args={id:g.id,revision:g.revision};b[fault]();
    assert.equal(b.admin('admin.delete',args).ok,false);
    assert.equal(b.book.getSheetByName('Archivo de invitados').get(2,6),'Prueba local');
    assert.equal(b.admin('admin.delete',args).ok,true);assert.equal(b.admin().guests.length,0);
    assert.equal(b.book.getSheetByName('Archivo de invitados').getLastRow(),2);
  }
});
test('replaying an archived public RSVP does not restore an eliminated guest',()=>{
  const b=backend(),data={...edited,requestId:'public-local-request-000001',website:''};
  assert.equal(b.post(data).ok,true);const g=b.admin().guests.find(g=>g.name===edited.name);
  assert.equal(b.admin('admin.delete',{id:g.id,revision:g.revision}).ok,true);
  assert.equal(b.post(data).code,'archived_request');assert.equal(b.admin().guests.length,1);
});
test('filtering, accent-insensitive search and totals never count declines as attendees',()=>{
  const b=backend(),g=b.admin().guests[0];
  const guests=[{...g,name:'Familia Muñoz'},{...g,id:crypto.randomUUID(),name:'Familia Ávila',attendance:core.NO,adults:0,children:0,passes:0},
    {...g,id:crypto.randomUUID(),name:'Datos antiguos',adults:null,children:null,passes:2}];
  assert.deepEqual(core.totals(guests),{records:3,attending:2,declined:1,passes:5,adults:2,children:1,incomplete:1});
  const options={search:'munoz',attendance:'all',status:'all',sort:'name'};
  assert.equal(core.visible(guests,options).length,1);
  assert.equal(core.visible(guests,{...options,search:'',attendance:'no'})[0].name,'Familia Ávila');
});
test('only versioned, matched and readable API receipts are accepted',()=>{
  const b=backend(),body=b.admin(),response={ok:true,type:'cors'};
  assert.equal(core.verified(response,body,'admin.list',RID),true);
  for(const patch of [{version:2},{requestId:'other'},{action:'admin.delete'},{ok:'true'},{guests:[{}]},{guests:[body.guests[0],body.guests[0]]}]) assert.equal(core.verified(response,{...body,...patch},'admin.list',RID),false);
  assert.equal(core.verified({...response,type:'opaque'},body,'admin.list',RID),false);
});
