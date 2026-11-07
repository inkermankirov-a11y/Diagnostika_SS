import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const planningSource=fs.readFileSync('modules/calendar/ui/session-planning.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(planningSource.includes("version:'8G'"),'Calendar session planning version is not 8G');
assert(indexSource.includes('modules/calendar/ui/session-planning.js?v=20261007-no-phantom-migration-1'),'Calendar session planner module marker is stale');

for(const forbidden of [
  "typeof save==='function'",
  'st.calendarEvents',
  'e.sessionNumber=',
  'e.requestId='
])assert.equal(planningSource.includes(forbidden),false,'Calendar 8C still mutates legacy calendar persistence: '+forbidden);

for(const token of [
  "sessionsApi()?.forRequest?.(r.id,c)",
  "api.list({clientId:c.id})",
  "api.update(e.id,patch,{source:'calendar-session-linkage'})",
  "sessions.create({",
  "source:'calendar-planned-session-create'",
  "source:'calendar-planned-session-sync'",
  "source:'calendar-planned-session-orphan-remove'",
  "source:'calendar-auto-migration-repair'",
  "'calendar:event-created'",
  "'calendar:event-updated'",
  "'calendar:event-deleted'",
  "'session:created'",
  "'session:updated'",
  "'session:deleted'"
])assert(planningSource.includes(token),'Calendar 8E service/event linkage missing '+token);

const fixture={
  version:4,
  calendarEvents:[{
    id:'cal-8c-existing-future',
    date:'2099-01-02',
    time:'17:45',
    clientId:'cal-8c-client',
    clientName:'Calendar 8C Client',
    requestId:'cal-8c-r1',
    type:'Диагностика',
    title:'Диагностика',
    note:'Старая запись должна сохраниться',
    createdAt:'2026-09-01T10:00:00.000Z'
  },{
    id:'cal-8c-auto-migrated-phantom',
    date:'2099-01-03',
    time:'19:00',
    clientId:'cal-8c-client',
    clientName:'Calendar 8C Client',
    requestId:'cal-8c-r1',
    type:'Диагностика',
    title:'Диагностика',
    note:'Автоматически мигрированная фантомная диагностика',
    plannedSessionSkeleton:true,
    plannedSessionMigrated:true,
    sessionId:'cal-8c-phantom-session'
  }],
  clients:[{
    id:'cal-8c-client',
    name:'Calendar 8C Client',
    currentRequestId:'cal-8c-r1',
    lastDiagnosisRequestId:'cal-8c-r1',
    requests:[{
      id:'cal-8c-r1',
      title:'Calendar 8C request',
      status:'active',
      situations:[]
    }],
    sessions:[{
      id:'cal-8c-session-existing',
      date:'2026-09-20',
      requestId:'cal-8c-r1',
      notes:''
    },{
      id:'cal-8c-phantom-session',
      date:'2099-01-03',
      scheduledTime:'19:00',
      requestId:'cal-8c-r1',
      status:'planned',
      planned:true,
      calendarEventId:'cal-8c-auto-migrated-phantom',
      appointmentType:'Диагностика',
      calendarTitle:'Диагностика',
      notes:'',
      plan:''
    }],
    quickNotes:[],
    questionnaires:[]
  },{
    id:'diag-only-client',
    name:'Diagnosis Only Client',
    currentRequestId:'diag-only-r1',
    lastDiagnosisRequestId:'diag-only-r1',
    requests:[{
      id:'diag-only-r1',
      title:'Diagnosis only request',
      status:'active',
      situations:[]
    }],
    sessions:[{
      id:'diag-only-record-1',
      date:'2026-10-05',
      requestId:'diag-only-r1',
      appointmentType:'Диагностика',
      calendarTitle:'Диагностика',
      planned:false,
      status:'completed',
      notes:'Диагностика проведена'
    }],
    quickNotes:[],
    questionnaires:[]
  }]
};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','cal-8c-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?calendar-8c=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaCalendar?.moduleAware===true
  && window.DiagnostikaSessions?.moduleAware===true
  && window.DiagnostikaCalendarSessionPlanning?.version==='8G',
  null,{timeout:15000});

const diagnosisOnlyNumber=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.list().find(x=>x.id==='diag-only-client');
  const r=c?.requests?.find(x=>x.id==='diag-only-r1');
  return window.DiagnostikaCalendarSessionPlanning.nextSessionNumber(c,r);
});
assert.equal(diagnosisOnlyNumber,1,'Conducted diagnosis incorrectly increments therapy session number');

await page.waitForTimeout(200);
const legacyFuture=await page.evaluate(()=>({
  item:window.DiagnostikaCalendar.get('cal-8c-existing-future'),
  skeleton:window.DiagnostikaSessions.list('cal-8c-client').find(s=>s.calendarEventId==='cal-8c-existing-future')||null
}));
assert.equal(legacyFuture.item?.plannedSessionSkeleton,undefined,'Legacy calendar diagnosis was auto-promoted into a planned card');
assert.equal(legacyFuture.item?.plannedSessionMigrated,undefined,'Legacy calendar diagnosis was marked as auto-migrated');
assert.equal(legacyFuture.item?.sessionId,undefined,'Legacy calendar diagnosis was linked to a synthetic session');
assert.equal(legacyFuture.skeleton,null,'Legacy calendar diagnosis created a phantom planned session card');
assert.equal(legacyFuture.item?.title,'Диагностика');
assert.equal(legacyFuture.item?.note,'Старая запись должна сохраниться');

