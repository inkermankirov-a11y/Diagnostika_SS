import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const clientSource=fs.readFileSync('client-ai-chat.js','utf8');
const sessionSource=fs.readFileSync('session-ai-chat.js','utf8');
const apiSource=fs.readFileSync('ai-api.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert.equal(clientSource.includes('c.aiChat'),false,'Client AI UI still accesses client.aiChat directly');
assert.equal(sessionSource.includes('c.aiChat'),false,'Session AI compatibility UI still accesses client.aiChat directly');
assert(clientSource.includes("source:'client-ai-chat-user'"),'Client user message is not routed through AIService');
assert(clientSource.includes("source:'client-ai-chat-assistant'"),'Client assistant message is not routed through AIService');
assert(sessionSource.includes("source:'session-ai-client-clear'"),'Client chat clear is not routed through AIService');
assert(sessionSource.includes('s.aiChat'),'Session aiChat should remain for AI 6C');
assert(apiSource.includes("version:'6B'"),'AI facade version is not 6B');
for(const token of [
  'modules/ai/ai-service.js?v=20260918-ai6b',
  'modules/ai/index.js?v=20260918-ai6b',
  'ai-api.js?v=20260918-ai6b'
])assert(loaderSource.includes(token),'Stale AI loader marker: '+token);
for(const token of [
  'client-ai-chat.js?v=20260918-ai6b',
  'session-ai-chat.js?v=20260918-ai6b',
  'app-loader.js?v=20260918-ai6b'
])assert(indexSource.includes(token),'Stale AI runtime marker: '+token);

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const fixture={version:4,clients:[{
  id:'ai-6b-client',
  name:'AI 6B Client',
  currentRequestId:'ai-6b-r2',
  lastDiagnosisRequestId:'ai-6b-r2',
  aiChat:[],
  quickNotes:[],
  questionnaires:[],
  requests:[
    {id:'ai-6b-r1',title:'Historical request',status:'closed',situations:[]},
    {id:'ai-6b-r2',title:'Active request',status:'active',situations:[]}
  ],
  sessions:[{
    id:'ai-6b-s1',
    requestId:'ai-6b-r1',
    date:'2026-09-18',
    notes:'Historical session',
    aiChat:[]
  }]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','ai-6b-client');
  localStorage.setItem('diagnostika-ai-n8n-access-key','ai-6b-access-key-123456');
  if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

let chatRequests=0;
await page.route('https://lugovoyn8n.ru/**',async route=>{
  const url=route.request().url();
  if(url.includes('/diagnostika-client-chat-v1')){
    chatRequests++;
    await route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({reply:'AI 6B acceptance answer'})
    });
    return;
  }
  await route.abort();
});

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaAI?.version==='6B'
    && window.DiagnostikaPlatform?.services?.ai
    && typeof window.DiagnostikaClientAIChat?.send==='function',
    null,{timeout:15000});
  await page.locator('#hdClientAiWidget').waitFor({state:'visible',timeout:10000});
}

await page.goto(base,{waitUntil:'commit',timeout:10000});
await ready();

await page.evaluate(()=>{
  window.__ai6bCalls=[];
  window.__ai6bEvents=[];
  const api=window.DiagnostikaAI;
  const add=api.appendClientMessage.bind(api);
  const clear=api.clearClientChat.bind(api);
  api.appendClientMessage=function(clientRef,data,options){
    window.__ai6bCalls.push({method:'appendClientMessage',clientRef,data:{...data},options:{...options}});
    return add(clientRef,data,options);
  };
  api.clearClientChat=function(clientRef,options){
    window.__ai6bCalls.push({method:'clearClientChat',clientRef,options:{...options}});
    return clear(clientRef,options);
  };
  const bus=window.DiagnostikaPlatform.events;
  for(const type of ['ai-client-chat:message-added','ai-client-chat:updated']){
    bus.on(type,detail=>window.__ai6bEvents.push({type,detail:{...detail}}));
  }
});

