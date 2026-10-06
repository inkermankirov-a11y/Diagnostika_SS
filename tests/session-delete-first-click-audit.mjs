import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const fixture={version:4,calendarEvents:[{
  id:'delete-cal-1',
  title:'Диагностика',
  type:'Диагностика',
  date:'2099-10-06',
  time:'19:00',
  clientId:'delete-client',
  requestId:'delete-r1',
  sessionId:'delete-planned-1',
  plannedSessionSkeleton:true
}],clients:[{
  id:'delete-client',
  name:'Удаление сессии',
  currentRequestId:'delete-r1',
  lastDiagnosisRequestId:'delete-r1',
  requests:[{id:'delete-r1',title:'Текущий запрос',status:'active',situations:[]}],
  sessions:[{
    id:'delete-planned-1',
    date:'2099-10-06',
    scheduledTime:'19:00',
    requestId:'delete-r1',
    notes:'',
    plan:'',
    status:'planned',
    planned:true,
    calendarEventId:'delete-cal-1',
    appointmentType:'Диагностика',
    calendarTitle:'Диагностика'
  }]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1500,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','delete-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?session-delete-first-click=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready')
  &&window.DiagnostikaSessions?.moduleAware===true
  &&window.DiagnostikaCalendar?.moduleAware===true
  &&window.DiagnostikaDashboardSessions?.deletePlanned
  &&window.AppDialog?.confirm,null,{timeout:20000});

await page.evaluate(()=>window.DiagnostikaHomeDashboard.openClient('delete-client'));
const card=page.locator('.hd-session-card[data-session-id="delete-planned-1"]');
await card.waitFor({state:'visible',timeout:8000});

await page.evaluate(()=>{
  window.__deleteConfirmCount=0;
  const original=window.AppDialog.confirm;
  window.AppDialog.confirm=async(...args)=>{
    window.__deleteConfirmCount++;
    return original(...args);
  };
});

await card.locator('.hd-session-delete-planned-btn').click();
const confirm=page.locator('dialog.app-message-dialog');
await confirm.waitFor({state:'visible',timeout:5000});
assert.equal(await page.evaluate(()=>window.__deleteConfirmCount),1,'planned session delete asked more than once');
await confirm.locator('.app-message-yes').click();

await page.waitForFunction(()=>!window.DiagnostikaSessions.get('delete-planned-1'));
await page.waitForFunction(()=>!window.DiagnostikaCalendar.get('delete-cal-1'));
await page.waitForFunction(()=>!document.querySelector('.hd-session-card[data-session-id="delete-planned-1"]'));

const after=await page.evaluate(()=>({
  confirms:window.__deleteConfirmCount,
  session:window.DiagnostikaSessions.get('delete-planned-1'),
  event:window.DiagnostikaCalendar.get('delete-cal-1'),
  count:window.DiagnostikaSessions.list().length
}));
assert.equal(after.confirms,1);
assert.equal(after.session,null);
assert.equal(after.event,null);
assert.equal(after.count,0);

await page.reload({waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready')&&window.DiagnostikaSessions?.moduleAware===true,null,{timeout:20000});
assert.equal(await page.evaluate(()=>window.DiagnostikaSessions.get('delete-planned-1')),null,'deleted session returned after reload');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');
console.log('SESSION_DELETE_FIRST_CLICK_OK');
await browser.close();
