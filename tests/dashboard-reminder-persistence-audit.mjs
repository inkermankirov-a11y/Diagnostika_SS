import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const now=new Date();
const yesterday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1,12,0,0,0);
const yyyy=yesterday.getFullYear();
const mm=String(yesterday.getMonth()+1).padStart(2,'0');
const dd=String(yesterday.getDate()).padStart(2,'0');
const pastDate=`${yyyy}-${mm}-${dd}`;
const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,12,0,0,0);
const futureDate=`${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;

const fixture={
  version:4,
  clients:[
    {id:'reminder-client',name:'Клиент Напоминание',city:'Киров',sessions:[],requests:[]},
    {id:'other-client',name:'Другой клиент',city:'Киров',sessions:[],requests:[]}
  ],
  calendarEvents:[
    {
      id:'reminder-overdue-1',
      clientId:'reminder-client',
      clientName:'Клиент Напоминание',
      date:pastDate,
      time:'09:00',
      type:'Напоминание',
      title:'Напоминание',
      note:'Ответить клиенту по сообщению',
      createdAt:new Date(yesterday.getTime()-86400000).toISOString(),
      updatedAt:new Date(yesterday.getTime()-86400000).toISOString()
    }
  ]
};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','reminder-client');
},fixture);

const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')pageErrors.push(m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

await page.goto(base,{waitUntil:'commit',timeout:10000});
await page.waitForFunction(
  ()=>document.documentElement.classList.contains('diagnostika-dashboard-ready')
    &&window.DiagnostikaClients?.moduleAware
    &&window.DiagnostikaCalendar?.moduleAware
    &&window.DiagnostikaCalendarUI?.open
    &&window.DiagnostikaHomeDashboard,
  null,{timeout:20000}
);

await page.evaluate(()=>window.DiagnostikaHomeDashboard.openClient('reminder-client'));
await page.waitForSelector('#hdHeroReminder:not([hidden])',{timeout:5000});

const before=await page.evaluate(()=>{
  const card=document.getElementById('hdHeroReminder');
  const row=document.querySelector('.hd-client-row[data-id="reminder-client"]');
  return {
    text:card?.innerText||'',
    overdue:card?.classList.contains('is-overdue')||false,
    doneButton:card?.querySelector('.hd-hero-reminder-done')?.textContent||'',
    marker:Boolean(row?.querySelector('.hd-client-status-middle .hd-upcoming-session-dot.is-reminder')),
    persisted:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}').calendarEvents?.find(x=>x.id==='reminder-overdue-1')||null
  };
});

assert(before.text.includes('Ответить клиенту по сообщению'),'Expired reminder text disappeared');
assert(before.text.includes('ПРОСРОЧЕНО'),'Expired reminder is not marked overdue');
assert.equal(before.overdue,true,'Expired reminder card has no overdue state');
assert.equal(before.doneButton.trim(),'✓ Выполнено','Reminder has no completion action');
assert.equal(before.marker,true,'Expired reminder marker disappeared from the client row');
assert.equal(before.persisted?.completedAt,undefined,'Reminder is completed before user action');

const source=page.locator('#hdHeroReminder .hd-hero-reminder-source');
assert.equal((await source.textContent()).trim(),'из календаря','Calendar source link text changed');
await source.click();
await page.waitForSelector('#diagnostikaCalendarOverlay[open]',{timeout:5000});
await page.locator('#diagnostikaCalendarOverlay .cal-close').click();
await page.waitForFunction(()=>!document.getElementById('diagnostikaCalendarOverlay')?.open,null,{timeout:5000});

const snooze=page.locator('#hdHeroReminder .hd-hero-reminder-snooze');
assert.equal((await snooze.textContent()).trim(),'⏰ Отложить','Snooze action is missing');
await snooze.click();
await page.waitForSelector('.hd-reminder-snooze-dialog[open]',{timeout:5000});
await page.locator('.hd-reminder-snooze-date').fill(futureDate);
await page.locator('.hd-reminder-snooze-time').fill('10:30');
await page.locator('.hd-reminder-snooze-save').click();
await page.waitForFunction(()=>!document.querySelector('.hd-reminder-snooze-dialog')?.open,null,{timeout:5000});

await page.waitForFunction(
  ({date,time})=>{
    const event=JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}').calendarEvents?.find(x=>x.id==='reminder-overdue-1');
    return event?.date===date&&event?.time===time&&event?.status==='pending'&&event?.completedAt===null;
  },
  {date:futureDate,time:'10:30'},
  {timeout:5000}
);

const snoozed=await page.evaluate(()=>({
  visible:!document.getElementById('hdHeroReminder')?.hidden,
  overdue:document.getElementById('hdHeroReminder')?.classList.contains('is-overdue')||false,
  doneBackground:getComputedStyle(document.querySelector('.hd-hero-reminder-done')).backgroundImage
}));
assert.equal(snoozed.visible,true,'Snoozed reminder disappeared');
assert.equal(snoozed.overdue,false,'Snoozed reminder still looks overdue');
assert(/45, 154, 97|43, 185, 119/.test(snoozed.doneBackground),'Completed action is not green');

await page.locator('#hdHeroReminder .hd-hero-reminder-done').click();
await page.waitForFunction(()=>document.getElementById('hdHeroReminder')?.hidden===true,null,{timeout:5000});
await page.waitForFunction(
  ()=>!document.querySelector('.hd-client-row[data-id="reminder-client"] .hd-client-status-middle .hd-upcoming-session-dot.is-reminder'),
  null,{timeout:5000}
);

const after=await page.evaluate(()=>{
  const event=JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}').calendarEvents?.find(x=>x.id==='reminder-overdue-1')||null;
  return {event};
});
assert.equal(after.event?.status,'completed','Completed reminder status was not persisted');
assert(after.event?.completedAt,'Completed reminder timestamp was not persisted');

await page.reload({waitUntil:'commit',timeout:10000});
await page.waitForFunction(
  ()=>document.documentElement.classList.contains('diagnostika-dashboard-ready')
    &&window.DiagnostikaHomeDashboard,
  null,{timeout:20000}
);
await page.evaluate(()=>window.DiagnostikaHomeDashboard.openClient('reminder-client'));
await page.waitForTimeout(150);

const reloaded=await page.evaluate(()=>({
  hidden:document.getElementById('hdHeroReminder')?.hidden,
  marker:Boolean(document.querySelector('.hd-client-row[data-id="reminder-client"] .hd-client-status-middle .hd-upcoming-session-dot.is-reminder'))
}));
assert.equal(reloaded.hidden,true,'Completed reminder returned after reload');
assert.equal(reloaded.marker,false,'Completed reminder marker returned after reload');

const serious=pageErrors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('DASHBOARD_REMINDER_PERSISTENCE_AUDIT_OK');
await context.close();
await browser.close();
