import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const quickSource=fs.readFileSync('quick-notes.js','utf8');
const clientSource=fs.readFileSync('client-ai-chat.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');
const folderSource=fs.readFileSync('storage-simple-sync.js','utf8');
const driveWorkerSource=fs.readFileSync('google-drive-merge-worker.js','utf8');

assert(quickSource.includes("const LEGACY_KEY='diagnostika-quick-notes-v1'"),'Legacy global notes migration key missing');
assert(quickSource.includes('st.generalNotes=clone(legacy)'),'Legacy global notes are not migrated into canonical state');
assert(quickSource.includes("persistState('general-notes-legacy-migration')"),'Global note migration is not persisted');
assert(quickSource.includes("general-notes-create"),'Global note create source missing');
assert.equal(quickSource.includes("localStorage.setItem(LEGACY_KEY"),false,'General notes must not write to separate localStorage');
assert(clientSource.includes("title.textContent='Заметки клиента'"),'Client notes widget title missing');
assert(clientSource.includes("box.onclick=e=>"),'Client notes dashboard click is not client-scoped');
assert.equal(clientSource.includes('hookQuickNotes'),false,'Client notes still hijack the top Notes button');
assert.equal(clientSource.includes("getElementById('quickNotesBtn')"),false,'Client module still touches the top Notes button');
assert(indexSource.includes('quick-notes.js?v=20260920-notes17a'),'NOTES 17A general notes cache marker missing');
assert(indexSource.includes('client-ai-chat.js?v=20260920-notes17a&ai=6d'),'NOTES 17A client notes cache marker missing');
assert(folderSource.includes("writeJson(app,'database.json',data)"),'Folder sync no longer writes the full canonical state');
assert(folderSource.includes('const base=mergeObjects(primary||{clients:[]},secondary||{clients:[]})'),'Folder sync no longer merges top-level canonical fields');

let mergeResult=null;
const sandbox={
  structuredClone,
  console,
  self:{postMessage:value=>{mergeResult=value;}}
};
vm.createContext(sandbox);
vm.runInContext(driveWorkerSource,sandbox,{filename:'google-drive-merge-worker.js'});
sandbox.self.onmessage({data:{
  base:{version:4,clients:[],generalNotes:[]},
  local:{version:4,clients:[],generalNotes:[{id:'global-local',text:'Local general note'}]},
  remote:{version:4,clients:[],generalNotes:[{id:'global-remote',text:'Remote general note'}]}
}});
assert.equal(mergeResult?.ok,true,'Google merge worker failed canonical state merge');
assert.deepEqual(
  [...(mergeResult.merged.generalNotes||[])].map(x=>x.id).sort(),
  ['global-local','global-remote'],
  'Google merge does not preserve general notes from both sides'
);

const fixture={version:4,clients:[
  {
    id:'notes17a-alpha',
    name:'Альфа Клиент',
    city:'Киров',
    currentRequestId:'notes17a-alpha-r1',
    requests:[{id:'notes17a-alpha-r1',title:'Alpha request',status:'active',situations:[]}],
    sessions:[],
    quickNotes:[{id:'alpha-private',text:'ALPHA PRIVATE NOTE',createdAt:100,updatedAt:100}],
    questionnaires:[]
  },
  {
    id:'notes17a-beta',
    name:'Бета Клиент',
    city:'Москва',
    currentRequestId:'notes17a-beta-r1',
    requests:[{id:'notes17a-beta-r1',title:'Beta request',status:'active',situations:[]}],
    sessions:[],
    quickNotes:[{id:'beta-private',text:'BETA PRIVATE NOTE',createdAt:200,updatedAt:200}],
    questionnaires:[]
  }
]};

const legacyGeneral=[{
  id:'legacy-general',
  text:'LEGACY GENERAL NOTE',
  createdAt:50,
  updatedAt:50
}];

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050}});
await context.addInitScript(({fixture,legacyGeneral})=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(fixture));
  localStorage.setItem('diagnostika-last-client-id','notes17a-alpha');
  localStorage.setItem('diagnostika-ui-language','ru');
  localStorage.setItem('diagnostika-quick-notes-v1',JSON.stringify(legacyGeneral));
},{fixture,legacyGeneral});

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaQuickNotes?.open
    &&window.DiagnostikaClientAIChat?.openNotes
    &&window.DiagnostikaClients?.moduleAware===true
    &&window.DiagnostikaDB?.health?.().ready===true,
    null,{timeout:20000});
  await page.waitForFunction(()=>document.querySelector('#hdOpenNotes')?.closest('.hd-widget')?.querySelector('.hd-widget-title span:last-child')?.textContent==='Заметки клиента',null,{timeout:10000});
}

await page.goto('http://127.0.0.1:8000/index.html?notes-17a=1',{waitUntil:'commit',timeout:10000});
await ready();

