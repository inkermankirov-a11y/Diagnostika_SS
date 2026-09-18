import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const phase=process.env.CLIENT_WRITE_PHASE||'create';
const fixture={version:4,clients:[{
  id:'clients-2b1-seed',
  name:'Seed Client',
  city:'Киров',
  phone:'+70000000000',
  sessions:[],
  requests:[],
  currentRequestId:null,
  lastDiagnosisRequestId:null
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1')){
    localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  }
  if(!localStorage.getItem('diagnostika-last-client-id')){
    localStorage.setItem('diagnostika-last-client-id','clients-2b1-seed');
  }
  if(!localStorage.getItem('diagnostika-ui-language')){
    localStorage.setItem('diagnostika-ui-language','ru');
  }
},fixture);

const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')pageErrors.push(m.text())});
page.on('response',response=>{
  if(response.status()>=400)console.log('CLIENT_WRITE_HTTP_ERROR',response.status(),response.url());
});
page.on('requestfailed',request=>console.log('CLIENT_WRITE_REQUEST_FAILED',request.url(),request.failure()?.errorText||''));
page.on('dialog',d=>d.accept().catch(()=>{}));

await page.goto(base,{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>{
  const p=window.DiagnostikaPlatform;
  return p?.modules?.get?.('clients')?.status==='started'
    && typeof p?.services?.clients?.create==='function'
    && typeof p?.services?.clients?.update==='function'
    && window.DiagnostikaClients?.version==='2B2'
    && typeof window.DiagnostikaClientCard?.openNew==='function';
},null,{timeout:10000});

await page.evaluate(()=>{
  window.__clientWriteEvents=[];
  for(const type of ['client:created','client:selected','client:updated']){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__clientWriteEvents.push({type,detail}));
  }
});

if(phase==='create'){
  await page.evaluate(()=>window.DiagnostikaClientCard.openNew());
  const card=page.locator('#clientCardDialog');
  await card.waitFor({state:'visible',timeout:5000});
  await card.locator('#ccName').fill('Created Through Card');
  await card.locator('#ccPhone').fill('+79990001122');
  await card.locator('#ccCity').fill('Москва');
  await card.locator('#ccInitialProblem').fill('Первичный запрос');
  await card.locator('#ccSaveBtn').click();
  await card.waitFor({state:'hidden',timeout:5000});

  const result=await page.evaluate(()=>({
    count:window.DiagnostikaClients.list().length,
    currentId:window.DiagnostikaClients.currentId(),
    current:{...window.DiagnostikaClients.current()},
    events:window.__clientWriteEvents.map(x=>({type:x.type,detail:{...x.detail}})),
    persisted:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}')
  }));
  assert.equal(result.count,2);
  assert.equal(result.current.name,'Created Through Card');
  assert.equal(result.current.phone,'+79990001122');
  assert.equal(result.current.city,'Москва');
  assert.equal(result.current.initialProblem,'Первичный запрос');
  assert.equal(result.persisted.clients.length,2);
  const created=result.events.filter(x=>x.type==='client:created'&&x.detail.clientId===result.currentId);
  const selected=result.events.filter(x=>x.type==='client:selected'&&x.detail.clientId===result.currentId);
  assert.equal(created.length,1,'Card create must emit client:created exactly once');
  assert.equal(selected.length,1,'Card create must emit client:selected exactly once');
  assert.equal(created[0].detail.source,'client-card-create');

  await page.reload({waitUntil:'commit',timeout:10000});
  await page.waitForFunction(()=>window.DiagnostikaClients?.version==='2B2'&&window.DiagnostikaPlatform?.services?.clients,null,{timeout:20000});
  const afterReload=await page.evaluate(id=>window.DiagnostikaClients.findById(id),result.currentId);
  assert.equal(afterReload?.name,'Created Through Card');
  assert.equal(afterReload?.phone,'+79990001122');
}

if(phase==='update'){
  await page.evaluate(()=>window.DiagnostikaClientCard.openExisting());
  const card=page.locator('#clientCardDialog');
  await card.waitFor({state:'visible',timeout:5000});
  await card.locator('#ccCity').fill('Санкт-Петербург');
  await card.locator('#ccDesiredOutcome').fill('Желаемый результат 2B1');
  await card.locator('#ccSaveBtn').click();
  await card.waitFor({state:'hidden',timeout:5000});

  const result=await page.evaluate(()=>({
    client:{...window.DiagnostikaClients.findById('clients-2b1-seed')},
    events:window.__clientWriteEvents.map(x=>({type:x.type,detail:{...x.detail}})),
    persisted:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}')
  }));
  assert.equal(result.client.city,'Санкт-Петербург');
  assert.equal(result.client.desiredOutcome,'Желаемый результат 2B1');
  const updates=result.events.filter(x=>x.type==='client:updated'&&x.detail.clientId==='clients-2b1-seed');
  assert.equal(updates.length,1,'Card update must emit client:updated exactly once');
  assert.equal(updates[0].detail.source,'client-card');
  assert(updates[0].detail.fields.includes('city'));
  assert(updates[0].detail.fields.includes('desiredOutcome'));
  const persisted=result.persisted.clients.find(x=>x.id==='clients-2b1-seed');
  assert.equal(persisted?.city,'Санкт-Петербург');
  assert.equal(persisted?.desiredOutcome,'Желаемый результат 2B1');
}

if(phase==='legacy'){
  const opened=await page.evaluate(()=>window.DiagnostikaClients.openDatabase());
  assert.equal(opened,true);
  const database=page.locator('#clientDialog');
  await database.waitFor({state:'visible',timeout:5000});
  await database.locator('#dialogAddClientBtn').click();
  await database.waitFor({state:'hidden',timeout:5000});
  await page.waitForTimeout(80);

  const result=await page.evaluate(()=>({
    count:window.DiagnostikaClients.list().length,
    currentId:window.DiagnostikaClients.currentId(),
    currentName:window.DiagnostikaClients.current()?.name||null,
    events:window.__clientWriteEvents.map(x=>({type:x.type,detail:{...x.detail}})),
    persisted:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}')
  }));
  assert.equal(result.count,2);
  assert.equal(result.currentName,'Новый клиент');
  assert.equal(result.persisted.clients.length,2);
  const created=result.events.filter(x=>x.type==='client:created'&&x.detail.clientId===result.currentId);
  assert.equal(created.length,1,'Legacy database create must emit client:created exactly once');
  assert.equal(created[0].detail.source,'client-database-create');
}

const serious=pageErrors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');
console.log('CLIENT_WRITE_2B2_AUDIT_SUCCESS',phase);

await context.close();
await browser.close();