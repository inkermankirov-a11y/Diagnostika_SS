import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

async function ready(){
  await page.locator('.home-dashboard').waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(()=>window.DiagnostikaRequests?.moduleAware===true
    && window.DiagnostikaRequestsUI?.version==='3C'
    && !!window.DiagnostikaClients?.current?.(),null,{timeout:10000});
}

await page.goto('http://127.0.0.1:8000/index.html?requests-3d='+Date.now(),{waitUntil:'commit',timeout:10000});
await ready();

const handlers=await page.evaluate(()=>({
  select:String(document.querySelector('#requestSelect')?.onchange||''),
  add:String(document.querySelector('#addRequestBtn')?.onclick||''),
  del:String(document.querySelector('#deleteRequestBtn')?.onclick||''),
  title:String(document.querySelector('#requestTitle')?.oninput||'')
}));
assert.match(handlers.select,/\.view\(/,'requestSelect is still owned by legacy app.js');
assert.ok(handlers.add.includes("requestsApi()?.create")&&handlers.add.includes("request-ui-create"),'addRequestBtn is still owned by legacy app.js');
assert.match(handlers.del,/\.remove\(/,'deleteRequestBtn is still owned by legacy app.js');
assert.match(handlers.title,/\.update\(/,'requestTitle is still owned by legacy app.js');

const setup=await page.evaluate(()=>{
  const api=window.DiagnostikaRequests;
  const c=window.DiagnostikaClients.current();
  for(const r of api.list(c).slice())api.remove(r.id,{client:c,source:'requests-3d-clean',render:false});

  const r1=api.create({
    id:'requests-3d-r1',
    title:'3D active request',
    situations:[{id:'requests-3d-s1',name:'3D situation 1',level:5,comment:'',result:'',beliefs:[]}]
  },{client:c,source:'requests-3d-setup',render:false});

  const r2=api.create({
    id:'requests-3d-r2',
    title:'3D viewed request',
    situations:[{id:'requests-3d-s2',name:'3D situation 2',level:6,comment:'',result:'',beliefs:[]}]
  },{client:c,activate:false,view:false,source:'requests-3d-setup',render:false});

  api.activate(r1.id,{client:c,source:'requests-3d-active',render:false});
  requestId=null;
  situationId='stale-situation';
  selected={stale:true};
  mode='diagnosis';
  renderClient();
  renderMode();
  api.refresh();

  return {clientId:c.id,r1:r1.id,r2:r2.id};
});
await page.waitForTimeout(150);

let state=await page.evaluate(()=>({
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  selectedIsNull:selected===null
}));
assert.equal(state.active,setup.r1);
assert.equal(state.viewed,setup.r1,'renderClient compatibility sync did not restore active request view');
assert.equal(state.selectedIsNull,true,'renderClient compatibility sync did not clear stale selection');

assert.equal(await page.evaluate(id=>window.DiagnostikaRequests.view(id,{source:'requests-3d-history-view'}),setup.r2),true);
await page.waitForTimeout(80);
await page.evaluate(()=>renderClient());
await page.waitForTimeout(120);
state=await page.evaluate(()=>({
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId()
}));
assert.equal(state.active,setup.r1,'renderClient changed active request');
assert.equal(state.viewed,setup.r2,'renderClient forced historical view back to active request');

const clientSwitch=await page.evaluate(()=>{
  const clients=window.DiagnostikaClients;
  const requests=window.DiagnostikaRequests;
  const first=clients.current();
  const second=clients.create({name:'REQUESTS 3D CLIENT 2'},{select:true,source:'requests-3d-client',render:false});
  if(!second)throw new Error('Could not create second client');
  renderClient();
  const secondRequest=requests.create({
    id:'requests-3d-client2-r1',
    title:'Client 2 active request',
    situations:[]
  },{client:second,source:'requests-3d-client-request',render:false});
  renderClient();
  const secondState={client:clients.currentId(),active:requests.activeId(),viewed:requests.viewedId()};
  clients.select(first.id,{source:'requests-3d-switch-back'});
  return {
    firstId:first.id,
    secondId:second.id,
    secondRequestId:secondRequest.id,
    secondState
  };
});
await page.waitForTimeout(120);
assert.equal(String(clientSwitch.secondState.client),String(clientSwitch.secondId));
assert.equal(String(clientSwitch.secondState.active),String(clientSwitch.secondRequestId));
assert.equal(String(clientSwitch.secondState.viewed),String(clientSwitch.secondRequestId));

state=await page.evaluate(()=>({
  client:window.DiagnostikaClients.currentId(),
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId()
}));
assert.equal(String(state.client),String(clientSwitch.firstId));
assert.equal(String(state.active),String(setup.r1));
assert.equal(String(state.viewed),String(setup.r1),'client switch did not sync view to active request through RequestService');

const beforeTest=await page.evaluate(()=>({
  ids:window.DiagnostikaRequests.list().map(r=>r.id),
  clientId:window.DiagnostikaClients.currentId()
}));

await page.evaluate(()=>{
  window.__requests3dEvents=[];
  for(const type of ['request:created','request:selected','request:activated','request:deleted']){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__requests3dEvents.push({type,detail:{...detail}}));
  }
});
assert.equal(await page.evaluate(()=>{
  const button=document.querySelector('#testFillBtn');
  if(!button)return false;
  button.click();
  return true;
}),true,'TEST button is missing');
await page.waitForTimeout(250);

const testData=await page.evaluate(()=>({
  clientId:window.DiagnostikaClients.currentId(),
  list:window.DiagnostikaRequests.list().map(r=>({id:r.id,title:r.title,situations:r.situations?.length||0})),
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  last:window.DiagnostikaClients.current().lastDiagnosisRequestId,
  sessions:(window.DiagnostikaClients.current().sessions||[]).map(s=>s.requestId),
  situationId,
  selectedIsNull:selected===null,
  mode,
  events:window.__requests3dEvents
}));
assert.equal(String(testData.clientId),String(beforeTest.clientId));
assert.ok(testData.list.length>=1&&testData.list.length<=2,'TEST button created unexpected request count');
assert.ok(testData.list.every(r=>r.situations>=2&&r.situations<=3),'TEST button lost generated situations');
assert.equal(String(testData.active),String(testData.viewed));
assert.equal(String(testData.active),String(testData.last));
assert.ok(testData.sessions.length===2&&testData.sessions.every(id=>String(id)===String(testData.active)),'TEST sessions are not linked to active request');
assert.equal(testData.selectedIsNull,true);
assert.equal(testData.mode,'diagnosis');
assert.ok(testData.list.find(r=>String(r.id)===String(testData.active)),'TEST active request is missing from RequestService list');
assert.equal(testData.events.filter(x=>x.type==='request:created'&&x.detail.source==='test-data-create').length,testData.list.length);
assert.equal(testData.events.filter(x=>x.type==='request:activated'&&x.detail.source==='test-data-activate').length,1);
assert.equal(testData.events.filter(x=>x.type==='request:deleted'&&x.detail.source==='test-data-reset').length,beforeTest.ids.length);

const persisted={
  clientId:testData.clientId,
  active:testData.active,
  ids:testData.list.map(r=>r.id),
  titles:testData.list.map(r=>r.title)
};

await page.reload({waitUntil:'commit'});
await ready();
await page.waitForTimeout(180);
const restored=await page.evaluate(()=>({
  clientId:window.DiagnostikaClients.currentId(),
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  ids:window.DiagnostikaRequests.list().map(r=>r.id),
  titles:window.DiagnostikaRequests.list().map(r=>r.title)
}));
assert.equal(String(restored.clientId),String(persisted.clientId));
assert.equal(String(restored.active),String(persisted.active));
assert.equal(String(restored.viewed),String(persisted.active));
assert.deepEqual(restored.ids,persisted.ids);
assert.deepEqual(restored.titles,persisted.titles);

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('REQUESTS_3D_ACCEPTANCE_SUCCESS',JSON.stringify({
  handlersServiceOwned:true,
  historicalViewSurvivesRender:true,
  clientSwitchSync:true,
  testDataServiceOwned:true,
  reload:true
}));

await browser.close();
