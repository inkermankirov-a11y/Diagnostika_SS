import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource=fs.readFileSync('modules/sessions/session-service.js','utf8');
const moduleSource=fs.readFileSync('modules/sessions/index.js','utf8');
const apiSource=fs.readFileSync('session-api.js','utf8');

assert.match(serviceSource,/services\.sessions=Object\.freeze/);
for(const token of ['function list(','function get(','function create(','function update(','function remove(','function forRequest(','function requestId(','function sessionNumber(','function refresh(']){
  assert(serviceSource.includes(token),'SessionService method missing '+token);
}
assert.equal(serviceSource.includes('querySelector('),false,'SessionService must not know session HTML');
assert.equal(serviceSource.includes('openSessionEditor'),false,'SessionService must not own the editor UI');
assert.match(moduleSource,/MODULE_ID='sessions'/);
assert.match(apiSource,/moduleAware:true/);
assert.match(apiSource,/version:'4B'/);

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const payment=()=>({mode:'',total:0,payments:[],currency:'RUB',sessionAmount:0,sessionDiscount:0});
const fixture={version:4,clients:[{
  id:'sessions-4a-client',
  name:'Sessions 4A Client',
  city:'Киров',
  sessions:[],
  currentRequestId:'sessions-4a-r1',
  lastDiagnosisRequestId:'sessions-4a-r1',
  requests:[
    {id:'sessions-4a-r1',title:'Активный запрос',status:'active',createdAt:'2026-09-18T10:00:00.000Z',updatedAt:'2026-09-18T10:00:00.000Z',situations:[],payment:payment()},
    {id:'sessions-4a-r2',title:'Второй запрос',status:'active',createdAt:'2026-09-18T11:00:00.000Z',updatedAt:'2026-09-18T11:00:00.000Z',situations:[],payment:payment()}
  ]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','sessions-4a-client');
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
    return p?.services?.sessions
      && p?.modules?.get?.('sessions')?.status==='started'
      && p?.sessions===p?.services?.sessions
      && window.DiagnostikaSessions?.moduleAware===true
      && window.DiagnostikaRequests?.moduleAware===true;
  },null,{timeout:15000});
}

await page.goto(base,{waitUntil:'commit',timeout:10000});
await ready();

const architecture=await page.evaluate(()=>({
  module:window.DiagnostikaPlatform.modules.get('sessions'),
  sameService:window.DiagnostikaPlatform.sessions===window.DiagnostikaPlatform.services.sessions,
  facadeFrozen:Object.isFrozen(window.DiagnostikaSessions),
  facadeVersion:window.DiagnostikaSessions.version,
  moduleAware:window.DiagnostikaSessions.moduleAware,
  methods:['list','get','create','update','remove','forRequest','requestId','sessionNumber','refresh']
    .reduce((out,key)=>(out[key]=typeof window.DiagnostikaSessions[key],out),{}),
  scripts:[...document.scripts].map(s=>s.src).filter(Boolean).map(src=>new URL(src).pathname)
}));
assert.equal(architecture.module.status,'started');
assert.deepEqual(architecture.module.roles,['specialist','admin']);
assert.equal(architecture.sameService,true);
assert.equal(architecture.facadeFrozen,true);
assert.equal(architecture.facadeVersion,'4B');
assert.equal(architecture.moduleAware,true);
for(const [name,type] of Object.entries(architecture.methods))assert.equal(type,'function',name+' API missing');

const order=name=>architecture.scripts.findIndex(x=>x.endsWith(name));
assert(order('/request-api.js')>=0,'request facade script missing');
assert(order('/modules/sessions/session-service.js')>order('/request-api.js'),'session service must load after request facade');
assert(order('/modules/sessions/index.js')>order('/modules/sessions/session-service.js'),'session module must load after service');
assert(order('/session-api.js')>order('/modules/sessions/index.js'),'session facade must load after sessions module');
assert(order('/home-dashboard.js')>order('/session-api.js'),'dashboard must load after session facade');

