import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const fixture={version:4,clients:[{
  id:'requests-3b-client',
  name:'Requests 3B Client',
  city:'Киров',
  sessions:[],
  currentRequestId:'requests-3b-r1',
  lastDiagnosisRequestId:'requests-3b-r1',
  requests:[
    {id:'requests-3b-r1',title:'Первый запрос',status:'active',createdAt:'2026-09-18T10:00:00.000Z',updatedAt:'2026-09-18T10:00:00.000Z',situations:[]},
    {id:'requests-3b-r2',title:'Второй запрос',status:'active',createdAt:'2026-09-18T11:00:00.000Z',updatedAt:'2026-09-18T11:00:00.000Z',situations:[]}
  ]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','requests-3b-client');
  localStorage.setItem('diagnostika-ui-language','ru');

  const Native=window.MutationObserver;
  window.__requests3bObservers=[];
  window.MutationObserver=class extends Native{
    constructor(cb){
      const row={stack:String(new Error().stack||''),count:0,records:0};
      window.__requests3bObservers.push(row);
      super((records,observer)=>{
        row.count++;
        row.records+=records?.length||0;
        return cb(records,observer);
      });
    }
  };
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaRequests?.moduleAware===true&&window.DiagnostikaRequestsUI?.version==='3B'&&window.DiagnostikaRequestsUI?.ready===true,null,{timeout:15000});
}

await page.goto('http://127.0.0.1:8000/index.html?request-ui-3b='+Date.now(),{waitUntil:'commit',timeout:10000});
await ready();

await page.evaluate(()=>{
  mode='diagnosis';
  renderMode();
  window.DiagnostikaRequests.view('requests-3b-r1',{source:'requests-3b-test-open'});
});
await page.locator('#diagnosticsLeft').waitFor({state:'visible',timeout:5000});
await page.waitForTimeout(100);

await page.evaluate(()=>{
  window.__requests3bEvents=[];
  for(const type of ['request:created','request:selected','request:updated','request:activated','request:completed','request:resumed','request:deleted']){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__requests3bEvents.push({type,detail:{...detail}}));
  }
});

const baseline=await page.evaluate(()=>({
  requests:JSON.stringify(window.DiagnostikaRequests.list()),
  firstUpdated:window.DiagnostikaRequests.get('requests-3b-r1')?.updatedAt,
  secondUpdated:window.DiagnostikaRequests.get('requests-3b-r2')?.updatedAt
}));

await page.selectOption('#requestSelect','requests-3b-r2');
await page.waitForTimeout(100);
const viewed=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  const btn=document.querySelector('.request-current-btn');
  return {
    active:window.DiagnostikaRequests.activeId(),
    viewed:window.DiagnostikaRequests.viewedId(),
    currentRequestId:c.currentRequestId,
    lastDiagnosisRequestId:c.lastDiagnosisRequestId,
    select:document.querySelector('#requestSelect')?.value||'',
    disabled:!!btn?.disabled,
    text:btn?.textContent?.trim()||'',
    requests:JSON.stringify(window.DiagnostikaRequests.list())
  };
});
assert.equal(viewed.active,'requests-3b-r1');
assert.equal(viewed.currentRequestId,'requests-3b-r1');
assert.equal(viewed.lastDiagnosisRequestId,'requests-3b-r1');
assert.equal(viewed.viewed,'requests-3b-r2');
assert.equal(viewed.select,'requests-3b-r2');
assert.equal(viewed.disabled,false);
assert.equal(viewed.requests,baseline.requests,'view() mutated request payload');

await page.locator('.request-current-btn').click();
await page.waitForTimeout(80);
let snap=await page.evaluate(()=>({
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  last:window.DiagnostikaClients.current().lastDiagnosisRequestId,
  requests:JSON.stringify(window.DiagnostikaRequests.list())
}));
assert.equal(snap.active,'requests-3b-r2');
assert.equal(snap.viewed,'requests-3b-r2');
assert.equal(snap.last,'requests-3b-r2');
assert.equal(snap.requests,baseline.requests,'activate() mutated request payload');

page.once('dialog',dialog=>dialog.accept('Второй запрос — обновлён'));
await page.locator('#requestTitleEditBtn').click();
await page.waitForTimeout(100);
assert.equal(await page.evaluate(()=>window.DiagnostikaRequests.get('requests-3b-r2')?.title),'Второй запрос — обновлён');
assert.equal((await page.locator('#requestTitleDisplay').textContent())?.trim(),'Второй запрос — обновлён');

await page.locator('.request-finish-btn').click();
await page.waitForTimeout(100);
snap=await page.evaluate(()=>({
  status:window.DiagnostikaRequests.get('requests-3b-r2')?.status,
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  resumeDisplay:getComputedStyle(document.querySelector('.request-resume-btn')).display
}));
assert.equal(snap.status,'completed');
assert.equal(snap.active,'requests-3b-r1');
assert.equal(snap.viewed,'requests-3b-r2');
assert.notEqual(snap.resumeDisplay,'none');

