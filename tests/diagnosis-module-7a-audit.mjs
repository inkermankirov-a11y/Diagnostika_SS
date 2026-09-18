import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource=fs.readFileSync('modules/diagnosis/diagnosis-service.js','utf8');
const moduleSource=fs.readFileSync('modules/diagnosis/index.js','utf8');
const apiSource=fs.readFileSync('diagnosis-api.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');

for(const token of [
  'snapshot','situations','getSituation','findElement',
  'addSituation','updateSituation','removeSituation',
  'addBelief','addFeeling','addDeep','addInstinct','updateElement','removeElement'
]){
  assert(serviceSource.includes(token),'DiagnosisService missing '+token);
  assert(apiSource.includes(token),'Diagnosis facade missing '+token);
}
assert(apiSource.includes("version:'7A'"),'Diagnosis facade version is not 7A');
assert(apiSource.includes('moduleAware:true'),'Diagnosis facade is not module-aware');
assert(serviceSource.includes('api.update('),'DiagnosisService does not commit through RequestService.update');
assert.equal(/\b(?:currentRequestId|lastDiagnosisRequestId)\s*=/.test(serviceSource),false,'DiagnosisService owns request authority');
assert.equal(/\bsave\s*\(/.test(serviceSource),false,'DiagnosisService persists directly');
assert(moduleSource.includes("MODULE_ID='diagnosis'"),'Diagnosis module registration missing');
for(const token of [
  'modules/diagnosis/diagnosis-service.js?v=20260919-diagnosis7a',
  'modules/diagnosis/index.js?v=20260919-diagnosis7a'
])assert(loaderSource.includes(token),'Diagnosis loader missing '+token);

const fixture={version:4,clients:[{
  id:'diag-7a-client',
  name:'Diagnosis 7A Client',
  currentRequestId:'diag-7a-r1',
  lastDiagnosisRequestId:'diag-7a-r1',
  requests:[
    {id:'diag-7a-r1',title:'Active request',status:'active',situations:[{id:'diag-7a-base',name:'Base',level:5,comment:'',result:'',beliefs:[]}]},
    {id:'diag-7a-r2',title:'Historical request',status:'completed',situations:[]}
  ],
  sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','diag-7a-client');
  if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaDiagnosis?.version==='7A'
    && window.DiagnostikaDiagnosis?.moduleAware===true
    && window.DiagnostikaPlatform?.services?.diagnosis
    && window.DiagnostikaPlatform?.modules?.get?.('diagnosis')?.status==='started',
    null,{timeout:15000});
}

await page.goto('http://127.0.0.1:8000/index.html?diagnosis-7a=1',{waitUntil:'commit',timeout:10000});
await ready();

const result=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='diag-7a-client');
  const req=window.DiagnostikaRequests;
  req.activate('diag-7a-r1',{client:c,source:'diagnosis-7a-fixture-active',render:false});
  req.view('diag-7a-r1',{client:c,source:'diagnosis-7a-fixture-view',render:false});

  window.__diag7aEvents=[];
  for(const type of [
    'diagnosis:situation-created','diagnosis:situation-updated','diagnosis:situation-deleted',
    'diagnosis:element-created','diagnosis:element-updated','diagnosis:element-deleted','diagnosis:updated'
  ]){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__diag7aEvents.push({type,detail:{...detail}}));
  }

  const before={
    current:c.currentRequestId,
    last:c.lastDiagnosisRequestId,
    viewed:req.viewedId(c),
    active:req.activeId(c)
  };
  const opts={client:c,requestId:'diag-7a-r2',source:'diagnosis-7a-audit',render:false};
  const s=window.DiagnostikaDiagnosis.addSituation({
    id:'diag-7a-s1',name:'Historical situation',level:7,comment:'initial',result:'target',beliefs:[]
  },opts);
  const b=window.DiagnostikaDiagnosis.addBelief('diag-7a-s1',{
    id:'diag-7a-b1',text:'belief',level:6,comment:'',feelings:[]
  },opts);
  const f=window.DiagnostikaDiagnosis.addFeeling('diag-7a-b1',{
    id:'diag-7a-f1',text:'feeling',level:5,comment:'',deep:[]
  },opts);
  const d=window.DiagnostikaDiagnosis.addDeep('diag-7a-f1',{
    id:'diag-7a-d1',text:'deep',level:4,comment:'',instincts:[]
  },opts);
  const x=window.DiagnostikaDiagnosis.addInstinct('diag-7a-d1',{
    id:'diag-7a-i1',name:'Самосохранение',level:8,comment:'instinct'
  },opts);
  const updatedSituation=window.DiagnostikaDiagnosis.updateSituation('diag-7a-s1',{level:8,comment:'updated'},opts);
  const updatedBelief=window.DiagnostikaDiagnosis.updateElement('belief','diag-7a-b1',{text:'belief updated',level:7},opts);

  const snap=window.DiagnostikaDiagnosis.snapshot('diag-7a-r2',c.id);
  snap.situations[0].name='MUTATED SNAPSHOT';
  snap.situations.push({id:'fake'});
  const live=req.get('diag-7a-r2',c);
  const after={
    current:c.currentRequestId,
    last:c.lastDiagnosisRequestId,
    viewed:req.viewedId(c),
    active:req.activeId(c)
  };
  return {
    before,after,s,b,f,d,x,updatedSituation,updatedBelief,
    live:JSON.parse(JSON.stringify(live)),
    events:window.__diag7aEvents,
    persisted:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}')
  };
});

