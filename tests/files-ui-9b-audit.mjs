import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const uiSource=fs.readFileSync('session-attachments.js','utf8');
const storageSource=fs.readFileSync('storage-manager.js','utf8');

assert(uiSource.includes('function filesApi()'),'Session attachments Files facade bridge missing');
assert.equal(uiSource.includes('indexedDB.open(SESSION_MEDIA_DB'),false,'Session attachments still own IndexedDB');
assert(uiSource.includes("source:'session-attachment-add'"),'Session attachment create source missing');
assert(uiSource.includes("source:'session-attachment-delete'"),'Session attachment delete source missing');
assert(storageSource.includes("bus.on('file:created'"),'Folder storage does not mirror file create events');
assert(storageSource.includes("bus.on('file:deleted'"),'Folder storage does not mirror file delete events');
assert.equal(storageSource.includes('mediaDbPut=async function'),false,'Folder storage still monkey-patches mediaDbPut');
assert.equal(storageSource.includes('mediaDbDelete=async function'),false,'Folder storage still monkey-patches mediaDbDelete');
assert(storageSource.includes('api.list({sessionId:s.id})'),'Full folder export does not use FileService');

const fixture={version:4,clients:[{
  id:'files-ui-client',
  name:'Files UI Client',
  currentRequestId:'files-ui-r1',
  requests:[{id:'files-ui-r1',title:'Files UI request',status:'active',situations:[]}],
  sessions:[{id:'files-ui-s1',date:'2026-09-19',requestId:'files-ui-r1',notes:''}],
  quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','files-ui-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?files-9b=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaFiles?.moduleAware===true
  && typeof window.openSessionEditor==='function'
  && window.DiagnostikaPlatform?.services?.files,
  null,{timeout:15000});

await page.evaluate(()=>{
  window.__files9bEvents=[];
  window.DiagnostikaPlatform.events.on('file:created',detail=>window.__files9bEvents.push({type:'created',detail:{...detail,record:null}}));
  window.DiagnostikaPlatform.events.on('file:deleted',detail=>window.__files9bEvents.push({type:'deleted',detail:{...detail,record:null}}));
  const c=window.DiagnostikaClients?.findById?.('files-ui-client')
    || window.DiagnostikaPlatform.services.clients.findById('files-ui-client');
  const s=c.sessions.find(x=>x.id==='files-ui-s1');
  window.openSessionEditor(c,s,1);
});

const dialog=page.locator('dialog.session-edit-dialog');
await dialog.waitFor({state:'visible'});
const fileInput=dialog.locator('.session-media-add input[type=file]');
await fileInput.setInputFiles({
  name:'therapy-notes.txt',
  mimeType:'text/plain',
  buffer:Buffer.from('Files 9B UI payload')
});

await dialog.locator('.session-attachment-chip').filter({hasText:'therapy-notes.txt'}).waitFor({state:'visible',timeout:5000});

const afterAdd=await page.evaluate(async()=>{
  const rows=await window.DiagnostikaFiles.list({sessionId:'files-ui-s1'});
  const row=rows.find(x=>x.name==='therapy-notes.txt');
  return {
    count:rows.length,
    id:row?.id||null,
    text:row?.blob?await row.blob.text():null,
    events:window.__files9bEvents
  };
});
assert.equal(afterAdd.count,1);
assert(afterAdd.id,'UI file was not saved through FileService');
assert.equal(afterAdd.text,'Files 9B UI payload');
assert(afterAdd.events.some(x=>x.type==='created'&&x.detail?.source==='session-attachment-add'),'UI file create event missing');

page.once('dialog',d=>d.accept());
await dialog.locator('.session-attachment-remove').click();
await page.waitForFunction(async()=>await window.DiagnostikaFiles.count({sessionId:'files-ui-s1'})===0,null,{timeout:5000});
await dialog.locator('.session-media-empty').waitFor({state:'visible',timeout:5000});

const afterDelete=await page.evaluate(async()=>({
  count:await window.DiagnostikaFiles.count({sessionId:'files-ui-s1'}),
  events:window.__files9bEvents
}));
assert.equal(afterDelete.count,0);
assert(afterDelete.events.some(x=>x.type==='deleted'&&x.detail?.source==='session-attachment-delete'),'UI file delete event missing');

const legacy=await page.evaluate(async()=>{
  const rows=await window.mediaDbList('files-ui-s1');
  return Array.isArray(rows)?rows.length:-1;
});
assert.equal(legacy,0,'Legacy mediaDbList compatibility wrapper diverged from FileService');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('FILES_9B_SUCCESS',JSON.stringify({
  created:true,
  deleted:true,
  legacyBridge:true
}));

await context.close();
await browser.close();
