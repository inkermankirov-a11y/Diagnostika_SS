// validation: notification bookmark tabs v2
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
  id:'cal-future-2',
  title:'Диагностика',
  type:'Диагностика',
  date:'2099-01-02',
  time:'18:00',
  clientId:'overdue-client',
  requestId:'overdue-r1',
  sessionId:'future-session-2',
  plannedSessionSkeleton:true
},{
  id:'reminder-future-1',
  title:'Напоминание',
  type:'Напоминание',
  date:'2099-01-03',
  time:'15:00',
  note:'Спросить про самочувствие',
  clientId:'overdue-client'
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
    id:'future-session-2',
    date:'2099-01-02',
    scheduledTime:'18:00',
    requestId:'overdue-r1',
    notes:'',
    plan:'',
    status:'planned',
    planned:true,
    calendarEventId:'cal-future-2',
    appointmentType:'Диагностика',
    calendarTitle:'Диагностика'
  }]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1500,height:1000}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','overdue-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?notification-deck=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready')
  &&window.DiagnostikaSessions?.moduleAware===true
  &&window.DiagnostikaCalendar?.moduleAware===true
  &&window.DiagnostikaDashboardSessions?.completePlanned
  &&window.DiagnostikaHomeDashboard?.openClient,null,{timeout:20000});

await page.evaluate(()=>window.DiagnostikaHomeDashboard.openClient('overdue-client'));

const deck=page.locator('#hdHeroReminder');
await deck.waitFor({state:'visible',timeout:8000});
await page.waitForFunction(()=>document.querySelectorAll('#hdHeroReminder .hd-notification-card').length===1
  &&document.querySelectorAll('#hdHeroReminder .hd-notification-tab').length===2);

assert.equal(await page.locator('#hdClientAlertSlot').innerText(),'','Standalone client alert area should be empty');
assert.equal(await page.locator('#hdSessionOverdueNotice').count(),0,'Legacy overdue notice still exists');

const initial=await page.evaluate(()=>({
  count:document.querySelectorAll('#hdHeroReminder .hd-notification-card').length,
  activeKey:document.querySelector('#hdHeroReminder .hd-notification-card.is-active')?.dataset.notificationKey||'',
  activeText:document.querySelector('#hdHeroReminder .hd-notification-card.is-active')?.innerText||'',
  stackCount:document.querySelectorAll('#hdHeroReminder .hd-notification-stack-count').length,
  tabs:[...document.querySelectorAll('#hdHeroReminder .hd-notification-tab')].map(tab=>({
    kind:tab.dataset.kind,
    count:tab.dataset.count,
    selected:tab.getAttribute('aria-selected')
  }))
}));
assert.equal(initial.count,1,'Notification rail should render only one full card');
assert.equal(initial.activeKey,'session:overdue-session-1','Oldest overdue item should be the main notification');
assert.match(initial.activeText,/Диагностика №1/);
assert.match(initial.activeText,/ПРОСРОЧЕНО/);
assert.equal(initial.stackCount,0,'Legacy stack counter is still rendered');
assert.deepEqual(initial.tabs.map(x=>x.kind),['reminder','diagnosis']);
assert.equal(initial.tabs.find(x=>x.kind==='diagnosis')?.count,'2');
assert.equal(initial.tabs.find(x=>x.kind==='reminder')?.count,'1');
assert.equal(initial.tabs.find(x=>x.kind==='diagnosis')?.selected,'true');
assert.equal(await page.locator('#hdHeroReminder .hd-notification-page-count').textContent(),'1/2');

await page.locator('#hdHeroReminder .hd-notification-page-btn[aria-label="Следующее уведомление"]').click();
await page.waitForFunction(()=>document.querySelector('#hdHeroReminder .hd-notification-card.is-active')?.dataset.notificationKey==='session:future-session-2');

const futureActive=page.locator('#hdHeroReminder .hd-notification-card.is-active');
assert.equal(await futureActive.evaluate(el=>el.classList.contains('is-diagnosis')),true);
assert.equal(await futureActive.evaluate(el=>el.classList.contains('is-overdue')),false);
const futureStyle=await futureActive.evaluate(el=>({
  bg:getComputedStyle(el).backgroundImage,
  animation:getComputedStyle(el).animationName
}));
assert(/255, 253, 241|255, 244, 189/.test(futureStyle.bg)||futureStyle.animation.includes('hdDiagnosisNoticePulse'),'Future diagnosis is not using the yellow calendar theme');

