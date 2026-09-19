import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sessionSource=fs.readFileSync('session-ai-chat.js','utf8');
const apiSource=fs.readFileSync('ai-api.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert.equal(sessionSource.includes('s.aiChat'),false,'Session AI UI still accesses session.aiChat directly');
assert.equal(sessionSource.includes('persist()'),false,'Session AI UI still persists chat directly');
for(const token of [
  "source:'session-ai-chat-user'",
  "source:'session-ai-chat-assistant'",
  "source:'session-ai-chat-clear'"
])assert(sessionSource.includes(token),'Missing AIService session writer '+token);
assert(apiSource.includes("version:'6D'"),'AI facade version is not 6D');
for(const token of [
  'modules/ai/ai-service.js?v=20260919-ai6d',
  'modules/ai/index.js?v=20260919-ai6d',
  'ai-api.js?v=20260919-ai6d'
])assert(loaderSource.includes(token),'Stale AI loader marker: '+token);
for(const token of [
  'client-ai-chat.js?v=20260919-ai6d',
  'session-ai-chat.js?v=20260919-ai6d'
])assert(indexSource.includes(token),'Stale AI runtime marker: '+token);
assert(/app-loader\.js\?v=20260919-(?:ai6d|calendar8[a-d])/.test(indexSource),'Stale global app-loader marker after AI 6D');

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const fixture={version:4,clients:[{
  id:'ai-6c-client',
  name:'AI 6C Client',
  currentRequestId:'ai-6c-r2',
  lastDiagnosisRequestId:'ai-6c-r2',
  aiChat:[{id:'client-msg',role:'user',text:'client chat must survive',createdAt:'2026-09-19T00:00:00.000Z'}],
  quickNotes:[],questionnaires:[],
  requests:[
    {id:'ai-6c-r1',title:'Historical request',status:'closed',situations:[]},
    {id:'ai-6c-r2',title:'Active request',status:'active',situations:[]}
  ],
  sessions:[
    {id:'ai-6c-s1',requestId:'ai-6c-r1',date:'2026-09-18',notes:'Historical session',aiChat:[]},
    {id:'ai-6c-s2',requestId:'ai-6c-r2',date:'2026-09-19',notes:'Current session',aiChat:[{id:'s2-existing',role:'assistant',text:'keep me',createdAt:'2026-09-19T00:00:00.000Z'}]}
  ]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','ai-6c-client');
  if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
await page.route('https://lugovoyn8n.ru/**',route=>route.abort());

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaAI?.version==='6D' && window.DiagnostikaPlatform?.services?.ai,null,{timeout:15000});
}

await page.goto(base,{waitUntil:'commit',timeout:10000});
await ready();

const first=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='ai-6c-client');
  window.__ai6cEvents=[];
  const bus=window.DiagnostikaPlatform.events;
  for(const type of ['ai-session-chat:message-added','ai-session-chat:updated']){
    bus.on(type,detail=>window.__ai6cEvents.push({type,detail:{...detail}}));
  }
  const before={
    currentRequestId:c.currentRequestId,
    requestIds:c.sessions.map(s=>s.requestId),
    clientChat:JSON.stringify(c.aiChat),
    secondChat:JSON.stringify(c.sessions[1].aiChat)
  };
  const user=window.DiagnostikaAI.appendSessionMessage('ai-6c-s1',
    {id:'s1-user',role:'user',text:'historical session question',createdAt:'2026-09-19T00:01:00.000Z'},
    {client:c,source:'session-ai-chat-user'});
  const assistant=window.DiagnostikaAI.appendSessionMessage('ai-6c-s1',
    {id:'s1-assistant',role:'assistant',text:'historical session answer',createdAt:'2026-09-19T00:02:00.000Z'},
    {client:c,source:'session-ai-chat-assistant'});
  const duplicate=window.DiagnostikaAI.appendSessionMessage('ai-6c-s1',
    {id:'s1-user',role:'user',text:'duplicate',createdAt:'2026-09-19T00:03:00.000Z'},
    {client:c,source:'session-ai-chat-user'});
  return {
    before,user,assistant,duplicate,
    events:window.__ai6cEvents,
    currentRequestId:c.currentRequestId,
    requestIds:c.sessions.map(s=>s.requestId),
    clientChat:JSON.stringify(c.aiChat),
    firstChat:window.DiagnostikaAI.sessionChat('ai-6c-s1',c.id),
    secondChat:JSON.stringify(c.sessions[1].aiChat),
    persisted:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}')
  };
});

