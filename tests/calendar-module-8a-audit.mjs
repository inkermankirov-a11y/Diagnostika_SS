import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource=fs.readFileSync('modules/calendar/calendar-service.js','utf8');
const moduleSource=fs.readFileSync('modules/calendar/index.js','utf8');
const apiSource=fs.readFileSync('calendar-api.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');
const legacyUiSource=fs.readFileSync('client-calendar.js','utf8');
const planningSource=fs.readFileSync('calendar-session-planning.js','utf8');

for(const token of ['function list(','function get(','function forDate(','function forClient(','function create(','function update(','function remove(','function replace(']){
  assert(serviceSource.includes(token),'CalendarService method missing '+token);
}
assert(serviceSource.includes('services.calendar=Object.freeze({'),'CalendarService export is not frozen');
assert.equal(serviceSource.includes('querySelector('),false,'CalendarService knows calendar HTML');
assert.equal(serviceSource.includes("typeof save==='function'"),false,'CalendarService calls global save directly');
assert(serviceSource.includes('platform.store?.legacySave?.()===true'),'CalendarService does not persist through store bridge');
assert(moduleSource.includes("MODULE_ID='calendar'"),'Calendar module registration missing');
assert(/version:'8[A-D]'/.test(apiSource),'Calendar facade version is outside supported 8A-8D range');
assert(apiSource.includes('window.DiagnostikaCalendar=Object.freeze({'),'Calendar facade is not frozen');
assert(apiSource.includes('const ui=()=>window.DiagnostikaCalendarUI||initialLegacyUi||null;'),'Calendar facade does not preserve dynamic UI bridge');
for(const token of [
  'modules/calendar/calendar-service.js?v=20260919-calendar8a',
  'modules/calendar/index.js?v=20260919-calendar8a',
  'calendar-api.js?v=20260919-calendar8d'
])assert(loaderSource.includes(token),'Calendar loader missing/stale '+token);
assert(/<meta name="diagnostika-build" content="20260919-(?:calendar8d|files9[a-d])">/.test(indexSource),'Calendar-compatible build marker is stale');
assert(/app-loader\.js\?v=20260919-(?:calendar8d|files9[a-d])/.test(indexSource),'Calendar-compatible app-loader marker is stale');

assert(planningSource.includes('normalizePlannedSessions'),'Session planning baseline missing');