await page.evaluate(()=>window.DiagnostikaClientAIChat.send('Проверочный вопрос 6B'));
await page.waitForFunction(()=>{
  const c=state.clients.find(x=>x.id==='ai-6b-client');
  return Array.isArray(c?.aiChat)
    && c.aiChat.length===2
    && c.aiChat[1]?.text==='AI 6B acceptance answer';
},null,{timeout:10000});

const afterSend=await page.evaluate(()=>({
  calls:window.__ai6bCalls,
  events:window.__ai6bEvents,
  client:{...state.clients.find(x=>x.id==='ai-6b-client')},
  persisted:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}')
}));

assert.equal(chatRequests,1,'Expected exactly one successful client AI transport request');
assert.equal(afterSend.calls.filter(x=>x.method==='appendClientMessage').length,2,'Client AI send must use exactly two AIService appends');
assert.deepEqual(
  afterSend.calls.filter(x=>x.method==='appendClientMessage').map(x=>x.options.source),
  ['client-ai-chat-user','client-ai-chat-assistant']
);
assert.equal(afterSend.events.filter(x=>x.type==='ai-client-chat:message-added').length,2);
assert.equal(afterSend.events.filter(x=>x.type==='ai-client-chat:updated').length,2);
assert.equal(afterSend.client.currentRequestId,'ai-6b-r2','Client AI send changed active request');
assert.equal(afterSend.client.sessions[0].requestId,'ai-6b-r1','Client AI send changed root session.requestId');
const persistedClient=afterSend.persisted.clients.find(x=>x.id==='ai-6b-client');
assert.equal(persistedClient.aiChat.length,2);
assert.equal(persistedClient.aiChat[0].role,'user');
assert.equal(persistedClient.aiChat[1].role,'assistant');

await page.reload({waitUntil:'commit',timeout:10000});
await ready();
const restored=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='ai-6b-client');
  return {
    currentRequestId:c.currentRequestId,
    sessionRequestId:c.sessions[0].requestId,
    chat:window.DiagnostikaAI.clientChat(c.id)
  };
});
assert.equal(restored.chat.length,2,'Client AI chat did not survive reload');
assert.equal(restored.currentRequestId,'ai-6b-r2');
assert.equal(restored.sessionRequestId,'ai-6b-r1');

await page.evaluate(()=>{
  window.__ai6bClearCalls=[];
  const api=window.DiagnostikaAI;
  const clear=api.clearClientChat.bind(api);
  api.clearClientChat=function(clientRef,options){
    window.__ai6bClearCalls.push({clientRef,options:{...options}});
    return clear(clientRef,options);
  };
});
await page.locator('#hdClientAiWidget .hd-ai-clear-btn').waitFor({state:'visible',timeout:10000});
await page.locator('#hdClientAiWidget .hd-ai-clear-btn').click();
await page.waitForFunction(()=>{
  const c=state.clients.find(x=>x.id==='ai-6b-client');
  return Array.isArray(c?.aiChat)&&c.aiChat.length===0;
},null,{timeout:5000});

const afterClear=await page.evaluate(()=>({
  calls:window.__ai6bClearCalls,
  currentRequestId:state.clients.find(x=>x.id==='ai-6b-client').currentRequestId,
  sessionRequestId:state.clients.find(x=>x.id==='ai-6b-client').sessions[0].requestId,
  persisted:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}')
}));
assert.equal(afterClear.calls.length,1,'Client clear must use AIService exactly once');
assert.equal(afterClear.calls[0].options.source,'session-ai-client-clear');
assert.equal(afterClear.currentRequestId,'ai-6b-r2');
assert.equal(afterClear.sessionRequestId,'ai-6b-r1');
assert.deepEqual(afterClear.persisted.clients.find(x=>x.id==='ai-6b-client').aiChat,[]);

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('AI_MODULE_6B_SUCCESS',JSON.stringify({
  transportRequests:chatRequests,
  appendCalls:afterSend.calls.filter(x=>x.method==='appendClientMessage').length,
  messageEvents:afterSend.events.filter(x=>x.type==='ai-client-chat:message-added').length,
  restoredMessages:restored.chat.length,
  clearCalls:afterClear.calls.length,
  currentRequestId:afterClear.currentRequestId,
  sessionRequestId:afterClear.sessionRequestId
}));

await context.close();
await browser.close();
