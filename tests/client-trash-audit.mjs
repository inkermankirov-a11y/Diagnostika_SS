import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const fixture={version:4,clients:[
  {id:'client-a',name:'Alpha',city:'Киров',sessions:[],requests:[{id:'req-a',title:'A',situations:[]}]},
  {id:'client-b',name:'Beta',city:'Москва',sessions:[],requests:[]},
  {id:'client-c',name:'Gamma',city:'Казань',sessions:[],requests:[]}
]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1')){
    localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  }
  if(!localStorage.getItem('diagnostika-last-client-id')){
    localStorage.setItem('diagnostika-last-client-id','client-a');
  }
  if(!localStorage.getItem('diagnostika-ui-language')){
    localStorage.setItem('diagnostika-ui-language','ru');
  }
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

await page.goto(base,{waitUntil:'commit',timeout:10000});
await ready();

await page.evaluate(()=>{
  window.__clientTrashEvents=[];
  for(const type of ['client:deleted','client:selected','client:restored','client:purged']){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__clientTrashEvents.push({type,detail}));
  }
});

assert.equal(await page.locator('#deletedClientsBtn').count(),1,'Trash button must be installed exactly once');
assert.equal(await page.evaluate(()=>window.DiagnostikaClients.currentId()),'client-a');

// 1. Delete a non-current client. Current client must stay intact.
const removedNonCurrent=await page.evaluate(()=>window.moveClientToTrashById('client-b'));
assert.equal(removedNonCurrent,true);
let snapshot=await page.evaluate(()=>({
  active:window.DiagnostikaClients.list().map(x=>x.id),
  current:window.DiagnostikaClients.currentId(),
  trash:window.DiagnostikaClients.trashList().map(x=>x.id),
  events:window.__clientTrashEvents.map(x=>({type:x.type,detail:{...x.detail}}))
}));
assert.deepEqual(snapshot.active,['client-a','client-c']);
assert.equal(snapshot.current,'client-a');
assert.deepEqual(snapshot.trash,['client-b']);
assert.equal(snapshot.events.filter(x=>x.type==='client:deleted'&&x.detail.clientId==='client-b').length,1);
assert.equal(snapshot.events.filter(x=>x.type==='client:selected'&&x.detail.reason==='client-deleted').length,0);

// 2. Restore through API. Restoring must not steal current selection.
const restored=await page.evaluate(()=>window.DiagnostikaClients.restore('client-b',{source:'audit-restore'}));
assert.equal(restored?.id,'client-b');
snapshot=await page.evaluate(()=>({
  active:window.DiagnostikaClients.list().map(x=>x.id),
  current:window.DiagnostikaClients.currentId(),
  trash:window.DiagnostikaClients.trashList().map(x=>x.id)
}));
assert.deepEqual(snapshot.active,['client-a','client-c','client-b']);
assert.equal(snapshot.current,'client-a');
assert.deepEqual(snapshot.trash,[]);

// 3. Open client through the real database UI. Selection must go through the client API.
assert.equal(await page.evaluate(()=>window.DiagnostikaClients.openDatabase()),true);
const database=page.locator('#clientDialog');
await database.waitFor({state:'visible',timeout:5000});
const betaRow=database.locator('tbody tr').filter({hasText:'Beta'}).first();
await betaRow.locator('.db-open-btn').click();
await database.waitFor({state:'hidden',timeout:5000});
assert.equal(await page.evaluate(()=>window.DiagnostikaClients.currentId()),'client-b');
const dbSelectEvent=await page.evaluate(()=>window.__clientTrashEvents.find(x=>x.type==='client:selected'&&x.detail.clientId==='client-b'&&x.detail.source==='client-database-open')||null);
assert(dbSelectEvent,'Database open must emit client:selected from client-database-open');

// 4. Delete current client. Service must select a valid neighbour.
const removedCurrent=await page.evaluate(()=>window.deleteCurrentClient());
assert.equal(removedCurrent,true);
snapshot=await page.evaluate(()=>({
  active:window.DiagnostikaClients.list().map(x=>x.id),
  current:window.DiagnostikaClients.currentId(),
  trash:window.DiagnostikaClients.trashList().map(x=>x.id),
  selectedEvents:window.__clientTrashEvents.filter(x=>x.type==='client:selected'&&x.detail.reason==='client-deleted').map(x=>({...x.detail}))
}));
assert.deepEqual(snapshot.active,['client-a','client-c']);
assert.equal(snapshot.current,'client-c');
assert.deepEqual(snapshot.trash,['client-b']);
assert(snapshot.selectedEvents.some(x=>x.clientId==='client-c'&&x.previousClientId==='client-b'));

