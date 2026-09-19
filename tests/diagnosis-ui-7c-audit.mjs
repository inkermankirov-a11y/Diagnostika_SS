import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource=fs.readFileSync('app.js','utf8');
const apiSource=fs.readFileSync('diagnosis-api.js','utf8');
const serviceSource=fs.readFileSync('modules/diagnosis/diagnosis-service.js','utf8');
const focusSource=fs.readFileSync('diagnosis-add-focus.js','utf8');
const feelingsSource=fs.readFileSync('secondary-feeling-hints.js','utf8');
const collapseSource=fs.readFileSync('feeling-collapse.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(/version:'7[CD]'/.test(apiSource),'Diagnosis facade version is outside supported 7C-7D range');
assert(apiSource.includes('replaceFeelings'),'Diagnosis facade missing replaceFeelings');
assert(serviceSource.includes('function replaceFeelings'),'DiagnosisService missing replaceFeelings');

for(const token of [
  "diagnosis-ui-belief-add'",
  "diagnosis-ui-feeling-add'",
  "diagnosis-ui-deep-add'",
  "diagnosis-ui-element-save'",
  "diagnosis-ui-element-delete'",
  "diagnosis-ui-instinct-save'",
  "diagnosis-ui-instinct-add'"
])assert(appSource.includes(token)||focusSource.includes(token)||collapseSource.includes(token),'Diagnosis 7C UI source missing '+token);
assert(feelingsSource.includes("diagnosis-ui-feelings-replace'"),'Feeling builder is not service-owned');

for(const forbidden of [
  '(s.beliefs||(s.beliefs=[])).push',
  '(selected.obj.feelings||(selected.obj.feelings=[])).push',
  '(selected.obj.deep||(selected.obj.deep=[])).push',
  'arr.splice(selected.index,1)',
  "o.name=$('#editorText').value",
  "o.text=$('#editorText').value",
  'selected.obj.instincts.push(newInstinct())',
  'if(!arr.length)arr.push(newInstinct())'
])assert.equal(appSource.includes(forbidden),false,'app.js still mutates nested diagnosis state directly: '+forbidden);

for(const forbidden of ['s.beliefs||(s.beliefs=[])','parent.feelings||(parent.feelings=[])','parent.deep||(parent.deep=[])',"typeof save==='function') save()"]){
  assert.equal(focusSource.includes(forbidden),false,'diagnosis-add-focus still owns nested state: '+forbidden);
}
assert.equal(feelingsSource.includes('editingBelief.feelings='),false,'Feeling builder replaces live feelings directly');
assert.equal(feelingsSource.includes("typeof save==='function')save()"),false,'Feeling builder persists directly');
assert.equal(collapseSource.includes('const arr=feeling.deep||(feeling.deep=[])'),false,'Context deep add mutates live state');
assert.equal(collapseSource.includes("typeof save==='function') save()"),false,'Context deep add persists directly');
assert.equal(appSource.includes('arr.push(newInstinct())'),false,'renderEditor still creates instincts during read');

for(const token of [
  'app.js?v=20260919-diagnosis7c',
  'diagnosis-add-focus.js?v=20260919-diagnosis7c',
  'secondary-feeling-hints.js?v=20260919-diagnosis7c',
  'feeling-collapse.js?v=20260919-diagnosis7c',
  'diagnosis-api.js?v=20260919-diagnosis7d'
])assert(indexSource.includes(token),'Diagnosis 7C cache marker missing '+token);

const fixture={version:4,clients:[{
  id:'diag-7c-client',
  name:'Diagnosis 7C Client',
  currentRequestId:'diag-7c-r1',
  lastDiagnosisRequestId:'diag-7c-r1',
  requests:[{
    id:'diag-7c-r1',
    title:'Nested diagnosis UI',
    status:'active',
    situations:[{id:'diag-7c-s1',name:'Nested situation',level:5,comment:'',result:'',beliefs:[]}]
  }],
  sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','diag-7c-client');
  if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>/^7[CD]$/.test(window.DiagnostikaDiagnosis?.version||'')
    && window.DiagnostikaDiagnosis?.moduleAware===true
    && window.DiagnostikaPlatform?.services?.diagnosis,
    null,{timeout:15000});
}

await page.goto('http://127.0.0.1:8000/index.html?diagnosis-7c=1',{waitUntil:'commit',timeout:10000});
await ready();

const authority=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  if(!window.DiagnostikaDiagnosis.open())throw new Error('Cannot open diagnosis');
  situationId='diag-7c-s1';
  selected=null;
  renderSituationList();
  window.__diag7cEvents=[];
  for(const type of ['diagnosis:element-created','diagnosis:element-updated','diagnosis:element-deleted','diagnosis:updated']){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__diag7cEvents.push({type,detail:{...detail}}));
  }
  return {
    current:c.currentRequestId,last:c.lastDiagnosisRequestId,
    viewed:window.DiagnostikaRequests.viewedId(c),active:window.DiagnostikaRequests.activeId(c)
  };
});

