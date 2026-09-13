// Generate real PDFs from synthetic data. Poppler checks visible text and pages.
// Requires Node 18+ and pdftotext/pdfinfo (poppler-utils).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
function runtime(){
  const c={console,Blob,atob,btoa,TextEncoder,TextDecoder,setTimeout,clearTimeout,navigator:{userAgent:'local PDF test'}};
  c.window=c;c.self=c;vm.createContext(c);
  for(const f of ['vendor/jspdf-4.2.1.umd.min.js','vendor/jspdf-autotable-5.0.8.min.js','vendor/pdf-fonts.js','invitados-core.js','invitados-pdf.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c);
  return c;
}
const c=runtime(), yes=c.GuestAdminCore.YES, no=c.GuestAdminCore.NO;
const guest=(name,adults,children,extra={})=>({name,adults,children,passes:adults+children,attendance:yes,status:'Pendiente',date:'2026-09-13T16:00:00Z',phone:'+520000000000',message:'Una dedicatoria de prueba, con alegría y cariño.',...extra});
const guests=[guest('Familia Ejemplo Uno',3,0),guest('Familia Ejemplo Dos',3,1),guest('Familia Ejemplo Tres',1,3),guest('Familia No Asiste',0,0,{attendance:no})];
const settings={now:new Date('2026-09-13T18:00:00Z'),updatedAt:'2026-09-13T17:58:00Z',filters:{search:'',attendance:'all',status:'all',sort:'name'}};
async function read(pdf){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lyl-pdf-')),file=path.join(dir,pdf.filename);
  try {fs.writeFileSync(file,Buffer.from(await pdf.blob.arrayBuffer()));return {text:execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'}),info:execFileSync('pdfinfo',[file],{encoding:'utf8'})};}
  finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('download has the requested filename in Morelos time, including midnight',()=>{
  assert.equal(c.GuestPDF.filename(settings.now),'Lista de invitados LyL [13-09-2026 12-00].pdf');
  assert.equal(c.GuestPDF.filename(new Date('2026-09-14T06:03:00Z')),'Lista de invitados LyL [14-09-2026 00-03].pdf');
});
test('real PDF contains four totals, all columns, Spanish accents and a single final total',async()=>{
  const pdf=c.GuestPDF.create(guests,settings),result=await read(pdf);
  assert.equal(pdf.filename,'Lista de invitados LyL [13-09-2026 12-00].pdf');
  assert.match(result.text,/REGISTROS\s+PERSONAS\s+ADULTOS\s+NIÑOS\s+4\s+11\s+7\s+4/);
  assert.match(result.text,/TOTALES DE ASISTENTES\s+7\s+4\s+11/);
  assert.match(result.text,/Familia Ejemplo Dos[\s\S]*?3\s+1\s+4\s+Pendiente/);
  assert.match(result.text,/Seguimiento/);assert.doesNotMatch(result.text,/Una dedicatoria/);
  assert.match(result.info,/Pages:\s+1/);assert.match(result.info,/A4/);
});
test('filtered PDF sums only the visible attending people and keeps optional dedications literal',async()=>{
  const result=await read(c.GuestPDF.create(guests,{...settings,includeMessages:true,filters:{...settings.filters,search:'Ejemplo Tres'}}));
  assert.match(result.text,/REGISTROS\s+PERSONAS\s+ADULTOS\s+NIÑOS\s+1\s+4\s+1\s+3/);
  assert.match(result.text,/alegría y cariño/);assert.doesNotMatch(result.text,/Familia Ejemplo Uno/);
  assert.throws(()=>c.GuestPDF.create([]),/empty_list/);
});
test('long list paginates with repeated column headers, one final total and last guest intact',async()=>{
  const list=Array.from({length:75},(_,i)=>guest('Familia de ejemplo '+String(i+1).padStart(3,'0'),2,1));
  const result=await read(c.GuestPDF.create(list,{...settings,includeMessages:true}));
  const pages=Number(result.info.match(/Pages:\s+(\d+)/)[1]);assert.ok(pages>1);
  assert.equal((result.text.match(/TOTALES DE ASISTENTES/g)||[]).length,1);
  assert.match(result.text,/TOTALES DE ASISTENTES\s+150\s+75\s+225/);
  assert.match(result.text,/Familia de ejemplo 075/);
  assert.match(result.text,new RegExp('Página '+pages+' de '+pages));
  assert.equal((result.text.match(/Seguimiento/g)||[]).length,pages);
});
