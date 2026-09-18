import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const removed=['.workspace-grid','.client-card','#clientHome','#clientSelect','#clientName','#clientCity','#clientAge','#photoFrame','#addClientBtn','#sessionsList','#addSessionBtn','#clientCardModeBtn','#diagnosisModeBtn','#backToProgressBtn'];
const html=fs.readFileSync('index.html','utf8');
for(const id of removed.filter(x=>x.startsWith('#')))assert(!html.includes(`id="${id.slice(1)}"`),`Removed UI in HTML: ${id}`);
assert(!html.includes('diagnostika-dashboard-fallback'));
const browser=await chromium.launch({headless:true});
const errors=[];
const stamp='2026-09-16T12:00:00.000Z';
const payment=()=>({mode:'package',total:64000,payments:[{id:'pay-1',amount:8000,date:'2026-09-16',note:'Preserve payment'}],currency:'RUB',sessionAmount:0,sessionDiscount:0});
const fixture={version:4,clients:[{
  id:'keep-client',name:'Контроль сохранности',city:'Киров',birth:'1988-05-10',photoData:'',
  sessions:[{id:'keep-session',date:'2026-09-16',createdAt:stamp,requestId:'keep-request',notes:'Не потерять заметку',youtubeUrl:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',sessionFormat:'online',payment:{paid:true,amount:8000,requestId:'keep-request',manualAmount:true}}],
  currentRequestId:'keep-request',lastDiagnosisRequestId:'keep-request',
  requests:[{id:'keep-request',title:'Сохранённый запрос',status:'active',createdAt:stamp,updatedAt:stamp,payment:payment(),situations:[{id:'keep-situation',name:'Когда я называю цену',level:6,comment:'Сохранённый комментарий',result:'Спокойно назвать цену',beliefs:[{id:'keep-belief',text:'Меня осудят',level:7,comment:'',feelings:[]}]}]},
    {id:'archive-request',title:'Архивный запрос',status:'completed',createdAt:stamp,updatedAt:stamp,payment:payment(),situations:[]}],
  freeConsultation:{request:'Сохранить консультацию'},specialistMeta:{originalSpecialist:'Первый',currentSpecialist:'Текущий'}
}]};
async function context(viewport={width:1440,height:1000}){
  const c=await browser.newContext({viewport});
  await c.addInitScript(f=>{
    if(!localStorage.getItem('diagnostika-web-v1')){
      localStorage.setItem('diagnostika-web-v1',JSON.stringify(f));
      localStorage.setItem('diagnostika-last-client-id','keep-client');
      localStorage.setItem('diagnostika-ui-language','ru');
    }
  },fixture);
  return c;
}
async function absent(p){for(const s of removed)assert.equal(await p.locator(s).count(),0,`Retired UI exists: ${s}`);}
async function ready(p){
  await p.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await p.locator('#appStartupStatus').waitFor({state:'hidden'});
  await p.locator('#hdAddSession').waitFor({state:'visible'});
  await absent(p);
}

for(const viewport of [{width:1440,height:1000},{width:768,height:1024},{width:390,height:844}]){
  const c=await context(viewport),p=await c.newPage();
  p.on('pageerror',e=>errors.push(e.message));
  p.on('dialog',d=>d.accept());
  await p.goto(base);await ready(p);
  assert.equal(await p.locator('#diagnosisWorkspace').isVisible(),false);
  assert.equal(await p.locator('#hdHeroTitle').textContent(),'Контроль сохранности');
  const baseline=await p.evaluate(()=>JSON.stringify(window.DiagnostikaClients.current()));
  await p.getByRole('button',{name:'Диагностика',exact:true}).click();
  await p.locator('#diagnosisWorkspace').waitFor({state:'visible'});
  await absent(p);
  await p.locator('#tree .tree-row.primary').first().click();
  await p.locator('#editorText').fill('Проверено в новом интерфейсе');
  await p.locator('#saveElementBtn').click();
  await p.locator('#requestSelect').selectOption('archive-request');
  await p.waitForFunction(()=>document.querySelector('#requestTitleDisplay')?.textContent==='Архивный запрос');
  await p.locator('#requestSelect').selectOption('keep-request');
  await p.screenshot({path:`/tmp/new-ui-diagnosis-${viewport.width}.png`,fullPage:true});
  await p.locator('.diagnosis-compact-back').click();
  await ready(p);
  await p.getByRole('button',{name:'Карточка клиента',exact:true}).click();
  await p.locator('#ccCity').fill('Киров — проверено');
  await p.locator('#ccSaveBtn').click();
  await p.locator('#clientCardDialog').waitFor({state:'hidden'});
  await p.locator('#hdAddSession').click();
  const dlg=p.locator('dialog.session-edit-dialog');
  await dlg.waitFor({state:'visible'});
  await dlg.locator('.session-edit-text').fill('Новая сессия: сохранение проверено');
  await dlg.locator('.session-edit-actions .primary').click();
  await dlg.waitFor({state:'hidden'});
  await p.waitForFunction(()=>document.querySelector('#hdSessionsList')?.textContent.includes('Новая сессия: сохранение проверено'));
  const after=await p.evaluate(()=>window.DiagnostikaClients.current());
  assert.equal(after.sessions.length,2);
  assert.equal(after.sessions[0].notes,'Не потерять заметку');
  assert.equal(after.sessions[0].youtubeUrl,fixture.clients[0].sessions[0].youtubeUrl);
  assert.equal(after.requests[0].payment.total,64000);
  assert.deepEqual(after.requests[0].payment.payments,JSON.parse(baseline).requests[0].payment.payments);
  assert.equal(after.freeConsultation.request,'Сохранить консультацию');
  assert.equal(after.requests[0].situations[0].beliefs[0].text,'Проверено в новом интерфейсе');
  await p.reload();await ready(p);
  const restored=await p.evaluate(()=>window.DiagnostikaClients.current());
  assert.equal(restored.city,'Киров — проверено');
  assert.equal(restored.sessions.length,2);
  assert.deepEqual(restored.requests,after.requests);
  const normalizeSessionOwnership=rows=>rows.map(s=>{const copy={...s};delete copy.aiChat;return copy;});
  assert.deepEqual(normalizeSessionOwnership(restored.sessions),normalizeSessionOwnership(after.sessions));
  await p.screenshot({path:`/tmp/new-ui-dashboard-${viewport.width}.png`,fullPage:true});
  console.log('NEW_UI_PERSISTENCE_OK',viewport.width);
  await c.close();
}
assert.deepEqual(errors,[],'Unexpected runtime errors');

// A late asset must never reveal the old screen, and recovery must not reload/delete data.
{
  const c=await context(),p=await c.newPage();
  await p.route('**/home-dashboard.js?*',async route=>{
    await new Promise(r=>setTimeout(r,10000));
    await route.continue();
  });
  await p.goto(base,{waitUntil:'domcontentloaded'});
  await p.locator('#appReloadBtn').waitFor({state:'visible',timeout:12000});
  await absent(p);assert.equal(await p.locator('#diagnosisWorkspace').isVisible(),false);
  await ready(p);
  console.log('NEW_UI_DELAY_RECOVERY_OK');await c.close();
}
for(const asset of ['app.js','app-loader.js','home-dashboard.js','home-dashboard-sessions.js']){
  const c=await context(),p=await c.newPage();
  await p.route(`**/${asset}?*`,route=>route.abort());
  await p.goto(base,{waitUntil:'domcontentloaded'});
  await p.locator('#appReloadBtn').waitFor({state:'visible',timeout:12000});
  await absent(p);assert.equal(await p.locator('#diagnosisWorkspace').isVisible(),false);
  const data=await p.evaluate(()=>JSON.parse(localStorage.getItem('diagnostika-web-v1')));
  assert.equal(data.clients[0].sessions[0].notes,'Не потерять заметку');
  assert.equal(data.clients[0].requests[0].payment.total,64000);
  await p.screenshot({path:`/tmp/new-ui-failure-${asset}.png`,fullPage:true});
  await p.unroute(`**/${asset}?*`);
  await p.locator('#appReloadBtn').click();await ready(p);
  console.log('NEW_UI_FAILURE_RECOVERY_OK',asset);await c.close();
}
await browser.close();
console.log('NEW_UI_AUDIT_SUCCESS');
