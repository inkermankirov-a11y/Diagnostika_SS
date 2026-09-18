import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const phase=process.env.CLIENT_TRASH_PHASE||'noncurrent';
const fixture={version:4,clients:[
  {id:'client-a',name:'Alpha',city:'Киров',sessions:[],requests:[{id:'req-a',title:'A',situations:[]}]},
  {id:'client-b',name:'Beta',city:'Москва',sessions:[],requests:[]},
  {id:'client-c',name:'Gamma',city:'Казань',sessions:[],requests:[]}
]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1')) localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id')) localStorage.setItem('diagnostika-last-client-id','client-a');
  if(!localStorage.getItem('diagnostika-ui-language')) localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>{
    const p=window.DiagnostikaPlatform;
    const api=window.DiagnostikaClients;
    return p?.modules?.get?.('clients')?.status==='started'
      && api?.version==='2B2'
      && typeof api?.remove==='function'
      && typeof api?.restore==='function'
      && typeof api?.purge==='function'
      && typeof api?.trashList==='function'
      && typeof window.moveClientToTrashById==='function'
      && typeof window.openDeletedClients==='function';
  },null,{timeout:10000});
}

async function subscribe(){
  await page.evaluate(()=>{
    window.__clientTrashEvents=[];
    for(const type of ['client:deleted','client:selected','client:restored','client:purged']){
      window.DiagnostikaPlatform.events.on(type,detail=>window.__clientTrashEvents.push({type,detail}));
    }
  });
}

await page.goto(base,{waitUntil:'commit',timeout:10000});
await ready();
await subscribe();

assert.equal(await page.locator('#deletedClientsBtn').count(),1,'Trash button must be installed exactly once');
assert.equal(await page.evaluate(()=>window.DiagnostikaClients.currentId()),'client-a');

if(phase==='noncurrent'){
  assert.equal(await page.evaluate(()=>window.moveClientToTrashById('client-b')),true);
  let snap=await page.evaluate(()=>({
    active:window.DiagnostikaClients.list().map(x=>x.id),
    current:window.DiagnostikaClients.currentId(),
    trash:window.DiagnostikaClients.trashList().map(x=>x.id),
    events:window.__clientTrashEvents.map(x=>({type:x.type,detail:{...x.detail}}))
  }));
  assert.deepEqual(snap.active,['client-a','client-c']);
  assert.equal(snap.current,'client-a');
  assert.deepEqual(snap.trash,['client-b']);
  assert.equal(snap.events.filter(x=>x.type==='client:deleted'&&x.detail.clientId==='client-b').length,1);
  assert.equal(snap.events.filter(x=>x.type==='client:selected'&&x.detail.reason==='client-deleted').length,0);

  const restored=await page.evaluate(()=>window.DiagnostikaClients.restore('client-b',{source:'audit-restore'}));
  assert.equal(restored?.id,'client-b');
  snap=await page.evaluate(()=>({
    active:window.DiagnostikaClients.list().map(x=>x.id),
    current:window.DiagnostikaClients.currentId(),
    trash:window.DiagnostikaClients.trashList().map(x=>x.id)
  }));
  assert.deepEqual(snap.active,['client-a','client-c','client-b']);
  assert.equal(snap.current,'client-a');
  assert.deepEqual(snap.trash,[]);

  await page.reload({waitUntil:'commit',timeout:10000});
  await ready();
  snap=await page.evaluate(()=>({
    active:window.DiagnostikaClients.list().map(x=>x.id),
    current:window.DiagnostikaClients.currentId(),
    trash:window.DiagnostikaClients.trashList().map(x=>x.id)
  }));
  assert.deepEqual(snap.active,['client-a','client-c','client-b']);
  assert.equal(snap.current,'client-a');
  assert.deepEqual(snap.trash,[]);
}

if(phase==='current'){
  assert.equal(await page.evaluate(()=>window.DiagnostikaClients.select('client-b',{source:'audit-select-beta'})),true);
  await page.evaluate(()=>{ window.__clientTrashEvents=[]; });
  assert.equal(await page.evaluate(()=>window.deleteCurrentClient()),true);
  const snap=await page.evaluate(()=>({
    active:window.DiagnostikaClients.list().map(x=>x.id),
    current:window.DiagnostikaClients.currentId(),
    trash:window.DiagnostikaClients.trashList().map(x=>x.id),
    events:window.__clientTrashEvents.map(x=>({type:x.type,detail:{...x.detail}})),
    remembered:localStorage.getItem('diagnostika-last-client-id')
  }));
  assert.deepEqual(snap.active,['client-a','client-c']);
  assert.equal(snap.current,'client-c');
  assert.deepEqual(snap.trash,['client-b']);
  assert.equal(snap.remembered,'client-c');
  assert(snap.events.some(x=>x.type==='client:selected'&&x.detail.reason==='client-deleted'&&x.detail.clientId==='client-c'&&x.detail.previousClientId==='client-b'));
}

