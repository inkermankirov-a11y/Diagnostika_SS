import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource=fs.readFileSync('modules/ai/ai-service.js','utf8');
const apiSource=fs.readFileSync('ai-api.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');
const clientLegacy=fs.readFileSync('client-ai-chat.js','utf8');
const sessionLegacy=fs.readFileSync('session-ai-chat.js','utf8');

for(const token of [
  'clientChat','sessionChat','appendClientMessage','replaceClientChat','clearClientChat',
  'appendSessionMessage','replaceSessionChat','clearSessionChat'
]){
  assert(serviceSource.includes(token),`AIService missing ${token}`);
  assert(apiSource.includes(token),`AI facade missing ${token}`);
}
assert(/version:'6[A-C]'/.test(apiSource),'AI facade version is outside supported 6A-6C range');
assert(apiSource.includes('moduleAware:true'),'AI facade is not module-aware');
assert(/modules\/ai\/ai-service\.js\?v=2026091[89]-ai6[abc]/.test(loaderSource),'AI service is not loaded by app-loader');
assert(/modules\/ai\/index\.js\?v=2026091[89]-ai6[abc]/.test(loaderSource),'AI module is not loaded by app-loader');
assert(/ai-api\.js\?v=2026091[89]-ai6[abc]/.test(loaderSource),'AI facade is not loaded by app-loader');
assert.equal(serviceSource.includes('fetch('),false,'AI 6A service must not own n8n transport yet');

// Foundation audit remains valid after 6B: client debt may be gone; session debt remains until 6C.
assert(sessionLegacy.includes('s.aiChat'),'Expected session aiChat debt for 6C disappeared unexpectedly');

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const fixture={version:4,clients:[{
  id:'ai-6a-client',
  name:'AI 6A Client',
  currentRequestId:'ai-6a-r2',
  lastDiagnosisRequestId:'ai-6a-r2',
  aiChat:[{id:'old-client-msg',role:'user',text:'existing client message',createdAt:1}],
  requests:[
    {id:'ai-6a-r1',title:'Historical request',status:'closed',situations:[]},
    {id:'ai-6a-r2',title:'Active request',status:'active',situations:[]}
  ],
  sessions:[
    {
      id:'ai-6a-s1',
      requestId:'ai-6a-r1',
      date:'2026-09-17',
      notes:'session one',
      aiChat:[{id:'old-session-msg',role:'assistant',text:'existing session message',createdAt:2}]
    },
    {
      id:'ai-6a-s2',
      requestId:'ai-6a-r2',
      date:'2026-09-18',
      notes:'session two'
    }
  ]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','ai-6a-client');
  if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>/^6[A-B]$/.test(window.DiagnostikaAI?.version||'')
    && window.DiagnostikaAI?.moduleAware===true
    && window.DiagnostikaPlatform?.services?.ai
    && window.DiagnostikaPlatform?.modules?.get?.('ai')?.status==='started',
    null,{timeout:15000});
}

await page.goto(base,{waitUntil:'commit',timeout:10000});
await ready();

const architecture=await page.evaluate(()=>({
  version:window.DiagnostikaAI?.version,
  moduleAware:window.DiagnostikaAI?.moduleAware,
  sameService:window.DiagnostikaPlatform?.ai===window.DiagnostikaPlatform?.services?.ai,
  module:window.DiagnostikaPlatform?.modules?.get?.('ai')?.status||null,
  methods:Object.fromEntries([
    'clientChat','sessionChat','appendClientMessage','replaceClientChat','clearClientChat',
    'appendSessionMessage','replaceSessionChat','clearSessionChat'
  ].map(k=>[k,typeof window.DiagnostikaAI?.[k]]))
}));
assert(/^6[A-B]$/.test(architecture.version));
assert.equal(architecture.moduleAware,true);
assert.equal(architecture.sameService,true);
assert.equal(architecture.module,'started');
for(const value of Object.values(architecture.methods))assert.equal(value,'function');

await page.evaluate(()=>{
  window.__ai6aEvents=[];
  const bus=window.DiagnostikaPlatform.events;
  for(const type of Object.values(window.DiagnostikaAI.events)){
    bus.on(type,detail=>window.__ai6aEvents.push({type,detail}));
  }
});

const before=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='ai-6a-client');
  const s2=c.sessions.find(x=>x.id==='ai-6a-s2');
  const read=window.DiagnostikaAI.sessionChat(s2.id,c);
  return {
    currentRequestId:c.currentRequestId,
    s1RequestId:c.sessions.find(x=>x.id==='ai-6a-s1').requestId,
    s2HasAiChat:Object.prototype.hasOwnProperty.call(s2,'aiChat'),
    s2Read:read
  };
});
assert.equal(before.currentRequestId,'ai-6a-r2');
assert.equal(before.s1RequestId,'ai-6a-r1');
assert.equal(before.s2HasAiChat,false,'AI read path created session.aiChat');
assert.equal(before.s2Read,null);

