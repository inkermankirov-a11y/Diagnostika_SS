import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files={
  last:fs.readFileSync('last-client.js','utf8'),
  transfer:fs.readFileSync('client-transfer.js','utf8'),
  forms:fs.readFileSync('form-integrations.js','utf8'),
  ui:fs.readFileSync('ui-fixes.js','utf8')
};

assert.equal(/renderClient\s*=/.test(files.last),false,'last-client must not wrap renderClient');
assert.equal(/state\.clients/.test(files.last),false,'last-client must not read state.clients directly');
assert.match(files.last,/client:selected/);
assert.match(files.last,/api\.select\(savedId/);

for(const token of ['state.clients.push','state.clients[existingIndex]','clientId=incoming.id','window.renderClient=wrapped']){
  assert.equal(files.transfer.includes(token),false,'client-transfer legacy mutation remains: '+token);
}
for(const token of ['api.create(incoming','api.update(existing.id,incoming','api.select(incoming.id']){
  assert.equal(files.transfer.includes(token),true,'client-transfer service path missing: '+token);
}
assert.equal(files.forms.includes('state.clients.push(c)'),false,'form integration still creates client directly');
assert.match(files.forms,/clientsApi\(\)\?\.create\?\./);
assert.equal(/clientId\s*=\s*c\.id/.test(files.ui),false,'ui-fixes still assigns clientId directly');
assert.equal(files.ui.includes('state.clients.forEach'),false,'ui-fixes still lists clients from state');
assert.match(files.ui,/clientUiApi\(\)\?\.select\?\./);

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const fixture={version:4,clients:[
  {id:'legacy-a',name:'Legacy A',city:'Киров',phone:'+70000000001',sessions:[],requests:[]},
  {id:'legacy-b',name:'Legacy B',city:'Москва',phone:'+70000000002',sessions:[],requests:[]}
]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','legacy-b');
  localStorage.setItem('diagnostika-ui-language','ru');
  localStorage.setItem('diagnostika-specialist-name','Audit Specialist');
},fixture);

const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')pageErrors.push(m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

await page.goto(base,{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaClients?.moduleAware&&window.DiagnostikaForms?.importSubmissions,null,{timeout:15000});

await page.waitForFunction(()=>window.DiagnostikaClients.currentId()==='legacy-b',null,{timeout:5000});
assert.equal(await page.evaluate(()=>localStorage.getItem('diagnostika-last-client-id')),'legacy-b');

await page.evaluate(()=>window.DiagnostikaClients.select('legacy-a',{source:'2c1-audit-select'}));
await page.waitForFunction(()=>localStorage.getItem('diagnostika-last-client-id')==='legacy-a',null,{timeout:3000});

await page.evaluate(()=>{
  window.__client2c1Created=[];
  window.DiagnostikaPlatform.events.on('client:created',detail=>window.__client2c1Created.push(detail));
});
const formResult=await page.evaluate(()=>window.DiagnostikaForms.importSubmissions([{
  id:'form-2c1-1',
  externalId:'form-2c1-1',
  source:'yandex',
  profile:{name:'Form 2C1',phone:'+79990001122',city:'Киров'},
  answers:{}
}]));
assert.equal(formResult.imported,1);
assert.equal(formResult.newClients,1);
const formState=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.list().find(x=>x.name==='Form 2C1');
  return {
    id:c?.id||null,
    questionnaireCount:c?.questionnaires?.length||0,
    currentId:window.DiagnostikaClients.currentId(),
    created:window.__client2c1Created.map(x=>({...x}))
  };
});
assert.ok(formState.id);
assert.equal(formState.questionnaireCount,1);
assert.equal(formState.currentId,'legacy-a','form import must not steal current selection');
assert.equal(formState.created.filter(x=>x.clientId===formState.id).length,1);

await page.waitForSelector('input[data-client-transfer-import="1"]',{state:'attached',timeout:5000});
const transferPackage={
  format:'diagnostika-client-transfer-v1',
  version:1,
  exportedBy:'Previous Specialist',
  client:{
    id:'transfer-2c1',
    name:'Transfer 2C1',
    city:'Пермь',
    sessions:[{id:'session-transfer-1',date:'2026-09-18',requestId:'request-transfer-1',notes:'audit'}],
    requests:[{id:'request-transfer-1',title:'Imported request',situations:[]}]
  }
};
await page.setInputFiles('input[data-client-transfer-import="1"]',{
  name:'transfer-2c1.json',
  mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(transferPackage))
});
await page.waitForFunction(()=>window.DiagnostikaClients.findById('transfer-2c1')?.name==='Transfer 2C1',null,{timeout:5000});
await page.waitForFunction(()=>window.DiagnostikaClients.currentId()==='transfer-2c1',null,{timeout:5000});
await page.waitForFunction(()=>localStorage.getItem('diagnostika-last-client-id')==='transfer-2c1',null,{timeout:3000});

const transferState=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.findById('transfer-2c1');
  return {
    name:c?.name,
    requestId:c?.requests?.[0]?.id,
    sessionId:c?.sessions?.[0]?.id,
    currentId:window.DiagnostikaClients.currentId(),
    remembered:localStorage.getItem('diagnostika-last-client-id'),
    originalSpecialist:c?.specialistMeta?.originalSpecialist||'',
    currentSpecialist:c?.specialistMeta?.currentSpecialist||''
  };
});
assert.equal(transferState.name,'Transfer 2C1');
assert.equal(transferState.requestId,'request-transfer-1');
assert.equal(transferState.sessionId,'session-transfer-1');
assert.equal(transferState.currentId,'transfer-2c1');
assert.equal(transferState.remembered,'transfer-2c1');
assert.equal(transferState.originalSpecialist,'Previous Specialist');
assert.equal(transferState.currentSpecialist,'Audit Specialist');

const serious=pageErrors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');
console.log('CLIENT_LEGACY_BOUNDARY_2C1_SUCCESS',JSON.stringify({formResult,formState,transferState}));

await context.close();
await browser.close();
