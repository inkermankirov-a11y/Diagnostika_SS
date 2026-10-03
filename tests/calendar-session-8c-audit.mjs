import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const planningSource=fs.readFileSync('modules/calendar/ui/session-planning.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(planningSource.includes("version:'8E'"),'Calendar session planning version is not 8E');
assert(indexSource.includes('modules/calendar/ui/session-planning.js?v=20261003-planned-session-1'),'Calendar session planner module marker is stale');

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
  "'calendar:event-created'",
  "'calendar:event-updated'",
  "'calendar:event-deleted'",
  "'session:created'",
  "'session:updated'",
  "'session:deleted'"
])assert(planningSource.includes(token),'Calendar 8E service/event linkage missing '+token);

const fixture={
  version:4,
  calendarEvents:[],
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
  && window.DiagnostikaCalendarSessionPlanning?.version==='8E',
  null,{timeout:15000});

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
