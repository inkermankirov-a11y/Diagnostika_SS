'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {TextDecoder,TextEncoder}=require('node:util');

const root=path.resolve(__dirname,'..');
const materialsJs=fs.readFileSync(path.join(root,'session-materials.js'),'utf8');
const editorJs=fs.readFileSync(path.join(root,'modules/sessions/ui/editor.js'),'utf8');
const sessionAiJs=fs.readFileSync(path.join(root,'modules/ai/ui/session-chat.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const n8n=JSON.parse(fs.readFileSync(path.join(root,'n8n/diagnostika-client-chat-v1.json'),'utf8'));
function cpEncode(text){
  const lookup=new Map();
  const chars=new TextDecoder('windows-1251').decode(Uint8Array.from({length:256},(_,i)=>i));
  for(let i=0;i<chars.length;i++)lookup.set(chars[i],i);
  return Uint8Array.from([...text].map(c=>{
    if(!lookup.has(c))throw new Error('Cannot encode CP1251 char '+c);
    return lookup.get(c);
  }));
}
function harness(records=[]){
  const api={moduleAware:true,get:async id=>records.find(r=>r.id===id)||null,
    list:async filter=>records.filter(r=>String(r.sessionId)===String(filter.sessionId))};
  const window={DiagnostikaFiles:api},sandbox={window,TextDecoder,Uint8Array,TextEncoder,FileReader:global.FileReader};
  vm.runInNewContext(materialsJs,sandbox);
  return window.DiagnostikaSessionMaterials;
}
function rec(id,contents,name='Запись.txt',clientId='client1',sessionId='session1'){
  return {id,name,type:'text/plain',clientId,sessionId,
    blob:new Blob([contents],{type:'text/plain'})};
}

test('decodes UTF-8 and legacy Windows-1251 Cyrillic without changing the original',async()=>{
  const text='Вика. Проведена диагностика, установлен исходный запрос.\nПроверены убеждения.';
  const unicode=rec('utf',new TextEncoder().encode(text));
  const old=rec('cp',cpEncode(text));
  const m=harness([unicode,old]);
  assert.equal((await m.readText(unicode)).text,text);
  assert.equal((await m.readText(old)).text,text);
  assert.equal((await m.readText(old)).encoding,'Windows-1251');
});

test('repairs UTF-8 text previously misread as Windows-1251',async()=>{
  const original='Кратко: была проведена диагностика, выявлены ключевые убеждения клиента. ';
  const utf8=new TextEncoder().encode(original.repeat(5));
  const garbled=new TextDecoder('windows-1251').decode(utf8);
  const stored=rec('corrupted',new TextEncoder().encode(garbled));
  const m=harness([stored]);
  const decoded=await m.readText(stored);
  assert.equal(decoded.text,original.repeat(5));
  assert.match(decoded.encoding,/Восстановленная/);
});

test('sends only documents from requested client and session, not other clients',async()=>{
  const transcript='Вика: обсуждали ситуацию и выявили исходный запрос.';
  const records=[
    rec('a',new TextEncoder().encode(transcript)),
    rec('b',new TextEncoder().encode('Тайные заметки другого клиента'), 'Другой.txt','other','session1'),
    rec('c',new TextEncoder().encode('Чужая сессия'), 'Другая.txt','client1','other-session')
  ];
  const m=harness(records),found=await m.collect('session1','client1');
  assert.equal(found.count,1);
  assert.equal(found.texts.length,1);
  assert.equal(found.texts[0].content,transcript);
  assert.equal(found.images.length,0);
});

test('long transcripts produce an explicit truncation notice',async()=>{
  const long=rec('long',new TextEncoder().encode('Сессия и запись. '.repeat(10000)));
  const m=harness([long]),collected=await m.collect('session1','client1');
  assert.equal(collected.texts.length,1);
  assert.equal(collected.texts[0].truncated,true);
  assert.ok(collected.skipped.some(x=>/часть файла/.test(x.reason)));
});

test('file viewer offers repaired Cyrillic, manual encoding and original download',()=>{
  assert.match(editorJs,/openTextAttachment/);
  assert.match(editorJs,/Восстановить кириллицу/);
  assert.match(editorJs,/Windows-1251/);
  assert.match(editorJs,/Скачать оригинал/);
  assert.match(editorJs,/reader\.readText\(rec,encoding\.value\)/);
  assert.match(editorJs,/link\.download=rec\.name/);
});

test('session AI receives transcript content and has its own session-specific hint buttons',()=>{
  assert.match(sessionAiJs,/sessionAttachments:\{/);
  assert.match(sessionAiJs,/texts:materials\.texts/);
  assert.match(sessionAiJs,/sessionAttachmentImages:/);
  assert.match(sessionAiJs,/Подсказки по этой сессии/);
  assert.match(sessionAiJs,/Итоги сессии/);
  assert.match(sessionAiJs,/Что уточнить/);
  assert.match(sessionAiJs,/Следующие шаги/);
  assert.match(sessionAiJs,/Что упущено/);
  assert.match(sessionAiJs,/Не выдумывай техники и результаты/);
  assert.match(sessionAiJs,/processedImageCount/);
});

test('repository workflow template forwards attached images to OpenAI and reports count',()=>{
  const prepare=n8n.nodes.find(n=>n.name==='Подготовить контекст');
  const llm=n8n.nodes.find(n=>n.name==='OpenAI — Responses API');
  const finish=n8n.nodes.find(n=>n.name==='Подготовить ответ');
  assert.match(prepare.parameters.jsCode,/sessionAttachmentImages/);
  assert.match(prepare.parameters.jsCode,/input_image/);
  assert.match(llm.parameters.body,/imageContent/);
  assert.match(finish.parameters.jsCode,/processedImageCount/);
});

test('scripts versioned and session materials load before viewer and AI',()=>{
  const read=name=>html.indexOf(name);
  assert.ok(read('session-materials.js?v=20261111-session-materials-1')>0);
  assert.ok(read('session-materials.js?v=20261111-session-materials-1')<
    read('modules/sessions/ui/editor.js?v=20261111-session-materials-1'));
  assert.ok(read('modules/sessions/ui/editor.js?v=20261111-session-materials-1')<
    read('modules/ai/ui/session-chat.js?v=20261111-session-materials-1'));
});
