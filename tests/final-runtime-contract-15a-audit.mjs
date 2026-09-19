import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtimeSource=fs.readFileSync('core/runtime-contract.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(runtimeSource.includes("const VERSION = '15A'"),'FINAL 15A runtime version missing');
assert(runtimeSource.includes("'clients','requests','diagnosis','sessions','files','export','calendar','payments','ai'"),'Required module manifest missing');
assert(runtimeSource.includes("'clients','requests','diagnosis','sessions','files','export','calendar','payments','ai','roles'"),'Required API manifest missing');
assert(runtimeSource.includes("db: '14D'"),'DB 14D runtime contract missing');
assert(runtimeSource.includes("api: '13D'"),'API 13D runtime contract missing');
assert(runtimeSource.includes("access: '11D'"),'Access 11D runtime contract missing');
assert(runtimeSource.includes("modules: '11D'"),'ModuleRegistry 11D runtime contract missing');
assert(loaderSource.includes("core/runtime-contract.js?v=20260919-final15a"),'FINAL 15A runtime loader missing');
assert(loaderSource.includes("api.onload=loadRuntimeContract"),'Runtime contract is not after the final API load');
assert(indexSource.includes('app-loader.js?v=20260919-db14d&api=13d&final=15a'),'FINAL 15A app-loader cache marker missing');

const fixture={version:4,clients:[{
  id:'final15a-client',
  name:'FINAL 15A Client',
  currentRequestId:'final15a-r1',
  requests:[{id:'final15a-r1',title:'Architecture closure',status:'active',situations:[]}],
  sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','final15a-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?final-15a=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>window.DiagnostikaRuntime?.version==='15A',null,{timeout:20000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});

const initial=await page.evaluate(async()=>{
  const report=await window.DiagnostikaRuntime.ready;
  return {
    sameBridge:window.DiagnostikaRuntime===window.DiagnostikaPlatform.runtime,
    frozen:Object.isFrozen(window.DiagnostikaRuntime),
    report,
    moduleIds:[...window.DiagnostikaRuntime.requiredModules],
    apiIds:[...window.DiagnostikaRuntime.requiredApis],
    serviceIds:[...window.DiagnostikaRuntime.requiredServices]
  };
});

assert.equal(initial.sameBridge,true);
assert.equal(initial.frozen,true);
assert.equal(initial.report.ready,true,JSON.stringify(initial.report.issues));
assert.equal(initial.report.status,'ready');
assert.equal(initial.report.role,'specialist');
assert.equal(initial.report.versions.db,'14D');
assert.equal(initial.report.versions.api,'13D');
assert.equal(initial.report.versions.access,'11D');
assert.equal(initial.report.versions.modules,'11D');
assert.equal(initial.report.db.backend,'localStorage');
assert.equal(initial.report.apiSummary.ready,true);
assert.equal(initial.moduleIds.length,9);
assert.equal(initial.apiIds.length,10);
assert.equal(initial.serviceIds.length,9);
assert(initial.report.modules.every(x=>x.ready&&x.status==='started'));
assert(initial.report.apis.every(x=>x.ready));
assert(initial.report.services.every(x=>x.ready));

const clientRole=await page.evaluate(async()=>{
  window.DiagnostikaRoles.set('client',{source:'final15a-client-role'});
  await window.DiagnostikaRoles.settled();
  return window.DiagnostikaRuntime.refresh({source:'final15a-client-health'});
});

assert.equal(clientRole.ready,true,JSON.stringify(clientRole.issues));
assert.equal(clientRole.role,'client');
assert(clientRole.modules.every(x=>x.ready&&x.status==='blocked'&&x.allowed===false));
const restrictedApis=clientRole.apis.filter(x=>x.id!=='roles');
assert(restrictedApis.every(x=>x.ready&&x.status==='blocked'));
assert.equal(clientRole.apis.find(x=>x.id==='roles')?.status,'ready');

const restored=await page.evaluate(async()=>{
  window.DiagnostikaRoles.set('specialist',{source:'final15a-specialist-role'});
  await window.DiagnostikaRoles.settled();
  return window.DiagnostikaRuntime.refresh({source:'final15a-specialist-health'});
});

assert.equal(restored.ready,true,JSON.stringify(restored.issues));
assert.equal(restored.role,'specialist');
assert(restored.modules.every(x=>x.ready&&x.status==='started'));
assert(restored.apis.every(x=>x.ready));
assert.deepEqual(restored.issues,[]);

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('FINAL_15A_SUCCESS',JSON.stringify({
  runtimeVersion:initial.report.version,
  specialistReady:true,
  clientRoleReady:true,
  specialistRestored:true,
  requiredModules:initial.moduleIds.length,
  requiredApis:initial.apiIds.length,
  requiredServices:initial.serviceIds.length
}));

await context.close();
await browser.close();