for(const key of ['s','b','f','d','x','updatedSituation','updatedBelief'])assert(result[key],key+' operation failed');
assert.deepEqual(result.after,result.before,'Diagnosis tree update changed request authority');
assert.equal(result.live.situations.length,1,'Snapshot mutation leaked into live situations');
assert.equal(result.live.situations[0].name,'Historical situation','Snapshot mutation changed live situation');
assert.equal(result.live.situations[0].level,8);
assert.equal(result.live.situations[0].beliefs[0].text,'belief updated');
assert.equal(result.live.situations[0].beliefs[0].feelings[0].deep[0].instincts[0].name,'Самосохранение');
const storedClient=result.persisted.clients.find(x=>x.id==='diag-7a-client');
const storedR2=storedClient.requests.find(x=>x.id==='diag-7a-r2');
assert.equal(storedR2.situations[0].beliefs[0].text,'belief updated','Diagnosis tree not persisted');
assert(result.events.some(x=>x.type==='diagnosis:situation-created'));
assert(result.events.filter(x=>x.type==='diagnosis:element-created').length>=4);

await page.reload({waitUntil:'commit',timeout:10000});
await ready();
const restored=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='diag-7a-client');
  const req=window.DiagnostikaRequests;
  const snap=window.DiagnostikaDiagnosis.snapshot('diag-7a-r2',c.id);
  return {
    current:c.currentRequestId,
    last:c.lastDiagnosisRequestId,
    viewed:req.viewedId(c),
    active:req.activeId(c),
    snap
  };
});
assert.equal(restored.current,'diag-7a-r1');
assert.equal(restored.last,'diag-7a-r1');
assert.equal(restored.active,'diag-7a-r1');
assert.equal(restored.snap.situations.length,1);
assert.equal(restored.snap.situations[0].beliefs[0].text,'belief updated');

const cleanup=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='diag-7a-client');
  const opts={client:c,requestId:'diag-7a-r2',source:'diagnosis-7a-cleanup',render:false};
  const removedInstinct=window.DiagnostikaDiagnosis.removeElement('instinct','diag-7a-i1',opts);
  const removedSituation=window.DiagnostikaDiagnosis.removeSituation('diag-7a-s1',opts);
  return {
    removedInstinct,removedSituation,
    current:c.currentRequestId,
    last:c.lastDiagnosisRequestId,
    active:window.DiagnostikaRequests.activeId(c),
    situations:window.DiagnostikaDiagnosis.situations('diag-7a-r2',c.id)
  };
});
assert(cleanup.removedInstinct&&cleanup.removedSituation);
assert.deepEqual({current:cleanup.current,last:cleanup.last,active:cleanup.active},
  {current:'diag-7a-r1',last:'diag-7a-r1',active:'diag-7a-r1'});
assert.deepEqual(cleanup.situations,[]);

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('DIAGNOSIS_MODULE_7A_SUCCESS',JSON.stringify({
  requestAuthority:result.after,
  createdEvents:result.events.filter(x=>x.type==='diagnosis:element-created').length,
  restoredSituations:restored.snap.situations.length,
  cleanupSituations:cleanup.situations.length
}));

await context.close();
await browser.close();
