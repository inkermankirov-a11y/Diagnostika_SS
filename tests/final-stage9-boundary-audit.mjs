import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const count=(source,token)=>source.split(token).length-1;

const index=read('index.html');
const aiService=read('modules/ai/ai-service.js');
const aiTransport=read('modules/ai/ai-transport.js');
const requestAi=read('request-ai-n8n.js');
const clientChat=read('modules/ai/ui/client-chat.js');
const fullContext=read('client-ai-full-context.js');
const chatView=read('client-ai-chat-view.js');
const indicator=read('ai-processing-indicator.js');
const freeV2=read('free-consultation-v2.js');
const freeCardSync=read('free-consultation-client-card-sync.js');
const manualQuestionnaire=read('manual-questionnaire-template.js');

for(const path of [
  'modules/ai/ai-transport.js',
  'request-ai-n8n.js',
  'client-ai-chat-view.js',
  'client-ai-full-context.js',
  'modules/ai/ui/client-chat.js'
]){
  assert.equal(count(index,path),1,'Stage 9 asset must load exactly once: '+path);
}

assert.ok(
  index.indexOf('modules/ai/ai-transport.js')<index.indexOf('request-ai-n8n.js'),
  'AI transport must load before request-ai-n8n.js'
);
assert.ok(
  index.indexOf('client-ai-chat-view.js')<index.indexOf('modules/ai/ui/client-chat.js'),
  'Client AI chat view helper must load before client chat'
);
assert.ok(
  index.indexOf('client-ai-full-context.js')<index.indexOf('modules/ai/ui/client-chat.js'),
  'Client AI full-context helper must load before client chat'
);

assert.equal(/\bfetch\s*\(/.test(requestAi),false,'request-ai-n8n.js still owns fetch transport');
assert.equal(/\bfetch\s*\(/.test(aiService),false,'AI service must remain transport-free');
assert.equal((aiTransport.match(/\bfetch\s*\(/g)||[]).length,1,'AI transport must be the single Stage 9 request transport owner');
assert.ok(aiTransport.includes('DiagnostikaAITransport=Object.freeze'),'AI transport export must remain frozen');
assert.ok(requestAi.includes('DiagnostikaAITransport'),'request-ai-n8n.js is not routed through AI transport');

for(const [path,source] of [
  ['client-ai-full-context.js',fullContext],
  ['client-ai-chat-view.js',chatView],
  ['ai-processing-indicator.js',indicator],
  ['free-consultation-v2.js',freeV2],
  ['free-consultation-client-card-sync.js',freeCardSync]
]){
  assert.equal(/\bMutationObserver\b/.test(source),false,path+' reintroduced MutationObserver');
}

for(const [path,source] of [
  ['free-consultation-v2.js',freeV2],
  ['free-consultation-client-card-sync.js',freeCardSync],
  ['manual-questionnaire-template.js',manualQuestionnaire]
]){
  assert.equal(/state\??\.clients|state\.clients/.test(source),false,path+' reads legacy state.clients');
  assert.equal(/\bsave\s*\(/.test(source),false,path+' calls legacy save()');
  assert.equal(/typeof\s+client|\bclient\s*\(\)/.test(source),false,path+' uses legacy client()');
}

assert.equal(/\brequest\s*\(\)/.test(freeV2),false,'free-consultation-v2.js uses legacy request()');
assert.equal(/\bsituation\s*\(\)/.test(freeV2),false,'free-consultation-v2.js uses legacy situation()');
assert.equal(/\bselected\s*=/.test(freeV2),false,'free-consultation-v2.js writes legacy selected');
assert.ok(freeV2.includes('DiagnostikaRequestUIContext?.clientsApi?.()'),'free-consultation-v2.js must persist through Clients API');
assert.ok(freeCardSync.includes('api.update('),'free-consultation-client-card-sync.js must persist through Clients API');
assert.ok(manualQuestionnaire.includes('clientsApi()?.update?.'),'manual questionnaire template must persist through Clients API');
const bindTimeouts=[...freeCardSync.matchAll(/setTimeout\s*\(\s*bind\s*,\s*(\d+)\s*\)/g)].map(match=>Number(match[1]));
assert.deepEqual(bindTimeouts,[0],'free consultation card sync reintroduced bind retry polling');
assert.ok(/diagnostika:core-ready[^\n]*setTimeout\s*\(\s*bind\s*,\s*0\s*\)/.test(freeCardSync),'free consultation card sync core-ready deferred bind hook missing');

assert.ok(clientChat.includes('DiagnostikaClientAIFullContext?.enrichPayload'),'Client AI full-context pipeline missing');
assert.ok(clientChat.includes('DiagnostikaClientAIChatView?.preparePayload'),'Client AI chat-view pipeline missing');

console.log('FINAL_STAGE9_BOUNDARY_OK',JSON.stringify({
  transportOwner:'modules/ai/ai-transport.js',
  cleanedFiles:6,
  questionnaireLegacy:false,
  clientAiHelpersLoaded:true
}));
