import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const pad=n=>String(n).padStart(2,'0');
const tomorrow=new Date();
tomorrow.setDate(tomorrow.getDate()+1);
const date=[tomorrow.getFullYear(),pad(tomorrow.getMonth()+1),pad(tomorrow.getDate())].join('-');
const fixture={version:4,clients:[
  {id:'c-vika',name:'Вика',currentRequestId:'r-vika',
   requests:[{id:'r-vika',title:'Работа с тревожностью',status:'active',situations:[]}],
   sessions:[
    {id:'v1',date:'2026-01-10',requestId:'r-vika',status:'completed',appointmentType:'Сессия'},
    {id:'v2',date,scheduledTime:'19:00',requestId:'r-vika',planned:true,status:'planned',appointmentType:'Сессия',
     calendarEventId:'ev2',calendarTitle:'Сессия №2'}],quickNotes:[],questionnaires:[]},
  {id:'c-ira',name:'Ирина',currentRequestId:'r-ira',
   requests:[{id:'r-ira',title:'Встречи',status:'active',situations:[]}],
   sessions:[
    {id:'i1',date:'2026-01-01',requestId:'r-ira',status:'completed',appointmentType:'Сессия'},
    {id:'i2',date:'2026-02-01',requestId:'r-ira',status:'completed',appointmentType:'Сессия'},
    {id:'i3',date,scheduledTime:'20:00',requestId:'r-ira',planned:true,status:'planned',appointmentType:'Сессия',
     calendarEventId:'ev3',calendarTitle:'Сессия №3'}],quickNotes:[],questionnaires:[]}
],calendarEvents:[
 {id:'ev2',date,time:'19:00',type:'Сессия',title:'Сессия',clientId:'c-vika',
  requestId:'r-vika',sessionId:'v2',plannedSessionSkeleton:true},
 {id:'ev3',date,time:'20:00',type:'Сессия',title:'Сессия',sessionNumber:3,
  clientId:'c-ira',requestId:'r-ira',sessionId:'i3',plannedSessionSkeleton:true}
]};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1400,height:900},locale:'ru-RU'});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(data=>{
 localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
 localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
try{
 await page.goto('http://127.0.0.1:8131/index.html?session-title-check=1',
   {waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>window.DiagnostikaSessionEventLabel&&window.DiagnostikaHomeWorkspace&&
   document.querySelectorAll('#hwsSchedule .hws-event-row').length>=2,null,{timeout:35000});
 const rows=await page.locator('#hwsSchedule .hws-event-row').allTextContents();
 assert(rows.some(x=>x.includes('Сессия №2')&&x.includes('Вика')),'Vika event missing session №2');
 assert(rows.some(x=>x.includes('Сессия №3')&&x.includes('Ирина')),'Ira event missing session №3');
 const dot=page.locator('.hd-client-row[data-id="c-vika"] .hd-upcoming-session-dot.is-session');
 await dot.waitFor({state:'visible',timeout:20000});
 await dot.hover();
 const tip=page.locator('.hd-upcoming-tooltip.is-session:not([hidden])');
 await tip.waitFor({state:'visible',timeout:7000});
 const title=(await tip.locator('.hd-beacon-tooltip-title').textContent()||'').trim();
 const time=(await tip.locator('.hd-beacon-tooltip-time').textContent()||'').trim();
 assert.equal(title,'Сессия №2');
 assert.equal(time,'19:00');
 const layout=await tip.evaluate(el=>{
   const h=el.querySelector('.hd-beacon-tooltip-header').getBoundingClientRect();
   const b=el.querySelector('.hd-beacon-tooltip-bottom').getBoundingClientRect();
   const r=el.getBoundingClientRect();
   return {width:r.width,height:r.height,gap:b.top-h.bottom,bg:getComputedStyle(el).backgroundColor};
 });
 assert(layout.width>=200&&layout.width<=270,'Tooltip width out of range');
 assert(layout.height<145,'Tooltip is too bulky');
 assert(layout.gap>=0,'Tooltip contents overlap');
 assert.equal(layout.bg,'rgb(255, 255, 255)','Tooltip background is not white');
 assert.deepEqual(errors,[],'Browser JS errors');
 console.log('NUMBERED_DASHBOARD_EVENTS_BROWSER_OK',JSON.stringify({rows,title,time,layout}));
}finally{await context.close();await browser.close();}
