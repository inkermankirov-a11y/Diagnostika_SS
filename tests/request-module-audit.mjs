import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource=fs.readFileSync('modules/requests/request-service.js','utf8');
const apiSource=fs.readFileSync('request-api.js','utf8');
assert.match(serviceSource,/services\.requests=Object\.freeze/);
assert.match(serviceSource,/function view\(/);
assert.match(serviceSource,/function activate\(/);
assert.equal(/function activate[\s\S]*?target\.updatedAt=now\(\)/.test(serviceSource),false,'activate() must not mutate request data during navigation');
assert.match(apiSource,/moduleAware:true/);
assert.match(apiSource,/version:'3A'/);

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const payment=()=>({mode:'',total:0,payments:[],currency:'RUB',sessionAmount:0,sessionDiscount:0});
const fixture={version:4,clients:[{
  id:'requests-3a-client',
  name:'Requests 3A Client',
  city:'Киров',
  sessions:[],
  currentRequestId:'requests-3a-r1',
  lastDiagnosisRequestId:'requests-3a-r1',
  requests:[
    {id:'requests-3a-r1',title:'Первый запрос',status:'active',createdAt:'2026-09-18T10:00:00.000Z',updatedAt:'2026-09-18T10:00:00.000Z',situations:[],payment:payment()},
    {id:'requests-3a-r2',title:'Второй запрос',status:'active',createdAt:'2026-09-18T11:00:00.000Z',updatedAt:'2026-09-18T11:00:00.000Z',situations:[],payment:payment()}
  ]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','requests-3a-client');
  if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>{
    const p=window.DiagnostikaPlatform;
    return p?.services?.requests
      && p?.modules?.get?.('requests')?.status==='started'
      && p?.requests===p?.services?.requests
      && window.DiagnostikaRequests?.moduleAware===true;
  },null,{timeout:15000});
}

await page.goto(base,{waitUntil:'commit',timeout:10000});
await ready();

const architecture=await page.evaluate(()=>({
  module:window.DiagnostikaPlatform.modules.get('requests'),
  sameService:window.DiagnostikaPlatform.requests===window.DiagnostikaPlatform.services.requests,
  facadeFrozen:Object.isFrozen(window.DiagnostikaRequests),
  facadeVersion:window.DiagnostikaRequests.version,
  moduleAware:window.DiagnostikaRequests.moduleAware,
  methods:['list','get','current','currentId','active','activeId','viewed','viewedId','view','select','activate','create','update','complete','resume','remove','requestNumber','refresh']
    .reduce((out,key)=>(out[key]=typeof window.DiagnostikaRequests[key],out),{}),
  scripts:[...document.scripts].map(s=>s.src).filter(Boolean).map(src=>new URL(src).pathname)
}));
assert.equal(architecture.module.status,'started');
assert.deepEqual(architecture.module.roles,['specialist','admin']);
assert.equal(architecture.sameService,true);
assert.equal(architecture.facadeFrozen,true);
assert.equal(architecture.facadeVersion,'3A');
assert.equal(architecture.moduleAware,true);
for(const [name,type] of Object.entries(architecture.methods))assert.equal(type,'function',name+' API missing');

const order=name=>architecture.scripts.findIndex(x=>x.endsWith(name));
assert(order('/modules/requests/request-service.js')>=0,'request service script missing');
assert(order('/modules/requests/index.js')>order('/modules/requests/request-service.js'),'request module must load after service');
assert(order('/request-api.js')>order('/modules/requests/index.js'),'request facade must load after requests module');
assert(order('/home-dashboard.js')>order('/request-api.js'),'dashboard must load after request facade');

await page.evaluate(()=>{
  window.__requests3aEvents=[];
  for(const type of ['request:created','request:selected','request:updated','request:activated','request:completed','request:resumed','request:deleted']){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__requests3aEvents.push({type,detail:{...detail}}));
  }
});

const initial=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  const s=window.DiagnostikaPlatform.services.requests;
  return {
    clientId:c?.id,
    active:s.activeId(),
    current:s.currentId(),
    viewed:s.viewedId(),
    last:c?.lastDiagnosisRequestId,
    requests:JSON.stringify(s.list())
  };
});
assert.equal(initial.clientId,'requests-3a-client');
assert.equal(initial.active,'requests-3a-r1');
assert.equal(initial.current,'requests-3a-r1');
assert.equal(initial.viewed,'requests-3a-r1');
assert.equal(initial.last,'requests-3a-r1');

