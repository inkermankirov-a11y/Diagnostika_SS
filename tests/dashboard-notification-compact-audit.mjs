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
}],calendarEvents:[]};

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
    tops:rects.map(r=>r.top),
    heights:rects.map(r=>r.height),
    dotContent:pseudo?.content||''
  };
});

assert.equal(state.badge,'ДИАГНОСТИКА');
assert.equal(state.sourceCount,0);
assert.deepEqual(state.buttons,['✓ Проведена','📅 Перенести','Удалить']);
assert(Math.max(...state.tops)-Math.min(...state.tops)<=1,'Diagnosis action buttons are not on one row');
assert(Math.max(...state.heights)-Math.min(...state.heights)<=1,'Diagnosis action buttons have different heights');
assert(state.height<150,`Diagnosis card is not compact: ${state.height}px`);
assert(state.dotContent==='none'||state.dotContent==='normal'||state.dotContent==='""','Decorative badge dot still renders');
assert(!state.text.includes('из календаря'),'Calendar source text is still visible');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('DASHBOARD_NOTIFICATION_COMPACT_OK',JSON.stringify(state));
await browser.close();
