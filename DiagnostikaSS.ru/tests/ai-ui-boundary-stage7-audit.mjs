import fs from 'node:fs';
import assert from 'node:assert/strict';

const retired=[
  'ai-settings-button.js',
  'client-ai-chat.js',
  'session-ai-chat.js'
];
const modular=[
  'modules/ai/ui/context.js',
  'modules/ai/ui/settings.js',
  'modules/ai/ui/client-chat.js',
  'modules/ai/ui/session-chat.js'
];

for(const path of retired)assert.equal(fs.existsSync(path),false,`retired root AI UI file still exists: ${path}`);
for(const path of modular)assert.equal(fs.existsSync(path),true,`modular AI UI file missing: ${path}`);

const index=fs.readFileSync('index.html','utf8');
for(const path of modular){
  assert.equal(index.split(path).length-1,1,`AI UI module must load exactly once: ${path}`);
}
for(const path of retired){
  assert.equal(index.includes(`src="${path}`),false,`index still loads retired AI UI file: ${path}`);
}

const context=fs.readFileSync('modules/ai/ui/context.js','utf8');
const settings=fs.readFileSync('modules/ai/ui/settings.js','utf8');
const clientChat=fs.readFileSync('modules/ai/ui/client-chat.js','utf8');
const sessionChat=fs.readFileSync('modules/ai/ui/session-chat.js','utf8');

assert.ok(context.includes('DiagnostikaAIUIContext=Object.freeze'),'AI UI context export missing');
assert.equal(/typeof\s+client|\bclient\s*\(\)/.test(context),false,'AI UI context reintroduced legacy client()');
assert.equal(/state\??\.clients|state\.clients/.test(context),false,'AI UI context reads state.clients');
assert.equal(/\bsave\s*\(/.test(context),false,'AI UI context calls legacy save()');

assert.ok(settings.includes('DiagnostikaAIUIContext?.currentClient?.()'),'AI settings does not use AI UI context');
assert.equal(/typeof\s+client|\bclient\s*\(\)/.test(settings),false,'AI settings reintroduced legacy client()');
assert.equal(/state\??\.clients|state\.clients/.test(settings),false,'AI settings reads state.clients');
assert.equal(settings.includes('new MutationObserver'),false,'AI settings still owns MutationObserver');

assert.ok(clientChat.includes('DiagnostikaAIUIContext?.currentClient?.()'),'Client AI chat does not use AI UI context');
assert.equal(/state\??\.clients|state\.clients/.test(clientChat),false,'Client AI chat reads state.clients');
assert.equal(/\bsave\s*\(/.test(clientChat),false,'Client AI chat calls legacy save()');
assert.ok(clientChat.includes('DiagnostikaAIUIContext?.clientsApi?.()'),'Client notes do not persist through Clients API');

assert.ok(sessionChat.includes('DiagnostikaAIUIContext?.currentClient?.()'),'Session AI chat does not use AI UI context');
assert.ok(sessionChat.includes('DiagnostikaAIUIContext?.sessionById?.'),'Session AI chat does not resolve session through AI UI context');
assert.equal(/state\??\.clients|state\.clients/.test(sessionChat),false,'Session AI chat reads state.clients');
assert.equal(/\bselectedSessionId\b/.test(sessionChat),false,'Session AI chat still reads selectedSessionId');
assert.equal(sessionChat.includes('new MutationObserver'),false,'Session AI chat still owns MutationObserver');
assert.equal(/setInterval\s*\(/.test(sessionChat),false,'Session AI chat still polls DOM');

const contextPos=index.indexOf('modules/ai/ui/context.js');
for(const path of modular.filter(x=>x!=='modules/ai/ui/context.js')){
  assert.ok(contextPos>=0&&contextPos<index.indexOf(path),`AI UI context must load before ${path}`);
}

console.log('AI_UI_BOUNDARY_STAGE7_OK',JSON.stringify({retired:retired.length,modular:modular.length}));