await page.locator('#addBeliefBtn').click();
let nested=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  const s=window.DiagnostikaRequests.get('diag-7c-r1',c).situations[0];
  return {beliefs:s.beliefs.length,selectedType:selected?.type,selectedId:selected?.obj?.id||null};
});
assert.equal(nested.beliefs,1);
assert.equal(nested.selectedType,'belief');
const beliefId=nested.selectedId;
assert(beliefId);

await page.locator('#editorText').fill('Belief through DiagnosisService');
await page.locator('#editorLevel').fill('8');
await page.locator('#editorComment').fill('belief comment');
await page.locator('#saveElementBtn').click();

const savedBelief=await page.evaluate(id=>{
  const c=window.DiagnostikaClients.current();
  const b=window.DiagnostikaDiagnosis.findElement('belief',id,'diag-7c-r1',c.id);
  return {b,selectedId:selected?.obj?.id||null,selectedType:selected?.type||null};
},beliefId);
assert.equal(savedBelief.b.text,'Belief through DiagnosisService');
assert.equal(savedBelief.b.level,8);
assert.equal(savedBelief.selectedId,beliefId);
assert.equal(savedBelief.selectedType,'belief');

await page.locator('#addFeelingBtn').click();
await page.locator('.feeling-builder-dialog').waitFor({state:'visible',timeout:3000});
const firstRow=page.locator('.feeling-select-row').first();
await firstRow.locator('.feeling-check').check();
await firstRow.locator('.feeling-level').fill('7');
await firstRow.locator('.feeling-answer').fill('secondary answer');
await page.locator('.feeling-builder-save').click();
await page.locator('.feeling-builder-dialog').waitFor({state:'hidden',timeout:3000});

const feelingState=await page.evaluate(id=>{
  const c=window.DiagnostikaClients.current();
  const b=window.DiagnostikaDiagnosis.findElement('belief',id,'diag-7c-r1',c.id);
  return {count:b.feelings.length,feeling:JSON.parse(JSON.stringify(b.feelings[0]))};
},beliefId);
assert.equal(feelingState.count,1);
assert(feelingState.feeling.id);
assert.equal(feelingState.feeling.level,7);
assert(feelingState.feeling.text.includes('Обида'));
const feelingId=feelingState.feeling.id;

await page.evaluate(id=>{
  selectDiagnosisElementById('feeling',id);
  renderTree();
},feelingId);
await page.locator('.context-add-deep-btn').waitFor({state:'visible',timeout:3000});
await page.locator('.context-add-deep-btn').click();

const deepState=await page.evaluate(id=>{
  const c=window.DiagnostikaClients.current();
  const f=window.DiagnostikaDiagnosis.findElement('feeling',id,'diag-7c-r1',c.id);
  return {count:f.deep.length,deep:JSON.parse(JSON.stringify(f.deep[0])),selectedType:selected?.type,selectedId:selected?.obj?.id||null};
},feelingId);
assert.equal(deepState.count,1);
assert.equal(deepState.selectedType,'deep');
assert.equal(deepState.selectedId,deepState.deep.id);
const deepId=deepState.deep.id;

await page.locator('#editorText').fill('Deep belief through service');
await page.locator('#editorLevel').fill('6');
await page.locator('#editorComment').fill('deep comment');
await page.locator('#saveElementBtn').click();

await page.locator('#instinctCombo').selectOption({index:1});
await page.locator('#instinctLevel').fill('9');
await page.locator('#instinctComment').fill('instinct comment');
await page.locator('#saveInstinctBtn').click();

const afterInstinctSave=await page.evaluate(id=>{
  const c=window.DiagnostikaClients.current();
  return window.DiagnostikaDiagnosis.findElement('deep',id,'diag-7c-r1',c.id);
},deepId);
assert.equal(afterInstinctSave.text,'Deep belief through service');
assert(afterInstinctSave.instincts.length>=1);
assert.equal(afterInstinctSave.instincts[0].level,9);
assert.equal(afterInstinctSave.instincts[0].comment,'instinct comment');

