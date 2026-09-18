import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const fixture={version:4,clients:[
  {id:'clients-2a-a',name:'Clients 2A A',city:'Киров',sessions:[],requests:[],currentRequestId:null,lastDiagnosisRequestId:null},
  {id:'clients-2a-b',name:'Clients 2A B',city:'Москва',sessions:[],requests:[],currentRequestId:null,lastDiagnosisRequestId:null}
]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','clients-2a-a');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')pageErrors.push(m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

await page.goto(base,{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>{
  const p=window.DiagnostikaPlatform;
  return p?.status==='ready'
    && p?.modules?.get?.('clients')?.status==='started'
    && !!p?.services?.clients
    && !!window.DiagnostikaClients?.moduleAware;
},null,{timeout:10000});

const architecture=await page.evaluate(()=>{
  const p=window.DiagnostikaPlatform;
  const mod=p.modules.get('clients');
  const service=p.services.clients;
  return {
    status:mod?.status,
    roles:mod?.roles||[],
    sameActiveService:p.clients===service,
    facadeVersion:window.DiagnostikaClients.version,
    moduleAware:window.DiagnostikaClients.moduleAware,
    events:{...service.events},
    list:service.list().map(c=>({id:c.id,name:c.name})),
    facadeList:window.DiagnostikaClients.list().map(c=>({id:c.id,name:c.name})),
    found:service.findById('clients-2a-b')?.name||null,
    facadeFound:window.DiagnostikaClients.findById('clients-2a-b')?.name||null,
    currentId:service.currentId(),
    currentName:service.current()?.name||null
  };
});

assert.equal(architecture.status,'started');
assert.deepEqual([...architecture.roles].sort(),['admin','specialist']);
assert.equal(architecture.sameActiveService,true);
assert.equal(architecture.facadeVersion,'2B1');
assert.equal(architecture.moduleAware,true);
assert.deepEqual(architecture.events,{
  created:'client:created',
  selected:'client:selected',
  updated:'client:updated',
  deleted:'client:deleted',
  restored:'client:restored'
});
assert.equal(architecture.list.length,2);
assert.deepEqual(architecture.facadeList,architecture.list);
assert.equal(architecture.found,'Clients 2A B');
assert.equal(architecture.facadeFound,'Clients 2A B');
assert.equal(architecture.currentId,'clients-2a-a');
assert.equal(architecture.currentName,'Clients 2A A');

const persistedBefore=await page.evaluate(()=>localStorage.getItem('diagnostika-web-v1'));
await page.evaluate(()=>{
  window.__clients2aEvents=[];
  window.DiagnostikaPlatform.events.on('client:selected',detail=>window.__clients2aEvents.push(detail));
});

const selected=await page.evaluate(()=>window.DiagnostikaClients.select('clients-2a-b'));
assert.equal(selected,true);
await page.waitForTimeout(50);

const afterSelect=await page.evaluate(()=>({
  serviceId:window.DiagnostikaPlatform.services.clients.currentId(),
  facadeId:window.DiagnostikaClients.currentId(),
  currentName:window.DiagnostikaClients.current()?.name||null,
  events:window.__clients2aEvents.map(x=>({...x})),
  remembered:localStorage.getItem('diagnostika-last-client-id')
}));
assert.equal(afterSelect.serviceId,'clients-2a-b');
assert.equal(afterSelect.facadeId,'clients-2a-b');
assert.equal(afterSelect.currentName,'Clients 2A B');
assert.equal(afterSelect.events.length,1);
assert.equal(afterSelect.events[0].clientId,'clients-2a-b');
assert.equal(afterSelect.events[0].previousClientId,'clients-2a-a');
assert.equal(afterSelect.events[0].source,'client-service');
assert.equal(afterSelect.remembered,'clients-2a-b');

const persistedAfter=await page.evaluate(()=>localStorage.getItem('diagnostika-web-v1'));
assert.equal(persistedAfter,persistedBefore,'Selecting a client must not mutate persisted client data');

const stress=await page.evaluate(()=>{
  const service=window.DiagnostikaPlatform.services.clients;
  for(let i=0;i<100;i++){
    const expected=i%2===0?'clients-2a-a':'clients-2a-b';
    if(service.select(expected)!==true) return {ok:false,iteration:i,expected,current:service.currentId()};
    if(String(service.currentId())!==expected) return {ok:false,iteration:i,expected,current:service.currentId()};
  }
  return {
    ok:true,
    current:service.currentId(),
    eventCount:window.__clients2aEvents.length,
    remembered:localStorage.getItem('diagnostika-last-client-id'),
    persisted:localStorage.getItem('diagnostika-web-v1')
  };
});
assert.equal(stress.ok,true,JSON.stringify(stress));
assert.equal(stress.current,'clients-2a-b');
assert.equal(stress.eventCount,101);
assert.equal(stress.remembered,'clients-2a-b');
assert.equal(stress.persisted,persistedBefore,'100 client switches mutated persisted client data');

const invalid=await page.evaluate(()=>{
  const before=window.DiagnostikaClients.currentId();
  const eventCount=window.__clients2aEvents.length;
  const result=window.DiagnostikaClients.select('__missing_client__');
  return {before,after:window.DiagnostikaClients.currentId(),result,eventCount,afterEventCount:window.__clients2aEvents.length};
});
assert.equal(invalid.result,false);
assert.equal(invalid.before,invalid.after);
assert.equal(invalid.eventCount,invalid.afterEventCount);

const serious=pageErrors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');
console.log('CLIENT_MODULE_2A_AUDIT_SUCCESS',JSON.stringify({architecture,afterSelect,stress,invalid}));

await context.close();
await browser.close();
