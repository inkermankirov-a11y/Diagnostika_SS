import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const fixture={version:4,calendarEvents:[{
  id:'diag-beacon-1',
  title:'Диагностика',
  type:'Диагностика',
  date:'2099-01-02',
  time:'19:00',
  clientId:'diag-beacon-client',
  requestId:'diag-beacon-r1',
  plannedSessionSkeleton:true
}],clients:[{
  id:'diag-beacon-client',
  name:'Марина',
  currentRequestId:'diag-beacon-r1',
  lastDiagnosisRequestId:'diag-beacon-r1',
  requests:[{id:'diag-beacon-r1',title:'Запрос',status:'active',situations:[]}],
  sessions:[{
    id:'diag-beacon-session',
    date:'2099-01-02',
    scheduledTime:'19:00',
    requestId:'diag-beacon-r1',
    appointmentType:'Диагностика',
    calendarTitle:'Диагностика',
    planned:true,
    status:'planned',
    calendarEventId:'diag-beacon-1'
  }]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1200,height:800}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','diag-beacon-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
const page=await context.newPage();
await page.goto('http://127.0.0.1:8000/index.html?diag-beacon=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>document.querySelector('.hd-client-row[data-client-id="diag-beacon-client"] .hd-upcoming-session-dot'),null,{timeout:8000});

const state=await page.evaluate(()=>{
  const dot=document.querySelector('.hd-client-row[data-client-id="diag-beacon-client"] .hd-upcoming-session-dot');
  const style=getComputedStyle(dot);
  return {
    cls:dot?.className||'',
    kind:dot?.dataset.kind||'',
    tooltip:dot?.dataset.tooltip||'',
    bg:style.backgroundColor
  };
});
assert.match(state.cls,/is-diagnosis/,'Diagnosis marker is not classified as diagnosis');
assert.equal(state.kind,'diagnosis');
assert.match(state.tooltip,/Диагностика/);
assert.notEqual(state.bg,'rgb(148, 163, 184)','Diagnosis marker still uses neutral gray');
console.log('DIAGNOSIS_BEACON_YELLOW_OK',JSON.stringify(state));
await browser.close();
