import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const fixture={version:4,calendarEvents:[{
  id:'cal-overdue-1',
  title:'Диагностика',
  type:'Диагностика',
  date:'2000-01-01',
  time:'19:00',
  clientId:'overdue-client',
  requestId:'overdue-r1',
  sessionId:'overdue-session-1',
  plannedSessionSkeleton:true
},{
  id:'cal-overdue-2',
  title:'Диагностика',
  type:'Диагностика',
  date:'2000-01-02',
  time:'18:00',
  clientId:'overdue-client',
  requestId:'overdue-r1',
  sessionId:'overdue-session-2',
  plannedSessionSkeleton:true
}],clients:[{
  id:'overdue-client',
  name:'Просроченный клиент',
  currentRequestId:'overdue-r1',
  lastDiagnosisRequestId:'overdue-r1',
  requests:[{id:'overdue-r1',title:'Текущий запрос',status:'active',situations:[]}],
  sessions:[{
    id:'overdue-session-1',
    date:'2000-01-01',
    scheduledTime:'19:00',
    requestId:'overdue-r1',
    notes:'',
    plan:'',
    status:'planned',
    planned:true,
    calendarEventId:'cal-overdue-1',
    appointmentType:'Диагностика',
    calendarTitle:'Диагностика'
  },{
    id:'overdue-session-2',
    date:'2000-01-02',
    scheduledTime:'18:00',
    requestId:'overdue-r1',
    notes:'',
    plan:'',
    status:'planned',
    planned:true,
    calendarEventId:'cal-overdue-2',
    appointmentType:'Диагностика',
    calendarTitle:'Диагностика'
  }]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','overdue-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?overdue-session=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready')
  &&window.DiagnostikaSessions?.moduleAware===true
  &&window.DiagnostikaCalendar?.moduleAware===true
  &&window.DiagnostikaDashboardSessions
  &&window.DiagnostikaHomeDashboard?.openClient,null,{timeout:20000});
await page.evaluate(()=>{
  window.DiagnostikaHomeDashboard.openClient('overdue-client');
  window.DiagnostikaDashboardSessions.refresh();
});

const card=page.locator('.hd-session-card[data-session-id="overdue-session-1"]');
const deleteCard=page.locator('.hd-session-card[data-session-id="overdue-session-2"]');
const notice=page.locator('#hdSessionOverdueNotice');
await card.waitFor({state:'visible',timeout:8000});
await deleteCard.waitFor({state:'visible',timeout:8000});
await notice.waitFor({state:'visible',timeout:5000});

assert.equal(await notice.evaluate(el=>el.parentElement?.id),'hdClientAlertSlot','Overdue notice is not in the top client alert area');
assert.equal(await card.evaluate(el=>el.classList.contains('is-overdue')),true);
assert.equal(await card.locator('.hd-session-overdue-badge').textContent(),'⚠ ПРОСРОЧЕНО');
assert.match(await card.locator('.hd-session-top strong').textContent(),/^Диагностика №\d+$/);
assert.equal(await card.locator('.hd-session-complete-btn').isVisible(),true);
assert.equal(await card.locator('.hd-session-reschedule-btn').isVisible(),true);
assert.equal(await card.locator('.hd-session-delete-planned-btn').isVisible(),true);
assert.match(await notice.innerText(),/Просроченная запись/);
assert.match(await notice.innerText(),/Диагностика/);

await page.evaluate(()=>{window.AppDialog.confirm=async()=>true;});
await deleteCard.locator('.hd-session-delete-planned-btn').click();
await page.waitForFunction(()=>!window.DiagnostikaSessions.get('overdue-session-2')&&!window.DiagnostikaCalendar.get('cal-overdue-2'));

assert.equal(await page.locator('.hd-session-card[data-session-id="overdue-session-2"]').count(),0,'Deleted diagnosis card still exists');

await card.locator('.hd-session-complete-btn').click();
await page.waitForFunction(()=>{
  const s=window.DiagnostikaSessions.get('overdue-session-1');
  return s&&s.planned===false&&s.status==='completed';
});

const state=await page.evaluate(()=>({
  session:window.DiagnostikaSessions.get('overdue-session-1'),
  event:window.DiagnostikaCalendar.get('cal-overdue-1'),
  noticeHidden:document.querySelector('#hdSessionOverdueNotice')?.hidden,
  summary:[...document.querySelectorAll('#hdSummary .hd-summary-box')].map(box=>({
    label:box.querySelector('.hd-summary-label')?.textContent,
    value:box.querySelector('.hd-summary-value')?.textContent
  }))
}));
assert.equal(state.session.planned,false);
assert.equal(state.session.status,'completed');
assert.equal(state.event.sessionCompleted,true);
assert.equal(state.event.status,'completed');
assert.equal(state.event.plannedSessionSkeleton,false);
assert.equal(state.noticeHidden,true);
assert.equal(state.summary.find(x=>x.label?.trim()==='Сессии')?.value,'1');
assert.match(await page.locator('.hd-session-card[data-session-id="overdue-session-1"] .hd-session-top strong').textContent(),/^Диагностика №\d+$/);
assert.equal(state.summary.find(x=>x.label?.trim()==='Последняя сессия')?.value,'01.01.2000');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');
console.log('SESSION_OVERDUE_ACTIONS_OK');
await browser.close();
