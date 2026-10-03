import assert from 'node:assert/strict';
import fs from 'node:fs';

const retiredRoots=[
  'all-payments-complete.js',
  'client-payment-flag-rule.js',
  'payment-consistency-core.js',
  'payment-currency-hard-rule.js',
  'payment-currency.js',
  'payment-enhancements.js',
  'payment-full-mode-ui.js',
  'payment-history-final-scope.js',
  'payment-history-scope.js',
  'payment-save-guard.js',
  'payment-save-normalizer.js',
  'payment-scope-authority.js',
  'payment-session-fix.js',
  'payment-status-semantic-rule.js',
  'payment-system.js',
  'payment-total-input-stability.js',
  'session-ledger-current-request.js',
  'session-payment-button-authority.js',
  'session-payment-data-repair.js',
  'session-payment-editor.js',
  'session-payment-mode-rule.js',
  'session-payment-motion-lock.js',
  'session-payment-status.js',
  'session-payment-ui-sync.js'
];
for(const path of retiredRoots)assert.equal(fs.existsSync(path),false,'Retired payment root returned: '+path);

const staticUi=[
  'modules/payments/ui/context.js',
  'modules/payments/ui/payment-dialog.js',
  'modules/payments/ui/session-status.js',
  'modules/payments/ui/enhancements.js',
  'modules/payments/ui/session-settings.js',
  'modules/payments/ui/session-editor.js',
  'modules/payments/ui/save-guard.js',
  'modules/payments/ui/client-debt-flags.js',
  'modules/payments/ui/consistency.js',
  'modules/payments/ui/total-input.js'
];
const dynamicUi=[
  'modules/payments/ui/data-repair.js',
  'modules/payments/ui/session-mode.js'
];
const allUi=[...staticUi,...dynamicUi];

const index=fs.readFileSync('index.html','utf8');
const loader=fs.readFileSync('app-loader.js','utf8');
for(const path of staticUi){
  assert(fs.existsSync(path),'Missing Payment UI module: '+path);
  assert.equal(index.split(path).length-1,1,'Static Payment UI must load exactly once: '+path);
}
for(const path of dynamicUi){
  assert(fs.existsSync(path),'Missing dynamic Payment UI module: '+path);
  assert.equal(loader.split(path).length-1,1,'Dynamic Payment UI must load exactly once: '+path);
}

for(const path of allUi){
  const src=fs.readFileSync(path,'utf8');
  for(const forbidden of [
    'typeof state',
    'state.clients',
    "typeof client==='function'",
    "typeof client === 'function'",
    "typeof requestId",
    'new MutationObserver'
  ])assert.equal(src.includes(forbidden),false,path+' still uses legacy coupling: '+forbidden);
  assert.equal(/\brenderClient\s*=/.test(src),false,path+' monkey-patches renderClient');
  assert.equal(/\brenderSessions\s*=/.test(src),false,path+' monkey-patches renderSessions');
  assert.equal(src.includes('window.DiagnostikaPayments='),false,path+' owns public Payments facade');
}

const dialog=fs.readFileSync('modules/payments/ui/payment-dialog.js','utf8');
assert(dialog.includes('window.DiagnostikaPaymentUI=Object.freeze'),'Payment UI export missing');
assert(dialog.includes('dialogRequestId'),'Payment dialog request context must be local');
assert(dialog.includes('dlg.dataset.requestId=r.id'),'Payment dialog request identity missing');

const api=fs.readFileSync('payment-api.js','utf8');
assert(api.includes('window.DiagnostikaPayments=Object.freeze(facade)'),'Payment API facade owner missing');
assert(api.includes('window.DiagnostikaPaymentUI'),'Payment API does not compose modular UI');
assert.equal((api.match(/window\.DiagnostikaPayments=/g)||[]).length,1,'Payment facade owner count changed');

const paymentContext=fs.readFileSync('modules/payments/ui/context.js','utf8');
assert(paymentContext.includes("rows.filter(s=>!(s?.planned===true||String(s?.status||'')==='planned'))"),'Payment context still exposes planned session skeletons as billable sessions');

const sessionEditor=fs.readFileSync('modules/payments/ui/session-editor.js','utf8');
assert(sessionEditor.includes("'diagnostika:session-editor-opened'"),'Session payment editor is not event-driven');
assert(sessionEditor.includes("source:'session-payment-editor-toggle'"),'Canonical session payment toggle source missing');
assert(sessionEditor.includes("if(s?.planned===true||String(s?.status||'')==='planned')return;"),'Planned session editor still shows payment controls');

const status=fs.readFileSync('modules/payments/ui/session-status.js','utf8');
assert(status.includes("'diagnostika:dashboard-sessions-rendered'"),'Session payment status render event missing');
assert(status.includes("s?.planned===true||String(s?.status||'')==='planned'"),'Session payment status still treats planned skeletons as unpaid');

console.log('PAYMENT_UI_BOUNDARY_25A_SUCCESS',JSON.stringify({
  retiredRoots:retiredRoots.length,
  staticUi:staticUi.length,
  dynamicUi:dynamicUi.length,
  legacyGlobalCouplings:0,
  mutationObservers:0,
  publicFacadeOwners:1
}));