const writes=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='ai-6a-client');
  const a=window.DiagnostikaAI.appendClientMessage(c.id,{
    id:'ai-6a-client-added',role:'user',text:'new client message',createdAt:100
  },{source:'ai-6a-test-client'});
  const b=window.DiagnostikaAI.appendSessionMessage('ai-6a-s1',{
    id:'ai-6a-session-added',role:'assistant',text:'new session message',createdAt:200
  },{client:c,source:'ai-6a-test-session'});
  const dup=window.DiagnostikaAI.appendClientMessage(c.id,{
    id:'ai-6a-client-added',role:'assistant',text:'duplicate',createdAt:300
  },{source:'ai-6a-test-duplicate'});
  return {
    client:a,session:b,duplicate:dup,
    currentRequestId:c.currentRequestId,
    s1RequestId:c.sessions.find(x=>x.id==='ai-6a-s1').requestId,
    clientChat:window.DiagnostikaAI.clientChat(c.id),
    sessionChat:window.DiagnostikaAI.sessionChat('ai-6a-s1',c),
    events:window.__ai6aEvents
  };
});

assert.equal(writes.client.id,'ai-6a-client-added');
assert.equal(writes.session.id,'ai-6a-session-added');
assert.equal(writes.duplicate,null,'Duplicate message id was accepted');
assert.equal(writes.currentRequestId,'ai-6a-r2','AI service changed active request');
assert.equal(writes.s1RequestId,'ai-6a-r1','AI service changed root session.requestId');
assert.equal(writes.clientChat.length,2);
assert.equal(writes.sessionChat.length,2);
assert.equal(writes.events.filter(x=>x.type==='ai-client-chat:message-added').length,1);
assert.equal(writes.events.filter(x=>x.type==='ai-client-chat:updated').length,1);
assert.equal(writes.events.filter(x=>x.type==='ai-session-chat:message-added').length,1);
assert.equal(writes.events.filter(x=>x.type==='ai-session-chat:updated').length,1);

await page.reload({waitUntil:'commit',timeout:10000});
await ready();

const restored=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='ai-6a-client');
  return {
    currentRequestId:c.currentRequestId,
    s1RequestId:c.sessions.find(x=>x.id==='ai-6a-s1').requestId,
    clientChat:window.DiagnostikaAI.clientChat(c.id),
    sessionChat:window.DiagnostikaAI.sessionChat('ai-6a-s1',c)
  };
});
assert.equal(restored.currentRequestId,'ai-6a-r2');
assert.equal(restored.s1RequestId,'ai-6a-r1');
assert.equal(restored.clientChat.some(x=>x.id==='ai-6a-client-added'),true);
assert.equal(restored.sessionChat.some(x=>x.id==='ai-6a-session-added'),true);

const cleared=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='ai-6a-client');
  const client=window.DiagnostikaAI.clearClientChat(c.id,{source:'ai-6a-test-client-clear'});
  const session=window.DiagnostikaAI.clearSessionChat('ai-6a-s1',{client:c,source:'ai-6a-test-session-clear'});
  return {
    client,session,
    currentRequestId:c.currentRequestId,
    s1RequestId:c.sessions.find(x=>x.id==='ai-6a-s1').requestId
  };
});
assert.deepEqual(cleared.client,[]);
assert.deepEqual(cleared.session,[]);
assert.equal(cleared.currentRequestId,'ai-6a-r2');
assert.equal(cleared.s1RequestId,'ai-6a-r1');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('AI_MODULE_6A_SUCCESS',JSON.stringify({architecture,before,writes:{
  currentRequestId:writes.currentRequestId,
  s1RequestId:writes.s1RequestId,
  clientCount:writes.clientChat.length,
  sessionCount:writes.sessionChat.length,
  eventCount:writes.events.length
},restored:{
  currentRequestId:restored.currentRequestId,
  s1RequestId:restored.s1RequestId,
  clientCount:restored.clientChat.length,
  sessionCount:restored.sessionChat.length
}}));

await context.close();
await browser.close();