const firstInstinctId=afterInstinctSave.instincts[0].id;
await page.locator('#addInstinctBtn').click();
const afterInstinctAdd=await page.evaluate(id=>{
  const c=window.DiagnostikaClients.current();
  return window.DiagnostikaDiagnosis.findElement('deep',id,'diag-7c-r1',c.id);
},deepId);
assert.equal(afterInstinctAdd.instincts.length,2);
const secondInstinctId=afterInstinctAdd.instincts[1].id;

await page.evaluate(id=>{
  selectDiagnosisElementById('instinct',id);
  renderTree();
},secondInstinctId);
await page.locator('#deleteElementBtn').click();

const afterDelete=await page.evaluate(id=>{
  const c=window.DiagnostikaClients.current();
  return window.DiagnostikaDiagnosis.findElement('deep',id,'diag-7c-r1',c.id);
},deepId);
assert.equal(afterDelete.instincts.length,1);
assert.equal(afterDelete.instincts[0].id,firstInstinctId);

const readOnlyRender=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  const api=window.DiagnostikaDiagnosis;
  const empty=api.addDeep(
    window.DiagnostikaDiagnosis.findElement('feeling',window.DiagnostikaDiagnosis.findElement('belief',
      window.DiagnostikaDiagnosis.snapshot('diag-7c-r1',c.id).situations[0].beliefs[0].id,
      'diag-7c-r1',c.id).feelings[0].id,'diag-7c-r1',c.id).id,
    {id:'diag-7c-empty-deep',text:'empty instinct deep',instincts:[]},
    {client:c,requestId:'diag-7c-r1',source:'diagnosis-7c-readonly-fixture',render:false}
  );
  selectDiagnosisElementById('deep',empty.id);
  renderTree();
  const after=api.findElement('deep',empty.id,'diag-7c-r1',c.id);
  return {count:after.instincts.length};
});
assert.equal(readOnlyRender.count,0,'renderEditor created an instinct during read');

const persisted=await page.evaluate(()=>{
  const stored=JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}');
  const c=stored.clients.find(x=>x.id==='diag-7c-client');
  const r=c.requests.find(x=>x.id==='diag-7c-r1');
  return {
    current:c.currentRequestId,last:c.lastDiagnosisRequestId,
    tree:r.situations[0],
    events:window.__diag7cEvents
  };
});
assert.equal(persisted.tree.beliefs[0].text,'Belief through DiagnosisService');
assert.equal(persisted.tree.beliefs[0].feelings.length,1);
assert.equal(persisted.tree.beliefs[0].feelings[0].deep[0].text,'Deep belief through service');
assert.equal(persisted.tree.beliefs[0].feelings[0].deep[0].instincts.length,1);

for(const source of [
  'diagnosis-ui-belief-add','diagnosis-ui-element-save','diagnosis-ui-feelings-replace',
  'diagnosis-ui-deep-add','diagnosis-ui-instinct-save','diagnosis-ui-instinct-add','diagnosis-ui-element-delete'
]){
  assert(persisted.events.some(x=>x.detail?.source===source),'Missing Diagnosis 7C event source '+source);
}

const afterAuthority=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  return {
    current:c.currentRequestId,last:c.lastDiagnosisRequestId,
    viewed:window.DiagnostikaRequests.viewedId(c),active:window.DiagnostikaRequests.activeId(c)
  };
});
assert.deepEqual(afterAuthority,authority,'Nested diagnosis UI changed request authority');

await page.reload({waitUntil:'commit',timeout:10000});
await ready();
const restored=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  const snap=window.DiagnostikaDiagnosis.snapshot('diag-7c-r1',c.id);
  return {
    current:c.currentRequestId,last:c.lastDiagnosisRequestId,
    active:window.DiagnostikaRequests.activeId(c),
    tree:snap.situations[0]
  };
});
assert.equal(restored.tree.beliefs[0].text,'Belief through DiagnosisService');
assert.equal(restored.tree.beliefs[0].feelings[0].deep[0].text,'Deep belief through service');
assert.equal(restored.tree.beliefs[0].feelings[0].deep[0].instincts.length,1);
assert.deepEqual(
  {current:restored.current,last:restored.last,active:restored.active},
  {current:'diag-7c-r1',last:'diag-7c-r1',active:'diag-7c-r1'}
);

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('DIAGNOSIS_UI_7C_SUCCESS',JSON.stringify({
  beliefId,feelingId,deepId,
  instincts:restored.tree.beliefs[0].feelings[0].deep[0].instincts.length,
  requestAuthority:afterAuthority
}));

await context.close();
await browser.close();
