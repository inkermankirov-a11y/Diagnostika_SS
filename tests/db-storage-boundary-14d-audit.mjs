import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dbSource=fs.readFileSync('core/database.js','utf8');
const appSource=fs.readFileSync('app.js','utf8');
const storeSource=fs.readFileSync('core/store-bridge.js','utf8');
const bootstrapSource=fs.readFileSync('core/bootstrap.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(dbSource.includes("const VERSION = '14D'"),'DB 14D version marker missing');
assert(dbSource.includes('function createLocalStorageBackend()'),'Storage backend driver missing');
assert(dbSource.includes('const backend = createLocalStorageBackend()'),'Database backend selection missing');
assert(dbSource.includes('backend.readRaw(key)'),'DB reads bypass backend driver');
assert(dbSource.includes('backend.writeRaw(key, raw)'),'DB writes bypass backend driver');
assert(dbSource.includes('backend.removeRaw(key)'),'DB removals bypass backend driver');
assert(appSource.includes("db.readState({source:'app-load'})"),'App read path bypasses DB');
assert(appSource.includes("db.writeState(state,{source:options.source||'app-save'})"),'App write path bypasses DB');
assert(!appSource.includes('localStorage'),'app.js still knows the localStorage backend');
assert(!appSource.includes('diagnostika-web-v1'),'app.js still knows the canonical storage key');
assert(!storeSource.includes('localStorage'),'StoreBridge still knows the localStorage backend');
assert(!storeSource.includes('forceLegacy'),'StoreBridge still exposes a legacy storage bypass');
assert(!storeSource.includes('store-legacy-fallback'),'StoreBridge legacy fallback remains');
assert(/core\/database\.js\?v=20260919-db14d/.test(bootstrapSource),'DB 14D bootstrap marker missing');
assert(/core\/store-bridge\.js\?v=20260919-db14d/.test(bootstrapSource),'DB 14D store marker missing');

function runtimeJsFiles(dir='.') {
  const result=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(['.git','node_modules','tests'].includes(entry.name))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()){
      if(entry.name==='.github')continue;
      result.push(...runtimeJsFiles(full));
    }else if(entry.isFile()&&entry.name.endsWith('.js')){
      result.push(full.replace(/^\.\//,''));
    }
  }
  return result;
}

const canonicalKeyOffenders=runtimeJsFiles()
  .filter(file=>file!=='core/database.js')
  .filter(file=>fs.readFileSync(file,'utf8').includes('diagnostika-web-v1'));
assert.deepEqual(canonicalKeyOffenders,[],'Canonical storage key leaked outside database core');

const buildMatch=indexSource.match(/<meta name="diagnostika-build" content="([^"]+)">/);
const bootstrapMatch=indexSource.match(/core\/bootstrap\.js\?v=([^"&]+)&api=13d/);
const loaderMatch=indexSource.match(/app-loader\.js\?v=([^"&]+)&api=13d/);
assert(buildMatch&&bootstrapMatch&&loaderMatch,'DB 14D global runtime markers missing');
assert.equal(buildMatch[1],'20260919-db14d');
assert.equal(buildMatch[1],bootstrapMatch[1],'DB 14D build/bootstrap marker mismatch');
assert.equal(buildMatch[1],loaderMatch[1],'DB 14D build/app-loader marker mismatch');

const fixture={version:4,clients:[{
  id:'db14d-client',
  name:'DB 14D Client',
  city:'',
  requests:[{id:'db14d-r1',title:'Before DB 14D',situations:[]}],
  sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','db14d-client');
  if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

async function ready(){
  await page.waitForFunction(()=>window.DiagnostikaDB?.version==='14D'
    && window.DiagnostikaClients?.moduleAware===true
    && window.DiagnostikaPlatform?.store?.persist
    && document.documentElement.classList.contains('diagnostika-dashboard-ready'),
    null,{timeout:20000});
}

await page.goto('http://127.0.0.1:8000/index.html?db-14d=1',{waitUntil:'commit',timeout:10000});
await ready();

await page.evaluate(()=>{
  window.__db14dWrites=[];
  window.DiagnostikaPlatform.events.on('db:written',detail=>{
    window.__db14dWrites.push({
      key:detail?.key||null,
      source:detail?.source||null
    });
  });
});

const clientUpdated=await page.evaluate(()=>Boolean(window.DiagnostikaClients.update(
  'db14d-client',{city:'Boundary City'},{render:false,source:'db14d-client-update'}
)));
assert.equal(clientUpdated,true,'Client write failed through DB boundary');

const appSaved=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.findById('db14d-client');
  const r=c?.requests?.find(x=>x.id==='db14d-r1');
  if(!r||typeof window.save!=='function')return false;
  r.title='After DB 14D';
  return window.save({source:'db14d-app-save'})===true;
});
assert.equal(appSaved,true,'App write failed through DB boundary');

const storeSaved=await page.evaluate(()=>window.DiagnostikaPlatform.store.persist({
  source:'db14d-store-persist'
})===true);
assert.equal(storeSaved,true,'StoreBridge write failed through DB boundary');

await page.waitForFunction(()=>{
  const rows=window.__db14dWrites||[];
  return rows.some(x=>x.source==='client-service-persist')
    && rows.some(x=>x.source==='db14d-app-save')
    && rows.some(x=>x.source==='db14d-store-persist');
},null,{timeout:5000});

const beforeReload=await page.evaluate(()=>{
  const db=window.DiagnostikaDB;
  const saved=db.readState({source:'db14d-verify'});
  const c=saved?.clients?.find(x=>x.id==='db14d-client');
  return {
    health:db.health(),
    writes:window.__db14dWrites,
    city:c?.city||null,
    title:c?.requests?.find(x=>x.id==='db14d-r1')?.title||null
  };
});

assert.equal(beforeReload.health.version,'14D');
assert.equal(beforeReload.health.backend,'localStorage');
assert.equal(beforeReload.health.backendSynchronous,true);
assert.equal(beforeReload.city,'Boundary City');
assert.equal(beforeReload.title,'After DB 14D');

await page.reload({waitUntil:'commit',timeout:10000});
await ready();

const restored=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.findById('db14d-client');
  return {
    city:c?.city||null,
    title:c?.requests?.find(x=>x.id==='db14d-r1')?.title||null
  };
});
assert.equal(restored.city,'Boundary City','DB boundary client write did not survive reload');
assert.equal(restored.title,'After DB 14D','DB boundary app write did not survive reload');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('DB_14D_SUCCESS',JSON.stringify({
  version:beforeReload.health.version,
  backend:beforeReload.health.backend,
  canonicalKeyIsolated:true,
  appStorageAgnostic:true,
  storeStorageAgnostic:true,
  persistedAcrossReload:true
}));

await context.close();
await browser.close();
