import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dashboardSource=fs.readFileSync('home-dashboard-sessions.js','utf8');
const editorSource=fs.readFileSync('session-attachments.js','utf8');
const interactionsSource=fs.readFileSync('session-interactions.js','utf8');
const activeSource=fs.readFileSync('session-active-request.js','utf8');
const formatSource=fs.readFileSync('session-format.js','utf8');

assert.equal(dashboardSource.includes('c.sessions.push('),false,'dashboard still creates sessions directly');
assert.match(dashboardSource,/home-dashboard-session-create/);
assert.equal(dashboardSource.includes("addEventListener('diagnostika:sessions-changed'"),false,'dashboard still consumes legacy session DOM event directly');
for(const event of ['session:created','session:updated','session:deleted'])assert(dashboardSource.includes(event),'dashboard EventBus subscription missing '+event);

for(const forbidden of ['s.date=','s.requestId=','s.notes=','s.youtubeUrl=']){
  assert.equal(editorSource.includes(forbidden),false,'session editor still mutates session directly: '+forbidden);
}
assert.match(editorSource,/api\.update\(s\.id,changes/);
assert.match(editorSource,/source:'session-editor-save'/);

assert.equal(interactionsSource.includes('c.sessions.splice('),false,'session delete still splices client sessions');
assert.match(interactionsSource,/api\.remove\(s\.id/);
assert.match(interactionsSource,/source: 'session-editor-delete'/);

assert.equal(activeSource.includes('s.requestId ='),false,'active-request bridge still mutates requestId directly');
assert.match(activeSource,/api\?\.update\?\.\(s\.id/);
assert.match(activeSource,/source:'session-active-request'/);

assert.equal(/s\\.sessionFormat\\s*=(?!=)/.test(formatSource),false,'session format still mutates session directly');
assert.equal(formatSource.includes("typeof save==='function'"),false,'session format still owns persistence');

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const stamp='2026-09-18T10:00:00.000Z';
const payment=()=>({mode:'',total:0,payments:[],currency:'RUB',sessionAmount:0,sessionDiscount:0});
const fixture={version:4,clients:[{
  id:'sessions-4b-client',
  name:'Sessions 4B Client',
  city:'Киров',
  sessions:[],
  currentRequestId:'sessions-4b-r1',
  lastDiagnosisRequestId:'sessions-4b-r1',
  requests:[
    {id:'sessions-4b-r1',title:'Активный запрос',status:'active',createdAt:stamp,updatedAt:stamp,situations:[],payment:payment()},
    {id:'sessions-4b-r2',title:'Архивный запрос',status:'active',createdAt:stamp,updatedAt:stamp,situations:[],payment:payment()}
  ]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','sessions-4b-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaSessions?.moduleAware===true
    && window.DiagnostikaSessions?.version==='4B'
    && !!window.DiagnostikaDashboardSessions
    && !!window.DiagnostikaClients?.current?.(),null,{timeout:15000});
  await page.locator('#hdAddSession').waitFor({state:'visible',timeout:8000});
}

async function captureEvents(){
  await page.evaluate(()=>{
    window.__sessionUi4bEvents=[];
    for(const type of ['session:created','session:updated','session:deleted']){
      window.DiagnostikaPlatform.events.on(type,detail=>window.__sessionUi4bEvents.push({type,detail:{...detail}}));
    }
  });
}

async function lastEditor(){
  const dlg=page.locator('dialog.session-edit-dialog').last();
  await dlg.waitFor({state:'visible',timeout:5000});
  await dlg.locator('.session-format-select').waitFor({state:'visible',timeout:5000});
  return dlg;
}

async function openArchiveSession(){
  await page.locator('#hdSessionArchive').waitFor({state:'visible',timeout:5000});
  await page.locator('#hdSessionArchive').click();
  const archive=page.locator('#hdSessionArchiveDialog');
  await archive.waitFor({state:'visible',timeout:5000});
  const row=archive.locator('.hd-session-archive-row').first();
  await row.waitFor({state:'visible',timeout:5000});
  await row.click();
  return lastEditor();
}

await page.goto(base,{waitUntil:'commit',timeout:10000});
await ready();
await captureEvents();

await page.locator('#hdAddSession').click();
let dlg=await lastEditor();

let createdState=await page.evaluate(()=>({
  list:window.DiagnostikaSessions.list().map(s=>({id:s.id,requestId:s.requestId})),
  activeRequestId:window.DiagnostikaRequests.currentId(),
  events:window.__sessionUi4bEvents
}));
assert.equal(createdState.list.length,1);
assert.equal(createdState.list[0].requestId,'sessions-4b-r1');
assert.equal(createdState.activeRequestId,'sessions-4b-r1');
assert.equal(createdState.events.filter(x=>x.type==='session:created'&&x.detail.source==='home-dashboard-session-create').length,1);
assert.equal(createdState.events.filter(x=>x.type==='session:created').length,1,'session create emitted duplicate lifecycle events');

const sessionId=createdState.list[0].id;
await page.evaluate(()=>{window.__sessionUi4bEvents=[];});

await dlg.locator('.session-edit-grid input[type="date"]').fill('2026-09-20');
await dlg.locator('.session-edit-grid select:not(.session-format-select)').selectOption('sessions-4b-r2');
await dlg.locator('.session-edit-text').fill('Сохранённая заметка');
await dlg.locator('.session-youtube-editor input').fill('https://youtu.be/dQw4w9WgXcQ');
await dlg.locator('.session-format-select').selectOption('other');
await dlg.locator('.session-format-other').fill('Signal');
await dlg.locator('.session-edit-actions .primary').click();
await dlg.waitFor({state:'hidden',timeout:5000});
await page.waitForTimeout(150);

const saved=await page.evaluate(id=>{
  const s=window.DiagnostikaSessions.get(id);
  return {
    data:s?{
      id:s.id,date:s.date,requestId:s.requestId,notes:s.notes,youtubeUrl:s.youtubeUrl,
      sessionFormat:s.sessionFormat,sessionFormatOther:s.sessionFormatOther
    }:null,
    activeRequestId:window.DiagnostikaRequests.currentId(),
    events:window.__sessionUi4bEvents
  };
},sessionId);
assert.deepEqual(saved.data,{
  id:sessionId,
  date:'2026-09-20',
  requestId:'sessions-4b-r2',
  notes:'Сохранённая заметка',
  youtubeUrl:'https://youtu.be/dQw4w9WgXcQ',
  sessionFormat:'other',
  sessionFormatOther:'Signal'
});
assert.equal(saved.activeRequestId,'sessions-4b-r1','saving a historical session activated its request');
assert.equal(saved.events.filter(x=>x.type==='session:updated'&&x.detail.source==='session-editor-save').length,1);
assert.equal(saved.events.filter(x=>x.type==='session:updated').length,1,'session save emitted duplicate lifecycle events');

await page.reload({waitUntil:'commit',timeout:10000});
await ready();
const restored=await page.evaluate(id=>{
  const s=window.DiagnostikaSessions.get(id);
  return {
    data:s?{date:s.date,requestId:s.requestId,notes:s.notes,youtubeUrl:s.youtubeUrl,sessionFormat:s.sessionFormat,sessionFormatOther:s.sessionFormatOther}:null,
    activeRequestId:window.DiagnostikaRequests.currentId()
  };
},sessionId);
assert.deepEqual(restored.data,{
  date:'2026-09-20',
  requestId:'sessions-4b-r2',
  notes:'Сохранённая заметка',
  youtubeUrl:'https://youtu.be/dQw4w9WgXcQ',
  sessionFormat:'other',
  sessionFormatOther:'Signal'
});
assert.equal(restored.activeRequestId,'sessions-4b-r1');

dlg=await openArchiveSession();
assert.equal(await page.evaluate(()=>window.DiagnostikaRequests.currentId()),'sessions-4b-r1','opening archive session activated its request');
await page.evaluate(()=>document.querySelector('dialog.session-edit-dialog')?.close());
await dlg.waitFor({state:'hidden',timeout:5000});

await captureEvents();
dlg=await openArchiveSession();
await dlg.locator('.session-edit-text').fill('ЭТО НЕ СОХРАНЯТЬ');
const cancel=dlg.locator('.session-edit-actions button').filter({hasText:'Отмена'}).first();
await cancel.click();
const confirmDiscard=page.locator('dialog.app-message-dialog');
await confirmDiscard.waitFor({state:'visible',timeout:5000});
await confirmDiscard.locator('.app-message-no').click();
await dlg.waitFor({state:'hidden',timeout:5000});
assert.equal(await page.evaluate(id=>window.DiagnostikaSessions.get(id)?.notes,sessionId),'Сохранённая заметка','unsaved discard changed session data');

dlg=await openArchiveSession();
await dlg.locator('.session-edit-text').fill('Сохранено через защиту');
await dlg.locator('.session-edit-actions button').filter({hasText:'Отмена'}).first().click();
const confirmSave=page.locator('dialog.app-message-dialog');
await confirmSave.waitFor({state:'visible',timeout:5000});
await confirmSave.locator('.app-message-yes').click();
await dlg.waitFor({state:'hidden',timeout:5000});
await page.waitForTimeout(120);
assert.equal(await page.evaluate(id=>window.DiagnostikaSessions.get(id)?.notes,sessionId),'Сохранено через защиту','unsaved guard Yes did not save through SessionService');
let guardEvents=await page.evaluate(()=>window.__sessionUi4bEvents);
assert.equal(guardEvents.filter(x=>x.type==='session:updated'&&x.detail.source==='session-editor-save').length,1,'unsaved guard save emitted wrong event count');

await page.evaluate(()=>{window.__sessionUi4bEvents=[];});
dlg=await openArchiveSession();
await dlg.locator('.session-delete-btn').click();
await dlg.waitFor({state:'hidden',timeout:5000});
await page.waitForTimeout(150);

const deleted=await page.evaluate(id=>({
  exists:!!window.DiagnostikaSessions.get(id),
  count:window.DiagnostikaSessions.list().length,
  activeRequestId:window.DiagnostikaRequests.currentId(),
  events:window.__sessionUi4bEvents
}),sessionId);
assert.equal(deleted.exists,false);
assert.equal(deleted.count,0);
assert.equal(deleted.activeRequestId,'sessions-4b-r1');
assert.equal(deleted.events.filter(x=>x.type==='session:deleted'&&x.detail.source==='session-editor-delete').length,1);
assert.equal(deleted.events.filter(x=>x.type==='session:deleted').length,1,'session delete emitted duplicate lifecycle events');

await page.reload({waitUntil:'commit',timeout:10000});
await ready();
assert.equal(await page.evaluate(()=>window.DiagnostikaSessions.list().length),0,'deleted session returned after reload');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('SESSION_UI_4B_SUCCESS',JSON.stringify({
  create:true,
  save:true,
  archive:true,
  activeRequestPreserved:true,
  unsavedDiscard:true,
  unsavedSave:true,
  delete:true,
  reload:true
}));

await context.close();
await browser.close();
