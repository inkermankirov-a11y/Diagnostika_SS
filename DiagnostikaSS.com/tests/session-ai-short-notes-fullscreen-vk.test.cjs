'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const helperSource=fs.readFileSync(path.join(root,'modules/ai/ui/session-short-summary.js'),'utf8');
const chatSource=fs.readFileSync(path.join(root,'modules/ai/ui/session-chat.js'),'utf8');
const sessionFormat=fs.readFileSync(path.join(root,'modules/sessions/ui/format.js'),'utf8');
const styles=fs.readFileSync(path.join(root,'session-format.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function helper(){
  const window={};
  vm.runInNewContext(helperSource,{window});
  return window.DiagnostikaSessionShortSummary;
}

test('short AI session summary is limited to three lines and does not include markdown',()=>{
  const h=helper();
  const raw='### Итоги сессии\n**Обсудили:** перенос отпуска, страх неопределённости.\n'+
    '**Проведено:** выявлен исходный запрос, проведена диагностика.\n'+
    '**Результат:** сформулирован запрос на дальнейшую работу.\n'+
    '### Дополнительные рассуждения\n'+('Длинный повтор. '.repeat(100));
  const short=h.normalize(raw);
  assert.ok(short.length<=h.maxLength);
  assert.equal(short.split('\n').length,3);
  assert.match(short,/Обсудили:/);
  assert.match(short,/Проведено:/);
  assert.match(short,/Результат:/);
  assert.doesNotMatch(short,/###|\*\*|Дополнительные рассуждения/);
});

test('long prose AI answer is compacted without losing all content',()=>{
  const h=helper();
  const answer='На сессии обсуждали запрос и тревогу. Проведена диагностика. '+ 
    'Выявили несколько убеждений. '+('Слишком длинный дополнительный текст. '.repeat(35));
  const short=h.normalize(answer);
  assert.ok(short.length<=h.maxLength);
  assert.match(short,/диагностика/);
  assert.doesNotMatch(short,/Слишком длинный/);
});

test('existing manual notes are preserved, regenerated summary replaces old one',()=>{
  const h=helper();
  const notes='Важные записи специалиста.\nНе менять исходные заметки.';
  const first='Обсудили: тревогу.\nПроведено: диагностика.\nРезультат: запрос.';
  const second='Обсудили: тревогу.\nПроведено: уточнение.\nРезультат: запрос.';
  const merged=h.merge(notes,'',first);
  assert.match(merged,/Важные записи специалиста/);
  assert.match(merged,/Краткие итоги сессии \(ИИ\):/);
  assert.match(merged,/Проведено: диагностика/);
  assert.equal(h.merge(merged,first,first),merged);
  const replaced=h.merge(merged,first,second);
  assert.match(replaced,/Проведено: уточнение/);
  assert.doesNotMatch(replaced,/Проведено: диагностика/);
  assert.match(replaced,/Не менять исходные заметки/);
  assert.equal((replaced.match(/Краткие итоги сессии \(ИИ\):/g)||[]).length,1);
});

function saveImpl({s,notes,fail=false}){
  const h=helper();
  const start=chatSource.indexOf('    const saveShortNotes=answer=>{');
  const end=chatSource.indexOf('    const send=async(kind=',start);
  assert.ok(start>=0&&end>start);
  const snippet=chatSource.slice(start,end);
  const calls=[];
  const service={moduleAware:true,update:(id,changes,opts)=>{
    calls.push({id,changes,opts});
    if(fail)return null;
    Object.assign(s,changes);
    return s;
  }};
  const window={DiagnostikaSessionShortSummary:h,DiagnostikaSessions:service};
  const textarea={value:notes};
  const dlg={querySelector:selector=>selector==='.session-edit-text'?textarea:null};
  const jumpNotes={hidden:true};
  const fn=Function('window','dlg','s','c','jumpNotes',snippet+' return saveShortNotes;')(
    window,dlg,s,{id:'c-vika'},jumpNotes
  );
  return {fn,textarea,calls,jumpNotes,s};
}

test('one-click short summary persists exactly the session notes via session service',()=>{
  const s={id:'s-vika',notes:'Ручная заметка'};
  const t=saveImpl({s,notes:'Ручная заметка'});
  t.fn('Обсудили: отпуск.\nПроведено: диагностика.\nРезультат: уточнён запрос.');
  assert.equal(t.calls.length,1);
  assert.equal(t.calls[0].id,'s-vika');
  assert.equal(t.calls[0].opts.client.id,'c-vika');
  assert.equal(t.calls[0].opts.render,false);
  assert.match(t.calls[0].changes.notes,/Ручная заметка/);
  assert.match(t.calls[0].changes.notes,/Проведено: диагностика/);
  assert.equal(t.s.aiShortSummary,t.calls[0].changes.aiShortSummary);
  assert.equal(t.textarea.value,t.s.notes);
  assert.equal(t.jumpNotes.hidden,false);
});

test('failed storage write keeps generated summary visible but never claims it is saved',()=>{
  const s={id:'s-vika',notes:'Ручная заметка'};
  const t=saveImpl({s,notes:'Ручная заметка',fail:true});
  assert.throws(()=>t.fn('Обсудили: запрос.\nПроведено: диагностика.\nРезультат: уточнён.'),/не сохранены/);
  assert.match(t.textarea.value,/Обсудили: запрос/);
  assert.equal(s.notes,'Ручная заметка');
  assert.equal(t.jumpNotes.hidden,true);
});

test('fullscreen toggle leaves other fields in editor and Escape collapses instead of closing',()=>{
  assert.match(chatSource,/class="session-ai-expand"/);
  assert.match(chatSource,/dlg\.classList\.toggle\('session-ai-fullscreen'/);
  assert.match(chatSource,/dlg\.addEventListener\('cancel',event=>\{/);
  assert.match(chatSource,/event\.preventDefault\(\);\s*setFullscreen\(false\)/);
  assert.match(chatSource,/session-edit-card > :not\(\.session-ai-box\)\{display:none!important\}/);
  assert.match(chatSource,/session-ai-messages\{flex:1 1 auto!important/);
  assert.match(chatSource,/Короткие итоги → в заметки/);
  assert.match(chatSource,/К заметкам сессии/);
});

test('VKontakte session format and cache-busted scripts are present only on .com site',()=>{
  assert.match(sessionFormat,/\['vk','ВКонтакте'\]/);
  assert.match(styles,/\.session-format-chip\.vk/);
  assert.ok(html.indexOf('modules/ai/ui/session-short-summary.js?v=20261111-vk-short-notes-1')>
    html.indexOf('modules/sessions/ui/format.js?v=20261111-vk-short-notes-1'));
  assert.ok(html.indexOf('modules/ai/ui/session-short-summary.js?v=20261111-vk-short-notes-1')<
    html.indexOf('modules/ai/ui/session-chat.js?v=20261111-vk-short-notes-1'));
  assert.match(html,/session-format\.css\?v=20261111-vk-short-notes-1/);
});