await page.locator('#quickNotesBtn').click();
const generalOverlay=page.locator('.quick-notes-overlay');
await generalOverlay.waitFor({state:'visible',timeout:5000});
assert.equal(await generalOverlay.locator('.quick-notes-head h2').textContent(),'📝 Общие заметки');
assert.equal(await generalOverlay.getByText('LEGACY GENERAL NOTE',{exact:true}).count(),1,'Legacy global note did not migrate/open');
assert.equal(await page.locator('#clientNotesOverlay:not([hidden])').count(),0,'Top Notes button opened client notes');

await generalOverlay.locator('.quick-notes-text').fill('GLOBAL NOTE 17A');
await generalOverlay.locator('.quick-notes-save').click();
await generalOverlay.getByText('GLOBAL NOTE 17A',{exact:true}).waitFor({state:'visible'});
await generalOverlay.locator('.quick-notes-close').click();

let canonical=await page.evaluate(()=>window.DiagnostikaDB.readState({source:'notes17a-check-general'}));
assert.deepEqual(
  canonical.generalNotes.map(x=>x.text).sort(),
  ['GLOBAL NOTE 17A','LEGACY GENERAL NOTE'].sort(),
  'Global notes are not stored in canonical state'
);

await page.evaluate(()=>window.DiagnostikaClients.select('notes17a-beta',{source:'notes17a-beta-select'}));
await page.waitForFunction(()=>window.DiagnostikaClients.currentId()==='notes17a-beta',null,{timeout:5000});
await page.waitForFunction(()=>document.querySelector('#hdOpenNotes')?.textContent?.includes('BETA PRIVATE NOTE'),null,{timeout:5000});

await page.locator('#quickNotesBtn').click();
await generalOverlay.waitFor({state:'visible'});
assert.equal(await generalOverlay.getByText('GLOBAL NOTE 17A',{exact:true}).count(),1,'Global note changed when client changed');
assert.equal(await generalOverlay.getByText('BETA PRIVATE NOTE',{exact:true}).count(),0,'Client note leaked into global notes');
await generalOverlay.locator('.quick-notes-close').click();

const clientBox=page.locator('#hdOpenNotes');
assert.equal(await clientBox.locator('xpath=..').locator('.hd-widget-title span:last-child').textContent(),'Заметки клиента');
await clientBox.click();

const clientOverlay=page.locator('#clientNotesOverlay');
await clientOverlay.waitFor({state:'visible',timeout:5000});
assert((await clientOverlay.locator('.client-notes-head h2').textContent()).includes('Бета Клиент'));
assert.equal(await clientOverlay.getByText('BETA PRIVATE NOTE',{exact:true}).count(),1);
assert.equal(await clientOverlay.getByText('ALPHA PRIVATE NOTE',{exact:true}).count(),0);
assert.equal(await clientOverlay.getByText('GLOBAL NOTE 17A',{exact:true}).count(),0);

await clientOverlay.locator('.client-notes-text').fill('BETA SECOND PRIVATE NOTE');
await clientOverlay.locator('.client-notes-save').click();
await clientOverlay.getByText('BETA SECOND PRIVATE NOTE',{exact:true}).waitFor({state:'visible'});
await clientOverlay.locator('.client-notes-close').click();

await page.reload({waitUntil:'commit',timeout:10000});
await ready();

canonical=await page.evaluate(()=>window.DiagnostikaDB.readState({source:'notes17a-after-reload'}));
const alpha=canonical.clients.find(x=>x.id==='notes17a-alpha');
const beta=canonical.clients.find(x=>x.id==='notes17a-beta');

assert.deepEqual(
  canonical.generalNotes.map(x=>x.text).sort(),
  ['GLOBAL NOTE 17A','LEGACY GENERAL NOTE'].sort()
);
assert.deepEqual(alpha.quickNotes.map(x=>x.text),['ALPHA PRIVATE NOTE']);
assert.deepEqual(
  beta.quickNotes.map(x=>x.text).sort(),
  ['BETA PRIVATE NOTE','BETA SECOND PRIVATE NOTE'].sort()
);

await page.evaluate(()=>window.DiagnostikaClients.select('notes17a-alpha',{source:'notes17a-alpha-select'}));
await page.waitForFunction(()=>document.querySelector('#hdOpenNotes')?.textContent?.includes('ALPHA PRIVATE NOTE'),null,{timeout:5000});
await page.locator('#hdOpenNotes').click();
await clientOverlay.waitFor({state:'visible'});
assert.equal(await clientOverlay.getByText('ALPHA PRIVATE NOTE',{exact:true}).count(),1);
assert.equal(await clientOverlay.getByText('BETA PRIVATE NOTE',{exact:true}).count(),0);

const serious=errors.filter(x=>
  !x.includes('Failed to fetch')
  &&!x.includes('ERR_')
  &&!x.includes('favicon')
  &&!x.includes('429 (Too Many Requests)')
);
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('NOTES_17A_SUCCESS',JSON.stringify({
  topGeneral:true,
  clientScoped:true,
  legacyMigrated:true,
  canonicalState:true,
  googleMerge:true,
  folderSyncFullState:true,
  reloadPersistence:true
}));

await context.close();
await browser.close();