assert.equal(await futureActive.locator('.hd-hero-reminder-source').count(),0,'Diagnosis card still renders calendar source link');
assert.equal((await futureActive.locator('.hd-notification-complete').textContent()).trim(),'');
assert.equal(await futureActive.locator('.hd-notification-complete').getAttribute('aria-label'),'Проведено');
assert.equal((await futureActive.locator('.hd-notification-move').textContent()).trim(),'');
assert.equal(await futureActive.locator('.hd-notification-move').getAttribute('aria-label'),'Перенести');
assert.equal((await futureActive.locator('.hd-notification-delete').textContent()).trim(),'');
assert.equal(await futureActive.locator('.hd-notification-delete').getAttribute('aria-label'),'Удалить');
const compactDiagnosis=await futureActive.evaluate(card=>{
  const buttons=[...card.querySelectorAll('.hd-notification-actions button')];
  const rects=buttons.map(button=>button.getBoundingClientRect());
  const badge=card.querySelector('.hd-notification-badge');
  const dot=getComputedStyle(badge,'::before');
  return {
    height:card.getBoundingClientRect().height,
    tops:rects.map(r=>r.top),
    bottoms:rects.map(r=>r.bottom),
    widths:rects.map(r=>r.width),
    dotWidth:dot.width,
    dotHeight:dot.height
  };
});
assert(compactDiagnosis.height<180,'Diagnosis notification card is not compact');
assert(Math.max(...compactDiagnosis.tops)-Math.min(...compactDiagnosis.tops)<=1,'Diagnosis actions are not on one row');
assert(Math.max(...compactDiagnosis.bottoms)-Math.min(...compactDiagnosis.bottoms)<=1,'Diagnosis action buttons have different heights');
assert(compactDiagnosis.widths.every(width=>width<=30),'Diagnosis action button is not compact');
assert.equal(compactDiagnosis.dotWidth,'5px','Planned badge dot width is wrong');
assert.equal(compactDiagnosis.dotHeight,'5px','Planned badge dot height is wrong');

await page.locator('#hdHeroReminder .hd-notification-tab.is-reminder').click();
await page.waitForFunction(()=>document.querySelector('#hdHeroReminder .hd-notification-card.is-active')?.dataset.notificationKey==='reminder:reminder-future-1');
assert.match(await page.locator('#hdHeroReminder .hd-notification-card.is-active').innerText(),/Спросить про самочувствие/);
assert.equal(await page.locator('#hdHeroReminder .hd-notification-card.is-active').evaluate(el=>el.classList.contains('is-reminder')),true);
assert.equal(await page.locator('#hdHeroReminder .hd-notification-card.is-active .hd-hero-reminder-source').count(),0,'Reminder card still renders calendar source link');
assert.equal((await page.locator('#hdHeroReminder .hd-notification-card.is-active .hd-hero-reminder-snooze').textContent()).trim(),'');
assert.equal(await page.locator('#hdHeroReminder .hd-notification-card.is-active .hd-hero-reminder-snooze').getAttribute('aria-label'),'Перенести');

await page.evaluate(()=>{
  window.DiagnostikaSessions.create({
    id:'legacy-reschedule-session',
    date:'2000-01-02',
    scheduledTime:'10:00',
    requestId:'overdue-r1',
    notes:'',
    plan:'',
    status:'planned',
    planned:true,
    appointmentType:'Диагностика',
    calendarTitle:'Диагностика'
  },{clientId:'overdue-client',requestId:'overdue-r1',source:'reschedule-regression-fixture',render:false});
  window.DiagnostikaCalendar.create({
    id:'legacy-reschedule-event',
    title:'Диагностика',
    type:'Диагностика',
    date:'2000-01-02',
    time:'10:00',
    clientId:'overdue-client',
    requestId:'overdue-r1',
    sessionId:'legacy-reschedule-session',
    plannedSessionSkeleton:true
  },{source:'reschedule-regression-fixture'});
  window.DiagnostikaDashboardSessions.refresh();
});
await page.waitForFunction(()=>document.querySelector('.hd-session-card[data-session-id="legacy-reschedule-session"]'));

const beforeReschedule=await page.evaluate(()=>({
  sessions:window.DiagnostikaSessions.list('overdue-client').map(s=>({id:s.id,date:s.date,scheduledTime:s.scheduledTime,calendarEventId:s.calendarEventId||''})),
  events:window.DiagnostikaCalendar.list().map(e=>({id:e.id,sessionId:e.sessionId||'',date:e.date,time:e.time}))
}));
assert.equal(beforeReschedule.sessions.filter(s=>s.id==='legacy-reschedule-session').length,1,'Regression session is duplicated before reschedule');
assert.equal(beforeReschedule.sessions.find(s=>s.id==='legacy-reschedule-session')?.calendarEventId,'','Regression fixture unexpectedly has a forward calendar link');

const overdueListCard=page.locator('.hd-session-card[data-session-id="legacy-reschedule-session"]');
await overdueListCard.locator('.hd-session-reschedule-btn').click();
const calendarDialog=page.locator('#diagnostikaCalendarOverlay');
await calendarDialog.waitFor({state:'visible',timeout:5000});
assert.equal(await calendarDialog.locator('.cal-save').innerText(),'Сохранить изменения','Reschedule did not open the existing calendar event in edit mode');
await calendarDialog.locator('.cal-date').fill('2099-01-05');
await calendarDialog.locator('.cal-time').fill('20:30');
await calendarDialog.locator('.cal-save').click();

await page.waitForFunction(()=>{
  const rows=window.DiagnostikaSessions.list('overdue-client');
  const s=rows.find(x=>x.id==='legacy-reschedule-session');
  return s?.date==='2099-01-05'&&s?.scheduledTime==='20:30'&&s?.calendarEventId==='legacy-reschedule-event';
},null,{timeout:5000});

