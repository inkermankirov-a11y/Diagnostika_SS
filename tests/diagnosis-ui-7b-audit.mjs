import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource=fs.readFileSync('app.js','utf8');
const apiSource=fs.readFileSync('diagnosis-api.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(apiSource.includes("version:'7B'"),'Diagnosis facade version is not 7B');
for(const token of [
  "source:'diagnosis-ui-situation-add'",
  "source:'diagnosis-ui-situation-edit'",
  "source:'diagnosis-ui-situation-delete'",
  "source:'diagnosis-ui-situation-result'"
])assert(appSource.includes(token),'Diagnosis 7B UI source missing '+token);

for(const forbidden of [
  'r.situations.push(s)',
  'r.situations=r.situations.filter',
  "s.result=$('#situationResult').value",
  'if(n!==null)s.name=n',
  'if(l!==null)s.level=lvl(l)'
])assert.equal(appSource.includes(forbidden),false,'Situation UI still mutates diagnosis state directly: '+forbidden);

assert(indexSource.includes('app.js?v=20260919-diagnosis7b'),'app.js cache marker is stale');
assert(indexSource.includes('diagnosis-api.js?v=20260919-diagnosis7b'),'diagnosis-api cache marker is stale');

const fixture={version:4,clients:[{
  id:'diag-7b-client',
  name:'Diagnosis 7B Client',
  currentRequestId:'diag-7b-r1',
  lastDiagnosisRequestId:'diag-7b-r1',
  requests:[{
    id:'diag-7b-r1',
    title:'Diagnosis UI request',
    status:'active',
    situations:[{id:'diag-7b-base',name:'Base situation',level:4,comment:'',result:'',beliefs:[]}]
  }],
  sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','diag-7b-client');
  if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
page.on('dialog',async d=>{
  const msg=d.message();
  if(/Название ситуации/i.test(msg))return d.accept('Edited through DiagnosisService');
  if(/Дискомфорт 1–10/i.test(msg))return d.accept('9');
  return d.accept();
});

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaDiagnosis?.version==='7B'
    && window.DiagnostikaDiagnosis?.moduleAware===true
    && window.DiagnostikaPlatform?.services?.diagnosis,
    null,{timeout:15000});
}

await page.goto('http://127.0.0.1:8000/index.html?diagnosis-7b=1',{waitUntil:'commit',timeout:10000});
await ready();

const before=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  window.__diag7bEvents=[];
  for(const type of ['diagnosis:situation-created','diagnosis:situation-updated','diagnosis:situation-deleted','diagnosis:updated']){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__diag7bEvents.push({type,detail:{...detail}}));
  }
  if(!window.DiagnostikaDiagnosis.open())throw new Error('Cannot open diagnosis');
  return {
    current:c.currentRequestId,
    last:c.lastDiagnosisRequestId,
    viewed:window.DiagnostikaRequests.viewedId(c),
    active:window.DiagnostikaRequests.activeId(c)
  };
});
await page.locator('#addSituationBtn').waitFor({state:'visible',timeout:5000});
const preClick=await page.evaluate(()=>({
  apiVersion:window.DiagnostikaDiagnosis?.version||null,
  moduleAware:window.DiagnostikaDiagnosis?.moduleAware===true,
  service:!!window.DiagnostikaPlatform?.services?.diagnosis,
  requestService:!!window.DiagnostikaPlatform?.services?.requests,
  clientId:client()?.id||null,
  requestId:request()?.id||null,
  globalRequestId:typeof requestId!=='undefined'?requestId:null,
  handler:String(document.getElementById('addSituationBtn')?.onclick||'')
}));
console.log('DIAGNOSIS_7B_PRECLICK',JSON.stringify(preClick));

await page.locator('#addSituationBtn').click();
await page.locator('.situation-create-dialog').waitFor({state:'visible',timeout:3000});
await page.locator('#newSituationName').fill('Created through DiagnosisService');
await page.locator('#newSituationLevel').fill('6');
await page.locator('.situation-create-dialog .save').click();
await page.locator('.situation-create-dialog').waitFor({state:'detached',timeout:3000});

const added=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  const r=window.DiagnostikaRequests.get('diag-7b-r1',c);
  return {
    selected:situationId,
    count:r.situations.length,
    item:JSON.parse(JSON.stringify(r.situations.find(x=>String(x.id)===String(situationId)))),
    current:c.currentRequestId,last:c.lastDiagnosisRequestId,
    viewed:window.DiagnostikaRequests.viewedId(c),active:window.DiagnostikaRequests.activeId(c)
  };
});
assert.equal(added.count,2);
assert(added.item,'New situation was not selected after service create');
assert.deepEqual(
  {current:added.current,last:added.last,viewed:added.viewed,active:added.active},
  before,
  'Adding a situation changed request authority'
);

