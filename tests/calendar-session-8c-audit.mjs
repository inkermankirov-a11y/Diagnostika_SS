import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const planningSource=fs.readFileSync('calendar-session-planning.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(planningSource.includes("version:'8C'"),'Calendar session planning version is not 8C');
assert(indexSource.includes('calendar-session-planning.js?v=20260919-calendar8c'),'Calendar 8C planner cache marker is stale');

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
  "'session:created'",
  "'session:updated'",
  "'session:deleted'"
])assert(planningSource.includes(token),'Calendar 8C service/event linkage missing '+token);

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
  && window.DiagnostikaCalendarSessionPlanning?.version==='8C',
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
),null,{timeout:5000});

const initial=await page.evaluate(()=>{
  const item=window.DiagnostikaCalendar.list().find(e=>e.clientId==='cal-8c-client'&&e.date==='2026-09-22');
  const stored=JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}');
  return {
    item,
    stored:stored.calendarEvents?.find(e=>e.id===item?.id)||null,
    events:window.__calendar8cEvents
  };
});
assert.equal(initial.item?.requestTitle,'Calendar 8C request');
assert.equal(initial.stored?.sessionNumber,2);
assert(String(initial.item?.note||'').includes('Calendar 8C request'));
assert(initial.events.some(e=>e.source==='calendar-session-linkage'),'Calendar 8C linkage update event missing');

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

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('CALENDAR_8C_SUCCESS',JSON.stringify({
  initialNumber:initial.item.sessionNumber,
  afterSessionCreate:afterCreate.sessionNumber,
  afterSessionDelete:afterDelete.sessionNumber,
  requestId:afterDelete.requestId
}));

await context.close();
await browser.close();