// Viewing another request must not activate it or persist authority changes.
assert.equal(await page.evaluate(()=>window.DiagnostikaPlatform.services.requests.view('requests-3a-r2',{source:'requests-3a-view',render:false})),true);
const viewed=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  const s=window.DiagnostikaPlatform.services.requests;
  return {
    active:s.activeId(),
    viewed:s.viewedId(),
    currentRequestId:c.currentRequestId,
    lastDiagnosisRequestId:c.lastDiagnosisRequestId,
    requests:JSON.stringify(s.list()),
    events:window.__requests3aEvents
  };
});
assert.equal(viewed.active,'requests-3a-r1');
assert.equal(viewed.viewed,'requests-3a-r2');
assert.equal(viewed.currentRequestId,'requests-3a-r1');
assert.equal(viewed.lastDiagnosisRequestId,'requests-3a-r1');
assert.equal(viewed.requests,initial.requests,'view() mutated request data');
assert.equal(viewed.events.filter(x=>x.type==='request:selected'&&x.detail.source==='requests-3a-view').length,1);
assert.equal(viewed.events.filter(x=>x.type==='request:activated').length,0);

// Explicit activation changes authority, but still not the request payload itself.
await page.evaluate(()=>{window.__requests3aEvents=[];});
assert.equal(await page.evaluate(()=>window.DiagnostikaPlatform.services.requests.activate('requests-3a-r2',{source:'requests-3a-activate',render:false})),true);
const activated=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  const s=window.DiagnostikaPlatform.services.requests;
  return {
    active:s.activeId(),
    viewed:s.viewedId(),
    currentRequestId:c.currentRequestId,
    lastDiagnosisRequestId:c.lastDiagnosisRequestId,
    requests:JSON.stringify(s.list()),
    events:window.__requests3aEvents
  };
});
assert.equal(activated.active,'requests-3a-r2');
assert.equal(activated.viewed,'requests-3a-r2');
assert.equal(activated.currentRequestId,'requests-3a-r2');
assert.equal(activated.lastDiagnosisRequestId,'requests-3a-r2');
assert.equal(activated.requests,initial.requests,'activate() mutated request data');
assert.equal(activated.events.filter(x=>x.type==='request:activated'&&x.detail.source==='requests-3a-activate').length,1);
assert.equal(activated.events.filter(x=>x.type==='request:selected').length,0,'activate after view duplicated selected event');

// CRUD/lifecycle through RequestService.
await page.evaluate(()=>{window.__requests3aEvents=[];});
const updated=await page.evaluate(()=>window.DiagnostikaPlatform.services.requests.update(
  'requests-3a-r2',
  {title:'Второй запрос обновлён'},
  {source:'requests-3a-update',render:false}
));
assert.equal(updated?.title,'Второй запрос обновлён');

const created=await page.evaluate(()=>window.DiagnostikaPlatform.services.requests.create(
  {id:'requests-3a-r3',title:'Третий запрос',situations:[]},
  {source:'requests-3a-create',activate:false,view:false,render:false}
));
assert.equal(created?.id,'requests-3a-r3');

let snap=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current(),s=window.DiagnostikaPlatform.services.requests;
  return {active:s.activeId(),viewed:s.viewedId(),last:c.lastDiagnosisRequestId,count:s.list().length};
});
assert.deepEqual(snap,{active:'requests-3a-r2',viewed:'requests-3a-r2',last:'requests-3a-r2',count:3});

const completed=await page.evaluate(()=>window.DiagnostikaPlatform.services.requests.complete(
  'requests-3a-r2',{source:'requests-3a-complete',render:false}
));
assert.equal(completed?.status,'completed');

