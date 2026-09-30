import assert from 'node:assert/strict';
import fs from 'node:fs';

const retiredRoots=[
  'client-card-window.js',
  'client-card-window.css',
  'client-db-enhancements.js',
  'client-db-enhancements.css',
  'client-trash.js',
  'client-transfer.js',
  'client-list-cleanup.js',
  'client-questionnaires.js',
  'delete-client.js',
  'last-client.js'
];

for(const path of retiredRoots){
  assert.equal(fs.existsSync(path),false,'Retired client root returned: '+path);
}

const staticUi=[
  'modules/clients/ui/context.js',
  'modules/clients/ui/delete.js',
  'modules/clients/ui/card.js',
  'modules/clients/ui/database.js',
  'modules/clients/ui/trash.js',
  'modules/clients/ui/transfer.js',
  'modules/clients/ui/legacy-cleanup.js'
];
const styles=[
  'modules/clients/ui/card.css',
  'modules/clients/ui/database.css'
];
const dynamicUi='modules/clients/ui/questionnaires.js';
const selectionMemory='modules/clients/selection-memory.js';

for(const path of [...staticUi,...styles,dynamicUi,selectionMemory]){
  assert.equal(fs.existsSync(path),true,'Missing modular client asset: '+path);
}

const index=fs.readFileSync('index.html','utf8');
const aiSettings=fs.readFileSync('ai-settings-button.js','utf8');

for(const path of staticUi){
  assert.equal(index.split(path).length-1,1,'Static client UI must load exactly once: '+path);
}
for(const path of styles){
  assert.equal(index.split(path).length-1,1,'Client stylesheet must load exactly once: '+path);
}
assert.equal(index.split(selectionMemory).length-1,1,'Client selection memory must load exactly once');
assert.equal(aiSettings.split(dynamicUi).length-1,1,'Questionnaire UI must load exactly once through its lazy loader');

const jsFiles=[...staticUi,dynamicUi,selectionMemory];
for(const path of jsFiles){
  const src=fs.readFileSync(path,'utf8');
  for(const forbidden of [
    'state.clients',
    "typeof client==='function'",
    "typeof client === 'function'",
    'new MutationObserver'
  ]){
    assert.equal(src.includes(forbidden),false,path+' still uses legacy coupling: '+forbidden);
  }
}

const dbOwnerFiles=jsFiles.filter(path=>fs.readFileSync(path,'utf8').includes('window.renderClientDatabaseTable='));
assert.deepEqual(dbOwnerFiles,['modules/clients/ui/database.js'],'Client database renderer must have one owner');

const openDbOwnerFiles=jsFiles.filter(path=>fs.readFileSync(path,'utf8').includes('window.openDatabase='));
assert.deepEqual(openDbOwnerFiles,['modules/clients/ui/database.js'],'Client database opener must have one owner');

const transfer=fs.readFileSync('modules/clients/ui/transfer.js','utf8');
assert.equal(/\buid\s*\(/.test(transfer),false,'Client transfer still depends on legacy uid()');
assert.equal(/window\.renderClientDatabaseTable\s*=(?!=)/.test(transfer),false,'Client transfer monkey-patches database renderer');
assert.equal(transfer.includes("'diagnostika:client-database-rendered'"),true,'Client transfer is not event-driven');

const questionnaires=fs.readFileSync(dynamicUi,'utf8');
for(const forbidden of ['typeof save','state.clients','c.questionnaires=','c.questionnaires.push']){
  assert.equal(questionnaires.includes(forbidden),false,'Questionnaire legacy write returned: '+forbidden);
}
assert.equal(questionnaires.includes("persistQuestionnaires(c,next,'questionnaire-primary-profile',patch)"),true,'Questionnaire writes are not service-routed');

const cleanup=fs.readFileSync('modules/clients/ui/legacy-cleanup.js','utf8');
assert.equal(cleanup.includes('new MutationObserver'),false,'Client legacy cleanup returned to global DOM observation');
assert.equal(cleanup.includes("'diagnostika:dashboard-clients-rendered'"),true,'Client legacy cleanup is not event-driven');

const context=fs.readFileSync('modules/clients/ui/context.js','utf8');
assert.equal(context.includes('window.DiagnostikaClientUIContext=Object.freeze'),true,'Client UI context export missing');

const api=fs.readFileSync('client-api.js','utf8');
assert.equal(api.includes('window.DiagnostikaClients=api'),true,'Client public facade owner missing');

console.log('CLIENT_UI_BOUNDARY_STAGE5_SUCCESS',JSON.stringify({
  retiredRoots:retiredRoots.length,
  staticUi:staticUi.length,
  styles:styles.length,
  dynamicUi:1,
  databaseRendererOwners:dbOwnerFiles.length,
  databaseOpenOwners:openDbOwnerFiles.length,
  legacyObservers:0
}));
