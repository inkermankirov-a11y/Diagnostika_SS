import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const questionnaireSource=fs.readFileSync('client-questionnaires.js','utf8');
const consultationSource=fs.readFileSync('free-consultation-client-card-sync.js','utf8');

for(const token of [
  'if(p.name)c.name=p.name',
  'if(p.phone)c.phone=p.phone',
  "if(typeof renderClient==='function')renderClient();"
]){
  assert.equal(questionnaireSource.includes(token),false,'questionnaire direct profile mutation remains: '+token);
}
assert.match(questionnaireSource,/api\.update\(c\.id,patch,\{source:'questionnaire-primary-profile'\}\)/);

for(const token of ['c.mainRequest=next.mainRequest','c[key]=cleaned.value','c[key]=next']){
  assert.equal(consultationSource.includes(token),false,'free consultation direct profile mutation remains: '+token);
}
assert.match(consultationSource,/api\.update\(c\.id,profilePatch,\{source:'free-consultation-card-sync',render:false\}\)/);

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const legacyStart='=== БЕСПЛАТНАЯ КОНСУЛЬТАЦИЯ / ИИ ===';
const legacyEnd='=== КОНЕЦ АВТО-БЛОКА ===';
const fixture={version:4,clients:[{
  id:'profile-boundary-a',
  name:'Исходное имя',
  phone:'+70000000000',
  email:'old@example.com',
  city:'Киров',
  age:'30',
  country:'',
  gender:'',
  preferredContact:'',
  sessions:[],
  requests:[],
  initialProblem:'',
  mainRequest:'Ручной запрос специалиста',
  tried:'',
  desiredOutcome:'',
  clientNotes:`До блока\n\n${legacyStart}\nСТАРЫЙ АВТОТЕКСТ\n${legacyEnd}\n\nПосле блока`,
  questionnaires:[{
    id:'questionnaire-2c2',
    externalId:'',
    source:'manual',
    receivedAt:'2026-09-18T10:00:00.000Z',
    profile:{
      name:'Анна Тестовая',
      phone:'+79990001122',
      email:'anna@example.com',
      city:'Казань',
      age:'32',
      country:'Россия',
      gender:'Женский',
      contactMethod:'telegram'
    },
    answerItems:[],
    answers:{},
    raw:null,
    isPrimary:false,
    editedAt:null
  }],
  freeConsultation:{
    context:'Контекст клиента',
    attempts:'Дыхательные практики помогали частично'
  }
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','profile-boundary-a');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')pageErrors.push(m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

await page.goto(base,{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaClients?.moduleAware&&window.DiagnostikaPlatform?.events&&window.DiagnostikaFreeConsultationSync,null,{timeout:15000});
await page.waitForFunction(()=>window.DiagnostikaQuestionnaires,null,{timeout:10000});

await page.evaluate(()=>{
  window.__client2c2Events=[];
  window.DiagnostikaPlatform.events.on('client:updated',detail=>window.__client2c2Events.push({...detail}));
  window.DiagnostikaQuestionnaires.open();
});
await page.waitForSelector('#clientQuestionnairesDialog[open] .cq-primary-btn',{timeout:5000});
await page.click('#clientQuestionnairesDialog .cq-primary-btn');
await page.waitForFunction(()=>window.DiagnostikaClients.current()?.name==='Анна Тестовая',null,{timeout:5000});

const questionnaireState=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  return {
    name:c.name,
    phone:c.phone,
    email:c.email,
    city:c.city,
    age:c.age,
    country:c.country,
    gender:c.gender,
    preferredContact:c.preferredContact,
    primary:c.questionnaires?.find(q=>q.id==='questionnaire-2c2')?.isPrimary===true,
    events:window.__client2c2Events.filter(x=>x.source==='questionnaire-primary-profile')
  };
});

assert.deepEqual({
  name:questionnaireState.name,
  phone:questionnaireState.phone,
  email:questionnaireState.email,
  city:questionnaireState.city,
  age:questionnaireState.age,
  country:questionnaireState.country,
  gender:questionnaireState.gender,
  preferredContact:questionnaireState.preferredContact,
  primary:questionnaireState.primary
},{
  name:'Анна Тестовая',
  phone:'+79990001122',
  email:'anna@example.com',
  city:'Казань',
  age:'32',
  country:'Россия',
  gender:'Женский',
  preferredContact:'telegram',
  primary:true
});
assert.equal(questionnaireState.events.length,1,'primary questionnaire must emit one client:updated');
assert.deepEqual([...questionnaireState.events[0].fields].sort(),['age','city','country','email','gender','name','phone','preferredContact'].sort());

await page.evaluate(()=>{window.__client2c2Events=[];});
const syncResult=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  return window.DiagnostikaFreeConsultationSync.syncClient(c,{
    mainRequest:'Развёрнутый запрос из AI',
    selectedShortRequest:{title:'Короткий AI запрос'},
    desiredResult:'Желаемый результат AI'
  });
});
assert.equal(syncResult,true);

const consultationState=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  return {
    initialProblem:c.initialProblem,
    mainRequest:c.mainRequest,
    tried:c.tried,
    desiredOutcome:c.desiredOutcome,
    clientNotes:c.clientNotes,
    syncValues:{...(c.freeConsultation?.cardSync?.values||{})},
    events:window.__client2c2Events.filter(x=>x.source==='free-consultation-card-sync')
  };
});

assert.equal(consultationState.initialProblem,'Развёрнутый запрос из AI');
assert.equal(consultationState.mainRequest,'Ручной запрос специалиста','AI must not overwrite arbitrary manual mainRequest');
assert.equal(consultationState.tried,'Дыхательные практики помогали частично');
assert.equal(consultationState.desiredOutcome,'Желаемый результат AI');
assert.equal(consultationState.clientNotes,'До блока\n\nПосле блока');
assert.equal(consultationState.syncValues.mainRequest,'Короткий AI запрос');
assert.equal(consultationState.events.length,1,'free consultation profile sync must emit one client:updated');
assert.deepEqual([...consultationState.events[0].fields].sort(),['clientNotes','desiredOutcome','initialProblem','tried'].sort());

await page.reload({waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaClients?.current?.()?.id==='profile-boundary-a',null,{timeout:10000});

const reloaded=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  return {
    name:c.name,
    phone:c.phone,
    mainRequest:c.mainRequest,
    initialProblem:c.initialProblem,
    tried:c.tried,
    desiredOutcome:c.desiredOutcome,
    clientNotes:c.clientNotes,
    primary:c.questionnaires?.find(q=>q.id==='questionnaire-2c2')?.isPrimary===true,
    cardSyncMain:c.freeConsultation?.cardSync?.values?.mainRequest||''
  };
});

assert.deepEqual(reloaded,{
  name:'Анна Тестовая',
  phone:'+79990001122',
  mainRequest:'Ручной запрос специалиста',
  initialProblem:'Развёрнутый запрос из AI',
  tried:'Дыхательные практики помогали частично',
  desiredOutcome:'Желаемый результат AI',
  clientNotes:'До блока\n\nПосле блока',
  primary:true,
  cardSyncMain:'Короткий AI запрос'
});

const serious=pageErrors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('CLIENT_PROFILE_BOUNDARY_2C2_SUCCESS',JSON.stringify({questionnaireState,consultationState,reloaded}));
await context.close();
await browser.close();