const afterReschedule=await page.evaluate(()=>({
  sessions:window.DiagnostikaSessions.list('overdue-client').map(s=>({id:s.id,date:s.date,scheduledTime:s.scheduledTime,calendarEventId:s.calendarEventId||''})),
  events:window.DiagnostikaCalendar.list().map(e=>({id:e.id,sessionId:e.sessionId||'',date:e.date,time:e.time}))
}));
assert.equal(afterReschedule.sessions.length,beforeReschedule.sessions.length,'Reschedule created a new session card');
assert.equal(afterReschedule.sessions.filter(s=>s.id==='legacy-reschedule-session').length,1,'Original session card was duplicated');
assert.equal(afterReschedule.events.length,beforeReschedule.events.length,'Reschedule created a new calendar event');
assert.equal(afterReschedule.events.find(e=>e.id==='legacy-reschedule-event')?.date,'2099-01-05');
assert.equal(afterReschedule.events.find(e=>e.id==='legacy-reschedule-event')?.time,'20:30');
assert.equal(afterReschedule.events.find(e=>e.id==='legacy-reschedule-event')?.sessionId,'legacy-reschedule-session');

await calendarDialog.locator('.cal-close').click();
await calendarDialog.waitFor({state:'hidden',timeout:5000});
await page.evaluate(()=>{
  window.DiagnostikaCalendar.remove('legacy-reschedule-event',{source:'reschedule-regression-cleanup'});
  window.DiagnostikaSessions.remove('legacy-reschedule-session',{clientId:'overdue-client',source:'reschedule-regression-cleanup',render:false});
  window.DiagnostikaDashboardSessions.refresh();
});
await page.waitForFunction(()=>!window.DiagnostikaSessions.get('legacy-reschedule-session')&&!window.DiagnostikaCalendar.get('legacy-reschedule-event'));

await page.locator('#hdHeroReminder .hd-notification-tab.is-diagnosis').click();
await page.waitForFunction(()=>document.querySelector('#hdHeroReminder .hd-notification-card.is-active')?.dataset.notificationKey==='session:overdue-session-1');
await page.locator('#hdHeroReminder .hd-notification-page-btn[aria-label="Следующее уведомление"]').click();
await page.waitForFunction(()=>document.querySelector('#hdHeroReminder .hd-notification-card.is-active')?.dataset.notificationKey==='session:future-session-2');

await page.evaluate(()=>{window.AppDialog.confirm=async()=>true;});
await page.locator('#hdHeroReminder .hd-notification-card.is-active .hd-notification-delete').click();
await page.waitForFunction(()=>!window.DiagnostikaSessions.get('future-session-2')&&!window.DiagnostikaCalendar.get('cal-future-2'));
assert.equal(await page.locator('#hdHeroReminder .hd-notification-card[data-notification-key="session:future-session-2"]').count(),0,'Deleted diagnosis remains in notification deck');

await page.waitForFunction(()=>document.querySelector('#hdHeroReminder .hd-notification-card.is-active')?.dataset.notificationKey==='session:overdue-session-1');
await page.locator('#hdHeroReminder .hd-notification-card.is-active .hd-notification-complete').click();

await page.waitForFunction(()=>{
  const s=window.DiagnostikaSessions.get('overdue-session-1');
  return s&&s.planned===false&&s.status==='completed';
});

const state=await page.evaluate(()=>({
  session:window.DiagnostikaSessions.get('overdue-session-1'),
  event:window.DiagnostikaCalendar.get('cal-overdue-1'),
  deckKeys:[...document.querySelectorAll('#hdHeroReminder .hd-notification-card')].map(el=>el.dataset.notificationKey),
  listCardClass:document.querySelector('.hd-session-card[data-session-id="overdue-session-1"]')?.className||'',
  listTitle:document.querySelector('.hd-session-card[data-session-id="overdue-session-1"] .hd-session-top strong')?.textContent||'',
  summary:[...document.querySelectorAll('#hdSummary .hd-summary-box')].map(box=>({
    label:box.querySelector('.hd-summary-label')?.textContent?.trim()||'',
    value:box.querySelector('.hd-summary-value')?.textContent?.trim()||''
  }))
}));
assert.equal(state.session.planned,false);
assert.equal(state.session.status,'completed');
assert.equal(state.event.sessionCompleted,true);
assert.equal(state.event.status,'completed');
assert(!state.deckKeys.includes('session:overdue-session-1'),'Completed diagnosis remains in notification deck');
assert.match(state.listCardClass,/is-diagnosis/,'Completed diagnosis lost its yellow diagnosis identity');
assert.match(state.listTitle,/^Диагностика №1$/);
assert.equal(state.summary.find(x=>x.label==='Сессии')?.value,'0','Conducted diagnosis incorrectly increments session summary');
assert.equal(state.summary.find(x=>x.label==='Последняя сессия')?.value,'—','Diagnosis incorrectly became the last therapy session');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('SESSION_NOTIFICATION_DECK_OK');
await browser.close();