await page.locator('.request-resume-btn').click();
await page.waitForTimeout(100);
snap=await page.evaluate(()=>({
  status:window.DiagnostikaRequests.get('requests-3b-r2')?.status,
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId()
}));
assert.deepEqual(snap,{status:'active',active:'requests-3b-r2',viewed:'requests-3b-r2'});

const countBefore=await page.evaluate(()=>window.DiagnostikaRequests.list().length);
await page.locator('#addRequestBtn').click();
await page.waitForTimeout(100);
const created=await page.evaluate(()=>({
  count:window.DiagnostikaRequests.list().length,
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  title:window.DiagnostikaRequests.viewed()?.title||''
}));
assert.equal(created.count,countBefore+1);
assert.equal(created.active,created.viewed);
assert.equal(created.title,'Новый запрос');

page.once('dialog',dialog=>dialog.accept());
await page.locator('#deleteRequestBtn').click();
await page.waitForTimeout(100);
assert.equal(await page.evaluate(()=>window.DiagnostikaRequests.list().length),countBefore);

const secondClient=await page.evaluate(()=>{
  const c=newClient();
  c.id='requests-3b-client-2';
  c.name='Requests 3B Client 2';
  c.requests=[{id:'requests-3b-c2-r1',title:'Запрос второго клиента',status:'active',createdAt:'2026-09-18T12:00:00.000Z',updatedAt:'2026-09-18T12:00:00.000Z',situations:[]}];
  c.currentRequestId=c.requests[0].id;
  c.lastDiagnosisRequestId=c.requests[0].id;
  state.clients.push(c);
  save();
  return c.id;
});
assert.equal(await page.evaluate(id=>window.DiagnostikaClients.select(id),secondClient),true);
await page.waitForTimeout(100);
snap=await page.evaluate(()=>({
  client:window.DiagnostikaClients.currentId(),
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  select:document.querySelector('#requestSelect')?.value||''
}));
assert.deepEqual(snap,{client:'requests-3b-client-2',active:'requests-3b-c2-r1',viewed:'requests-3b-c2-r1',select:'requests-3b-c2-r1'});

assert.equal(await page.evaluate(()=>window.DiagnostikaClients.select('requests-3b-client')),true);
await page.waitForTimeout(100);
assert.equal(await page.evaluate(()=>window.DiagnostikaRequests.activate('requests-3b-r2',{source:'requests-3b-final-active'})),true);

const events=await page.evaluate(()=>window.__requests3bEvents);
const uiPairs=new Map();
for(const event of events){
  const source=event.detail?.source||'';
  if(!source.startsWith('request-ui-')&&source!=='request-title-display')continue;
  const key=event.type+'|'+source;
  uiPairs.set(key,(uiPairs.get(key)||0)+1);
}
for(const [key,count] of uiPairs)assert.equal(count,1,'Duplicate UI event '+key);
assert.equal(events.filter(x=>x.type==='request:selected'&&x.detail.source==='request-ui-view').length,1);
assert.equal(events.filter(x=>x.type==='request:activated'&&x.detail.source==='request-ui-view').length,0);
assert.equal(events.filter(x=>x.type==='request:updated'&&x.detail.source==='request-title-display').length,1);

const observers=await page.evaluate(()=>(window.__requests3bObservers||[]).map(x=>({stack:x.stack,count:x.count,records:x.records})));
const requestSelectObservers=observers.filter(x=>x.stack.includes('request-select-labels.js'));
const requestDateObservers=observers.filter(x=>x.stack.includes('request-date-unsaved.js'));
assert.equal(requestSelectObservers.length,1,'Request UI should keep only one scoped legacy compatibility observer until 3C');
assert.equal(requestDateObservers.length,0,'request-date-unsaved.js must not own request DOM observation');

await page.reload({waitUntil:'commit'});
await ready();
const reloaded=await page.evaluate(()=>({
  client:window.DiagnostikaClients.currentId(),
  active:window.DiagnostikaRequests.activeId(),
  viewed:window.DiagnostikaRequests.viewedId(),
  title:window.DiagnostikaRequests.get('requests-3b-r2')?.title||'',
  status:window.DiagnostikaRequests.get('requests-3b-r2')?.status||''
}));
assert.equal(reloaded.client,'requests-3b-client');
assert.equal(reloaded.active,'requests-3b-r2');
assert.equal(reloaded.viewed,'requests-3b-r2');
assert.equal(reloaded.title,'Второй запрос — обновлён');
assert.equal(reloaded.status,'active');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('REQUEST_UI_3B_SUCCESS',JSON.stringify({viewed,created,reloaded,eventCount:events.length,requestSelectObservers:requestSelectObservers.length}));
await context.close();
await browser.close();
