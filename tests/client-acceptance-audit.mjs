import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const fixture={version:4,clients:[{
  id:'acceptance-guard',
  name:'Контрольный клиент',
  city:'Киров',
  phone:'+70000000000',
  sessions:[],
  requests:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1')) localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id')) localStorage.setItem('diagnostika-last-client-id','acceptance-guard');
  if(!localStorage.getItem('diagnostika-ui-language')) localStorage.setItem('diagnostika-ui-language','ru');
  localStorage.setItem('diagnostika-specialist-name','Acceptance Specialist');
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
    return p?.modules?.get?.('clients')?.status==='started'
      && window.DiagnostikaClients?.moduleAware
      && typeof window.DiagnostikaClientCard?.openNew==='function'
      && typeof window.DiagnostikaQuestionnaires?.open==='function'
      && typeof window.DiagnostikaFreeConsultationSync?.syncClient==='function'
      && !!document.querySelector('input[data-client-transfer-import="1"]');
  },null,{timeout:15000});
}

await page.goto(base,{waitUntil:'commit',timeout:10000});
await ready();

await page.evaluate(()=>{
  window.__clientAcceptanceEvents=[];
  for(const type of ['client:created','client:selected','client:updated','client:deleted','client:restored']){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__clientAcceptanceEvents.push({type,detail:{...detail}}));
  }
});

// 1. Создание клиента через реальную карточку.
await page.evaluate(()=>window.DiagnostikaClientCard.openNew());
const card=page.locator('#clientCardDialog');
await card.waitFor({state:'visible',timeout:5000});
await card.locator('#ccName').fill('Acceptance Client');
await card.locator('#ccPhone').fill('+79991112233');
await card.locator('#ccEmail').fill('acceptance@example.com');
await card.locator('#ccCity').fill('Москва');
await card.locator('#ccInitialProblem').fill('Исходный запрос acceptance');
await card.locator('#ccSaveBtn').click();
await card.waitFor({state:'hidden',timeout:5000});

const acceptanceId=await page.evaluate(()=>window.DiagnostikaClients.currentId());
assert(acceptanceId && acceptanceId!=='acceptance-guard','Card create did not select the created client');

// 2. Редактирование того же клиента через карточку.
await page.evaluate(()=>window.DiagnostikaClientCard.openExisting());
await card.waitFor({state:'visible',timeout:5000});
await card.locator('#ccCity').fill('Санкт-Петербург');
await card.locator('#ccClientNotes').fill('Рабочая заметка acceptance');
await card.locator('#ccSaveBtn').click();
await card.waitFor({state:'hidden',timeout:5000});

// 3. Добавляем анкету этому же клиенту и назначаем её основной через UI.
const questionnaireId='acceptance-questionnaire';
await page.evaluate(({id,qid})=>{
  const api=window.DiagnostikaClients;
  const c=api.findById(id);
  api.update(id,{
    questionnaires:[{
      id:qid,
      externalId:'acceptance-ext',
      source:'yandex',
      receivedAt:'2026-09-18T12:00:00.000Z',
      profile:{
        name:'Анна Acceptance',
        phone:'+79995556677',
        email:'anna.acceptance@example.com',
        city:'Казань',
        age:'32',
        contactMethod:'telegram'
      },
      answers:{'Главный вопрос':'Ответ acceptance'},
      raw:{source:'yandex'},
      isPrimary:false,
      editedAt:null
    }]
  },{source:'acceptance-questionnaire-seed',render:false});
},{id:acceptanceId,qid:questionnaireId});

await page.evaluate(()=>window.DiagnostikaQuestionnaires.open());
const qdlg=page.locator('#clientQuestionnairesDialog');
await qdlg.waitFor({state:'visible',timeout:5000});
await qdlg.locator('.cq-primary-btn').click();
await page.waitForFunction(id=>{
  const c=window.DiagnostikaClients.findById(id);
  return c?.name==='Анна Acceptance' && c?.questionnaires?.some(q=>q.id==='acceptance-questionnaire'&&q.isPrimary);
},acceptanceId,{timeout:5000});
await qdlg.locator('#cqClose').click();
await qdlg.waitFor({state:'hidden',timeout:5000});

// 4. AI/free-consultation синхронизация профиля того же клиента.
await page.evaluate(id=>{
  const api=window.DiagnostikaClients;
  api.update(id,{
    freeConsultation:{
      context:'Контекст acceptance',
      attempts:'Пробовал дыхательные практики'
    }
  },{source:'acceptance-free-consultation-seed',render:false});
  const c=api.findById(id);
  window.DiagnostikaFreeConsultationSync.syncClient(c,{
    mainRequest:'Развёрнутый AI запрос acceptance',
    selectedShortRequest:{title:'Короткий AI запрос acceptance'},
    desiredResult:'Желаемый AI результат acceptance'
  });
},acceptanceId);

