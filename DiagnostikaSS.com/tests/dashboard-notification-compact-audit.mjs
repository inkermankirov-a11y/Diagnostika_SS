import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const now=new Date();
const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,12,0,0,0);
const date=`${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;

const fixture={version:4,clients:[{
  id:'compact-client',
  name:'Марина Сергеевна Черных',
  currentRequestId:'compact-r1',
  lastDiagnosisRequestId:'compact-r1',
  requests:[{id:'compact-r1',title:'Отсутствие интереса и удовольствия от жизни',status:'active',situations:[]}],
  sessions:[{
    id:'compact-diagnosis-1',
    date,
    scheduledTime:'19:00',
    requestId:'compact-r1',
    plan:'',
    notes:'',
    planned:true,
    status:'planned',
    appointmentType:'Диагностика',
    calendarTitle:'Диагностика'
  }],
  quickNotes:[],questionnaires:[]
}],calendarEvents:[{
  id:'compact-reminder-1',
  clientId:'compact-client',
  type:'Напоминание',
  title:'Напоминание',
  date,
  time:'20:00',
  note:'Напомнить, что нужно записаться на первую сессию.',
  status:'planned'
},{
  id:'compact-reminder-2',
  clientId:'compact-client',
  type:'Напоминание',
  title:'Напоминание',
  date,
  time:'21:00',
  note:'Второе напоминание.',
  status:'planned'
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','compact-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});

await page.goto('http://127.0.0.1:8000/index.html?notification-compact=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready')&&window.DiagnostikaHomeDashboard,null,{timeout:20000});
await page.evaluate(()=>window.DiagnostikaHomeDashboard.openClient('compact-client'));
await page.locator('#hdHeroReminder:not([hidden]) .hd-notification-card.is-diagnosis').waitFor({state:'visible',timeout:5000});

const state=await page.evaluate(()=>{
  const card=document.querySelector('#hdHeroReminder .hd-notification-card.is-diagnosis');
  const badge=card?.querySelector('.hd-notification-badge');
  const actions=[...card?.querySelectorAll('.hd-notification-actions button')||[]];
  const rects=actions.map(b=>b.getBoundingClientRect());
  const pseudo=badge?getComputedStyle(badge,'::before'):null;
  return{
    text:card?.innerText||'',
    height:card?.getBoundingClientRect().height||0,
    badge:badge?.textContent?.trim()||'',
    sourceCount:card?.querySelectorAll('.hd-hero-reminder-source').length||0,
    buttons:actions.map(x=>x.textContent.trim()),
    labels:actions.map(x=>x.getAttribute('aria-label')||''),
    titles:actions.map(x=>x.getAttribute('title')||''),
    svgCount:actions.map(x=>x.querySelectorAll('svg').length),
    tops:rects.map(r=>r.top),
    widths:rects.map(r=>r.width),
    heights:rects.map(r=>r.height),
    dotContent:pseudo?.content||''
  };
});

assert.equal(state.badge,'ДИАГНОСТИКА');
assert.equal(state.sourceCount,0);
assert.deepEqual(state.buttons,['','','']);
assert.deepEqual(state.labels,['Проведено','Перенести','Удалить']);
assert.deepEqual(state.titles,['Проведено','Перенести','Удалить']);
assert.deepEqual(state.svgCount,[1,1,1]);
assert(Math.max(...state.tops)-Math.min(...state.tops)<=1,'Diagnosis action buttons are not on one row');
assert(Math.max(...state.heights)-Math.min(...state.heights)<=1,'Diagnosis action buttons have different heights');
assert(Math.max(...state.widths)-Math.min(...state.widths)<=1,'Diagnosis action buttons have different widths');
assert(state.widths.every((w,i)=>Math.abs(w-state.heights[i])<=1),`Diagnosis action buttons are not square: ${state.widths.join(',')} x ${state.heights.join(',')}`);
assert(state.widths.every(w=>w<=30),`Diagnosis action buttons are too large: ${state.widths.join(',')}`);
assert(state.height<150,`Diagnosis card is not compact: ${state.height}px`);
assert(state.dotContent==='none'||state.dotContent==='normal'||state.dotContent==='""','Decorative badge dot still renders');
assert(!state.text.includes('из календаря'),'Calendar source text is still visible');

const tabs=page.locator('#hdHeroReminder .hd-notification-type-tab');
assert.equal(await tabs.count(),2,'Expected one tab per notification type');
const reminderTab=page.locator('#hdHeroReminder .hd-notification-type-tab.is-reminder');
assert.equal(await reminderTab.locator('.hd-notification-type-count').innerText(),'2','Two reminders should share one violet tab with count 2');
assert.equal(await page.locator('#hdHeroReminder .hd-notification-card').count(),1,'Carousel should render exactly one full notification card');
await reminderTab.click();
await page.locator('#hdHeroReminder .hd-notification-card.is-reminder .hd-hero-reminder-actions').waitFor({state:'visible',timeout:5000});
const reminderState=await page.evaluate(()=>{
  const card=document.querySelector('#hdHeroReminder .hd-notification-card.is-reminder');
  const actions=[...card?.querySelectorAll('.hd-hero-reminder-actions button')||[]];
  const rects=actions.map(b=>b.getBoundingClientRect());
  return{
    buttons:actions.map(x=>x.textContent.trim()),
    labels:actions.map(x=>x.getAttribute('aria-label')||''),
    titles:actions.map(x=>x.getAttribute('title')||''),
    svgCount:actions.map(x=>x.querySelectorAll('svg').length),
    tops:rects.map(r=>r.top),
    widths:rects.map(r=>r.width),
    heights:rects.map(r=>r.height)
  };
});
assert.deepEqual(reminderState.buttons,['','']);
assert.deepEqual(reminderState.labels,['Перенести','Выполнено']);
assert.deepEqual(reminderState.titles,['Перенести','Выполнено']);
assert.deepEqual(reminderState.svgCount,[1,1]);
assert(Math.max(...reminderState.tops)-Math.min(...reminderState.tops)<=1,'Reminder action buttons are not on one row');
assert(Math.max(...reminderState.widths)-Math.min(...reminderState.widths)<=1,'Reminder action buttons have different widths');
assert(Math.max(...reminderState.heights)-Math.min(...reminderState.heights)<=1,'Reminder action buttons have different heights');
assert(reminderState.widths.every((w,i)=>Math.abs(w-reminderState.heights[i])<=1),`Reminder action buttons are not square: ${reminderState.widths.join(',')} x ${reminderState.heights.join(',')}`);
assert(reminderState.widths.every(w=>w<=30),`Reminder action buttons are too large: ${reminderState.widths.join(',')}`);
assert.equal(await page.locator('#hdHeroReminder .hd-notification-group-pos').innerText(),'1 / 2','Reminder pager is missing');
await page.locator('#hdHeroReminder .hd-notification-group-next').click();
assert.match(await page.locator('#hdHeroReminder .hd-notification-card.is-reminder').innerText(),/Второе напоминание/,'Reminder pager did not switch within the same type');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('DASHBOARD_NOTIFICATION_COMPACT_OK',JSON.stringify({diagnosis:state,reminder:reminderState}));
await browser.close();
