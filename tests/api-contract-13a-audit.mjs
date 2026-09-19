import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const registrySource=fs.readFileSync('core/api-registry.js','utf8');
const bootstrapSource=fs.readFileSync('core/bootstrap.js','utf8');

assert(registrySource.includes("version:'13D'"),'API registry is not 13A');
assert(registrySource.includes('window.DiagnostikaAPI=platform.api'),'Unified DiagnostikaAPI export missing');
assert(registrySource.includes('function invokeService('),'Common service invocation missing');
assert(registrySource.includes('function invokeServiceAsync('),'Common async service invocation missing');
assert(registrySource.includes('function health('),'API health contract missing');
assert(registrySource.includes('function allowed('),'API role gate missing');
assert(bootstrapSource.includes("['api', 'core/api-registry.js?v=20260919-api13d']"),'API registry CORE loader missing');

const apiFiles=[
  'ai-api.js','calendar-api.js','client-api.js','diagnosis-api.js','export-api.js',
  'files-api.js','payment-api.js','request-api.js','roles-api.js','session-api.js'
];
for(const file of apiFiles){
  const source=fs.readFileSync(file,'utf8');
  assert(source.includes('moduleAware:true')||source.includes('moduleAware: true'),file+' is not module-aware');
}
assert(fs.readFileSync('payment-api.js','utf8').includes('Object.freeze(facade)'),'Payments facade is not frozen');
for(const file of ['ai-api.js','calendar-api.js','session-api.js','payment-api.js','files-api.js','export-api.js']){
  const source=fs.readFileSync(file,'utf8');
  assert(source.includes('platform.api?.invokeService'),file+' does not use common API invocation');
}
for(const file of ['client-api.js','request-api.js','diagnosis-api.js']){
  const source=fs.readFileSync(file,'utf8');
  assert(source.includes('function apiAllowed()'),file+' has no Roles-aware legacy guard');
}