assert(first.user&&first.assistant,'Session messages were not appended through AIService');
assert.equal(first.duplicate,null,'Duplicate session message id was accepted');
assert.equal(first.firstChat.length,2,'Historical session did not receive exactly two messages');
assert.equal(first.events.filter(x=>x.type==='ai-session-chat:message-added').length,2);
assert.equal(first.events.filter(x=>x.type==='ai-session-chat:updated').length,2);
assert.deepEqual(first.requestIds,first.before.requestIds,'Session request bindings changed during AI write');
assert.equal(first.currentRequestId,first.before.currentRequestId,'currentRequestId changed during session AI write');
assert.equal(first.clientChat,first.before.clientChat,'Client AI chat was changed by session AI write');
assert.equal(first.secondChat,first.before.secondChat,'Another session chat was changed');
const persistedClient=first.persisted.clients.find(x=>x.id==='ai-6c-client');
assert.equal(persistedClient.sessions[0].aiChat.length,2);
assert.equal(persistedClient.sessions[1].aiChat.length,1);

await page.reload({waitUntil:'commit',timeout:10000});
await ready();
const restored=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='ai-6c-client');
  return {
    first:window.DiagnostikaAI.sessionChat('ai-6c-s1',c.id),
    second:window.DiagnostikaAI.sessionChat('ai-6c-s2',c.id),
    clientChat:window.DiagnostikaAI.clientChat(c.id),
    currentRequestId:c.currentRequestId,
    requestIds:c.sessions.map(s=>s.requestId)
  };
});
assert.equal(restored.first.length,2,'Session AI chat did not survive reload');
assert.equal(restored.second.length,1,'Unrelated session chat changed after reload');
assert.equal(restored.clientChat.length,1,'Client AI chat changed after reload');
assert.equal(restored.currentRequestId,'ai-6c-r2');
assert.deepEqual(restored.requestIds,['ai-6c-r1','ai-6c-r2']);

const cleared=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='ai-6c-client');
  const result=window.DiagnostikaAI.clearSessionChat('ai-6c-s1',{client:c,source:'session-ai-chat-clear'});
  return {
    result,
    first:window.DiagnostikaAI.sessionChat('ai-6c-s1',c.id),
    second:window.DiagnostikaAI.sessionChat('ai-6c-s2',c.id),
    clientChat:window.DiagnostikaAI.clientChat(c.id),
    currentRequestId:c.currentRequestId,
    requestIds:c.sessions.map(s=>s.requestId),
    persisted:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}')
  };
});
assert.deepEqual(cleared.result,[]);
assert.deepEqual(cleared.first,[],'Clear did not target only historical session');
assert.equal(cleared.second.length,1,'Clear touched another session');
assert.equal(cleared.clientChat.length,1,'Clear touched client AI chat');
assert.equal(cleared.currentRequestId,'ai-6c-r2');
assert.deepEqual(cleared.requestIds,['ai-6c-r1','ai-6c-r2']);
assert.deepEqual(cleared.persisted.clients.find(x=>x.id==='ai-6c-client').sessions[0].aiChat,[]);
assert.equal(cleared.persisted.clients.find(x=>x.id==='ai-6c-client').sessions[1].aiChat.length,1);

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('AI_MODULE_6C_SUCCESS',JSON.stringify({
  sessionMessageEvents:first.events.filter(x=>x.type==='ai-session-chat:message-added').length,
  restoredMessages:restored.first.length,
  otherSessionMessages:cleared.second.length,
  clientMessages:cleared.clientChat.length,
  currentRequestId:cleared.currentRequestId,
  historicalRequestId:cleared.requestIds[0]
}));

await context.close();
await browser.close();