if(phase==='ui'){
  assert(await page.evaluate(()=>!!window.DiagnostikaClients.remove('client-b',{source:'audit-ui-remove'})));
  await page.evaluate(()=>window.openDeletedClients());
  const trashDialog=page.locator('.trash-dialog');
  await trashDialog.waitFor({state:'visible',timeout:5000});
  await trashDialog.locator('.trash-row').filter({hasText:'Beta'}).first().locator('.trash-restore').click();
  assert.equal(await page.evaluate(()=>window.DiagnostikaClients.findById('client-b')?.name||null),'Beta');
  assert.equal(await page.evaluate(()=>window.DiagnostikaClients.currentId()),'client-a');
  await page.evaluate(()=>document.querySelector('.trash-dialog')?.close());

  assert.equal(await page.evaluate(()=>window.DiagnostikaClients.openDatabase()),true);
  const database=page.locator('#clientDialog');
  await database.waitFor({state:'visible',timeout:5000});
  await database.locator('tbody tr').filter({hasText:'Beta'}).first().locator('.db-open-btn').click();
  await database.waitFor({state:'hidden',timeout:5000});
  assert.equal(await page.evaluate(()=>window.DiagnostikaClients.currentId()),'client-b');
  const dbEvent=await page.evaluate(()=>window.__clientTrashEvents.find(x=>x.type==='client:selected'&&x.detail.clientId==='client-b'&&x.detail.source==='client-database-open')||null);
  assert(dbEvent,'Database open must select through client API');

  assert(await page.evaluate(()=>!!window.DiagnostikaClients.remove('client-b',{source:'audit-ui-purge-remove'})));
  await page.evaluate(()=>window.openDeletedClients());
  await trashDialog.waitFor({state:'visible',timeout:5000});
  await trashDialog.locator('.trash-row').filter({hasText:'Beta'}).first().locator('.trash-delete').click();
  await page.waitForTimeout(50);
  const snap=await page.evaluate(()=>({
    active:window.DiagnostikaClients.list().map(x=>x.id),
    trash:window.DiagnostikaClients.trashList().map(x=>x.id),
    restorePurged:window.DiagnostikaClients.restore('client-b'),
    persisted:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}'),
    purgeEvents:window.__clientTrashEvents.filter(x=>x.type==='client:purged'&&x.detail.clientId==='client-b').length
  }));
  assert(!snap.active.includes('client-b'));
  assert(!snap.trash.includes('client-b'));
  assert.equal(snap.restorePurged,null);
  assert(snap.persisted.deletedClientTombstones.includes('client-b'));
  assert.equal(snap.purgeEvents,1);
}

if(phase==='last'){
  assert(await page.evaluate(()=>!!window.DiagnostikaClients.remove('client-b',{source:'audit-remove-b'})));
  assert(await page.evaluate(()=>window.DiagnostikaClients.purge('client-b',{source:'audit-purge-b'})));
  assert(await page.evaluate(()=>!!window.DiagnostikaClients.remove('client-a',{source:'audit-remove-a'})));
  assert(await page.evaluate(()=>window.DiagnostikaClients.purge('client-a',{source:'audit-purge-a'})));
  assert.equal(await page.evaluate(()=>window.DiagnostikaClients.currentId()),'client-c');

  const lastDelete=await page.evaluate(()=>window.DiagnostikaClients.remove('client-c',{source:'audit-delete-last'}));
  assert.equal(lastDelete?.replacementCreated,true);
  let snap=await page.evaluate(()=>({
    active:window.DiagnostikaClients.list().map(x=>({id:x.id,name:x.name})),
    current:window.DiagnostikaClients.currentId(),
    trash:window.DiagnostikaClients.trashList().map(x=>x.id)
  }));
  assert.equal(snap.active.length,1);
  assert.equal(snap.active[0].name,'Новый клиент');
  assert.notEqual(snap.active[0].id,'client-c');
  assert.equal(snap.current,snap.active[0].id);
  assert(snap.trash.includes('client-c'));
  const replacementId=snap.current;

  await page.reload({waitUntil:'commit',timeout:10000});
  await ready();
  snap=await page.evaluate(()=>({
    active:window.DiagnostikaClients.list().map(x=>({id:x.id,name:x.name})),
    current:window.DiagnostikaClients.currentId(),
    trash:window.DiagnostikaClients.trashList().map(x=>x.id),
    persisted:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}')
  }));
  assert.equal(snap.active.length,1);
  assert.equal(snap.active[0].id,replacementId);
  assert.equal(snap.current,replacementId);
  assert(snap.trash.includes('client-c'));
  assert(snap.persisted.deletedClientTombstones.includes('client-a'));
  assert(snap.persisted.deletedClientTombstones.includes('client-b'));
}

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');
console.log('CLIENT_TRASH_2B2_AUDIT_SUCCESS',phase);

await context.close();
await browser.close();