const fixture={version:4,calendarEvents:[{
  id:'cal-existing',
  date:'2026-09-20',
  time:'10:00',
  clientId:'cal-client',
  clientName:'Calendar Client',
  type:'Созвон',
  title:'Existing calendar event',
  note:'existing note',
  createdAt:'2026-09-19T08:00:00.000Z'
}],clients:[{
  id:'cal-client',
  name:'Calendar Client',
  currentRequestId:'cal-r1',
  lastDiagnosisRequestId:'cal-r1',
  requests:[{id:'cal-r1',title:'Calendar request',status:'active',situations:[]}],
  sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','cal-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?calendar-8a=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>/^8[A-D]$/.test(window.DiagnostikaCalendar?.version||'')
  && window.DiagnostikaCalendar?.moduleAware===true
  && window.DiagnostikaPlatform?.services?.calendar
  && window.DiagnostikaPlatform?.modules?.get?.('calendar')?.status==='started',
  null,{timeout:15000});

const foundation=await page.evaluate(()=>{
  const api=window.DiagnostikaCalendar;
  const service=window.DiagnostikaPlatform.services.calendar;
  window.__calendar8aEvents=[];
  for(const type of Object.values(api.events)){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__calendar8aEvents.push({type,detail:{...detail}}));
  }

  const first=api.list();
  const one=api.get('cal-existing');
  first[0].title='MUTATED LIST COPY';
  one.note='MUTATED GET COPY';

  return {
    facadeFrozen:Object.isFrozen(api),
    serviceFrozen:Object.isFrozen(service),
    eventsFrozen:Object.isFrozen(service.events),
    module:window.DiagnostikaPlatform.modules.get('calendar'),
    listCount:first.length,
    liveAfterListMutation:api.get('cal-existing'),
    byDate:api.forDate('2026-09-20'),
    byClient:api.forClient('cal-client')
  };
});

assert.equal(foundation.facadeFrozen,true);
assert.equal(foundation.serviceFrozen,true);
assert.equal(foundation.eventsFrozen,true);
assert.equal(foundation.module.status,'started');
assert.equal(foundation.listCount,1);
assert.equal(foundation.liveAfterListMutation.title,'Existing calendar event');
assert.equal(foundation.liveAfterListMutation.note,'existing note');
assert.equal(foundation.byDate.length,1);
assert.equal(foundation.byClient.length,1);

const created=await page.evaluate(()=>{
  return window.DiagnostikaCalendar.create({
    id:'cal-new',
    date:'2026-09-21',
    time:'19:00',
    clientId:'cal-client',
    clientName:'Calendar Client',
    requestId:'cal-r1',
    type:'Сессия',
    title:'Calendar 8A created',
    note:'created through service'
  },{source:'calendar-8a-test-create'});
});
assert(created,'CalendarService create failed');
assert.equal(created.id,'cal-new');

const updated=await page.evaluate(()=>{
  return window.DiagnostikaCalendar.update('cal-new',{
    time:'20:30',
    note:'updated through service'
  },{source:'calendar-8a-test-update'});
});
assert(updated,'CalendarService update failed');
assert.equal(updated.time,'20:30');
assert.equal(updated.note,'updated through service');

const persisted=await page.evaluate(()=>{
  const stored=JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}');
  const item=stored.calendarEvents?.find(x=>x.id==='cal-new');
  return {
    item,
    live:window.DiagnostikaCalendar.get('cal-new'),
    dateCount:window.DiagnostikaCalendar.forDate('2026-09-21').length,
    clientCount:window.DiagnostikaCalendar.forClient('cal-client').length,
    events:window.__calendar8aEvents
  };
});
assert.equal(persisted.item.time,'20:30');
assert.equal(persisted.item.note,'updated through service');
assert.equal(persisted.live.time,'20:30');
assert.equal(persisted.dateCount,1);
assert.equal(persisted.clientCount,2);
for(const source of ['calendar-8a-test-create','calendar-8a-test-update']){
  assert(persisted.events.some(x=>x.detail?.source===source),'Missing calendar event source '+source);
}

const uiOpen=await page.evaluate(()=>{
  const result=window.DiagnostikaCalendar.open();
  const dialog=document.getElementById('diagnostikaCalendarOverlay');
  return {result,open:!!dialog?.open};
});
assert.equal(uiOpen.open,true,'Calendar legacy UI did not open through 8A facade');
await page.evaluate(()=>{
  const cells=[...document.querySelectorAll('#diagnostikaCalendarOverlay .cal-day:not(.out)')];
  const target=cells.find(cell=>cell.querySelector('.cal-num')?.textContent==='20');
  if(!target)throw new Error('Calendar day 20 was not rendered');
  target.click();
});
const uiRows=await page.locator('#diagnostikaCalendarOverlay .cal-event').count();
assert(uiRows>=1,'Calendar UI did not render stored event after selecting its date');
await page.locator('#diagnostikaCalendarOverlay .cal-close').click();

const removed=await page.evaluate(()=>{
  const deleted=window.DiagnostikaCalendar.remove('cal-new',{source:'calendar-8a-test-delete'});
  const stored=JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}');
  return {
    deleted,
    live:window.DiagnostikaCalendar.get('cal-new'),
    storedExists:stored.calendarEvents?.some(x=>x.id==='cal-new')||false,
    events:window.__calendar8aEvents
  };
});
assert.equal(removed.deleted.id,'cal-new');
assert.equal(removed.live,null);
assert.equal(removed.storedExists,false);
assert(removed.events.some(x=>x.detail?.source==='calendar-8a-test-delete'),'Missing calendar delete event');

await page.reload({waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>/^8[A-D]$/.test(window.DiagnostikaCalendar?.version||'')
  && window.DiagnostikaPlatform?.services?.calendar
  && window.DiagnostikaPlatform?.modules?.get?.('calendar')?.status==='started',
  null,{timeout:20000});
const restored=await page.evaluate(()=>window.DiagnostikaCalendar.list());
assert.equal(restored.length,1);
assert.equal(restored[0].id,'cal-existing');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('CALENDAR_8A_SUCCESS',JSON.stringify({
  module:foundation.module.status,
  initial:foundation.listCount,
  restored:restored.length,
  uiOpened:uiOpen.open
}));

await context.close();
await browser.close();