await page.locator('#editSituationBtn').click();
const edited=await page.evaluate(id=>{
  const c=window.DiagnostikaClients.current();
  const r=window.DiagnostikaRequests.get('diag-7b-r1',c);
  return JSON.parse(JSON.stringify(r.situations.find(x=>String(x.id)===String(id))));
},added.selected);
assert.equal(edited.name,'Edited through DiagnosisService');
assert.equal(edited.level,9);

await page.locator('#situationResult').fill('Desired result through service');
await page.locator('#saveResultBtn').click();
const withResult=await page.evaluate(id=>{
  const c=window.DiagnostikaClients.current();
  return window.DiagnostikaRequests.get('diag-7b-r1',c).situations.find(x=>String(x.id)===String(id))?.result||'';
},added.selected);
assert.equal(withResult,'Desired result through service');

const persistedBeforeReload=await page.evaluate(id=>{
  const stored=JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}');
  const c=stored.clients?.find(x=>x.id==='diag-7b-client');
  const r=c?.requests?.find(x=>x.id==='diag-7b-r1');
  const s=r?.situations?.find(x=>String(x.id)===String(id));
  return {
    name:s?.name,level:s?.level,result:s?.result,
    current:c?.currentRequestId,last:c?.lastDiagnosisRequestId,
    events:window.__diag7bEvents
  };
},added.selected);
assert.deepEqual(
  {name:persistedBeforeReload.name,level:persistedBeforeReload.level,result:persistedBeforeReload.result},
  {name:'Edited through DiagnosisService',level:9,result:'Desired result through service'}
);
for(const source of ['diagnosis-ui-situation-add','diagnosis-ui-situation-edit','diagnosis-ui-situation-result']){
  assert(persistedBeforeReload.events.some(x=>x.detail?.source===source),'Missing diagnosis event source '+source);
}

await page.reload({waitUntil:'commit',timeout:10000});
await ready();
const restored=await page.evaluate(id=>{
  const c=window.DiagnostikaClients.current();
  const r=window.DiagnostikaRequests.get('diag-7b-r1',c);
  const s=r.situations.find(x=>String(x.id)===String(id));
  window.DiagnostikaDiagnosis.open();
  situationId=id;
  renderSituationList();
  return {
    item:JSON.parse(JSON.stringify(s)),
    current:c.currentRequestId,last:c.lastDiagnosisRequestId,
    active:window.DiagnostikaRequests.activeId(c)
  };
},added.selected);
assert.equal(restored.item.name,'Edited through DiagnosisService');
assert.equal(restored.item.result,'Desired result through service');
assert.deepEqual(
  {current:restored.current,last:restored.last,active:restored.active},
  {current:'diag-7b-r1',last:'diag-7b-r1',active:'diag-7b-r1'}
);

await page.locator('#deleteSituationBtn').click();
const removed=await page.evaluate(id=>{
  const c=window.DiagnostikaClients.current();
  const r=window.DiagnostikaRequests.get('diag-7b-r1',c);
  const stored=JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}');
  const sr=stored.clients?.find(x=>x.id==='diag-7b-client')?.requests?.find(x=>x.id==='diag-7b-r1');
  return {
    liveExists:r.situations.some(x=>String(x.id)===String(id)),
    storedExists:sr?.situations?.some(x=>String(x.id)===String(id))||false,
    remaining:r.situations.length,
    selected:situationId,
    current:c.currentRequestId,last:c.lastDiagnosisRequestId,
    active:window.DiagnostikaRequests.activeId(c)
  };
},added.selected);
assert.equal(removed.liveExists,false);
assert.equal(removed.storedExists,false);
assert.equal(removed.remaining,1);
assert.equal(removed.selected,'diag-7b-base');
assert.deepEqual(
  {current:removed.current,last:removed.last,active:removed.active},
  {current:'diag-7b-r1',last:'diag-7b-r1',active:'diag-7b-r1'}
);

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('DIAGNOSIS_UI_7B_SUCCESS',JSON.stringify({
  addedId:added.selected,
  editedName:edited.name,
  result:withResult,
  remaining:removed.remaining
}));

await context.close();
await browser.close();
