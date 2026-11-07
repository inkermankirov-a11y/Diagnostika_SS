import assert from 'node:assert/strict';
import fs from 'node:fs';

const servicePaths=[
  'modules/clients/client-service.js',
  'modules/requests/request-service.js',
  'modules/diagnosis/diagnosis-service.js',
  'modules/sessions/session-service.js',
  'modules/files/file-service.js',
  'modules/export/export-service.js',
  'modules/calendar/calendar-service.js',
  'modules/payments/payment-service.js',
  'modules/ai/ai-service.js'
];

const forbiddenLegacy=[
  {re:/\btypeof\s+(?:client|save|uid|today|newSituation|newBelief|newFeeling|newDeep|newInstinct|renderClient|renderRequests|renderSessions|renderSituationList|renderTree)\b/,label:'legacy global function lookup'},
  {re:/\bplatform\.store\?\.legacySave\b/,label:'legacy store save bridge'},
  {re:/\bwindow\.(?:DiagnostikaClients|DiagnostikaRequests|DiagnostikaDiagnosis|DiagnostikaSessions|DiagnostikaFiles|DiagnostikaExport|DiagnostikaCalendar|DiagnostikaPayments|DiagnostikaAI|DiagnostikaHomeDashboard)\b/,label:'public/global facade dependency'}
];

for(const path of servicePaths){
  const source=fs.readFileSync(path,'utf8');
  assert(source.includes('const platform'),path+' does not bind the platform boundary');
  for(const {re,label} of forbiddenLegacy){
    assert.equal(re.test(source),false,path+' crosses the service boundary through '+label);
  }
  const windowRefs=[...source.matchAll(/\bwindow\.[A-Za-z_$][\w$]*/g)].map(m=>m[0]);
  assert.deepEqual([...new Set(windowRefs)],['window.DiagnostikaPlatform'],path+' has direct window dependencies');
}

const shell=fs.readFileSync('core/shell-bridge.js','utf8');
for(const token of [
  'renderClient:renderClientShell',
  'renderRequests:renderRequestsShell',
  'renderSessions:renderSessionsShell',
  'renderDiagnosis:renderDiagnosisShell',
  'refreshDashboard:refreshDashboardShell'
]){
  assert(shell.includes(token),'Shell bridge missing '+token);
}

const store=fs.readFileSync('core/store-bridge.js','utf8');
assert(store.includes('platform.shell?.currentClient?.()'),'Store current client does not cross through shell');
assert(store.includes('platform.shell?.currentClientId?.()'),'Store current client id does not cross through shell');

const diagnosis=fs.readFileSync('modules/diagnosis/diagnosis-service.js','utf8');
assert(diagnosis.includes("instincts:[{id:makeId('instinct'),name:'',level:5,comment:''}]"),'Diagnosis deep defaults changed during boundary cleanup');

const sessions=fs.readFileSync('modules/sessions/session-service.js','utf8');
assert(sessions.includes("return new Date().toISOString().slice(0,10)"),'Session default date behavior changed during boundary cleanup');

const persistenceContracts={
  'modules/clients/client-service.js':"platform.store?.persist?.({ source: 'client-service-persist' })",
  'modules/requests/request-service.js':"platform.store?.persist?.({source:'request-service-persist'})",
  'modules/sessions/session-service.js':"platform.store?.persist?.({source:'session-service-persist'})",
  'modules/calendar/calendar-service.js':"platform.store?.persist?.({source:'calendar-service-persist'})",
  'modules/payments/payment-service.js':"platform.store?.persist?.({source:'payment-service-persist'})",
  'modules/ai/ai-service.js':"platform.store?.persist?.({source:'ai-service-persist'})"
};
for(const [path,token] of Object.entries(persistenceContracts)){
  assert(fs.readFileSync(path,'utf8').includes(token),path+' does not use canonical store persistence');
}

console.log('SERVICE_BOUNDARY_23C_SUCCESS',JSON.stringify({
  services:servicePaths.length,
  publicFacadeDependencies:0,
  legacyGlobalLookups:0,
  canonicalPersistence:true,
  shellUiBoundary:true
}));
