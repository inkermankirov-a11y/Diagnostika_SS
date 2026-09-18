import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
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
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','clients-2b1-seed');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')pageErrors.push(m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

await page.goto(base,{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>{
  const p=window.DiagnostikaPlatform;
  return p?.modules?.get?.('clients')?.status==='started'
    && typeof p?.services?.clients?.create==='function'
    && typeof p?.services?.clients?.update==='function'
    && window.DiagnostikaClients?.version==='2B1'
    && typeof window.DiagnostikaClientCard?.openNew==='function';
},null,{timeout:10000});

await page.evaluate(()=>{
  window.__clientWriteEvents=[];
  for(const type of ['client:created','client:selected','client:updated']){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__clientWriteEvents.push({type,detail}));
  }
});

// 1. Create through the actual client card.
await page.evaluate(()=>window.DiagnostikaClientCard.openNew());
const card=page.locator('#clientCardDialog');
await card.waitFor({state:'visible',timeout:5000});
await card.locator('#ccName').fill('Created Through Card');
await card.locator('#ccPhone').fill('+79990001122');
await card.locator('#ccCity').fill('Москва');
await card.locator('#ccInitialProblem').fill('Первичный запрос');
await card.locator('#ccSaveBtn').click();
await card.waitFor({state:'hidden',timeout:5000});

const afterCreate=await page.evaluate(()=>({
  count:window.DiagnostikaClients.list().length,
  currentId:window.DiagnostikaClients.currentId(),
  current:{...window.DiagnostikaClients.current()},
  events:window.__clientWriteEvents.map(x=>({type:x.type,detail:{...x.detail}}))
}));
assert.equal(afterCreate.count,2);
assert.equal(afterCreate.current.name,'Created Through Card');
assert.equal(afterCreate.current.phone,'+79990001122');
assert.equal(afterCreate.current.city,'Москва');
assert.equal(afterCreate.current.initialProblem,'Первичный запрос');
const cardClientId=afterCreate.currentId;
const cardCreated=afterCreate.events.filter(x=>x.type==='client:created'&&x.detail.clientId===cardClientId);
const cardSelected=afterCreate.events.filter(x=>x.type==='client:selected'&&x.detail.clientId===cardClientId);
assert.equal(cardCreated.length,1,'Card create must emit client:created exactly once');
assert.equal(cardSelected.length,1,'Card create must emit client:selected exactly once');
assert.equal(cardCreated[0].detail.source,'client-card-create');

// 2. Update the same client through the actual card.
await page.evaluate(()=>window.DiagnostikaClientCard.openExisting());
await card.waitFor({state:'visible',timeout:5000});
await card.locator('#ccCity').fill('Санкт-Петербург');
await card.locator('#ccDesiredOutcome').fill('Желаемый результат 2B1');
await card.locator('#ccSaveBtn').click();
await card.waitFor({state:'hidden',timeout:5000});

const afterUpdate=await page.evaluate(id=>({
  client:{...window.DiagnostikaClients.findById(id)},
  events:window.__clientWriteEvents.map(x=>({type:x.type,detail:{...x.detail}}))
}),cardClientId);
assert.equal(afterUpdate.client.city,'Санкт-Петербург');
assert.equal(afterUpdate.client.desiredOutcome,'Желаемый результат 2B1');
const updates=afterUpdate.events.filter(x=>x.type==='client:updated'&&x.detail.clientId===cardClientId);
assert.equal(updates.length,1,'Card update must emit client:updated exactly once');
assert.equal(updates[0].detail.source,'client-card');
assert(updates[0].detail.fields.includes('city'));
assert(updates[0].detail.fields.includes('desiredOutcome'));

// 3. Legacy database "+ Новый клиент" button must also go through the service.
const opened=await page.evaluate(()=>window.DiagnostikaClients.openDatabase());
assert.equal(opened,true);
const database=page.locator('#clientDialog');
await database.waitFor({state:'visible',timeout:5000});
await database.locator('#dialogAddClientBtn').click();
await database.waitFor({state:'hidden',timeout:5000});
await page.waitForTimeout(80);

const afterLegacyCreate=await page.evaluate(()=>({
  count:window.DiagnostikaClients.list().length,
  currentId:window.DiagnostikaClients.currentId(),
  currentName:window.DiagnostikaClients.current()?.name||null,
  events:window.__clientWriteEvents.map(x=>({type:x.type,detail:{...x.detail}})),
  persisted:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}')
}));
assert.equal(afterLegacyCreate.count,3);
assert.equal(afterLegacyCreate.currentName,'Новый клиент');
assert.equal(afterLegacyCreate.persisted.clients.length,3);
const legacyCreated=afterLegacyCreate.events.filter(x=>x.type==='client:created'&&x.detail.clientId===afterLegacyCreate.currentId);
assert.equal(legacyCreated.length,1,'Legacy database create must emit client:created exactly once');
assert.equal(legacyCreated[0].detail.source,'client-database-create');

// All writes must persist across a real reload.
await page.reload({waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaClients?.version==='2B1'&&window.DiagnostikaPlatform?.services?.clients,null,{timeout:10000});
const afterReload=await page.evaluate(id=>({
  count:window.DiagnostikaClients.list().length,
  edited:{...window.DiagnostikaClients.findById(id)}
}),cardClientId);
assert.equal(afterReload.count,3);
assert.equal(afterReload.edited.city,'Санкт-Петербург');
assert.equal(afterReload.edited.desiredOutcome,'Желаемый результат 2B1');
assert.equal(afterReload.edited.phone,'+79990001122');

const serious=pageErrors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');
console.log('CLIENT_WRITE_2B1_AUDIT_SUCCESS',JSON.stringify({cardClientId,afterReload}));

await context.close();
await browser.close();