const fixture={version:4,clients:[{
  id:'api13-client',
  name:'API 13 Client',
  currentRequestId:'api13-r1',
  requests:[{id:'api13-r1',title:'API 13 request',status:'active',situations:[]}],
  sessions:[{id:'api13-s1',date:'2026-09-19',requestId:'api13-r1',notes:''}],
  quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','api13-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?api-13a=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaAPI?.version==='13D'
  && window.DiagnostikaRoles?.moduleAware===true
  && window.DiagnostikaClients?.moduleAware===true
  && window.DiagnostikaRequests?.moduleAware===true
  && window.DiagnostikaDiagnosis?.moduleAware===true
  && window.DiagnostikaSessions?.moduleAware===true
  && window.DiagnostikaFiles?.moduleAware===true
  && window.DiagnostikaExport?.moduleAware===true
  && window.DiagnostikaCalendar?.moduleAware===true
  && window.DiagnostikaPayments?.moduleAware===true
  && window.DiagnostikaAI?.moduleAware===true,
  null,{timeout:20000});

const ids=['clients','requests','diagnosis','sessions','files','export','calendar','payments','ai','roles'];
await page.waitForFunction(ids=>{
  const api=window.DiagnostikaAPI;
  return ids.every(id=>{
    const h=api.health(id);
    return h.status==='ready';
  });
},ids,{timeout:20000});

const initial=await page.evaluate(ids=>{
  window.__api13Events=[];
  window.DiagnostikaPlatform.events.on('api:unavailable',detail=>window.__api13Events.push({type:'unavailable',detail}));
  window.DiagnostikaPlatform.events.on('api:error',detail=>window.__api13Events.push({type:'error',detail:{id:detail?.id,method:detail?.method}}));

  const api=window.DiagnostikaAPI;
  const rows=api.list();
  const summary=api.ready();
  return {
    frozen:Object.isFrozen(api),
    version:api.version,
    rows,
    summary,
    globals:{
      clients:Object.isFrozen(window.DiagnostikaClients),
      requests:Object.isFrozen(window.DiagnostikaRequests),
      diagnosis:Object.isFrozen(window.DiagnostikaDiagnosis),
      sessions:Object.isFrozen(window.DiagnostikaSessions),
      files:Object.isFrozen(window.DiagnostikaFiles),
      export:Object.isFrozen(window.DiagnostikaExport),
      calendar:Object.isFrozen(window.DiagnostikaCalendar),
      payments:Object.isFrozen(window.DiagnostikaPayments),
      ai:Object.isFrozen(window.DiagnostikaAI),
      roles:Object.isFrozen(window.DiagnostikaRoles)
    },
    clientCount:window.DiagnostikaClients.list().length,
    sessionCount:window.DiagnostikaSessions.list().length,
    requestId:window.DiagnostikaRequests.currentId()
  };
},ids);

assert.equal(initial.frozen,true);
assert.equal(initial.version,'13D');
assert.equal(initial.rows.length,10);
assert.equal(initial.summary.ready,true);
assert.equal(initial.summary.total,10);
assert.equal(initial.summary.unhealthy.length,0);
for(const [name,frozen] of Object.entries(initial.globals))assert.equal(frozen,true,name+' facade is not frozen');
assert.equal(initial.clientCount,1);
assert.equal(initial.sessionCount,1);
assert.equal(initial.requestId,'api13-r1');

const unknown=await page.evaluate(()=>{
  const value=window.DiagnostikaAPI.invokeService('sessions','__missing_method__',[],'API_FALLBACK');
  return {value,events:window.__api13Events};
});
assert.equal(unknown.value,'API_FALLBACK');
assert(unknown.events.some(x=>x.type==='unavailable'
  && x.detail?.id==='sessions'
  && x.detail?.method==='__missing_method__'
  && x.detail?.reason==='unknown-method'));

await page.evaluate(async()=>{
  window.DiagnostikaRoles.set('client',{source:'api13-client-role'});
  await window.DiagnostikaRoles.settled();
});
await page.waitForFunction(ids=>ids.filter(id=>id!=='roles').every(id=>window.DiagnostikaAPI.health(id).status==='blocked'),ids,{timeout:10000});

const blocked=await page.evaluate(async ids=>{
  const api=window.DiagnostikaAPI;
  return {
    role:window.DiagnostikaRoles.current(),
    health:ids.map(id=>api.health(id)),
    clients:window.DiagnostikaClients.list(),
    requests:window.DiagnostikaRequests.list(),
    diagnosisOpen:window.DiagnostikaDiagnosis.open(),
    sessions:window.DiagnostikaSessions.list(),
    files:await window.DiagnostikaFiles.list(),
    exportName:window.DiagnostikaExport.safeName('A/B','fallback'),
    calendar:window.DiagnostikaCalendar.list(),
    payment:window.DiagnostikaPayments.request('api13-r1'),
    ai:window.DiagnostikaAI.clientChat('api13-client'),
    ready:api.ready()
  };
},ids);

assert.equal(blocked.role,'client');
for(const h of blocked.health.filter(x=>x.id!=='roles'))assert.equal(h.status,'blocked',h.id+' not blocked');
assert.equal(blocked.health.find(x=>x.id==='roles')?.status,'ready');
assert.deepEqual(blocked.clients,[]);
assert.deepEqual(blocked.requests,[]);
assert.equal(blocked.diagnosisOpen,false);
assert.deepEqual(blocked.sessions,[]);
assert.deepEqual(blocked.files,[]);
assert.equal(blocked.exportName,'fallback');
assert.deepEqual(blocked.calendar,[]);
assert.equal(blocked.payment,null);
assert.equal(blocked.ai,null);
assert.equal(blocked.ready.ready,true);
assert.equal(blocked.ready.blockedCount,9);

await page.evaluate(async()=>{
  window.DiagnostikaRoles.set('specialist',{source:'api13-specialist-role'});
  await window.DiagnostikaRoles.settled();
});
await page.waitForFunction(ids=>ids.every(id=>window.DiagnostikaAPI.health(id).status==='ready'),ids,{timeout:10000});

const restored=await page.evaluate(ids=>({
  role:window.DiagnostikaRoles.current(),
  health:ids.map(id=>window.DiagnostikaAPI.health(id)),
  clients:window.DiagnostikaClients.list().length,
  sessions:window.DiagnostikaSessions.list().length,
  ready:window.DiagnostikaAPI.ready()
}),ids);

assert.equal(restored.role,'specialist');
assert.equal(restored.clients,1);
assert.equal(restored.sessions,1);
assert.equal(restored.ready.ready,true);
assert.equal(restored.ready.readyCount,10);
assert.equal(restored.ready.blockedCount,0);
for(const h of restored.health)assert.equal(h.status,'ready',h.id+' did not restore');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('API_13AD_SUCCESS',JSON.stringify({
  contracts:initial.rows.length,
  specialistReady:true,
  clientBlocked:blocked.ready.blockedCount,
  restored:true
}));

await context.close();
await browser.close();