await page.waitForFunction(id=>{
  const c=window.DiagnostikaClients.findById(id);
  return c?.initialProblem==='Развёрнутый AI запрос acceptance'
    && c?.mainRequest==='Короткий AI запрос acceptance'
    && c?.tried==='Пробовал дыхательные практики'
    && c?.desiredOutcome==='Желаемый AI результат acceptance';
},acceptanceId,{timeout:5000});

// 5. Добавляем вложенные IDs, затем прогоняем реальный import/update того же клиента.
await page.evaluate(id=>{
  window.DiagnostikaClients.update(id,{
    requests:[{
      id:'acceptance-request-1',
      title:'Acceptance request',
      status:'active',
      situations:[{id:'acceptance-situation-1',title:'Acceptance situation',beliefs:[]}],
      payment:{}
    }],
    sessions:[{
      id:'acceptance-session-1',
      requestId:'acceptance-request-1',
      date:'2026-09-18',
      note:'Acceptance session'
    }]
  },{source:'acceptance-nested-data',render:false});
},acceptanceId);

const pkg=await page.evaluate(id=>{
  const c=window.DiagnostikaClients.findById(id);
  const copy=JSON.parse(JSON.stringify(c));
  copy.specialistMeta={
    originalSpecialist:'Acceptance Exporter',
    currentSpecialist:'Acceptance Exporter',
    transferHistory:[]
  };
  return {
    format:'diagnostika-client-transfer-v1',
    version:1,
    exportedAt:'2026-09-18T12:30:00.000Z',
    exportedBy:'Acceptance Exporter',
    client:copy
  };
},acceptanceId);

const importInput=page.locator('input[data-client-transfer-import="1"]');
await importInput.setInputFiles({
  name:'acceptance-client.json',
  mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(pkg),'utf8')
});

const confirm=page.locator('.app-message-dialog').filter({hasText:'Клиент уже есть в базе'});
await confirm.waitFor({state:'visible',timeout:5000});
await confirm.locator('.app-message-yes').click();

const importedAlert=page.locator('.app-message-dialog').filter({hasText:'Клиент импортирован'});
await importedAlert.waitFor({state:'visible',timeout:5000});
await importedAlert.locator('.app-message-ok').click();
await importedAlert.waitFor({state:'hidden',timeout:5000});

const afterImport=await page.evaluate(id=>{
  const c=window.DiagnostikaClients.findById(id);
  return {
    currentId:window.DiagnostikaClients.currentId(),
    requestId:c?.requests?.[0]?.id||null,
    situationId:c?.requests?.[0]?.situations?.[0]?.id||null,
    sessionId:c?.sessions?.[0]?.id||null,
    questionnaireId:c?.questionnaires?.[0]?.id||null,
    primary:!!c?.questionnaires?.[0]?.isPrimary,
    specialist:{...(c?.specialistMeta||{})}
  };
},acceptanceId);
assert.equal(afterImport.currentId,acceptanceId);
assert.equal(afterImport.requestId,'acceptance-request-1');
assert.equal(afterImport.situationId,'acceptance-situation-1');
assert.equal(afterImport.sessionId,'acceptance-session-1');
assert.equal(afterImport.questionnaireId,questionnaireId);
assert.equal(afterImport.primary,true);
assert.equal(afterImport.specialist.currentSpecialist,'Acceptance Specialist');
assert.equal(afterImport.specialist.originalSpecialist,'Acceptance Exporter');

// 6. Удаляем того же клиента, восстанавливаем и снова выбираем.
const removed=await page.evaluate(id=>window.DiagnostikaClients.remove(id,{source:'acceptance-delete',render:false}),acceptanceId);
assert.equal(removed?.clientId,acceptanceId);
assert.equal(await page.evaluate(id=>window.DiagnostikaClients.findById(id),acceptanceId),null);
assert.equal(await page.evaluate(id=>window.DiagnostikaClients.findDeletedById(id)?.id||null,acceptanceId),acceptanceId);

const restored=await page.evaluate(id=>window.DiagnostikaClients.restore(id,{
  source:'acceptance-restore',
  select:true,
  selectSource:'acceptance-restore-select',
  render:false
}),acceptanceId);
assert.equal(restored?.id,acceptanceId);
await page.waitForFunction(id=>window.DiagnostikaClients.currentId()===id,acceptanceId,{timeout:5000});
assert.equal(await page.evaluate(()=>localStorage.getItem('diagnostika-last-client-id')),acceptanceId);

// 7. Проверяем итоговое состояние до reload.
const beforeReload=await page.evaluate(id=>{
  const c=window.DiagnostikaClients.findById(id);
  return {
    id:c?.id,
    name:c?.name,
    phone:c?.phone,
    email:c?.email,
    city:c?.city,
    initialProblem:c?.initialProblem,
    mainRequest:c?.mainRequest,
    tried:c?.tried,
    desiredOutcome:c?.desiredOutcome,
    clientNotes:c?.clientNotes,
    questionnaireId:c?.questionnaires?.[0]?.id,
    questionnairePrimary:!!c?.questionnaires?.[0]?.isPrimary,
    requestId:c?.requests?.[0]?.id,
    situationId:c?.requests?.[0]?.situations?.[0]?.id,
    sessionId:c?.sessions?.[0]?.id,
    currentId:window.DiagnostikaClients.currentId(),
    remembered:localStorage.getItem('diagnostika-last-client-id'),
    trash:window.DiagnostikaClients.trashList().map(x=>x.id),
    events:window.__clientAcceptanceEvents
  };
},acceptanceId);