// 5. Restore from the real trash UI.
await page.evaluate(()=>window.openDeletedClients());
const trashDialog=page.locator('.trash-dialog');
await trashDialog.waitFor({state:'visible',timeout:5000});
const betaTrashRow=trashDialog.locator('.trash-row').filter({hasText:'Beta'}).first();
await betaTrashRow.locator('.trash-restore').click();
assert.equal(await page.evaluate(()=>window.DiagnostikaClients.findById('client-b')?.name||null),'Beta');
assert.equal(await page.evaluate(()=>window.DiagnostikaClients.currentId()),'client-c');
await page.evaluate(()=>document.querySelector('.trash-dialog')?.close());

// 6. Delete Beta again and purge it from the real trash UI.
assert(await page.evaluate(()=>!!window.DiagnostikaClients.remove('client-b',{source:'audit-remove-for-purge'})));
await page.evaluate(()=>window.openDeletedClients());
await trashDialog.waitFor({state:'visible',timeout:5000});
const betaPurgeRow=trashDialog.locator('.trash-row').filter({hasText:'Beta'}).first();
await betaPurgeRow.locator('.trash-delete').click();
await page.waitForTimeout(50);
snapshot=await page.evaluate(()=>({
  active:window.DiagnostikaClients.list().map(x=>x.id),
  trash:window.DiagnostikaClients.trashList().map(x=>x.id),
  restorePurged:window.DiagnostikaClients.restore('client-b'),
  persisted:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}'),
  purgedEvents:window.__clientTrashEvents.filter(x=>x.type==='client:purged'&&x.detail.clientId==='client-b').length
}));
assert(!snapshot.active.includes('client-b'));
assert(!snapshot.trash.includes('client-b'));
assert.equal(snapshot.restorePurged,null);
assert(snapshot.persisted.deletedClientTombstones.includes('client-b'));
assert.equal(snapshot.purgedEvents,1);
await page.evaluate(()=>document.querySelector('.trash-dialog')?.close());

// 7. Leave one active client, then delete it. A replacement client must be created automatically.
assert(await page.evaluate(()=>!!window.DiagnostikaClients.remove('client-a',{source:'audit-remove-alpha'})));
assert(await page.evaluate(()=>window.DiagnostikaClients.purge('client-a',{source:'audit-purge-alpha'})));
assert.equal(await page.evaluate(()=>window.DiagnostikaClients.currentId()),'client-c');

const lastDelete=await page.evaluate(()=>window.DiagnostikaClients.remove('client-c',{source:'audit-delete-last'}));
assert.equal(lastDelete?.replacementCreated,true);
snapshot=await page.evaluate(()=>({
  active:window.DiagnostikaClients.list().map(x=>({id:x.id,name:x.name})),
  current:window.DiagnostikaClients.currentId(),
  trash:window.DiagnostikaClients.trashList().map(x=>x.id)
}));
assert.equal(snapshot.active.length,1);
assert.equal(snapshot.active[0].name,'Новый клиент');
assert.notEqual(snapshot.active[0].id,'client-c');
assert.equal(snapshot.current,snapshot.active[0].id);
assert(snapshot.trash.includes('client-c'));
const replacementId=snapshot.current;

// 8. Reload must preserve replacement client, trash and tombstones.
await page.reload({waitUntil:'commit',timeout:10000});
await ready();
snapshot=await page.evaluate(()=>({
  active:window.DiagnostikaClients.list().map(x=>({id:x.id,name:x.name})),
  current:window.DiagnostikaClients.currentId(),
  trash:window.DiagnostikaClients.trashList().map(x=>x.id),
  persisted:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}')
}));
assert.equal(snapshot.active.length,1);
assert.equal(snapshot.active[0].id,replacementId);
assert.equal(snapshot.current,replacementId);
assert(snapshot.trash.includes('client-c'));
assert(snapshot.persisted.deletedClientTombstones.includes('client-a'));
assert(snapshot.persisted.deletedClientTombstones.includes('client-b'));

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');
console.log('CLIENT_TRASH_2B2_AUDIT_SUCCESS',JSON.stringify({replacementId,snapshot}));

await context.close();
await browser.close();
