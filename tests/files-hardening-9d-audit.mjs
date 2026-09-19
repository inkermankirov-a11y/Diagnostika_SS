import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource=fs.readFileSync('modules/files/file-service.js','utf8');
const apiSource=fs.readFileSync('files-api.js','utf8');
const uiSource=fs.readFileSync('session-attachments.js','utf8');
const storageSource=fs.readFileSync('storage-manager.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(serviceSource.includes("version:'9D'"),'FileService is not 9D');
assert(apiSource.includes("version:'9D'"),'Files facade is not 9D');
assert(apiSource.includes('window.DiagnostikaFiles=Object.freeze({'),'Files facade is not frozen');
assert.equal(serviceSource.includes('querySelector('),false,'FileService knows UI');
assert.equal(uiSource.includes('indexedDB.open(SESSION_MEDIA_DB'),false,'Session UI still owns file IndexedDB');
assert.equal(storageSource.includes('mediaDbPut=async function'),false,'Storage still monkey-patches mediaDbPut');
assert(storageSource.includes('findSessionDirById'),'Storage cannot find removed-session mirror directories');
for(const marker of [
  'modules/files/file-service.js?v=20260919-files9d',
  'modules/files/index.js?v=20260919-files9d',
  'files-api.js?v=20260919-files9d'
])assert(loaderSource.includes(marker),'Files 9D loader marker missing '+marker);
for(const marker of [
  'session-attachments.js?v=20260919-files9d',
  'storage-manager.js?v=20260919-files9d'
])assert(indexSource.includes(marker),'Files 9D runtime marker missing '+marker);
assert(/<meta name="diagnostika-build" content="20260919-(?:files9d|export10[a-d]|roles11[a-d])">/.test(indexSource),'Files-compatible build marker is stale');
assert(/app-loader\.js\?v=20260919-(?:files9d|export10[a-d]|roles11[a-d])/.test(indexSource),'Files-compatible app-loader marker is stale');

const fixture={version:4,clients:[{
  id:'files-9d-client',
  name:'Files 9D Client',
  currentRequestId:'files-9d-r1',
  requests:[{id:'files-9d-r1',title:'Files 9D request',status:'active',situations:[]}],
  sessions:[{id:'files-9d-s1',date:'2026-09-19',requestId:'files-9d-r1',notes:''}],
  quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','files-9d-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaFiles?.version==='9D'
    && window.DiagnostikaPlatform?.services?.files?.version==='9D'
    && window.DiagnostikaPlatform?.modules?.get?.('files')?.status==='started',
    null,{timeout:15000});
}

await page.goto('http://127.0.0.1:8000/index.html?files-9d=1',{waitUntil:'commit',timeout:10000});
await ready();

const created=await page.evaluate(async()=>{
  window.__files9dDeleted=null;
  window.DiagnostikaPlatform.events.on('file:deleted',detail=>{
    window.__files9dDeleted={...detail,record:detail.record?{...detail.record,blob:null}:null};
  });

  const result=await window.DiagnostikaFiles.add(
    new Blob(['persistent files 9D'],{type:'text/plain'}),
    {id:'files-9d-file',clientId:'files-9d-client',sessionId:'files-9d-s1',name:'persistent.txt'},
    {source:'files-9d-create'}
  );
  result.name='tampered-return.txt';
  const read=await window.DiagnostikaFiles.get('files-9d-file');
  read.name='tampered-read.txt';
  const live=await window.DiagnostikaFiles.get('files-9d-file');
  return {name:live?.name,text:live?.blob?await live.blob.text():null};
});
assert.equal(created.name,'persistent.txt','FileService return value leaked live storage record');
assert.equal(created.text,'persistent files 9D');

await page.reload({waitUntil:'commit',timeout:10000});
await ready();

const restored=await page.evaluate(async()=>{
  const rec=await window.DiagnostikaFiles.get('files-9d-file');
  return {
    name:rec?.name||null,
    text:rec?.blob?await rec.blob.text():null,
    count:await window.DiagnostikaFiles.count({sessionId:'files-9d-s1'})
  };
});
assert.equal(restored.name,'persistent.txt');
assert.equal(restored.text,'persistent files 9D');
assert.equal(restored.count,1,'IndexedDB file did not survive page reload');

await page.evaluate(()=>{
  window.__files9dSessionCleared=false;
  window.DiagnostikaPlatform.events.on('file:session-cleared',detail=>{
    if(detail?.sessionId==='files-9d-s1')window.__files9dSessionCleared=true;
  });
  window.DiagnostikaSessions.remove('files-9d-s1',{clientId:'files-9d-client',source:'files-9d-session-delete',render:false});
});
await page.waitForFunction(()=>window.__files9dSessionCleared===true,null,{timeout:5000});
assert.equal(await page.evaluate(async()=>await window.DiagnostikaFiles.count({sessionId:'files-9d-s1'})),0);

const serviceIsolation=await page.evaluate(async()=>{
  const service=window.DiagnostikaPlatform.services.files;
  const facade=window.DiagnostikaFiles;
  return {
    facadeFrozen:Object.isFrozen(facade),
    serviceFrozen:Object.isFrozen(service),
    eventsFrozen:Object.isFrozen(service.events),
    module:window.DiagnostikaPlatform.modules.get('files')
  };
});
assert.equal(serviceIsolation.facadeFrozen,true);
assert.equal(serviceIsolation.serviceFrozen,true);
assert.equal(serviceIsolation.eventsFrozen,true);
assert.equal(serviceIsolation.module.status,'started');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('FILES_9D_SUCCESS',JSON.stringify({
  persistedAcrossReload:true,
  isolatedReads:true,
  sessionCleanup:true,
  module:serviceIsolation.module.status
}));

await context.close();
await browser.close();