await page.evaluate(()=>{
  window.__sessions4aEvents=[];
  for(const type of ['session:created','session:updated','session:deleted']){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__sessions4aEvents.push({type,detail:{...detail}}));
  }
});

const initial=await page.evaluate(()=>({
  clientId:window.DiagnostikaClients.currentId(),
  activeRequestId:window.DiagnostikaRequests.currentId(),
  count:window.DiagnostikaSessions.list().length
}));
assert.deepEqual(initial,{clientId:'sessions-4a-client',activeRequestId:'sessions-4a-r1',count:0});

await page.evaluate(()=>{window.__sessions4aEvents=[];});
const s1=await page.evaluate(()=>window.DiagnostikaSessions.create(
  {id:'sessions-4a-s1',date:'2026-09-18',notes:'Первая сессия'},
  {source:'sessions-4a-create-default'}
));
assert.equal(s1?.id,'sessions-4a-s1');
assert.equal(s1?.requestId,'sessions-4a-r1','new session did not inherit active request');
await page.waitForTimeout(120);

let events=await page.evaluate(()=>window.__sessions4aEvents);
assert.equal(events.filter(x=>x.type==='session:created').length,1,'create emitted duplicate session:created');
assert.equal(events.filter(x=>x.type==='session:created'&&x.detail.source==='sessions-4a-create-default').length,1);

await page.evaluate(()=>{window.__sessions4aEvents=[];});
const s2=await page.evaluate(()=>window.DiagnostikaSessions.create(
  {id:'sessions-4a-s2',date:'2026-09-17',requestId:'sessions-4a-r2',notes:'Вторая сессия'},
  {source:'sessions-4a-create-explicit'}
));
assert.equal(s2?.id,'sessions-4a-s2');
assert.equal(s2?.requestId,'sessions-4a-r2');
await page.waitForTimeout(120);

events=await page.evaluate(()=>window.__sessions4aEvents);
assert.equal(events.filter(x=>x.type==='session:created').length,1,'explicit create emitted duplicate session:created');

const grouped=await page.evaluate(()=>({
  current:window.DiagnostikaSessions.forRequest().map(s=>s.id),
  r1:window.DiagnostikaSessions.forRequest('sessions-4a-r1').map(s=>s.id),
  r2:window.DiagnostikaSessions.forRequest('sessions-4a-r2').map(s=>s.id),
  s1Request:window.DiagnostikaSessions.requestId(window.DiagnostikaSessions.get('sessions-4a-s1')),
  s2Number:window.DiagnostikaSessions.sessionNumber(window.DiagnostikaClients.current(),'sessions-4a-s2'),
  s1Number:window.DiagnostikaSessions.sessionNumber(window.DiagnostikaClients.current(),'sessions-4a-s1')
}));
assert.deepEqual(grouped.current,['sessions-4a-s1']);
assert.deepEqual(grouped.r1,['sessions-4a-s1']);
assert.deepEqual(grouped.r2,['sessions-4a-s2']);
assert.equal(grouped.s1Request,'sessions-4a-r1');
assert.equal(grouped.s2Number,1);
assert.equal(grouped.s1Number,2);

const invalidCreate=await page.evaluate(()=>window.DiagnostikaSessions.create(
  {id:'sessions-4a-invalid',requestId:'missing-request'},
  {source:'sessions-4a-invalid-create',render:false}
));
assert.equal(invalidCreate,null);
assert.equal(await page.evaluate(()=>window.DiagnostikaSessions.list().length),2);

await page.evaluate(()=>{window.__sessions4aEvents=[];});
const updated=await page.evaluate(()=>window.DiagnostikaSessions.update(
  'sessions-4a-s2',
  {requestId:'sessions-4a-r1',notes:'Вторая сессия обновлена',sessionFormat:'google-meet'},
  {source:'sessions-4a-update'}
));
assert.equal(updated?.requestId,'sessions-4a-r1');
assert.equal(updated?.notes,'Вторая сессия обновлена');
assert.equal(updated?.sessionFormat,'google-meet');
await page.waitForTimeout(120);

