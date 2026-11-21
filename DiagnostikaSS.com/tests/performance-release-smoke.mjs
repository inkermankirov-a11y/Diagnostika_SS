import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
const url='http://127.0.0.1:8149/index.html';
const fixture={version:4,clients:[{id:'perf-release-client',name:'Synthetic release client',currentRequestId:'r1',requests:[{id:'r1',title:'Synthetic request',status:'active',situations:[{id:'s1',name:'Synthetic situation',level:5,beliefs:[{id:'b1',text:'Synthetic belief',level:6,feelings:[]}]}]}],sessions:[],questionnaires:[],quickNotes:[]}],calendarEvents:[]};
for(const [engine,launcher] of Object.entries({chromium,firefox,webkit})){
 const browser=await launcher.launch();
 try{
 for(const mobile of (engine==='firefox'?[false]:[false,true])){
  const c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},hasTouch:mobile,locale:'ru-RU'});
  const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(data=>{if(!localStorage.getItem('perf-release-seeded')){localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));localStorage.setItem('diagnostika-ui-language','ru');localStorage.setItem('perf-release-seeded','1');}},fixture);
  await p.goto(url,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>window.DiagnostikaRuntimeGate?.status==='ready'&&document.documentElement.classList.contains('diagnostika-dashboard-ready'));
  const check=()=>p.evaluate(()=>{const db=window.DiagnostikaDB,raw=db.readState();return {id:raw.clients[0].id,name:raw.clients[0].name,requestId:raw.clients[0].requests[0].id,belief:raw.clients[0].requests[0].situations[0].beliefs[0].text,ready:db.health().ready,apis:window.DiagnostikaPlatform.api.ready().ready};});
  const initial=await check();
  assert.deepEqual(initial,{id:'perf-release-client',name:'Synthetic release client',requestId:'r1',belief:'Synthetic belief',ready:true,apis:true});
  // Test persistence through the same storage facade used by the application.
  await p.evaluate(()=>{const db=window.DiagnostikaDB,data=db.readState();data.clients[0].perfTestNote='Тест 😀';if(!db.writeState(data,{source:'synthetic-release-test'}))throw Error('save failed');});
  await p.reload({waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'));
  assert.deepEqual(await check(),initial);
  assert.equal(await p.evaluate(()=>window.DiagnostikaDB.readState().clients[0].perfTestNote),'Тест 😀');
  for(const language of ['en','fr','de','it','ru']){
    await p.evaluate(l=>window.DiagnostikaI18n.setLanguage(l),language);
    await p.waitForFunction(l=>document.documentElement.lang===l,language);
    assert.equal(await p.evaluate(()=>window.DiagnostikaDB.readState().clients[0].name),initial.name);
  }
  if(mobile){
    await p.locator('#mobileBottomNav').waitFor({state:'visible'});
    await p.locator('#mobileBottomNav [data-mobile-action="notes"]').click();
  }else{
    await p.locator('#quickNotesBtn').click();
  }
  await p.locator('.quick-notes-overlay:not([hidden])').waitFor({state:'visible'});
  await p.locator('.quick-notes-close').click();
  if(mobile)await p.locator('#mobileBottomNav [data-mobile-action="calendar"]').click();else await p.locator('#headerCalendarBtn').click();
  await p.locator('.cal-overlay[open]').waitFor({state:'visible'});
  await p.locator('.cal-close').click();
  assert.deepEqual(errors,[]);
  console.log('RELEASE_SMOKE_OK',engine,mobile?'mobile':'desktop');
  await c.close();
 }
 }finally{await browser.close();}
}
