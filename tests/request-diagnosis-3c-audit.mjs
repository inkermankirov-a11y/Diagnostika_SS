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
    && typeof window.DiagnostikaDiagnosis?.open==='function'
    && typeof window.DiagnostikaFreeConsultationV2?.createDiagnosis==='function',null,{timeout:10000});
}

await page.goto('http://127.0.0.1:8000/index.html?requests-3c='+Date.now(),{waitUntil:'commit',timeout:10000});
await ready();

const setup=await page.evaluate(()=>{
  const api=window.DiagnostikaRequests;
  const c=window.DiagnostikaClients.current();
  if(!api||!c)throw new Error('Requests 3C fixture unavailable');

  for(const r of api.list(c).slice()){
    api.remove(r.id,{client:c,source:'requests-3c-fixture-clean',render:false});
  }

  const r1=api.create({
    id:'requests-3c-r1',
    title:'Активный запрос 3C',
    situations:[{id:'requests-3c-s1',name:'Ситуация активного запроса',level:5,comment:'',result:'',beliefs:[]}]
  },{client:c,source:'requests-3c-fixture',render:false});
  const r2=api.create({
    id:'requests-3c-r2',
    title:'Исторический запрос 3C',
    situations:[{id:'requests-3c-s2',name:'Ситуация исторического запроса',level:6,comment:'',result:'',beliefs:[]}]
  },{client:c,source:'requests-3c-fixture',render:false});

  api.activate(r1.id,{client:c,source:'requests-3c-fixture-active',render:false});
  api.view(r1.id,{client:c,source:'requests-3c-fixture-view',render:false});

  mode='card';
  situationId=null;
  selected=null;
  save();
  renderClient();
  renderMode();
  api.refresh();

  window.__requests3cEvents=[];
  for(const type of ['request:created','request:selected','request:activated','request:deleted']){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__requests3cEvents.push({type,detail:{...detail}}));
  }

  return {
    clientId:c.id,
    r1:r1.id,
    r2:r2.id,
    baseline:JSON.stringify(api.list(c))
  };
});

assert.equal(await page.evaluate(()=>window.DiagnostikaDiagnosis.open()),true);
await page.locator('.diagnosis-compact-back').waitFor({state:'visible',timeout:5000});
let state=await page.evaluate(()=>({
  mode,
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  last:window.DiagnostikaClients.current().lastDiagnosisRequestId
}));
assert.deepEqual(state,{mode:'diagnosis',active:setup.r1,viewed:setup.r1,last:setup.r1});

assert.equal(await page.evaluate(()=>window.DiagnostikaDiagnosis.open()),true);
await page.locator('#diagnosisLaunchDialog').waitFor({state:'visible',timeout:3000});
await page.locator('#diagPreviousBtn').click();
await page.locator('#requestHistoryDialog').waitFor({state:'visible',timeout:3000});
await page.evaluate(id=>{
  const row=[...document.querySelectorAll('#requestHistoryBody .request-history-row')]
    .find(x=>String(x.dataset.requestId)===String(id));
  if(!row)throw new Error('Historical request row missing');
  row.click();
},setup.r2);
await page.locator('#requestOpenBtn').click();
await page.waitForTimeout(120);

state=await page.evaluate(()=>({
  mode,
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  last:window.DiagnostikaClients.current().lastDiagnosisRequestId,
  payload:JSON.stringify(window.DiagnostikaRequests.list())
}));
assert.equal(state.mode,'diagnosis');
assert.equal(state.active,setup.r1,'Historical view activated a request');
assert.equal(state.viewed,setup.r2,'Historical view did not open selected request');
assert.equal(state.last,setup.r1,'Historical view rewrote lastDiagnosisRequestId');
assert.equal(state.payload,setup.baseline,'Historical navigation mutated request payload');

await page.locator('.diagnosis-compact-back').click();
await page.locator('.home-dashboard').waitFor({state:'visible',timeout:3000});
state=await page.evaluate(()=>({
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  last:window.DiagnostikaClients.current().lastDiagnosisRequestId
}));
assert.equal(state.active,setup.r1);
assert.equal(state.viewed,setup.r2);
assert.equal(state.last,setup.r1,'Back navigation rewrote authority');

assert.equal(await page.evaluate(()=>window.DiagnostikaDiagnosis.open()),true);
await page.locator('.diagnosis-compact-back').waitFor({state:'visible',timeout:3000});
state=await page.evaluate(()=>({
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  last:window.DiagnostikaClients.current().lastDiagnosisRequestId
}));
assert.deepEqual(state,{active:setup.r1,viewed:setup.r1,last:setup.r1},'Opening Diagnosis from card must return to active request');

assert.equal(await page.evaluate(()=>window.DiagnostikaDiagnosis.open()),true);
await page.locator('#diagnosisLaunchDialog').waitFor({state:'visible',timeout:3000});
await page.locator('#diagPreviousBtn').click();
await page.locator('#requestHistoryDialog').waitFor({state:'visible',timeout:3000});
await page.evaluate(id=>{
  const row=[...document.querySelectorAll('#requestHistoryBody .request-history-row')]
    .find(x=>String(x.dataset.requestId)===String(id));
  if(!row)throw new Error('Historical delete row missing');
  row.click();
},setup.r2);
await page.locator('#requestDeleteSelectedBtn').click();
await page.waitForTimeout(120);
assert.equal(await page.evaluate(id=>window.DiagnostikaRequests.get(id),setup.r2),null);
assert.equal(await page.evaluate(()=>window.DiagnostikaRequests.activeId()),setup.r1);

