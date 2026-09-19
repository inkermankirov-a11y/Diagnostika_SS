import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dbSource=fs.readFileSync('core/database.js','utf8');
const storeSource=fs.readFileSync('core/store-bridge.js','utf8');
const appSource=fs.readFileSync('app.js','utf8');
const clientSource=fs.readFileSync('modules/clients/client-service.js','utf8');
const bootstrapSource=fs.readFileSync('core/bootstrap.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(dbSource.includes("const VERSION = '14B'"),'DB 14B version marker missing');
assert(storeSource.includes('function persist(options = {})'),'Store DB persistence boundary missing');
assert(storeSource.includes('db?.writeState'),'Store does not persist through DB adapter');
assert(appSource.includes("source:options.source||'app-save'"),'app.js DB write source missing');
assert(appSource.includes('db?.writeState'),'app.js does not prefer DB adapter');
assert(clientSource.includes("platform.store?.legacySave?.({ source: 'client-service-persist' })"),'ClientService bypasses store persistence');
assert(bootstrapSource.includes("core/database.js?v=20260919-db14b"),'DB 14B CORE marker missing');
assert(bootstrapSource.includes("core/store-bridge.js?v=20260919-db14b"),'DB 14B store marker missing');

const buildMatch=indexSource.match(/<meta name="diagnostika-build" content="([^"]+)">/);
const bootstrapMatch=indexSource.match(/core\/bootstrap\.js\?v=([^"&]+)&api=13d/);
const loaderMatch=indexSource.match(/app-loader\.js\?v=([^"&]+)&api=13d/);
assert(buildMatch&&bootstrapMatch&&loaderMatch,'DB 14B global runtime markers missing');
assert.equal(buildMatch[1],bootstrapMatch[1],'DB 14B build/bootstrap marker mismatch');
assert.equal(buildMatch[1],loaderMatch[1],'DB 14B build/app-loader marker mismatch');

const fixture={version:4,clients:[{
  id:'db14b-client',
  name:'DB 14B Client',
  city:'',
  currentRequestId:'db14b-r1',
  requests:[{id:'db14b-r1',title:'Before DB 14B',status:'active',situations:[]}],
  sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','db14b-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaDB?.version==='14B'
    && window.DiagnostikaClients?.moduleAware===true
    && window.DiagnostikaPlatform?.store?.persist,
    null,{timeout:20000});
}

await page.goto('http://127.0.0.1:8000/index.html?db-14b=1',{waitUntil:'commit',timeout:10000});
await ready();

await page.evaluate(()=>{
  window.__db14bWrites=[];
  window.DiagnostikaPlatform.events.on('db:written',detail=>{
    window.__db14bWrites.push({key:detail?.key||null,source:detail?.source||null,operation:detail?.operation||null});
  });
});

const clientUpdated=await page.evaluate(()=>Boolean(window.DiagnostikaClients.update(
  'db14b-client',{city:'DB City'},{render:false,source:'db14b-client-update'}
)));
assert.equal(clientUpdated,true,'ClientService DB write failed');

await page.evaluate(()=>{
  const input=document.getElementById('requestTitle');
  if(!input)throw new Error('requestTitle input missing');
  input.value='After DB 14B';
  input.dispatchEvent(new Event('input',{bubbles:true}));
});

await page.waitForFunction(()=>{
  const rows=window.__db14bWrites||[];
  return rows.some(x=>x.key==='diagnostika-web-v1'&&x.source==='client-service-persist')
    && rows.some(x=>x.key==='diagnostika-web-v1'&&x.source==='app-save');
},null,{timeout:5000});

const persisted=await page.evaluate(()=>{
  const saved=JSON.parse(localStorage.getItem('diagnostika-web-v1')||'null');
  const c=saved?.clients?.find(x=>x.id==='db14b-client');
  return {
    db:window.DiagnostikaDB.health(),
    writes:window.__db14bWrites,
    city:c?.city||null,
    title:c?.requests?.find(x=>x.id==='db14b-r1')?.title||null
  };
});

assert.equal(persisted.db.version,'14B');
assert.equal(persisted.city,'DB City');
assert.equal(persisted.title,'After DB 14B');
assert(persisted.writes.some(x=>x.source==='client-service-persist'));
assert(persisted.writes.some(x=>x.source==='app-save'));

await page.reload({waitUntil:'commit',timeout:10000});
await ready();

const restored=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.findById('db14b-client');
  const r=c?.requests?.find(x=>x.id==='db14b-r1');
  return {city:c?.city||null,title:r?.title||null};
});
assert.equal(restored.city,'DB City','Client DB write did not survive reload');
assert.equal(restored.title,'After DB 14B','App DB write did not survive reload');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('DB_14B_SUCCESS',JSON.stringify({
  version:persisted.db.version,
  clientWrite:true,
  appWrite:true,
  persistedAcrossReload:true
}));

await context.close();
await browser.close();
