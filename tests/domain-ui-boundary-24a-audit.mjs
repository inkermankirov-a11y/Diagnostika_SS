import assert from 'node:assert/strict';
import fs from 'node:fs';

const retiredRoots=[
  'diagnosis-navigation.js','diagnosis-add-focus.js','situation-create.js',
  'secondary-feeling-hints.js','feeling-collapse.js','diagnosis-compact-client.js',
  'session-attachments.js','session-format.js','session-interactions.js','session-active-request.js'
];
for(const path of retiredRoots)assert.equal(fs.existsSync(path),false,'Retired root UI file returned: '+path);

const diagnosisUi=[
  'modules/diagnosis/ui/navigation.js',
  'modules/diagnosis/ui/add-focus.js',
  'modules/diagnosis/ui/situation-create.js',
  'modules/diagnosis/ui/secondary-feeling-hints.js',
  'modules/diagnosis/ui/feeling-collapse.js',
  'modules/diagnosis/ui/compact-client.js'
];
const sessionsUi=[
  'modules/sessions/ui/editor.js',
  'modules/sessions/ui/format.js',
  'modules/sessions/ui/interactions.js',
  'modules/sessions/ui/active-request.js'
];
const all=[...diagnosisUi,...sessionsUi];

const index=fs.readFileSync('index.html','utf8');
for(const path of all){
  assert(fs.existsSync(path),'Missing modular UI file: '+path);
  const count=index.split(path).length-1;
  assert.equal(count,1,'Modular UI asset must load exactly once: '+path);
}

const legacyCall=/\b(?:client|request|situation|renderTree|renderEditor|renderMode|renderSessions|uid)\s*\(/;
for(const path of diagnosisUi){
  const src=fs.readFileSync(path,'utf8');
  assert.equal(legacyCall.test(src),false,'Diagnosis UI calls legacy global directly: '+path);
  assert.equal(/\brender(?:Tree|Editor)\s*=\s*function/.test(src),false,'Diagnosis UI monkey-patches renderer: '+path);
}

for(const path of sessionsUi){
  const src=fs.readFileSync(path,'utf8');
  if(path!=='modules/sessions/ui/editor.js'){
    assert.equal(/(?:window\.)?openSessionEditor\s*=/.test(src),false,'Session extension wraps openSessionEditor: '+path);
  }
}
const editor=fs.readFileSync('modules/sessions/ui/editor.js','utf8');
assert(editor.includes("'diagnostika:session-editor-opened'"),'Session editor extension event missing');

const format=fs.readFileSync('modules/sessions/ui/format.js','utf8');
const interactions=fs.readFileSync('modules/sessions/ui/interactions.js','utf8');
const active=fs.readFileSync('modules/sessions/ui/active-request.js','utf8');
for(const [path,src] of [
  ['format',format],['interactions',interactions],['active-request',active]
]){
  assert(src.includes("addEventListener('diagnostika:session-editor-opened'"),'Session UI is not event-driven: '+path);
}

const app=fs.readFileSync('app.js','utf8');
for(const id of ['addSituationBtn','addBeliefBtn','addFeelingBtn','addDeepBtn']){
  assert.equal(app.includes(`$('#${id}').onclick=`),false,'app.js still owns duplicate diagnosis add handler: '+id);
}
for(const event of [
  'diagnostika:diagnosis-tree-rendered',
  'diagnostika:diagnosis-editor-rendered',
  'diagnostika:mode-rendered'
])assert(app.includes(event),'app.js render event missing: '+event);

const shell=fs.readFileSync('core/shell-bridge.js','utf8');
for(const token of [
  'currentSituationId','currentSelection','currentMode','currentRequest','currentSituation',
  'selectSituation','clearSelection','selectDiagnosisElement','setMode','renderDiagnosisTree','renderMode'
])assert(shell.includes(token),'Shell diagnosis boundary missing: '+token);

console.log('DOMAIN_UI_BOUNDARY_24A_SUCCESS',JSON.stringify({
  retiredRoots:retiredRoots.length,
  diagnosisUi:diagnosisUi.length,
  sessionsUi:sessionsUi.length,
  duplicateLoads:0,
  legacyDiagnosisCalls:0,
  sessionEditorWrappers:0
}));

// stage3 final site validation trigger
