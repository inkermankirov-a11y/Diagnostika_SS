import fs from 'node:fs';
import assert from 'node:assert/strict';

const retired=[
  'request-select-labels.js',
  'request-title-display.js',
  'request-date-unsaved.js',
  'free-consultation-request-builder.js'
];
const modular=[
  'modules/requests/ui/context.js',
  'modules/requests/ui/selection.js',
  'modules/requests/ui/title.js',
  'modules/requests/ui/date-unsaved.js',
  'modules/requests/ui/free-consultation-builder.js'
];

for(const path of retired)assert.equal(fs.existsSync(path),false,`retired root Requests UI file still exists: ${path}`);
for(const path of modular)assert.equal(fs.existsSync(path),true,`modular Requests UI file missing: ${path}`);

const index=fs.readFileSync('index.html','utf8');
for(const path of modular){
  assert.equal(index.split(path).length-1,1,`Requests UI module must load exactly once: ${path}`);
}
for(const path of retired){
  assert.equal(index.includes(`src="${path}`),false,`index still loads retired Requests UI file: ${path}`);
}

const context=fs.readFileSync('modules/requests/ui/context.js','utf8');
const selection=fs.readFileSync('modules/requests/ui/selection.js','utf8');
const title=fs.readFileSync('modules/requests/ui/title.js','utf8');
const dateUnsaved=fs.readFileSync('modules/requests/ui/date-unsaved.js','utf8');
const builder=fs.readFileSync('modules/requests/ui/free-consultation-builder.js','utf8');

assert.ok(context.includes('DiagnostikaRequestUIContext=Object.freeze'),'Requests UI context export missing');
assert.equal(/typeof\s+client|\bclient\s*\(\)/.test(context),false,'Requests UI context reintroduced legacy client()');
assert.equal(/typeof\s+mode|\bmode\s*=/.test(context),false,'Requests UI context directly owns legacy mode');
assert.equal(/typeof\s+client/.test(selection),false,'request selection UI still has legacy client fallback');
assert.equal(/typeof\s+mode|\bmode\s*===/.test(selection),false,'request selection UI still reads global mode');
assert.equal(/typeof\s+client/.test(title),false,'request title UI still has legacy client fallback');
assert.equal(builder.includes('new MutationObserver'),false,'free consultation builder still owns MutationObserver');
assert.equal(/typeof\s+client|\bclient\s*\(\)/.test(builder),false,'free consultation builder still uses legacy client()');
assert.equal(/state\??\.clients|state\.clients/.test(builder),false,'free consultation builder still reads state.clients');
assert.equal(/\bsave\s*\(/.test(builder),false,'free consultation builder still calls legacy save()');
assert.ok(builder.includes('DiagnostikaRequestUIContext?.clientsApi?.()'),'free consultation builder does not persist through Clients API');
assert.equal(dateUnsaved.includes('new MutationObserver'),false,'date-unsaved UI must remain observer-free');

const contextPos=index.indexOf('modules/requests/ui/context.js');
for(const path of modular.filter(x=>x!=='modules/requests/ui/context.js')){
  assert.ok(contextPos>=0&&contextPos<index.indexOf(path),`Requests UI context must load before ${path}`);
}

console.log('REQUEST_UI_BOUNDARY_STAGE6_OK',JSON.stringify({retired:retired.length,modular:modular.length}));
