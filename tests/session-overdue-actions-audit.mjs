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
await page.waitForFunction(()=>document.querySelectorAll('#hdHeroReminder .hd-notification-card').length===3);

assert.equal(await page.locator('#hdClientAlertSlot').innerText(),'','Standalone client alert area should be empty');
assert.equal(await page.locator('#hdSessionOverdueNotice').count(),0,'Legacy overdue notice still exists');

const initial=await page.evaluate(()=>({
  count:document.querySelectorAll('#hdHeroReminder .hd-notification-card').length,
  activeKey:document.querySelector('#hdHeroReminder .hd-notification-card.is-active')?.dataset.notificationKey||'',
  activeText:document.querySelector('#hdHeroReminder .hd-notification-card.is-active')?.innerText||'',
  countBadge:document.querySelector('#hdHeroReminder .hd-notification-stack-count')?.textContent||'',
  fan:document.querySelector('#hdHeroReminder')?.classList.contains('is-fanned')||false
}));
assert.equal(initial.count,3);
assert.equal(initial.activeKey,'session:overdue-session-1','Oldest overdue item should be the main notification');
assert.match(initial.activeText,/Диагностика №1/);
assert.match(initial.activeText,/ПРОСРОЧЕНО/);
assert.equal(initial.countBadge,'3');
assert.equal(initial.fan,false);

await page.locator('#hdHeroReminder .hd-notification-stack-count').click();
assert.equal(await deck.evaluate(el=>el.classList.contains('is-fanned')),true,'Notification stack did not fan out');

const futureTab=page.locator('#hdHeroReminder .hd-notification-card[data-notification-key="session:future-session-2"]');
await futureTab.click();
await page.waitForFunction(()=>document.querySelector('#hdHeroReminder .hd-notification-card.is-active')?.dataset.notificationKey==='session:future-session-2');
assert.equal(await deck.evaluate(el=>el.classList.contains('is-fanned')),false,'Deck did not collapse after choosing a notification');

const futureActive=page.locator('#hdHeroReminder .hd-notification-card.is-active');
assert.equal(await futureActive.evaluate(el=>el.classList.contains('is-diagnosis')),true);
assert.equal(await futureActive.evaluate(el=>el.classList.contains('is-overdue')),false);
const futureStyle=await futureActive.evaluate(el=>({
  bg:getComputedStyle(el).backgroundImage,
  animation:getComputedStyle(el).animationName
}));
assert(/255, 253, 241|255, 244, 189/.test(futureStyle.bg)||futureStyle.animation.includes('hdDiagnosisNoticePulse'),'Future diagnosis is not using the yellow calendar theme');

assert.equal(await futureActive.locator('.hd-hero-reminder-source').count(),0,'Diagnosis card still renders calendar source link');
assert.equal((await futureActive.locator('.hd-notification-complete').textContent()).trim(),'✓ Проведена');
assert.equal((await futureActive.locator('.hd-notification-move').textContent()).trim(),'📅 Перенести');
assert.equal((await futureActive.locator('.hd-notification-delete').textContent()).trim(),'Удалить');
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
assert(compactDiagnosis.widths.every(width=>width>45),'Diagnosis action button collapsed');
assert.equal(compactDiagnosis.dotWidth,'5px','Planned badge dot width is wrong');
assert.equal(compactDiagnosis.dotHeight,'5px','Planned badge dot height is wrong');

await page.locator('#hdHeroReminder .hd-notification-stack-count').click();
await page.locator('#hdHeroReminder .hd-notification-card[data-notification-key="reminder:reminder-future-1"]').click();
await page.waitForFunction(()=>document.querySelector('#hdHeroReminder .hd-notification-card.is-active')?.dataset.notificationKey==='reminder:reminder-future-1');
assert.match(await page.locator('#hdHeroReminder .hd-notification-card.is-active').innerText(),/Спросить про самочувствие/);
assert.equal(await page.locator('#hdHeroReminder .hd-notification-card.is-active').evaluate(el=>el.classList.contains('is-reminder')),true);
assert.equal(await page.locator('#hdHeroReminder .hd-notification-card.is-active .hd-hero-reminder-source').count(),0,'Reminder card still renders calendar source link');
assert.equal((await page.locator('#hdHeroReminder .hd-notification-card.is-active .hd-hero-reminder-snooze').textContent()).trim(),'📅 Перенести');

await page.locator('#hdHeroReminder .hd-notification-stack-count').click();
await futureTab.click();
await page.waitForFunction(()=>document.querySelector('#hdHeroReminder .hd-notification-card.is-active')?.dataset.notificationKey==='session:future-session-2');

await page.evaluate(()=>{window.AppDialog.confirm=async()=>true;});
await page.locator('#hdHeroReminder .hd-notification-card.is-active .hd-notification-delete').click();
await page.waitForFunction(()=>!window.DiagnostikaSessions.get('future-session-2')&&!window.DiagnostikaCalendar.get('cal-future-2'));
assert.equal(await page.locator('#hdHeroReminder .hd-notification-card[data-notification-key="session:future-session-2"]').count(),0,'Deleted diagnosis remains in notification deck');

await page.locator('#hdHeroReminder .hd-notification-stack-count').click();
const overdueTarget=page.locator('#hdHeroReminder .hd-notification-card[data-notification-key="session:overdue-session-1"]');
if(await overdueTarget.evaluate(el=>el.classList.contains('is-active'))){
  await page.locator('#hdHeroReminder .hd-notification-stack-count').click();
}else{
  await overdueTarget.click();
}
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
