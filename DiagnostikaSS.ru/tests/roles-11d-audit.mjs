import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const accessSource=fs.readFileSync('core/access-control.js','utf8');
const registrySource=fs.readFileSync('core/module-registry.js','utf8');
const apiSource=fs.readFileSync('roles-api.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');

assert(accessSource.includes("version: '11D'"),'AccessControl is not 11A');
assert(accessSource.includes('function moduleAllowed('),'AccessControl module gate missing');
assert(accessSource.includes('function requireModule('),'AccessControl module guard missing');
assert(registrySource.includes("version: '11D'"),'ModuleRegistry is not 11B');
assert(registrySource.includes('async function reconcileAccess('),'ModuleRegistry role reconciliation missing');
assert(registrySource.includes("record.status = 'blocked'"),'ModuleRegistry blocked state missing');
assert(registrySource.includes("'module:access-denied'"),'ModuleRegistry access-denied event missing');
assert(apiSource.includes("version:'11D'"),'Roles facade is not 11C');
assert(loaderSource.includes('roles-api.js?v=20260919-roles11d'),'Roles facade loader marker missing');

const fixture={version:4,clients:[{
  id:'roles-client',
  name:'Roles Test Client',
  currentRequestId:'roles-r1',
  requests:[{id:'roles-r1',title:'Roles test',status:'active',situations:[]}],
  sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','roles-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?roles-11c=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaRoles?.version==='11D'
  && window.DiagnostikaPlatform?.access?.version==='11D'
  && window.DiagnostikaPlatform?.modules?.version==='11D',
  null,{timeout:15000});

const moduleIds=['clients','requests','diagnosis','sessions','files','export','calendar','payments','ai'];

await page.waitForFunction(ids=>ids.every(id=>window.DiagnostikaPlatform.modules.get(id)?.status==='started'),moduleIds,{timeout:15000});

const initial=await page.evaluate(ids=>{
  const api=window.DiagnostikaRoles;
  window.__rolesAuditEvents=[];
  for(const type of ['access:role-changed','access:role-settled','module:access-denied','module:access-reconciled','module:stopped','module:started']){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__rolesAuditEvents.push({type,detail:{...detail,error:undefined}}));
  }
  window.DiagnostikaPlatform.modules.register({
    id:'roles-public-fixture',
    roles:[],
    async init(){window.__rolesPublicStarts=(window.__rolesPublicStarts||0)+1;return {ok:true};},
    async destroy(){window.__rolesPublicStops=(window.__rolesPublicStops||0)+1;}
  });
  return Promise.resolve(window.DiagnostikaPlatform.modules.start('roles-public-fixture',{source:'roles-audit'})).then(()=>({
    role:api.current(),
    roles:api.roles,
    modules:ids.map(id=>api.module(id)),
    publicModule:api.module('roles-public-fixture'),
    specialistCan:api.can('specialist:clients'),
    clientCan:api.can('client:profile','client'),
    adminCan:api.can('anything:anywhere','admin')
  }));
},moduleIds);

assert.equal(initial.role,'specialist');
assert.equal(initial.specialistCan,true);
assert.equal(initial.clientCan,true);
assert.equal(initial.adminCan,true);
assert.equal(initial.publicModule.status,'started');
for(const record of initial.modules){
  assert.equal(record.status,'started');
  assert(record.roles.includes('specialist'));
  assert(record.roles.includes('admin'));
  assert.equal(record.allowed,true);
}

await page.evaluate(()=>window.DiagnostikaRoles.set('client',{source:'roles-audit-client'}));
await page.waitForFunction(ids=>ids.every(id=>window.DiagnostikaPlatform.modules.get(id)?.status==='blocked'),moduleIds,{timeout:10000});

const clientState=await page.evaluate(async ids=>{
  let denied=null;
  try{
    await window.DiagnostikaPlatform.modules.start('clients',{source:'roles-audit-denied-start'});
  }catch(error){
    denied={name:error.name,role:error.role,moduleId:error.moduleId,message:error.message};
  }
  return {
    role:window.DiagnostikaRoles.current(),
    revision:window.DiagnostikaRoles.revision(),
    canClients:window.DiagnostikaRoles.canUseModule('clients'),
    clientPermission:window.DiagnostikaRoles.can('client:profile'),
    specialistPermission:window.DiagnostikaRoles.can('specialist:clients'),
    modules:ids.map(id=>window.DiagnostikaRoles.module(id)),
    publicModule:window.DiagnostikaRoles.module('roles-public-fixture'),
    denied,
    events:window.__rolesAuditEvents
  };
},moduleIds);

assert.equal(clientState.role,'client');
assert.equal(clientState.canClients,false);
assert.equal(clientState.clientPermission,true);
assert.equal(clientState.specialistPermission,false);
assert.equal(clientState.publicModule.status,'started');
assert.equal(clientState.publicModule.allowed,true);
assert.equal(clientState.denied?.name,'DiagnostikaAccessDeniedError');
assert.equal(clientState.denied?.role,'client');
assert.equal(clientState.denied?.moduleId,'clients');
for(const record of clientState.modules){
  assert.equal(record.status,'blocked');
  assert.equal(record.allowed,false);
  assert.equal(record.desired,true);
}
assert(clientState.events.some(x=>x.type==='access:role-changed'&&x.detail?.role==='client'));
assert(clientState.events.some(x=>x.type==='access:role-settled'&&x.detail?.role==='client'));
assert(clientState.events.some(x=>x.type==='module:access-reconciled'&&x.detail?.role==='client'));
assert(clientState.events.some(x=>x.type==='module:access-denied'&&x.detail?.id==='clients'));

await page.evaluate(()=>window.DiagnostikaRoles.set('admin',{source:'roles-audit-admin'}));
await page.waitForFunction(ids=>ids.every(id=>window.DiagnostikaPlatform.modules.get(id)?.status==='started'),moduleIds,{timeout:10000});

const adminState=await page.evaluate(ids=>({
  role:window.DiagnostikaRoles.current(),
  canClients:window.DiagnostikaRoles.canUseModule('clients'),
  anyPermission:window.DiagnostikaRoles.can('server:admin:anything'),
  modules:ids.map(id=>window.DiagnostikaRoles.module(id)),
  publicModule:window.DiagnostikaRoles.module('roles-public-fixture')
}),moduleIds);

assert.equal(adminState.role,'admin');
assert.equal(adminState.canClients,true);
assert.equal(adminState.anyPermission,true);
assert.equal(adminState.publicModule.status,'started');
for(const record of adminState.modules){
  assert.equal(record.status,'started');
  assert.equal(record.allowed,true);
}

const unknown=await page.evaluate(()=>{
  try{
    window.DiagnostikaRoles.set('superuser',{source:'roles-audit-invalid'});
    return null;
  }catch(error){
    return {name:error.name,message:error.message};
  }
});
assert(unknown?.message.includes('Unknown role: superuser'));

await page.evaluate(async()=>{
  window.DiagnostikaRoles.set('client',{source:'roles-audit-rapid-client'});
  window.DiagnostikaRoles.set('admin',{source:'roles-audit-rapid-admin'});
  window.DiagnostikaRoles.set('specialist',{source:'roles-audit-rapid-specialist'});
  await window.DiagnostikaRoles.settled();
});
await page.waitForFunction(ids=>window.DiagnostikaRoles.current()==='specialist'&&ids.every(id=>window.DiagnostikaPlatform.modules.get(id)?.status==='started'),moduleIds,{timeout:10000});

const finalState=await page.evaluate(()=>({
  role:window.DiagnostikaRoles.current(),
  publicStarts:window.__rolesPublicStarts||0,
  publicStops:window.__rolesPublicStops||0,
  events:window.__rolesAuditEvents
}));
assert.equal(finalState.role,'specialist');
assert.equal(finalState.publicStarts,1);
assert.equal(finalState.publicStops,0);

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('ROLES_11D_SUCCESS',JSON.stringify({
  roleTransitions:['specialist','client','admin','client→admin→specialist'],
  staleReconcileProtection:true,
  restrictedModules:moduleIds.length,
  clientBlocked:true,
  adminRestored:true,
  publicModuleStayedStarted:true
}));

await context.close();
await browser.close();
