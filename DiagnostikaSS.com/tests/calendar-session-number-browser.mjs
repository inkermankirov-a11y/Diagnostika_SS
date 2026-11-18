import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const visitDate=new Date();
visitDate.setMonth(visitDate.getMonth()+1,10);
const pad=n=>String(n).padStart(2,'0');
const date=[visitDate.getFullYear(),pad(visitDate.getMonth()+1),pad(visitDate.getDate())].join('-');
const fixture={
  version:4,
  calendarEvents:[{
    id:'calendar-label-session-2',date,time:'19:00',
    type:'Сессия',title:'Сессия №2',sessionNumber:2,
    clientId:'calendar-label-client',clientName:'Вика',
    requestId:'calendar-label-request',sessionId:'calendar-label-s2',
    plannedSessionSkeleton:true,requestTitle:'Запрос клиента',
    note:'Запрос: работа с тревожностью'
  }],
  clients:[{
    id:'calendar-label-client',name:'Вика',currentRequestId:'calendar-label-request',
    requests:[{id:'calendar-label-request',title:'Запрос клиента',status:'active',situations:[]}],
    sessions:[
      {id:'calendar-label-s1',date:'2026-01-10',requestId:'calendar-label-request',
       planned:false,status:'completed',appointmentType:'Сессия',notes:'Предыдущая сессия'},
      {id:'calendar-label-s2',date,scheduledTime:'19:00',requestId:'calendar-label-request',
       planned:true,status:'planned',appointmentType:'Сессия',
       calendarEventId:'calendar-label-session-2',calendarTitle:'Сессия №2',notes:'',plan:''}
    ],
    quickNotes:[],questionnaires:[]
  }]
};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1400,height:920},locale:'ru-RU'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','calendar-label-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
try{
  await page.goto('http://127.0.0.1:8118/index.html?calendar-number-test=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.DiagnostikaCalendarUI?.openEvent&&
    window.DiagnostikaCalendar?.moduleAware===true,null,{timeout:30000});
  assert(await page.evaluate(()=>window.DiagnostikaCalendarUI.openEvent('calendar-label-session-2',{mode:'overview'})));
  await page.locator('#diagnostikaCalendarOverlay[open]').waitFor({state:'visible',timeout:10000});
  const cell=page.locator('.cal-day.has-events[data-date="'+date+'"]');
  await cell.waitFor({state:'visible',timeout:10000});
  await cell.hover();
  const row=page.locator('.cal-hover-tooltip:not([hidden]) .cal-day-tooltip-row').first();
  await row.waitFor({state:'visible',timeout:7000});
  const action=(await row.locator('.cal-day-tooltip-action').textContent()||'').trim();
  assert.equal(action,'Сессия №2','Hovered calendar beacon lost the planned session number');
  assert.equal((await row.locator('.cal-day-tooltip-time').textContent()||'').trim(),'19:00');
  assert.match((await row.textContent())||'',/Вика/);

  // The same number must survive opening the day details, not just hovering.
  await cell.click();
  await page.locator('.cal-event-title').first().waitFor({state:'visible'});
  const dayLabels=await page.locator('.cal-event-title').allTextContents();
  assert(dayLabels.includes('Сессия №2'),'Calendar day details show generic "Сессия"');

  // Existing diagnosis/reminder categories must still keep their names.
  const raw=await page.evaluate(()=>window.DiagnostikaCalendar.get('calendar-label-session-2'));
  assert.equal(raw.sessionNumber,2);
  assert.equal(raw.title,'Сессия №2');
  assert.equal(raw.type,'Сессия');

  console.log('CALENDAR_SESSION_NUMBER_BROWSER_OK',JSON.stringify({date,action,dayLabels,storedNumber:raw.sessionNumber,errors}));
}finally{
  await context.close();
  await browser.close();
}
