// Exercise the actual admin page controller with fake DOM and fake transport.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const core=require('../invitados-core.js'),wedding=require('../invitation-core.js');
const g={id:'local-guest-id-00001',revision:'a'.repeat(64),name:'Familia prueba local',phone:'+521234567890',attendance:core.YES,adults:2,children:1,passes:3,status:'Pendiente',message:'<script>texto literal</script>',notes:'',date:'2026-09-12T12:00:00Z',formulaRow:false};
function app(transport){
  const nodes=new Map(),calls=[],events={},downloads=[],exports=[];let interval,prints=0;
  class E{
    constructor(tag){this.tag=tag;this.value='';this.textContent='';this.children=[];this.attrs={};this.events={};this.hidden=false;this.disabled=false;this.open=false;this.selectedOptions=[{textContent:'Todas'}];this.classList={toggle:()=>{}};}
    setAttribute(n,v){this.attrs[n]=v;}
    addEventListener(n,f){this.events[n]=f;}
    append(...children){for(const child of children)child.tag==='fragment'?this.children.push(...child.children):this.children.push(child);}
    replaceChildren(...children){this.children=[];this.append(...children);}
    focus(){} showModal(){this.open=true;} close(){this.open=false;} reset(){}
    click(){if(this.tag==='a')downloads.push({href:this.href,filename:this.download});}
    remove(){}
  }
  const html=fs.readFileSync(require.resolve('../invitados.html'),'utf8');
  for(const match of html.matchAll(/\bid="([^"]+)"/g)) {assert.ok(!nodes.has(match[1]),'duplicate DOM ID');nodes.set(match[1],new E(match[1]));}
  const $=id=>{assert.ok(nodes.has(id),'Unknown ID: '+id);return nodes.get(id);};
  const document={getElementById:$,createElement:tag=>new E(tag),createElementNS:(_,tag)=>new E(tag),createDocumentFragment:()=>new E('fragment'),body:new E('body'),addEventListener:()=>{},hidden:false};
  $('filter-attendance').value='all';$('filter-status').value='all';$('sort').value='newest';$('dashboard').hidden=true;
  const context={document,GuestAdminCore:core,WeddingCore:wedding,crypto:webcrypto,AbortController,Intl,Date,setTimeout:(f,ms)=>{const t=setTimeout(f,ms);t.unref();return t;},clearTimeout,setInterval:f=>{interval=f;},addEventListener:(n,f)=>{events[n]=f;},print:()=>{prints++;},
    GuestPDF:{create:(guests,settings)=>{exports.push({guests,settings});return {blob:new Blob(['test PDF']),filename:'Lista de invitados LyL [13-09-2026 12-00].pdf'};}},
    URL:{createObjectURL:()=> 'blob:local-test',revokeObjectURL:()=>{}},
    fetch:async(url,options)=>{assert.ok(!url.includes('key='));assert.equal(options.mode,'cors');assert.equal(options.credentials,'omit');const data=JSON.parse(options.body);calls.push(data);return transport(data,options);}};
  context.window=context;vm.runInNewContext(fs.readFileSync(require.resolve('../invitados.js'),'utf8'),context);
  const event=(id,name='click')=>$(id).events[name]({preventDefault(){}});
  return {$,event,calls,interval,events,downloads,exports,prints:()=>prints,login:async()=>{$('access-key').value='b'.repeat(64);await event('access-form','submit');}};
}
const receipt=(data,patch={})=>({ok:true,type:'cors',json:async()=>({ok:true,version:3,action:data.action,requestId:data.requestId,guests:[g],updatedAt:'2026-09-12T12:00:00Z',...patch})});
const buttons=app=>app.$('guest-rows').children[0].children[7].children[0].children;
test('login loads rows from the receiver, renders guest text literally and logs out without retaining data',async()=>{
  const a=app(data=>receipt(data));await a.login();assert.equal(a.$('dashboard').hidden,false);assert.equal(a.$('access-key').value,'');assert.equal(a.$('total-passes').textContent,3);
  assert.equal(a.$('guest-rows').children[1].children[0].textContent,'Dedicatoria de '+g.name+': '+g.message);
  a.event('print');assert.equal(a.prints(),1);a.event('logout');assert.equal(a.$('guest-rows').children.length,0);assert.equal(a.$('dashboard').hidden,true);
});
test('pencil edits counts and phone in the same guest; double submission makes one update',async()=>{
  let resolve;const pending=new Promise(done=>{resolve=done;});let updated=g;
  const a=app(async data=>{if(data.action==='admin.update'){await pending;updated={...g,...data.guest,passes:data.guest.adults+data.guest.children,revision:'c'.repeat(64)};return receipt(data,{guest:updated});}return receipt(data,{guests:[updated]});});
  await a.login();buttons(a)[0].events.click();assert.equal(a.$('edit-dialog').open,true);
  a.$('edit-adults').value='3';a.$('edit-children').value='2';a.$('edit-phone').value='123 456 7890';
  const first=a.event('edit-form','submit'),second=a.event('edit-form','submit');resolve();await Promise.all([first,second]);
  assert.equal(a.calls.filter(x=>x.action==='admin.update').length,1);
  const payload=a.calls.find(x=>x.action==='admin.update');assert.equal(payload.id,g.id);assert.equal(payload.guest.phone,'+521234567890');assert.equal(payload.guest.adults,3);assert.equal(a.$('total-passes').textContent,5);
});
test('X requires confirmation before sending a delete and removes only its matched guest',async()=>{
  let removed=false;const a=app(data=>{if(data.action==='admin.delete'){removed=true;return receipt(data,{id:g.id,deleted:true});}return receipt(data,{guests:removed?[]:[g]});});
  await a.login();buttons(a)[1].events.click();assert.equal(a.$('delete-dialog').open,true);assert.equal(a.calls.length,1);
  a.event('cancel-delete');assert.equal(a.calls.length,1);buttons(a)[1].events.click();await a.event('confirm-delete');
  assert.equal(a.calls.filter(x=>x.action==='admin.delete').length,1);assert.equal(a.$('total-records').textContent,0);assert.equal(a.$('empty-state').hidden,false);
});
test('failed or mismatched writes are never displayed as saved and never retried automatically',async()=>{
  for(const failure of ['opaque','conflict','wrong-id']){
    const a=app(data=>data.action==='admin.list'?receipt(data):failure==='opaque'?{ok:true,type:'opaque'}:failure==='conflict'?receipt(data,{ok:false,code:'conflict'}):receipt(data,{guest:{...g,id:'another-local-guest-0001'}}));
    await a.login();buttons(a)[0].events.click();await a.event('edit-form','submit');assert.equal(a.$('edit-dialog').open,true);assert.equal(a.$('edit-status-message').className,'status error');assert.equal(a.$('print').disabled,true);assert.equal(a.calls.length,2);
  }
});
test('late responses cannot reopen a page after logout, and legacy receivers leave it locked',async()=>{
  let resolve;const pending=new Promise(done=>{resolve=done;});const a=app(async data=>{await pending;return receipt(data);});
  const login=a.login();a.event('logout');resolve();await login;assert.equal(a.$('dashboard').hidden,true);
  const legacy=app(data=>receipt(data,{version:2,ok:false,code:'invalid_data'}));await legacy.login();assert.equal(legacy.$('dashboard').hidden,true);assert.match(legacy.$('access-status').textContent,/actualizarse/);
});
test('PDF downloads by filename without printing or transmitting guest data and honors filters',async()=>{
  const a=app(data=>receipt(data));a.event('download-pdf');assert.equal(a.downloads.length,0);
  await a.login();a.$('search').value='Familia';a.$('print-messages').checked=true;a.event('download-pdf');
  assert.deepEqual(a.downloads,[{href:'blob:local-test',filename:'Lista de invitados LyL [13-09-2026 12-00].pdf'}]);
  assert.equal(a.exports[0].settings.filters.search,'Familia');assert.equal(a.exports[0].settings.includeMessages,true);
  assert.equal(a.calls.length,1);assert.equal(a.prints(),0);
  a.event('logout');a.event('download-pdf');assert.equal(a.downloads.length,1);assert.equal(a.$('download-pdf').disabled,true);
});
test('unverified list refresh disables direct PDF export',async()=>{
  let fail=false;const a=app(data=>fail?{ok:true,type:'opaque'}:receipt(data));
  await a.login();fail=true;await a.event('refresh');a.event('download-pdf');
  assert.equal(a.$('download-pdf').disabled,true);assert.equal(a.downloads.length,0);
});
