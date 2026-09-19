import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const uiSource=fs.readFileSync('client-calendar.js','utf8');
const apiSource=fs.readFileSync('calendar-api.js','utf8');
const googleSource=fs.readFileSync('calendar-google-link.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(uiSource.includes("version:'8D'"),'Calendar UI bridge is not 8D');
assert(uiSource.includes('window.DiagnostikaCalendarUI=ui'),'Dedicated Calendar UI bridge missing');
assert(uiSource.includes("if(window.DiagnostikaCalendar?.moduleAware!==true)window.DiagnostikaCalendar=ui"),'Calendar UI can overwrite module facade');
assert(apiSource.includes("version:'8D'"),'Calendar facade is not 8D');
assert(apiSource.includes('const ui=()=>window.DiagnostikaCalendarUI||initialLegacyUi||null;'),'Calendar facade UI bridge is not dynamic');
assert(googleSource.includes("version:'8D'"),'Google Calendar bridge is not 8D');
assert(googleSource.includes('calendarApi()?.get?.(id)'),'Google Calendar link does not resolve canonical event data');
assert(loaderSource.includes('calendar-api.js?v=20260919-calendar8d'),'Calendar facade cache marker is stale');
for(const marker of [
  'client-calendar.js?v=20260919-calendar8d',
  'calendar-google-link.js?v=20260919-calendar8d'
])assert(indexSource.includes(marker),'Calendar 8D marker missing '+marker);
assert(/app-loader\.js\?v=[^"&]+&api=13d/.test(indexSource),'Calendar global app-loader/API marker missing');

const fixture={version:4,calendarEvents:[{
  id:'cal-8d-existing',
  date:'2026-09-22',
  time:'18:30',
  clientId:'cal-8d-client',
  clientName:'Calendar 8D Client',
  type:'Созвон',
  title:'Canonical title',
  note:'Canonical note',
  createdAt:'2026-09-19T10:00:00.000Z'
}],clients:[{
  id:'cal-8d-client',
  name:'Calendar 8D Client',
  currentRequestId:'cal-8d-r1',
  lastDiagnosisRequestId:'cal-8d-r1',
  requests:[{id:'cal-8d-r1',title:'Calendar 8D request',status:'active',situations:[]}],
  sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','cal-8d-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?calendar-8d=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaCalendar?.version==='8D'
  && window.DiagnostikaCalendar?.moduleAware===true
  && window.DiagnostikaCalendarUI?.version==='8D'
  && window.DiagnostikaGoogleCalendarLink?.version==='8D',
  null,{timeout:15000});

await page.evaluate(()=>window.DiagnostikaCalendar.open());
const dialog=page.locator('#diagnostikaCalendarOverlay');
await dialog.waitFor({state:'visible'});
await dialog.locator('.cal-date').fill('2026-09-22');
await page.evaluate(()=>{
  const input=document.querySelector('#diagnostikaCalendarOverlay .cal-date');
  input?.dispatchEvent(new Event('change',{bubbles:true}));
  const cells=[...document.querySelectorAll('#diagnostikaCalendarOverlay .cal-day')];
  const target=cells.find(cell=>cell.querySelector('.cal-num')?.textContent==='22'&&!cell.classList.contains('out'));
  target?.click();
});
const row=dialog.locator('.cal-event[data-calendar-event-id="cal-8d-existing"]');
await row.waitFor({state:'visible'});

await page.evaluate(()=>{
  window.DiagnostikaCalendar.update('cal-8d-existing',{
    title:'Updated from CalendarService',
    note:'Service-owned note'
  },{source:'calendar-8d-external-update'});
});
await row.getByText('Updated from CalendarService').waitFor({state:'visible',timeout:5000});

const google=await page.evaluate(()=>{
  const row=document.querySelector('.cal-event[data-calendar-event-id="cal-8d-existing"]');
  row.querySelector('.cal-event-title').textContent='WRONG DOM TITLE';
  row.querySelector('.cal-event-meta').textContent='WRONG DOM META';
  row.querySelector('.cal-event-time').textContent='00:01';
  const raw=window.DiagnostikaGoogleCalendarLink.urlForRow(row);
  const url=new URL(raw);
  return {
    raw,
    text:url.searchParams.get('text'),
    dates:url.searchParams.get('dates'),
    details:url.searchParams.get('details')
  };
});
assert(google.raw.startsWith('https://calendar.google.com/calendar/render?'));
assert.equal(google.text,'Updated from CalendarService — Calendar 8D Client');
assert.equal(google.dates,'20260922T183000/20260922T193000');
assert(google.details.includes('Service-owned note'));
assert.equal(google.details.includes('WRONG DOM META'),false);

const orderPage=await context.newPage();
await orderPage.goto('about:blank');
await orderPage.evaluate(()=>{
  window.DiagnostikaCalendar=Object.freeze({moduleAware:true,version:'SENTINEL',sentinel:true});
});
await orderPage.addScriptTag({path:'client-calendar.js'});
const orderSafe=await orderPage.evaluate(()=>({
  sentinel:window.DiagnostikaCalendar?.sentinel===true,
  facadeVersion:window.DiagnostikaCalendar?.version,
  uiVersion:window.DiagnostikaCalendarUI?.version,
  overlay:!!document.getElementById('diagnostikaCalendarOverlay')
}));
assert.equal(orderSafe.sentinel,true,'Calendar UI overwrote an existing module-aware facade');
assert.equal(orderSafe.facadeVersion,'SENTINEL');
assert.equal(orderSafe.uiVersion,'8D');
assert.equal(orderSafe.overlay,true);

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('CALENDAR_8D_SUCCESS',JSON.stringify({
  externalRefresh:true,
  canonicalGoogleData:true,
  loadOrderSafe:orderSafe.sentinel
}));

await orderPage.close();
await context.close();
await browser.close();