snap=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current(),s=window.DiagnostikaPlatform.services.requests;
  return {
    active:s.activeId(),viewed:s.viewedId(),last:c.lastDiagnosisRequestId,
    r2:s.get('requests-3a-r2')?.status,
    activateCompleted:s.activate('requests-3a-r2',{source:'requests-3a-invalid-activate',render:false})
  };
});
assert.equal(snap.active,'requests-3a-r1');
assert.equal(snap.viewed,'requests-3a-r2');
assert.equal(snap.last,'requests-3a-r2');
assert.equal(snap.r2,'completed');
assert.equal(snap.activateCompleted,false);

const resumed=await page.evaluate(()=>window.DiagnostikaPlatform.services.requests.resume(
  'requests-3a-r2',{source:'requests-3a-resume',render:false}
));
assert.equal(resumed?.status,'active');

const removed=await page.evaluate(()=>window.DiagnostikaPlatform.services.requests.remove(
  'requests-3a-r3',{source:'requests-3a-remove',render:false}
));
assert.equal(removed?.id,'requests-3a-r3');

const lifecycle=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current(),s=window.DiagnostikaPlatform.services.requests;
  return {
    active:s.activeId(),
    viewed:s.viewedId(),
    last:c.lastDiagnosisRequestId,
    r2Title:s.get('requests-3a-r2')?.title,
    r2Status:s.get('requests-3a-r2')?.status,
    r3:s.get('requests-3a-r3'),
    requestNumber:s.requestNumber(c,s.get('requests-3a-r2')),
    events:window.__requests3aEvents
  };
});
assert.equal(lifecycle.active,'requests-3a-r2');
assert.equal(lifecycle.viewed,'requests-3a-r2');
assert.equal(lifecycle.last,'requests-3a-r2');
assert.equal(lifecycle.r2Title,'Второй запрос обновлён');
assert.equal(lifecycle.r2Status,'active');
assert.equal(lifecycle.r3,null);
assert.equal(lifecycle.requestNumber,2);
assert.equal(lifecycle.events.filter(x=>x.type==='request:updated'&&x.detail.source==='requests-3a-update').length,1);
assert.equal(lifecycle.events.filter(x=>x.type==='request:created'&&x.detail.source==='requests-3a-create').length,1);
assert.equal(lifecycle.events.filter(x=>x.type==='request:completed'&&x.detail.source==='requests-3a-complete').length,1);
assert.equal(lifecycle.events.filter(x=>x.type==='request:resumed'&&x.detail.source==='requests-3a-resume').length,1);
assert.equal(lifecycle.events.filter(x=>x.type==='request:deleted'&&x.detail.source==='requests-3a-remove').length,1);

// Compatibility select() remains activation until 3B migrates legacy UI to view()/activate().
assert.equal(await page.evaluate(()=>window.DiagnostikaRequests.select('requests-3a-r1',{source:'requests-3a-select-compat',render:false})),true);
assert.equal(await page.evaluate(()=>window.DiagnostikaRequests.currentId()),'requests-3a-r1');
assert.equal(await page.evaluate(()=>window.DiagnostikaRequests.viewedId()),'requests-3a-r1');
assert.equal(await page.evaluate(()=>window.DiagnostikaRequests.select('requests-3a-r2',{source:'requests-3a-select-compat-final',render:false})),true);

// Persistence + reload.
await page.reload({waitUntil:'commit',timeout:10000});
await ready();
const reloaded=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current(),s=window.DiagnostikaPlatform.services.requests;
  return {
    active:s.activeId(),
    current:s.currentId(),
    viewed:s.viewedId(),
    last:c?.lastDiagnosisRequestId,
    title:s.get('requests-3a-r2')?.title,
    status:s.get('requests-3a-r2')?.status,
    count:s.list().length,
    r3:s.get('requests-3a-r3')
  };
});
assert.deepEqual(reloaded,{
  active:'requests-3a-r2',
  current:'requests-3a-r2',
  viewed:'requests-3a-r2',
  last:'requests-3a-r2',
  title:'Второй запрос обновлён',
  status:'active',
  count:2,
  r3:null
});

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('REQUEST_MODULE_3A_SUCCESS',JSON.stringify({architecture,lifecycle,reloaded}));
await context.close();
await browser.close();