const repairedPhantom=await page.evaluate(()=>({
  item:window.DiagnostikaCalendar.get('cal-8c-auto-migrated-phantom'),
  session:window.DiagnostikaSessions.list('cal-8c-client').find(s=>s.id==='cal-8c-phantom-session')||null
}));
assert.equal(repairedPhantom.session,null,'Previously auto-migrated phantom planned card was not removed');
assert.equal(repairedPhantom.item?.plannedSessionSkeleton,false,'Previously auto-migrated calendar event still behaves as a planned card');
assert.equal(repairedPhantom.item?.plannedSessionMigrated,false,'Auto-migration marker was not cleared');
assert.equal(repairedPhantom.item?.sessionId,'','Synthetic session link was not cleared');

await page.evaluate(()=>{
  window.__calendar8cEvents=[];
  window.DiagnostikaPlatform.events.on('calendar:event-updated',detail=>{
    window.__calendar8cEvents.push({...detail});
  });
  window.DiagnostikaCalendar.open();
});

const dialog=page.locator('#diagnostikaCalendarOverlay');
await dialog.waitFor({state:'visible'});
await dialog.locator('.cal-date').fill('2026-09-22');
await dialog.locator('.cal-time').fill('18:30');
await dialog.locator('.cal-client').selectOption('cal-8c-client');
await dialog.locator('.cal-type').selectOption('Сессия');
await dialog.locator('.cal-save').click();

await page.waitForFunction(()=>window.DiagnostikaCalendar.list().some(e=>
  e.clientId==='cal-8c-client'
  && e.date==='2026-09-22'
  && e.type==='Сессия'
  && e.requestId==='cal-8c-r1'
  && e.sessionNumber===2
  && e.title==='Сессия №2'
  && e.sessionId
),null,{timeout:5000});
await page.waitForFunction(()=>window.DiagnostikaSessions.list('cal-8c-client').some(s=>
  s.calendarEventId
  && s.date==='2026-09-22'
  && s.scheduledTime==='18:30'
  && s.requestId==='cal-8c-r1'
  && s.status==='planned'
  && s.planned===true
),null,{timeout:5000});

const initial=await page.evaluate(()=>{
  const item=window.DiagnostikaCalendar.list().find(e=>e.clientId==='cal-8c-client'&&e.date==='2026-09-22');
  const stored=JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}');
  const skeleton=window.DiagnostikaSessions.list('cal-8c-client').find(s=>s.calendarEventId===item?.id)||null;
  return {
    item,
    skeleton,
    stored:stored.calendarEvents?.find(e=>e.id===item?.id)||null,
    events:window.__calendar8cEvents
  };
});
assert.equal(initial.item?.requestTitle,'Calendar 8C request');
assert.equal(initial.stored?.sessionNumber,2);
assert(String(initial.item?.note||'').includes('Calendar 8C request'));
assert(initial.item?.sessionId,'Calendar event did not link to planned session skeleton');
assert.equal(initial.skeleton?.id,initial.item?.sessionId);
assert.equal(initial.skeleton?.status,'planned');
assert.equal(initial.skeleton?.planned,true);
assert.equal(initial.skeleton?.scheduledTime,'18:30');
assert.equal(initial.skeleton?.plan,'');
assert(initial.events.some(e=>e.source==='calendar-session-linkage'),'Calendar 8E linkage update event missing');

const createdSessionId=await page.evaluate(()=>{
  const created=window.DiagnostikaSessions.create(
    {date:'2026-09-21',notes:'created by 8C audit'},
    {clientId:'cal-8c-client',requestId:'cal-8c-r1',source:'calendar-8c-audit',render:false}
  );
  return created?.id||null;
});
assert(createdSessionId,'SessionService could not create a linked session');

await page.waitForFunction(()=>window.DiagnostikaCalendar.list().some(e=>
  e.clientId==='cal-8c-client'&&e.date==='2026-09-22'&&e.sessionNumber===3&&e.title==='Сессия №3'
),null,{timeout:5000});

const afterCreate=await page.evaluate(()=>window.DiagnostikaCalendar.list().find(e=>
  e.clientId==='cal-8c-client'&&e.date==='2026-09-22'
));
assert.equal(afterCreate.sessionNumber,3);

await page.evaluate(id=>{
  window.DiagnostikaSessions.remove(id,{clientId:'cal-8c-client',source:'calendar-8c-audit-remove',render:false});
},createdSessionId);

await page.waitForFunction(()=>window.DiagnostikaCalendar.list().some(e=>
  e.clientId==='cal-8c-client'&&e.date==='2026-09-22'&&e.sessionNumber===2&&e.title==='Сессия №2'
),null,{timeout:5000});

const afterDelete=await page.evaluate(()=>window.DiagnostikaCalendar.list().find(e=>
  e.clientId==='cal-8c-client'&&e.date==='2026-09-22'
));
assert.equal(afterDelete.sessionNumber,2);

const plannedEventId=afterDelete.id;
await page.evaluate(id=>{
  window.DiagnostikaCalendar.remove(id,{source:'calendar-8e-audit-delete'});
},plannedEventId);
await page.waitForFunction(id=>!window.DiagnostikaSessions.list('cal-8c-client').some(s=>s.calendarEventId===id),plannedEventId,{timeout:5000});

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('CALENDAR_8E_SUCCESS',JSON.stringify({
  initialNumber:initial.item.sessionNumber,
  afterSessionCreate:afterCreate.sessionNumber,
  afterSessionDelete:afterDelete.sessionNumber,
  requestId:afterDelete.requestId
}));

await context.close();
await browser.close();
