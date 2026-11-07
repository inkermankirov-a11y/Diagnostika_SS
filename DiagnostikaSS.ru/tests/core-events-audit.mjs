import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const stamp='2026-09-17T12:00:00.000Z';
const fixture={version:4,clients:[
  {
    id:'core-client-1',name:'CORE Клиент 1',city:'Киров',sessions:[],
    currentRequestId:'core-request-1',lastDiagnosisRequestId:'core-request-1',
    requests:[
      {id:'core-request-1',title:'Первый запрос',status:'active',createdAt:stamp,updatedAt:stamp,situations:[]},
      {id:'core-request-2',title:'Второй запрос',status:'active',createdAt:stamp,updatedAt:stamp,situations:[]}
    ]
  },
  {id:'core-client-2',name:'CORE Клиент 2',city:'Москва',sessions:[],requests:[]}
]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','core-client-1');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
page.on('dialog',d=>d.accept());
await page.goto(base);
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaPlatform?.status==='ready'&&window.DiagnostikaPlatform?.version==='0.2.0'&&!!window.DiagnostikaPlatform?.legacyEvents,null,{timeout:10000});

const watched=['client:created','client:selected','client:updated','request:created','request:selected','request:activated','request:completed','request:resumed','session:created','session:updated'];
await page.evaluate(types=>{
  window.__coreEventAudit=[];
  for(const type of types){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__coreEventAudit.push({type,detail}));
  }
},watched);

// Client selection through the public boundary.
assert.equal(await page.evaluate(()=>window.DiagnostikaClients.select('core-client-2')),true);
assert.equal(await page.evaluate(()=>window.DiagnostikaClients.select('core-client-1')),true);

// Existing client card update.
await page.getByRole('button',{name:'Карточка клиента',exact:true}).click();
await page.locator('#ccCity').fill('Киров CORE 0.2A');
await page.locator('#ccSaveBtn').click();
await page.locator('#clientCardDialog').waitFor({state:'hidden'});

// Request selection / activation / completion / resume / creation.
await page.getByRole('button',{name:'Диагностика',exact:true}).click();
await page.locator('#diagnosisWorkspace').waitFor({state:'visible'});
await page.locator('#requestSelect').selectOption('core-request-2');
await page.locator('.request-current-btn').click();
await page.locator('.request-finish-btn').click();
await page.locator('.request-resume-btn').click();
await page.locator('#addRequestBtn').click();

// Return to dashboard and create + update a session.
await page.locator('.diagnosis-compact-back').click();
await page.locator('#hdAddSession').waitFor({state:'visible'});
await page.locator('#hdAddSession').click();
const sessionDialog=page.locator('dialog.session-edit-dialog');
await sessionDialog.waitFor({state:'visible'});
await sessionDialog.locator('.session-edit-text').fill('CORE event updated session');
await sessionDialog.locator('.session-edit-actions .primary').click();
await sessionDialog.waitFor({state:'hidden'});

// Create a client through the card workflow.
await page.evaluate(()=>window.DiagnostikaClientCard.openNew());
await page.locator('#ccName').fill('CORE Новый клиент');
await page.locator('#ccSaveBtn').click();
await page.locator('#clientCardDialog').waitFor({state:'hidden'});

await page.waitForTimeout(150);
const events=await page.evaluate(()=>window.__coreEventAudit);
const types=events.map(x=>x.type);
for(const type of watched){
  assert(types.includes(type),`Missing CORE event: ${type}\n${JSON.stringify(events,null,2)}`);
}

const createdSession=events.find(x=>x.type==='session:created');
const updatedSession=events.find(x=>x.type==='session:updated');
assert(createdSession?.detail?.sessionId,'session:created has no sessionId');
assert.equal(updatedSession?.detail?.sessionId,createdSession.detail.sessionId,'session update must refer to created session');
assert(events.some(x=>x.type==='client:updated'&&x.detail.clientId==='core-client-1'));
assert(events.some(x=>x.type==='client:created'&&x.detail.clientId));
assert(events.some(x=>x.type==='request:selected'&&x.detail.requestId==='core-request-2'));
assert(events.some(x=>x.type==='request:activated'&&x.detail.requestId==='core-request-2'));
assert(events.some(x=>x.type==='request:completed'&&x.detail.requestId==='core-request-2'));
assert(events.some(x=>x.type==='request:resumed'&&x.detail.requestId==='core-request-2'));
assert.deepEqual(pageErrors,[],'Unexpected runtime errors');

console.log('CORE_EVENTS_AUDIT_SUCCESS',JSON.stringify(events));
await context.close();
await browser.close();