await page.evaluate(()=>document.querySelector('#requestHistoryDialog')?.close());
assert.equal(await page.evaluate(()=>window.DiagnostikaDiagnosis.open()),true);
await page.locator('#diagnosisLaunchDialog').waitFor({state:'visible',timeout:3000});
const countBeforeNew=await page.evaluate(()=>window.DiagnostikaRequests.list().length);
await page.locator('#diagNewBtn').click();
await page.waitForTimeout(120);
const created=await page.evaluate(()=>({
  count:window.DiagnostikaRequests.list().length,
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  title:window.DiagnostikaRequests.active()?.title||'',
  last:window.DiagnostikaClients.current().lastDiagnosisRequestId
}));
assert.equal(created.count,countBeforeNew+1);
assert.equal(created.active,created.viewed);
assert.equal(created.active,created.last);
assert.equal(created.title,'Новый запрос');

assert.equal(await page.evaluate(()=>window.DiagnostikaDiagnosis.open()),true);
await page.locator('#diagnosisLaunchDialog').waitFor({state:'visible',timeout:3000});
await page.locator('#diagDeleteBtn').click();
await page.locator('#requestHistoryDialog').waitFor({state:'visible',timeout:3000});
await page.evaluate(id=>{
  const row=[...document.querySelectorAll('#requestHistoryBody .request-history-row')]
    .find(x=>String(x.dataset.requestId)===String(id));
  if(!row)throw new Error('Active request delete row missing');
  row.click();
},created.active);
await page.locator('#requestDeleteSelectedBtn').click();
await page.waitForTimeout(120);
assert.equal(await page.evaluate(id=>window.DiagnostikaRequests.get(id),created.active),null);
assert.equal(await page.evaluate(()=>window.DiagnostikaRequests.activeId()),setup.r1);

await page.evaluate(()=>document.querySelector('#requestHistoryDialog')?.close());
if(await page.locator('#diagnosisLaunchDialog').isVisible())await page.evaluate(()=>document.querySelector('#diagnosisLaunchDialog')?.close());
await page.locator('.diagnosis-compact-back').click();
await page.locator('.home-dashboard').waitFor({state:'visible',timeout:3000});

await page.evaluate(()=>{
  window.DiagnostikaFreeConsultationV2.renderResult({
    mainRequest:'Развёрнутый запрос 3C',
    shortRequests:[{title:'Запрос из бесплатной консультации 3C',priority:100}],
    rationale:'Тест 3C',
    desiredResult:'Спокойствие',
    situations:['Ситуация FC 1','Ситуация FC 2'],
    clarifyingQuestions:[]
  });
});
await page.locator('#freeConsultationAiResultDialog').waitFor({state:'visible',timeout:3000});
const beforeFcCount=await page.evaluate(()=>window.DiagnostikaRequests.list().length);
await page.evaluate(()=>window.DiagnostikaFreeConsultationV2.createDiagnosis());
await page.waitForTimeout(250);

const fc=await page.evaluate(()=>({
  count:window.DiagnostikaRequests.list().length,
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  request:window.DiagnostikaRequests.active(),
  diagnosisRequestId:window.DiagnostikaClients.current().freeConsultation?.aiResult?.diagnosisRequestId||null,
  last:window.DiagnostikaClients.current().lastDiagnosisRequestId,
  mode
}));
assert.equal(fc.count,beforeFcCount+1);
assert.equal(fc.active,fc.viewed);
assert.equal(fc.active,fc.diagnosisRequestId);
assert.equal(fc.active,fc.last);
assert.equal(fc.request?.title,'Запрос из бесплатной консультации 3C');
assert.deepEqual((fc.request?.situations||[]).map(x=>x.name),['Ситуация FC 1','Ситуация FC 2']);
assert.equal(fc.mode,'diagnosis');

const events=await page.evaluate(()=>window.__requests3cEvents);
assert.equal(events.filter(x=>x.type==='request:created'&&x.detail.source==='free-consultation-v2-create').length,1);
assert.equal(events.filter(x=>x.type==='request:activated'&&x.detail.source==='free-consultation-v2-create').length,1);
assert.equal(events.filter(x=>x.type==='request:selected'&&x.detail.source==='diagnosis-history-view').length,1);
assert.equal(events.filter(x=>x.type==='request:activated'&&x.detail.source==='diagnosis-history-view').length,0);

const persistedId=fc.active;
await page.reload({waitUntil:'commit'});
await ready();
const reloaded=await page.evaluate(()=>({
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  request:window.DiagnostikaRequests.active(),
  diagnosisRequestId:window.DiagnostikaClients.current().freeConsultation?.aiResult?.diagnosisRequestId||null
}));
assert.equal(reloaded.active,persistedId);
assert.equal(reloaded.viewed,persistedId);
assert.equal(reloaded.diagnosisRequestId,persistedId);
assert.equal(reloaded.request?.title,'Запрос из бесплатной консультации 3C');
assert.deepEqual((reloaded.request?.situations||[]).map(x=>x.name),['Ситуация FC 1','Ситуация FC 2']);

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('REQUESTS_3C_SUCCESS',JSON.stringify({
  historicalViewPreservedAuthority:true,
  diagnosisCreateDelete:true,
  freeConsultationCreate:true,
  persistedId,
  eventCount:events.length
}));

await browser.close();
