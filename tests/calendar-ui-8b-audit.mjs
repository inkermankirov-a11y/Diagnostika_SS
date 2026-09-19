import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const uiSource=fs.readFileSync('client-calendar.js','utf8');
const apiSource=fs.readFileSync('calendar-api.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(apiSource.includes("version:'8D'"),'Calendar facade version is not 8D');
assert(indexSource.includes('client-calendar.js?v=20260919-calendar8d'),'Calendar UI cache marker is stale');
assert(/app-loader\.js\?v=20260919-(?:calendar8d|files9[a-d]|export10[a-d])/.test(indexSource),'Global loader marker is stale');
assert(loaderSource.includes('calendar-api.js?v=20260919-calendar8d'),'Calendar facade loader marker is stale');

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
  window.DiagnostikaCalendar.open();
});

const dialog=page.locator('#diagnostikaCalendarOverlay');
await dialog.waitFor({state:'visible'});
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
