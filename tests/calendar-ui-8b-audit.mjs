import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const uiSource=fs.readFileSync('modules/calendar/ui/calendar.js','utf8');
const apiSource=fs.readFileSync('calendar-api.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(apiSource.includes("version:'8D'"),'Calendar facade version is not 8D');
assert(indexSource.includes('modules/calendar/ui/calendar.js?v=20261006-future-beacon-tooltip-1'),'Calendar UI cache marker is stale');
assert(uiSource.includes(".cal-day.has-events.is-reminder{--cal-beacon:#8b5cf6"),'Reminder day beacon is not purple');
assert(uiSource.includes("if(kinds.includes('reminder'))return 'reminder'"),'Reminder day kind priority is missing');
assert(uiSource.includes("row.className=`cal-event is-${calendarEventKind(e)}`"),'Reminder day detail does not receive event type styling');
assert(indexSource.includes('app-loader.js?v=20261006-universal-notification-icons-2'),'Global app-loader marker missing');
assert(loaderSource.includes('calendar-api.js?v=20260919-calendar8d'),'Calendar facade loader marker is stale');
assert(uiSource.includes('function eventShouldSignal(event,now=new Date())'),'Future-only calendar signal filter is missing');
assert(uiSource.includes('event?.sessionCompleted===true'),'Completed calendar records still signal');
assert(uiSource.includes('.cal-day-tooltip-action'),'Structured calendar action line is missing');
assert(uiSource.includes('.cal-day-tooltip-note'),'Structured calendar note line is missing');
assert(uiSource.includes('.cal-day-tooltip-row.is-reminder{--cal-row-accent:#7c3aed'),'Reminder tooltip accent is not purple');
assert(uiSource.includes(".cal-day.has-events.is-diagnosis{--cal-beacon:#f59e0b"),'Diagnosis beacon color is missing');

for(const forbidden of [
  'customEvents().push(item)',
  '.splice(idx,1)',
  "typeof save==='function'"
])assert.equal(uiSource.includes(forbidden),false,'Calendar UI still owns persistence: '+forbidden);

for(const token of [
  "source:'calendar-ui-create'",
  "source:'calendar-ui-delete'",
  "api.create(item",
  "api.remove(e.id"
])assert(uiSource.includes(token),'Calendar UI service boundary missing '+token);

const fixture={version:4,calendarEvents:[],clients:[{
  id:'cal-8b-client',
  name:'Calendar 8B Client',
  currentRequestId:'cal-8b-r1',
  lastDiagnosisRequestId:'cal-8b-r1',
  requests:[{id:'cal-8b-r1',title:'Calendar 8B request',status:'active',situations:[]}],
  sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','cal-8b-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?calendar-8b=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaCalendar?.version==='8D'
  && window.DiagnostikaCalendar?.moduleAware===true
  && window.DiagnostikaPlatform?.services?.calendar,
  null,{timeout:15000});

await page.evaluate(()=>{
  window.__calendar8bEvents=[];
  for(const type of Object.values(window.DiagnostikaCalendar.events)){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__calendar8bEvents.push({type,detail:{...detail}}));
  }
  const pad=n=>String(n).padStart(2,'0');
  const day=offset=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  const dates={past:day(-1),reminder:day(1),diagnosis:day(2),completed:day(3)};
  window.__calendar8bSignalDates=dates;
  const api=window.DiagnostikaCalendar;
  api.create({id:'signal-past-diagnosis',date:dates.past,time:'19:00',clientId:'cal-8b-client',clientName:'Calendar 8B Client',type:'Диагностика',title:'Диагностика',note:'Проведена вчера',plannedSessionSkeleton:false},{source:'calendar-8b-signal-fixture'});
  api.create({id:'signal-reminder',date:dates.reminder,time:'19:00',clientId:'cal-8b-client',clientName:'Calendar 8B Client',type:'Напоминание',title:'Напоминание',note:'Уточнить состояние после диагностики',plannedSessionSkeleton:false},{source:'calendar-8b-signal-fixture'});
  api.create({id:'signal-diagnosis',date:dates.diagnosis,time:'18:30',clientId:'cal-8b-client',clientName:'Calendar 8B Client',type:'Диагностика',title:'Диагностика',note:'Повторная диагностика',plannedSessionSkeleton:false},{source:'calendar-8b-signal-fixture'});
  api.create({id:'signal-completed',date:dates.completed,time:'17:00',clientId:'cal-8b-client',clientName:'Calendar 8B Client',type:'Сессия',title:'Сессия',note:'Уже проведена',sessionCompleted:true,status:'completed',completedAt:new Date().toISOString(),plannedSessionSkeleton:false},{source:'calendar-8b-signal-fixture'});
  window.DiagnostikaCalendar.open();
});

const dialog=page.locator('#diagnostikaCalendarOverlay');
await dialog.waitFor({state:'visible'});
const signalDates=await page.evaluate(()=>window.__calendar8bSignalDates);
const pastCell=dialog.locator(`.cal-day[data-date="${signalDates.past}"]`);
const reminderCell=dialog.locator(`.cal-day[data-date="${signalDates.reminder}"]`);
const diagnosisCell=dialog.locator(`.cal-day[data-date="${signalDates.diagnosis}"]`);
const completedCell=dialog.locator(`.cal-day[data-date="${signalDates.completed}"]`);
await pastCell.waitFor({state:'visible',timeout:5000});
assert.equal(await pastCell.locator('.cal-day-beacon').count(),0,'Past diagnosis still shows a signal');
assert.equal(await completedCell.locator('.cal-day-beacon').count(),0,'Completed calendar record still shows a signal');
assert.equal(await reminderCell.locator('.cal-day-beacon').count(),1,'Future reminder has no signal');
assert.equal(await diagnosisCell.locator('.cal-day-beacon').count(),1,'Future diagnosis has no signal');

await reminderCell.hover();
const hover=dialog.locator('.cal-hover-tooltip');
await hover.waitFor({state:'visible',timeout:3000});
const reminderRow=hover.locator('.cal-day-tooltip-row.is-reminder');
const reminderTooltip=await reminderRow.evaluate(row=>{
  const client=row.querySelector('.cal-day-tooltip-client');
  const action=row.querySelector('.cal-day-tooltip-action');
  const note=row.querySelector('.cal-day-tooltip-note');
  return {
    client:client?.textContent?.trim()||'',
    action:action?.textContent?.trim()||'',
    note:note?.textContent?.trim()||'',
    actionColor:getComputedStyle(action).color,
    noteColor:getComputedStyle(note).color,
    clientDisplay:getComputedStyle(client).display,
    noteDisplay:getComputedStyle(note).display
  };
});
assert.equal(reminderTooltip.client,'Calendar 8B Client');
assert.equal(reminderTooltip.action,'Напоминание');
assert.equal(reminderTooltip.note,'Уточнить состояние после диагностики');
assert.equal(reminderTooltip.actionColor,'rgb(124, 58, 237)');
assert.equal(reminderTooltip.noteColor,'rgb(124, 58, 237)');
assert.equal(reminderTooltip.clientDisplay,'block');
assert.equal(reminderTooltip.noteDisplay,'block');

await page.mouse.move(5,5);
await diagnosisCell.hover();
await hover.waitFor({state:'visible',timeout:3000});
const diagnosisRow=hover.locator('.cal-day-tooltip-row.is-diagnosis');
assert.equal(await diagnosisRow.locator('.cal-day-tooltip-action').innerText(),'Диагностика');
assert.equal(await diagnosisRow.locator('.cal-day-tooltip-note').innerText(),'Повторная диагностика');
await dialog.locator('.cal-date').fill('2026-09-22');
await dialog.locator('.cal-time').fill('18:30');
await dialog.locator('.cal-client').selectOption('cal-8b-client');
await dialog.locator('.cal-type').selectOption({label:'Созвон'});
await dialog.locator('.cal-note').fill('Создано UI Calendar 8B');
await dialog.locator('.cal-save').click();

await page.waitForFunction(()=>window.DiagnostikaCalendar.list().some(e=>
  e.date==='2026-09-22'&&e.time==='18:30'&&e.note==='Создано UI Calendar 8B'
),null,{timeout:5000});

const created=await page.evaluate(()=>{
  const item=window.DiagnostikaCalendar.list().find(e=>e.date==='2026-09-22'&&e.time==='18:30');
  const stored=JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}');
  return {
    item,
    stored:stored.calendarEvents?.find(e=>e.id===item?.id)||null,
    events:window.__calendar8bEvents
  };
});
assert(created.item,'Calendar UI create did not reach CalendarService');
assert.equal(created.stored?.note,'Создано UI Calendar 8B');
assert(created.events.some(x=>x.detail?.source==='calendar-ui-create'),'Missing calendar-ui-create service event');

const rows=dialog.locator('.cal-event');
await rows.first().waitFor({state:'visible'});
const targetRow=rows.filter({hasText:'Созвон'}).filter({hasText:'Создано UI Calendar 8B'}).first();
await targetRow.locator('.cal-delete').click();

await page.waitForFunction(id=>window.DiagnostikaCalendar.get(id)===null,created.item.id,{timeout:5000});

const removed=await page.evaluate(id=>{
  const stored=JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}');
  return {
    live:window.DiagnostikaCalendar.get(id),
    storedExists:stored.calendarEvents?.some(e=>e.id===id)||false,
    events:window.__calendar8bEvents
  };
},created.item.id);

assert.equal(removed.live,null);
assert.equal(removed.storedExists,false);
assert(removed.events.some(x=>x.detail?.source==='calendar-ui-delete'),'Missing calendar-ui-delete service event');
assert.equal(await dialog.locator('.cal-event').count(),0,'Deleted calendar event is still rendered');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('CALENDAR_8B_SUCCESS',JSON.stringify({
  createdSource:created.events.some(x=>x.detail?.source==='calendar-ui-create'),
  deletedSource:removed.events.some(x=>x.detail?.source==='calendar-ui-delete'),
  persistedAfterDelete:removed.storedExists
}));

await context.close();
await browser.close();
