import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dbSource=fs.readFileSync('core/database.js','utf8');
const appSource=fs.readFileSync('app.js','utf8');
const bootstrapSource=fs.readFileSync('core/bootstrap.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(dbSource.includes("const VERSION = '14C'"),'DB 14C version marker missing');
assert(dbSource.includes("status: 'preloading'"),'DB pre-app platform bootstrap missing');
assert(appSource.includes("db.readState({source:'app-load'})"),'app.js does not read canonical state through DB');
assert(!appSource.includes('localStorage.getItem(KEY)'),'app.js still reads canonical state directly from localStorage');
assert(bootstrapSource.includes("core/database.js?v=20260919-db14c"),'DB 14C bootstrap marker missing');

const dbScript='core/database.js?v=20260919-db14c';
const appScript='app.js?v=20260919-export10d&db=14c';
const bootstrapScript='core/bootstrap.js?v=20260919-db14c&api=13d';
const dbIndex=indexSource.indexOf(dbScript);
const appIndex=indexSource.indexOf(appScript);
const bootstrapIndex=indexSource.indexOf(bootstrapScript);
assert(dbIndex>=0&&appIndex>=0&&bootstrapIndex>=0,'DB 14C script markers missing from index');
assert(dbIndex<appIndex,'Database adapter is not loaded before app.js');
assert(appIndex<bootstrapIndex,'Unexpected app/bootstrap order after DB 14C');

const fixture={version:4,clients:[{
  id:'db14c-client',
  name:'DB 14C Client',
  city:'Read Path City',
  requests:[{id:'db14c-r1',title:'Loaded through DB 14C',situations:[]}],
  sessions:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','db14c-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?db-14c=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>window.DiagnostikaDB?.version==='14C',null,{timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaClients?.moduleAware===true,null,{timeout:20000});

const first=await page.evaluate(()=>{
  const db=window.DiagnostikaDB;
  const c=window.DiagnostikaClients.findById('db14c-client');
  return {
    dbVersion:db?.version||null,
    sameBridge:db===window.DiagnostikaPlatform?.db,
    platformStatus:window.DiagnostikaPlatform?.status||null,
    clientId:c?.id||null,
    city:c?.city||null,
    title:c?.requests?.find(x=>x.id==='db14c-r1')?.title||null
  };
});

assert.equal(first.dbVersion,'14C');
assert.equal(first.sameBridge,true);
assert.equal(first.platformStatus,'ready');
assert.equal(first.clientId,'db14c-client');
assert.equal(first.city,'Read Path City');
assert.equal(first.title,'Loaded through DB 14C');

await page.reload({waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>window.DiagnostikaDB?.version==='14C'
  && window.DiagnostikaClients?.moduleAware===true
  && document.documentElement.classList.contains('diagnostika-dashboard-ready'),
  null,{timeout:20000});

const restored=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.findById('db14c-client');
  return {
    id:c?.id||null,
    city:c?.city||null,
    title:c?.requests?.find(x=>x.id==='db14c-r1')?.title||null
  };
});

assert.equal(restored.id,'db14c-client','DB read-path client did not survive reload');
assert.equal(restored.city,'Read Path City');
assert.equal(restored.title,'Loaded through DB 14C');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('DB_14C_SUCCESS',JSON.stringify({
  version:first.dbVersion,
  preloadedBeforeApp:true,
  canonicalReadViaDb:true,
  persistedAcrossReload:true
}));

await context.close();
await browser.close();