events=await page.evaluate(()=>window.__sessions4aEvents);
assert.equal(events.filter(x=>x.type==='session:updated').length,1,'update emitted duplicate session:updated');
assert.equal(events.filter(x=>x.type==='session:updated'&&x.detail.source==='sessions-4a-update').length,1);

const invalidUpdate=await page.evaluate(()=>window.DiagnostikaSessions.update(
  'sessions-4a-s2',
  {requestId:'missing-request'},
  {source:'sessions-4a-invalid-update',render:false}
));
assert.equal(invalidUpdate,null);
assert.equal(await page.evaluate(()=>window.DiagnostikaSessions.get('sessions-4a-s2')?.requestId),'sessions-4a-r1');

const afterUpdate=await page.evaluate(()=>({
  r1:window.DiagnostikaSessions.forRequest('sessions-4a-r1').map(s=>s.id),
  count:window.DiagnostikaSessions.list().length
}));
assert.deepEqual(afterUpdate.r1,['sessions-4a-s1','sessions-4a-s2']);
assert.equal(afterUpdate.count,2);

await page.evaluate(()=>{window.__sessions4aEvents=[];});
const removed=await page.evaluate(()=>window.DiagnostikaSessions.remove(
  'sessions-4a-s1',
  {source:'sessions-4a-remove'}
));
assert.equal(removed?.id,'sessions-4a-s1');
await page.waitForTimeout(120);

events=await page.evaluate(()=>window.__sessions4aEvents);
assert.equal(events.filter(x=>x.type==='session:deleted').length,1,'remove emitted duplicate session:deleted');
assert.equal(events.filter(x=>x.type==='session:deleted'&&x.detail.source==='sessions-4a-remove').length,1);
assert.equal(await page.evaluate(()=>window.DiagnostikaSessions.get('sessions-4a-s1')),null);

await page.evaluate(()=>{window.__sessions4aEvents=[];window.DiagnostikaSessions.refresh();});
await page.waitForTimeout(120);
events=await page.evaluate(()=>window.__sessions4aEvents);
assert.equal(events.length,0,'refresh emitted a fake session lifecycle event');

const persistedBeforeReload=await page.evaluate(()=>{
  const s=window.DiagnostikaSessions.get('sessions-4a-s2');
  return {
    id:s?.id,
    requestId:s?.requestId,
    notes:s?.notes,
    sessionFormat:s?.sessionFormat,
    count:window.DiagnostikaSessions.list().length
  };
});
assert.deepEqual(persistedBeforeReload,{
  id:'sessions-4a-s2',
  requestId:'sessions-4a-r1',
  notes:'Вторая сессия обновлена',
  sessionFormat:'google-meet',
  count:1
});

await page.reload({waitUntil:'commit',timeout:10000});
await ready();
const reloaded=await page.evaluate(()=>{
  const s=window.DiagnostikaSessions.get('sessions-4a-s2');
  return {
    module:window.DiagnostikaPlatform.modules.get('sessions')?.status,
    sameService:window.DiagnostikaPlatform.sessions===window.DiagnostikaPlatform.services.sessions,
    id:s?.id,
    requestId:s?.requestId,
    notes:s?.notes,
    sessionFormat:s?.sessionFormat,
    count:window.DiagnostikaSessions.list().length
  };
});
assert.deepEqual(reloaded,{
  module:'started',
  sameService:true,
  id:'sessions-4a-s2',
  requestId:'sessions-4a-r1',
  notes:'Вторая сессия обновлена',
  sessionFormat:'google-meet',
  count:1
});

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('SESSION_MODULE_4A_SUCCESS',JSON.stringify({architecture,grouped,afterUpdate,reloaded}));

await context.close();
await browser.close();