assert.equal(beforeReload.name,'Анна Acceptance');
assert.equal(beforeReload.phone,'+79995556677');
assert.equal(beforeReload.email,'anna.acceptance@example.com');
assert.equal(beforeReload.city,'Казань');
assert.equal(beforeReload.initialProblem,'Развёрнутый AI запрос acceptance');
assert.equal(beforeReload.mainRequest,'Короткий AI запрос acceptance');
assert.equal(beforeReload.tried,'Пробовал дыхательные практики');
assert.equal(beforeReload.desiredOutcome,'Желаемый AI результат acceptance');
assert.equal(beforeReload.clientNotes,'Рабочая заметка acceptance');
assert.equal(beforeReload.questionnaireId,questionnaireId);
assert.equal(beforeReload.questionnairePrimary,true);
assert.equal(beforeReload.requestId,'acceptance-request-1');
assert.equal(beforeReload.situationId,'acceptance-situation-1');
assert.equal(beforeReload.sessionId,'acceptance-session-1');
assert.equal(beforeReload.currentId,acceptanceId);
assert.equal(beforeReload.remembered,acceptanceId);
assert.deepEqual(beforeReload.trash,[]);

const count=(type,source='')=>beforeReload.events.filter(x=>x.type===type&&(!source||x.detail.source===source)).length;
assert.equal(count('client:created','client-card-create'),1,'acceptance create event missing or duplicated');
assert.equal(count('client:updated','client-card'),1,'acceptance card update event missing or duplicated');
assert.equal(count('client:updated','questionnaire-primary-profile'),1,'questionnaire profile update event missing or duplicated');
assert.equal(count('client:updated','free-consultation-card-sync'),1,'AI/free consultation update event missing or duplicated');
assert.equal(count('client:updated','client-transfer-import-update'),1,'transfer import update event missing or duplicated');
assert.equal(count('client:deleted','acceptance-delete'),1,'delete event missing or duplicated');
assert.equal(count('client:restored','acceptance-restore'),1,'restore event missing or duplicated');
assert(beforeReload.events.some(x=>x.type==='client:selected'&&x.detail.clientId===acceptanceId),'selected event missing');

// 8. Reload: данные и remembered selection обязаны пережить полный цикл.
await page.reload({waitUntil:'commit',timeout:10000});
await ready();
await page.waitForFunction(id=>window.DiagnostikaClients.currentId()===id,acceptanceId,{timeout:10000});

const afterReload=await page.evaluate(id=>{
  const c=window.DiagnostikaClients.findById(id);
  return {
    name:c?.name,
    phone:c?.phone,
    email:c?.email,
    city:c?.city,
    initialProblem:c?.initialProblem,
    mainRequest:c?.mainRequest,
    tried:c?.tried,
    desiredOutcome:c?.desiredOutcome,
    clientNotes:c?.clientNotes,
    questionnaireId:c?.questionnaires?.[0]?.id,
    questionnairePrimary:!!c?.questionnaires?.[0]?.isPrimary,
    requestId:c?.requests?.[0]?.id,
    situationId:c?.requests?.[0]?.situations?.[0]?.id,
    sessionId:c?.sessions?.[0]?.id,
    currentId:window.DiagnostikaClients.currentId(),
    remembered:localStorage.getItem('diagnostika-last-client-id'),
    trash:window.DiagnostikaClients.trashList().map(x=>x.id)
  };
},acceptanceId);

assert.deepEqual(afterReload,{
  name:'Анна Acceptance',
  phone:'+79995556677',
  email:'anna.acceptance@example.com',
  city:'Казань',
  initialProblem:'Развёрнутый AI запрос acceptance',
  mainRequest:'Короткий AI запрос acceptance',
  tried:'Пробовал дыхательные практики',
  desiredOutcome:'Желаемый AI результат acceptance',
  clientNotes:'Рабочая заметка acceptance',
  questionnaireId,
  questionnairePrimary:true,
  requestId:'acceptance-request-1',
  situationId:'acceptance-situation-1',
  sessionId:'acceptance-session-1',
  currentId:acceptanceId,
  remembered:acceptanceId,
  trash:[]
});

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected browser/runtime errors');

console.log('CLIENTS_2_ACCEPTANCE_SUCCESS',JSON.stringify({
  acceptanceId,
  beforeReload:{
    name:beforeReload.name,
    requestId:beforeReload.requestId,
    sessionId:beforeReload.sessionId,
    eventCount:beforeReload.events.length
  },
  afterReload
}));

await context.close();
await browser.close();
