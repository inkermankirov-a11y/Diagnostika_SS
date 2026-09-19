import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource=fs.readFileSync('modules/files/file-service.js','utf8');
const moduleSource=fs.readFileSync('modules/files/index.js','utf8');
const apiSource=fs.readFileSync('files-api.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');

for(const token of ['async function get(','async function list(','async function put(','async function add(','async function remove(','async function removeForSession(','async function removeForClient(']){
  assert(serviceSource.includes(token),'FileService method missing '+token);
}
assert(serviceSource.includes("const DB_NAME='diagnostika-session-media-v1'"),'FileService changed legacy media DB');
assert(serviceSource.includes("const STORE_NAME='files'"),'FileService changed legacy media store');
assert(serviceSource.includes('services.files=Object.freeze({'),'FileService export is not frozen');
assert.equal(serviceSource.includes('querySelector('),false,'FileService knows UI/HTML');
assert.equal(serviceSource.includes("typeof save==='function'"),false,'FileService calls legacy save');
assert(moduleSource.includes("MODULE_ID='files'"),'Files module registration missing');
assert(moduleSource.includes("'session:deleted'"),'Files module does not clean deleted sessions');
assert(moduleSource.includes("'client:purged'"),'Files module does not clean purged clients');
assert(apiSource.includes("version:'9A'"),'Files facade version is not 9A');
for(const marker of [
  'modules/files/file-service.js?v=20260919-files9a',
  'modules/files/index.js?v=20260919-files9a',
  'files-api.js?v=20260919-files9a'
])assert(loaderSource.includes(marker),'Files loader marker missing '+marker);

const fixture={version:4,clients:[{
  id:'files-client',
  name:'Files Client',
  currentRequestId:'files-r1',
  requests:[{id:'files-r1',title:'Files request',status:'active',situations:[]}],
  sessions:[
    {id:'files-s1',date:'2026-09-19',requestId:'files-r1',notes:''},
    {id:'files-s2',date:'2026-09-20',requestId:'files-r1',notes:''}
  ],
  quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','files-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?files-9a=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaFiles?.version==='9A'
  && window.DiagnostikaFiles?.moduleAware===true
  && window.DiagnostikaPlatform?.services?.files
  && window.DiagnostikaPlatform?.modules?.get?.('files')?.status==='started',
  null,{timeout:15000});

const initial=await page.evaluate(async()=>{
  const api=window.DiagnostikaFiles;
  window.__files9aEvents=[];
  for(const type of Object.values(api.events)){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__files9aEvents.push({type,detail:{...detail,record:detail?.record?{...detail.record,blob:null}:null}}));
  }

  const blob=new Blob(['hello files 9A'],{type:'text/plain'});
  const created=await api.add(blob,{
    id:'file-9a-1',
    clientId:'files-client',
    sessionId:'files-s1',
    name:'note.txt'
  },{source:'files-9a-test-add'});

  const fetched=await api.get('file-9a-1');
  const text=fetched?.blob?await fetched.blob.text():null;
  const bySession=await api.list({sessionId:'files-s1'});
  const byClient=await api.list({clientId:'files-client'});
  return {
    frozen:Object.isFrozen(api),
    serviceFrozen:Object.isFrozen(window.DiagnostikaPlatform.services.files),
    module:window.DiagnostikaPlatform.modules.get('files'),
    created:{id:created?.id,name:created?.name,size:created?.size,type:created?.type},
    fetched:{id:fetched?.id,text},
    bySession:bySession.length,
    byClient:byClient.length,
    events:window.__files9aEvents
  };
});

assert.equal(initial.frozen,true);
assert.equal(initial.serviceFrozen,true);
assert.equal(initial.module.status,'started');
assert.equal(initial.created.id,'file-9a-1');
assert.equal(initial.created.name,'note.txt');
assert.equal(initial.fetched.text,'hello files 9A');
assert.equal(initial.bySession,1);
assert.equal(initial.byClient,1);
assert(initial.events.some(e=>e.detail?.source==='files-9a-test-add'),'File create event missing');

await page.evaluate(async()=>{
  await window.DiagnostikaFiles.add(
    new Blob(['cleanup'],{type:'text/plain'}),
    {id:'file-9a-cleanup',clientId:'files-client',sessionId:'files-s2',name:'cleanup.txt'},
    {source:'files-9a-cleanup-seed'}
  );
  window.DiagnostikaSessions.remove('files-s2',{clientId:'files-client',source:'files-9a-session-delete',render:false});
});
await page.waitForFunction(()=>window.__files9aEvents.some(e=>e.type==='file:session-cleared'&&e.detail?.sessionId==='files-s2'),null,{timeout:5000});
assert.equal(await page.evaluate(async()=>await window.DiagnostikaFiles.count({sessionId:'files-s2'})),0);

await page.evaluate(async()=>{
  await window.DiagnostikaFiles.remove('file-9a-1',{source:'files-9a-reset'});
  await window.DiagnostikaFiles.add(
    new Blob(['purge'],{type:'text/plain'}),
    {id:'file-9a-purge',clientId:'files-client',sessionId:'files-s1',name:'purge.txt'},
    {source:'files-9a-purge-seed'}
  );
  window.DiagnostikaPlatform.events.emit('client:purged',{clientId:'files-client',source:'files-9a-purge-event'});
});
await page.waitForFunction(()=>window.__files9aEvents.some(e=>e.type==='file:client-cleared'&&e.detail?.clientId==='files-client'),null,{timeout:5000});

const finalState=await page.evaluate(async()=>({
  count:await window.DiagnostikaFiles.count({clientId:'files-client'}),
  events:window.__files9aEvents
}));
assert.equal(finalState.count,0);
assert(finalState.events.some(e=>e.type==='file:session-cleared'),'Session clear event missing');
assert(finalState.events.some(e=>e.type==='file:client-cleared'),'Client clear event missing');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('FILES_9A_SUCCESS',JSON.stringify({
  module:initial.module.status,
  blobText:initial.fetched.text,
  sessionCleanup:true,
  clientCleanup:true
}));

await context.close();
await browser.close();
