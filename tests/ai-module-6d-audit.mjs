import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource=fs.readFileSync('modules/ai/ai-service.js','utf8');
const apiSource=fs.readFileSync('ai-api.js','utf8');
const clientSource=fs.readFileSync('client-ai-chat.js','utf8');
const fullContextSource=fs.readFileSync('client-ai-full-context.js','utf8');
const viewSource=fs.readFileSync('client-ai-chat-view.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(apiSource.includes("version:'6D'"),'AI facade version is not 6D');
assert(apiSource.includes('window.DiagnostikaAI=Object.freeze({'),'AI facade is not frozen');
assert.equal(apiSource.includes('...legacy'),false,'AI facade still inherits legacy object');
assert.equal(apiSource.includes('const legacy='),false,'Legacy AI facade bridge still exists');
assert.equal(/window\.fetch\s*=/.test(fullContextSource),false,'Full-context helper still monkey-patches global fetch');
assert.equal(/window\.fetch\s*=/.test(viewSource),false,'AI chat view still monkey-patches global fetch');
assert(clientSource.includes('DiagnostikaClientAIFullContext?.enrichPayload'),'Client transport does not explicitly enrich full context');
assert(clientSource.includes('DiagnostikaClientAIChatView?.preparePayload'),'Client transport does not expose explicit response-mode preparation');
assert(serviceSource.includes("return c&&Array.isArray(c.aiChat)?clone(c.aiChat):null;"),'Client chat read leaks live store array');
assert(serviceSource.includes("return s&&Array.isArray(s.aiChat)?clone(s.aiChat):null;"),'Session chat read leaks live store array');
assert.equal(serviceSource.includes("typeof save==='function'"),false,'AIService still calls global save directly');
assert(serviceSource.includes("platform.store?.legacySave?.()===true"),'AIService does not persist through store bridge');
for(const token of [
  'modules/ai/ai-service.js?v=20260919-ai6d',
  'modules/ai/index.js?v=20260919-ai6d',
  'ai-api.js?v=20260919-ai6d'
])assert(loaderSource.includes(token),'Stale AI loader marker: '+token);
for(const token of [
  'client-ai-chat.js?v=20260919-ai6d',
  'client-ai-full-context.js?v=20260919-ai6d',
  'session-ai-chat.js?v=20260919-ai6d'
])assert(indexSource.includes(token),'Stale AI runtime marker: '+token);
assert(/app-loader\.js\?v=20260919-(?:ai6d|calendar8[a-d]|files9[a-d]|export10[a-d]|roles11[a-d])/.test(indexSource),'Stale global app-loader marker after AI 6D');

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const fixture={version:4,clients:[{
  id:'ai-6d-client',
  name:'AI 6D Client',
  currentRequestId:'ai-6d-r2',
  lastDiagnosisRequestId:'ai-6d-r2',
  aiChat:[{
    id:'client-existing',role:'assistant',text:'client original',createdAt:1,
    meta:{nested:{value:1}}
  }],
  quickNotes:[{id:'note-1',text:'client note',createdAt:1,updatedAt:1}],
  questionnaires:[],
  freeConsultation:{id:'fc-1',pain:'Проверочная боль клиента',desired:'Проверочный результат'},
  requests:[
    {id:'ai-6d-r1',title:'Historical request',status:'closed',situations:[]},
    {id:'ai-6d-r2',title:'Active request',status:'active',situations:[]}
  ],
  sessions:[
    {id:'ai-6d-s1',requestId:'ai-6d-r1',date:'2026-09-18',notes:'Historical session',aiChat:[{id:'session-existing',role:'assistant',text:'session original',createdAt:2,meta:{nested:{value:2}}}]},
    {id:'ai-6d-s2',requestId:'ai-6d-r2',date:'2026-09-19',notes:'Current session',aiChat:[]}
  ]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  window.DiagnostikaAI={legacyTrap:'must-not-survive'};
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','ai-6d-client');
  localStorage.setItem('diagnostika-ai-n8n-access-key','ai-6d-access-key-123456');
  if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

const payloads=[];
await page.route('https://lugovoyn8n.ru/**',async route=>{
  const url=route.request().url();
  if(url.includes('/diagnostika-client-chat-v1')){
    try{payloads.push(JSON.parse(route.request().postData()||'{}'));}catch(_){payloads.push({});}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({reply:'AI 6D transport answer'})});
    return;
  }
  await route.abort();
});

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaAI?.version==='6D'
    && window.DiagnostikaPlatform?.services?.ai
    && typeof window.DiagnostikaClientAIChat?.send==='function'
    && typeof window.DiagnostikaClientAIFullContext?.enrichPayload==='function',
    null,{timeout:15000});
  await page.locator('#hdClientAiWidget').waitFor({state:'visible',timeout:10000});
}

await page.goto(base,{waitUntil:'commit',timeout:10000});
await ready();

