import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const registrySource=fs.readFileSync('core/api-registry.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');
const bootstrapSource=fs.readFileSync('core/bootstrap.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(registrySource.includes("version:'13D'"),'API registry is not 13D');
assert(registrySource.includes("const RESTRICTED_ROLES=Object.freeze(['specialist','admin'])"),'API role metadata missing');
assert(registrySource.includes('options.reportError!==false'),'API error de-dup hardening missing');
assert(bootstrapSource.includes('core/api-registry.js?v=20260919-api13d'),'API 13D CORE marker missing');

for(const marker of [
  'ai-api.js?v=20260919-ai6d&api=13d',
  'payment-api.js?v=20260918-payment5d&api=13d',
  'calendar-api.js?v=20260919-calendar8d&api=13d',
  'export-api.js?v=20260919-export10d&api=13d',
  'files-api.js?v=20260919-files9d&api=13d',
  'session-api.js?v=20260918-sessions4c&api=13d',
  'diagnosis-api.js?v=20260919-diagnosis7a&api=13d',
  'request-api.js?v=20260918-requests3d&api=13d',
  'client-api.js?v=20260918-clients2b2&api=13d'
])assert(loaderSource.includes(marker),'API 13D facade marker missing '+marker);

for(const marker of [
  'core/bootstrap.js?v=20260919-roles11d&api=13d',
  'diagnosis-api.js?v=20260919-diagnosis7d&api=13d',
  'app-loader.js?v=20260919-roles11d&api=13d'
])assert(indexSource.includes(marker),'API 13D index marker missing '+marker);

const fixture={version:4,clients:[{
  id:'api13d-client',
  name:'API 13D Client',
  currentRequestId:'api13d-r1',
  requests:[{id:'api13d-r1',title:'API hardening',status:'active',situations:[]}],
  sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','api13d-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?api-13d=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaAPI?.version==='13D'
  && window.DiagnostikaAPI.ready().ready===true,
  null,{timeout:20000});

const contractState=await page.evaluate(()=>{
  const api=window.DiagnostikaAPI;
  const clients=api.contract('clients');
  const roles=api.contract('roles');
  const unknown=api.health('__missing_api__');
  let conflict=null;

  const same=api.register('clients',{
    global:'DiagnostikaClients',
    service:'clients',
    module:'clients',
    roles:['specialist','admin'],
    methods:['list','current','currentId','findById','select','create','update','trashList','findDeletedById','remove','restore','purge','openDatabase']
  });

  try{
    api.register('clients',{
      global:'DiagnostikaClients',
      service:'clients',
      module:'clients',
      roles:['admin'],
      methods:['list']
    });
  }catch(error){
    conflict={name:error.name,message:error.message};
  }

  return {
    apiFrozen:Object.isFrozen(api),
    clientsFrozen:Object.isFrozen(clients),
    clientRolesFrozen:Object.isFrozen(clients.roles),
    clientsRoles:[...clients.roles],
    rolesRoles:[...roles.roles],
    sameId:same.id,
    conflict,
    unknown
  };
});

assert.equal(contractState.apiFrozen,true);
assert.equal(contractState.clientsFrozen,true);
assert.equal(contractState.clientRolesFrozen,true);
assert.deepEqual(contractState.clientsRoles,['specialist','admin']);
assert.deepEqual(contractState.rolesRoles,[]);
assert.equal(contractState.sameId,'clients');
assert(contractState.conflict?.message.includes('API contract already registered: clients'));
assert.equal(contractState.unknown.status,'unknown');
assert.equal(contractState.unknown.ready,false);

const errorState=await page.evaluate(async()=>{
  const api=window.DiagnostikaAPI;
  window.__api13dErrors=[];
  window.DiagnostikaPlatform.events.on('api:error',detail=>{
    window.__api13dErrors.push({id:detail?.id,method:detail?.method,message:detail?.error?.message});
  });

  window.DiagnostikaPlatform.services.api13fixture={
    syncBoom(){throw new Error('sync boom');},
    asyncBoom(){return Promise.reject(new Error('async boom'));},
    ok(value){return value;}
  };

  api.register('api13fixture',{
    global:'',
    service:'api13fixture',
    module:null,
    roles:[],
    methods:['syncBoom','asyncBoom','ok']
  });

  const syncValue=api.invokeService('api13fixture','syncBoom',[],'sync-fallback');
  const asyncValue=await api.invokeServiceAsync('api13fixture','asyncBoom',[],'async-fallback');
  const ok=api.invokeService('api13fixture','ok',['ok-value'],'fallback');

  return {
    syncValue,
    asyncValue,
    ok,
    errors:window.__api13dErrors
  };
});

assert.equal(errorState.syncValue,'sync-fallback');
assert.equal(errorState.asyncValue,'async-fallback');
assert.equal(errorState.ok,'ok-value');
assert.equal(errorState.errors.filter(x=>x.method==='syncBoom').length,1,'sync API error emitted more than once');
assert.equal(errorState.errors.filter(x=>x.method==='asyncBoom').length,1,'async API error emitted more than once');

await page.evaluate(async()=>{
  window.DiagnostikaRoles.set('client',{source:'api13d-role'});
  await window.DiagnostikaRoles.settled();
});
const blockedEarly=await page.evaluate(()=>({
  clientsAllowed:window.DiagnostikaAPI.allowed('clients'),
  rolesAllowed:window.DiagnostikaAPI.allowed('roles'),
  clientsStatus:window.DiagnostikaAPI.health('clients').status,
  rolesStatus:window.DiagnostikaAPI.health('roles').status
}));
assert.equal(blockedEarly.clientsAllowed,false);
assert.equal(blockedEarly.rolesAllowed,true);
assert.equal(blockedEarly.clientsStatus,'blocked');
assert.equal(blockedEarly.rolesStatus,'ready');

await page.evaluate(async()=>{
  window.DiagnostikaRoles.set('specialist',{source:'api13d-role-restore'});
  await window.DiagnostikaRoles.settled();
});
await page.waitForFunction(()=>window.DiagnostikaAPI.health('clients').status==='ready',null,{timeout:10000});

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('API_13D_SUCCESS',JSON.stringify({
  immutableContracts:true,
  errorEventsDeDuplicated:true,
  roleMetadata:true,
  cacheMarkers:true
}));

await context.close();
await browser.close();
