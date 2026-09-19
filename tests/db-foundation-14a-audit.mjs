import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dbSource=fs.readFileSync('core/database.js','utf8');
const bootstrapSource=fs.readFileSync('core/bootstrap.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(/const VERSION = '14[A-Z]';/.test(dbSource),'DB 14.x version marker missing');
assert(dbSource.includes("const STATE_KEY = 'diagnostika-web-v1'"),'Canonical state key missing');
assert(dbSource.includes('function readState('),'readState contract missing');
assert(dbSource.includes('function writeState('),'writeState contract missing');
assert(dbSource.includes('function health('),'DB health contract missing');
assert(dbSource.includes('window.DiagnostikaDB = db'),'DiagnostikaDB global bridge missing');
assert(/\['db', 'core\/database\.js\?v=20260919-db14[a-z]'\]/.test(bootstrapSource),'DB CORE loader missing');
const dbBuildMatch=indexSource.match(/<meta name="diagnostika-build" content="([^"]+)">/);
const dbBootstrapMatch=indexSource.match(/core\/bootstrap\.js\?v=([^"&]+)&api=13d/);
const dbLoaderMatch=indexSource.match(/app-loader\.js\?v=([^"&]+)&api=13d/);
assert(dbBuildMatch,'DB global build marker missing');
assert(dbBootstrapMatch,'DB CORE loader marker missing');
assert(dbLoaderMatch,'DB app-loader marker missing');
assert.equal(dbBuildMatch[1],dbBootstrapMatch[1],'DB global build/bootstrap markers differ');
assert.equal(dbBuildMatch[1],dbLoaderMatch[1],'DB global build/app-loader markers differ');

const fixture={version:4,clients:[{
  id:'db14a-client',
  name:'DB 14A Client',
  requests:[],
  sessions:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','db14a-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?db-14a=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>/^14[A-Z]$/.test(window.DiagnostikaDB?.version||''),null,{timeout:20000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});

const result=await page.evaluate(()=>{
  const db=window.DiagnostikaDB;
  const before=localStorage.getItem(db.stateKey);
  const state=db.readState({source:'db14a-audit'});
  const testKey='diagnostika-db14a-audit-temp';
  const writeOk=db.write(testKey,{ok:true,nested:{value:14}},{source:'db14a-audit'});
  const testValue=db.read(testKey,null,{source:'db14a-audit'});
  const removeOk=db.remove(testKey,{source:'db14a-audit'});
  const after=localStorage.getItem(db.stateKey);
  return {
    frozen:Object.isFrozen(db),
    sameBridge:db===window.DiagnostikaPlatform.db,
    health:db.health(),
    state,
    before,
    after,
    writeOk,
    testValue,
    removeOk,
    tempExists:localStorage.getItem(testKey)!==null
  };
});

assert.equal(result.frozen,true);
assert.equal(result.sameBridge,true);
assert.equal(result.health.status,'ready');
assert.equal(result.health.ready,true);
assert(/^14[A-Z]$/.test(result.health.version),'DB foundation version is not 14.x');
assert.equal(result.health.backend,'localStorage');
assert.equal(result.health.stateKey,'diagnostika-web-v1');
assert.equal(result.health.schemaVersion,4);
assert.equal(result.state.clients.length,1);
assert.equal(result.state.clients[0].id,'db14a-client');
assert.equal(result.writeOk,true);
assert.deepEqual(result.testValue,{ok:true,nested:{value:14}});
assert.equal(result.removeOk,true);
assert.equal(result.tempExists,false);
assert.equal(result.after,result.before,'DB 14A foundation mutated canonical state during read-only boot');

const invalid=await page.evaluate(()=>{
  const db=window.DiagnostikaDB;
  localStorage.setItem('diagnostika-db14a-invalid','{bad json');
  const fallback=db.read('diagnostika-db14a-invalid',{safe:true},{source:'db14a-invalid'});
  localStorage.removeItem('diagnostika-db14a-invalid');
  return fallback;
});
assert.deepEqual(invalid,{safe:true});

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('DB_14A_SUCCESS',JSON.stringify({
  version:result.health.version,
  backend:result.health.backend,
  canonicalStateUntouched:true,
  tempRoundTrip:true
}));

await context.close();
await browser.close();