const hardening=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='ai-6d-client');
  const api=window.DiagnostikaAI;
  const clientRead=api.clientChat(c.id);
  const sessionRead=api.sessionChat('ai-6d-s1',c.id);

  clientRead[0].text='tampered client read';
  clientRead[0].meta.nested.value=999;
  clientRead.push({id:'read-only-client',role:'user',text:'should not persist'});
  sessionRead[0].text='tampered session read';
  sessionRead[0].meta.nested.value=999;
  sessionRead.push({id:'read-only-session',role:'user',text:'should not persist'});

  const appended=api.appendClientMessage(c.id,{
    id:'ai6d-appended',role:'user',text:'stored append',createdAt:3,meta:{nested:{value:3}}
  },{client:c,source:'ai-6d-return-isolation'});
  appended.text='tampered append return';
  appended.meta.nested.value=999;

  const replaced=api.replaceSessionChat('ai-6d-s2',[
    {id:'ai6d-replaced',role:'assistant',text:'stored replace',createdAt:4,meta:{nested:{value:4}}}
  ],{client:c,source:'ai-6d-return-isolation'});
  replaced[0].text='tampered replace return';
  replaced[0].meta.nested.value=999;
  replaced.push({id:'replace-return-only',role:'user',text:'should not persist'});

  return {
    facadeFrozen:Object.isFrozen(api),
    legacyTrap:api.legacyTrap,
    fullContextFrozen:Object.isFrozen(window.DiagnostikaClientAIFullContext),
    currentRequestId:c.currentRequestId,
    requestIds:c.sessions.map(s=>s.requestId),
    client:JSON.parse(JSON.stringify(c.aiChat)),
    s1:JSON.parse(JSON.stringify(c.sessions[0].aiChat)),
    s2:JSON.parse(JSON.stringify(c.sessions[1].aiChat))
  };
});

assert.equal(hardening.facadeFrozen,true,'AI facade is mutable');
assert.equal(hardening.legacyTrap,undefined,'Legacy facade property leaked into 6D API');
assert.equal(hardening.fullContextFrozen,true,'Full-context helper is mutable');
assert.equal(hardening.currentRequestId,'ai-6d-r2');
assert.deepEqual(hardening.requestIds,['ai-6d-r1','ai-6d-r2']);
assert.equal(hardening.client[0].text,'client original','Client read result mutated store');
assert.equal(hardening.client[0].meta.nested.value,1,'Nested client read result mutated store');
assert.equal(hardening.client.some(x=>x.id==='read-only-client'),false);
assert.equal(hardening.client.find(x=>x.id==='ai6d-appended')?.text,'stored append','Append return leaked live stored message');
assert.equal(hardening.client.find(x=>x.id==='ai6d-appended')?.meta.nested.value,3);
assert.equal(hardening.s1[0].text,'session original','Session read result mutated store');
assert.equal(hardening.s1[0].meta.nested.value,2,'Nested session read result mutated store');
assert.equal(hardening.s1.some(x=>x.id==='read-only-session'),false);
assert.equal(hardening.s2.length,1,'Replace return leaked live session array');
assert.equal(hardening.s2[0].text,'stored replace');
assert.equal(hardening.s2[0].meta.nested.value,4);

await page.evaluate(()=>window.DiagnostikaClientAIChat.send('Проверка явного 6D payload pipeline'));
await page.waitForFunction(()=>{
  const c=state.clients.find(x=>x.id==='ai-6d-client');
  return c.aiChat.some(x=>x.text==='AI 6D transport answer');
},null,{timeout:10000});

assert.equal(payloads.length,1,'Expected one successful client AI transport request');
const payload=payloads[0];
assert.equal(payload.clientId,'ai-6d-client');
assert.equal(payload.clientContext?.freeConsultation?.pain,'Проверочная боль клиента','Full context was not explicitly enriched');
assert.equal(typeof payload.clientContext?.contextInstruction,'string','Full context instruction missing');
assert(payload.clientContext.contextInstruction.length>20,'Full context instruction is empty');
assert(String(payload.message||'').includes('Используй весь переданный контекст клиента.'),'Full-context instruction was not applied to message');

const viewUrl=new URL('client-ai-chat-view.js',base).href;
await page.evaluate(()=>{window.__ai6dFetchBeforeView=window.fetch;});
await page.addScriptTag({url:viewUrl});
await page.waitForFunction(()=>typeof window.DiagnostikaClientAIChatView?.preparePayload==='function',null,{timeout:5000});
const viewCheck=await page.evaluate(()=>{
  const sameFetch=window.fetch===window.__ai6dFetchBeforeView;
  const prepared=window.DiagnostikaClientAIChatView.preparePayload({
    message:'mode test',
    clientContext:{profile:{name:'Test'},questionnaires:[],requests:[],sessions:[],notes:[]},
    chatHistory:[{role:'user',text:'history'}]
  });
  return {sameFetch,prepared};
});
assert.equal(viewCheck.sameFetch,true,'Loading AI view reintroduced global fetch monkey-patch');
assert.equal(viewCheck.prepared.responseMode,'short');
assert.equal(viewCheck.prepared.maxOutputTokens,500);
assert(String(viewCheck.prepared.message).includes('РЕЖИМ КОРОТКО'));

const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}'));
const persistedClient=persisted.clients.find(x=>x.id==='ai-6d-client');
assert.equal(persistedClient.currentRequestId,'ai-6d-r2');
assert.deepEqual(persistedClient.sessions.map(s=>s.requestId),['ai-6d-r1','ai-6d-r2']);
assert.equal(persistedClient.aiChat.find(x=>x.id==='ai6d-appended')?.text,'stored append');
assert.equal(persistedClient.sessions[1].aiChat[0]?.text,'stored replace');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('AI_MODULE_6D_SUCCESS',JSON.stringify({
  facadeFrozen:hardening.facadeFrozen,
  viewFetchStable:viewCheck.sameFetch,
  clientMessages:hardening.client.length,
  sessionMessages:hardening.s1.length+hardening.s2.length,
  payloadEnriched:Boolean(payload.clientContext?.contextInstruction),
  currentRequestId:hardening.currentRequestId,
  historicalRequestId:hardening.requestIds[0]
}));

await context.close();
await browser.close();
