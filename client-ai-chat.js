'use strict';

(() => {
  if (window.__diagnostikaClientAiChatReady) return;
  window.__diagnostikaClientAiChatReady = true;

  const TEST_URL='https://lugovoyn8n.ru/webhook-test/diagnostika-client-chat-v1';
  const PROD_URL='https://lugovoyn8n.ru/webhook/diagnostika-client-chat-v1';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const uid=prefix=>`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  let widget=null;
  let sending=false;
  let initAttempts=0;

  function currentClient(){
    try{return state?.clients?.find(c=>String(c.id)===String(clientId))||null;}catch(_){return null;}
  }
  function persist(source='client-notes'){try{if(typeof save==='function')return save({source})!==false;}catch(err){console.warn('Client data save failed',err);}return false;}
  function notesOf(c){if(!c)return[];if(!Array.isArray(c.quickNotes))c.quickNotes=[];return c.quickNotes;}
  function chatOf(c){
    if(!c)return[];
    try{
      const chat=window.DiagnostikaAI?.clientChat?.(c.id);
      return Array.isArray(chat)?chat:[];
    }catch(_){return[];}
  }
  function fmt(ts){try{return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ts));}catch(_){return'';}}

  const style=document.createElement('style');
  style.textContent=`
    #clientNotesOverlay{position:fixed;inset:0;z-index:15000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.54);backdrop-filter:blur(6px)}
    #clientNotesOverlay[hidden]{display:none!important}.client-notes-panel{width:min(680px,calc(100vw - 24px));max-height:86dvh;overflow:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:16px;box-shadow:0 25px 70px rgba(15,23,42,.35);padding:16px;box-sizing:border-box;color:#243447}.client-notes-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.client-notes-head h2{margin:0;font-size:20px}.client-notes-editor{padding:12px;border:1px solid #d8e3ec;border-radius:12px;background:#fff}.client-notes-text{width:100%;min-height:105px;resize:vertical;border:1px solid #b9c6d4;border-radius:9px;padding:10px 12px;box-sizing:border-box;font:14px/1.45 'Segoe UI',Arial,sans-serif}.client-notes-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}.client-notes-list{display:grid;gap:8px;margin-top:12px}.client-note-item{display:grid;grid-template-columns:1fr auto;gap:10px;padding:10px 12px;border:1px solid #dbe4ed;border-radius:10px;background:#fff;cursor:pointer}.client-note-item:hover{background:#f4f8fc}.client-note-content{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.4}.client-note-date{font-size:10px;color:#8290a1;margin-top:5px}.client-note-delete{height:30px!important;padding:0 9px!important;font-size:11px!important;background:#d95353!important;color:#fff!important}.client-note-empty{padding:16px;text-align:center;color:#94a3b8;font-size:12px}
    .hd-note-box .hd-note-preview-head{font-weight:800;color:#344b68;margin-bottom:5px}.hd-note-box .hd-note-preview-meta{font-size:11px;color:#8a9bb4;margin-top:5px}
    .hd-ai-widget{padding:14px!important}.hd-ai-widget .hd-widget-title{margin-bottom:6px!important}.hd-ai-client{font-size:11px;color:#7b8da8;margin-bottom:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hd-ai-quick{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px}.hd-ai-quick button{border:1px solid #cbdcf2;background:#f6faff;color:#356aa9;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:800;cursor:pointer}.hd-ai-quick button:hover{background:#eaf4ff}.hd-ai-messages{height:190px;overflow:auto;border:1px solid #dbe7f4;border-radius:10px;background:#f8fbff;padding:8px;display:flex;flex-direction:column;gap:7px;box-sizing:border-box}.hd-ai-empty{margin:auto;text-align:center;color:#91a0b5;font-size:11px;line-height:1.45;padding:10px}.hd-ai-msg{max-width:90%;padding:7px 9px;border-radius:10px;font-size:11px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere}.hd-ai-msg.user{align-self:flex-end;background:#2f7cf6;color:#fff;border-bottom-right-radius:4px}.hd-ai-msg.assistant{align-self:flex-start;background:#fff;border:1px solid #d8e4f2;color:#314861;border-bottom-left-radius:4px}.hd-ai-msg-time{display:block;font-size:9px;opacity:.65;margin-top:4px}.hd-ai-compose{display:grid;grid-template-columns:1fr 38px;gap:6px;margin-top:8px}.hd-ai-input{width:100%;height:38px;box-sizing:border-box;border:1px solid #cbd9ea;border-radius:9px;padding:0 10px;font:12px 'Segoe UI',Arial,sans-serif;outline:none}.hd-ai-input:focus{border-color:#72a6f2;box-shadow:0 0 0 2px rgba(47,124,246,.10)}.hd-ai-send{width:38px;height:38px;border:0;border-radius:9px;background:#2f7cf6;color:#fff;font-size:17px;font-weight:900;cursor:pointer}.hd-ai-send:disabled,.hd-ai-input:disabled,.hd-ai-quick button:disabled{opacity:.5;cursor:not-allowed}.hd-ai-status{min-height:15px;margin-top:6px;font-size:10px;color:#72839a}.hd-ai-status.error{color:#b33a3a}.hd-ai-status.busy{color:#2f70d4}
    @media(max-width:760px){#clientNotesOverlay{place-items:end center;padding:0}.client-notes-panel{width:100%;max-height:88dvh;border-radius:18px 18px 0 0}.hd-ai-messages{height:230px}}
  `;
  document.head.appendChild(style);

  const notesOverlay=document.createElement('div');
  notesOverlay.id='clientNotesOverlay';notesOverlay.hidden=true;document.body.appendChild(notesOverlay);
  let editingNoteId=null;
  let notesClientId=null;

  function closeNotes(){notesOverlay.hidden=true;notesOverlay.innerHTML='';editingNoteId=null;notesClientId=null;document.documentElement.style.overflow='';}
  function openNotes(){
    const c=currentClient();
    if(!c){window.AppDialog?.alert?.('Сначала выберите клиента.','Заметки клиента');return;}
    notesClientId=String(c.id);editingNoteId=null;
    notesOverlay.innerHTML=`<section class="client-notes-panel"><div class="client-notes-head"><h2>📝 Заметки — ${esc(c.name||'Клиент')}</h2><button type="button" class="tk-btn client-notes-close">×</button></div><div class="client-notes-editor"><textarea class="client-notes-text" placeholder="Общие заметки только по этому клиенту…"></textarea><div class="client-notes-actions"><button type="button" class="tk-btn client-notes-new">Новая заметка</button><button type="button" class="tk-btn client-notes-save">Сохранить заметку</button></div></div><div class="client-notes-list"></div></section>`;
    notesOverlay.hidden=false;document.documentElement.style.overflow='hidden';
    notesOverlay.querySelector('.client-notes-close').onclick=closeNotes;
    const input=notesOverlay.querySelector('.client-notes-text');
    const saveBtn=notesOverlay.querySelector('.client-notes-save');
    function liveClient(){return state?.clients?.find(x=>String(x.id)===notesClientId)||null;}
    function reset(){editingNoteId=null;input.value='';saveBtn.textContent='Сохранить заметку';input.focus();}
    function render(){
      const target=liveClient();const list=notesOverlay.querySelector('.client-notes-list');if(!target||!list)return;
      const notes=[...notesOf(target)].sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));list.innerHTML='';
      if(!notes.length){list.innerHTML='<div class="client-note-empty">Заметок по этому клиенту пока нет.</div>';return;}
      notes.forEach(note=>{
        const row=document.createElement('div');row.className='client-note-item';
        row.innerHTML=`<div><div class="client-note-content">${esc(note.text)}</div><div class="client-note-date">${esc(fmt(note.updatedAt||note.createdAt))}</div></div><button type="button" class="tk-btn client-note-delete">Удалить</button>`;
        row.querySelector('.client-note-delete').onclick=e=>{e.stopPropagation();const before=[...notesOf(target)];target.quickNotes=before.filter(x=>x.id!==note.id);if(!persist('client-notes-delete')){target.quickNotes=before;return;}if(editingNoteId===note.id)reset();render();refresh();window.dispatchEvent(new CustomEvent('diagnostika-client-notes-changed',{detail:{clientId:target.id}}));};
        row.onclick=()=>{editingNoteId=note.id;input.value=note.text||'';saveBtn.textContent='Сохранить изменения';input.focus();};list.appendChild(row);
      });
    }
    notesOverlay.querySelector('.client-notes-new').onclick=reset;
    saveBtn.onclick=()=>{
      const text=input.value.trim();if(!text)return;const target=liveClient();if(!target)return;const notes=notesOf(target),now=Date.now();
      if(editingNoteId){const n=notes.find(x=>x.id===editingNoteId);if(n){n.text=text;n.updatedAt=now;}}
      else notes.push({id:uid('note'),text,createdAt:now,updatedAt:now});
      if(!persist(editingNoteId?'client-notes-update':'client-notes-create'))return;reset();render();refresh();window.dispatchEvent(new CustomEvent('diagnostika-client-notes-changed',{detail:{clientId:target.id}}));
    };
    input.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();saveBtn.click();}});
    render();setTimeout(()=>input.focus(),0);
  }
  notesOverlay.addEventListener('click',e=>{if(e.target===notesOverlay)closeNotes();});

  function cleanQuestionnaires(c){
    return (Array.isArray(c?.questionnaires)?c.questionnaires:[]).slice(-8).map(q=>({
      source:q.source||'',receivedAt:q.receivedAt||'',isPrimary:!!q.isPrimary,
      answers:Array.isArray(q.answerItems)?q.answerItems.map(x=>({question:String(x.question||''),answer:String(x.answer||'')})):Object.entries(q.answers||{}).map(([question,answer])=>({question,answer:Array.isArray(answer)?answer.join(', '):String(answer??'')}))
    }));
  }
  function cleanRequests(c){
    return (Array.isArray(c?.requests)?c.requests:[]).map(r=>({id:r.id,title:r.title||'',situations:(r.situations||[]).map(s=>({
      name:s.name||'',level:s.level??'',comment:s.comment||'',result:s.result||'',beliefs:(s.beliefs||[]).map(b=>({text:b.text||'',level:b.level??'',comment:b.comment||'',feelings:(b.feelings||[]).map(f=>({text:f.text||'',level:f.level??'',comment:f.comment||'',deep:(f.deep||[]).map(d=>({text:d.text||'',level:d.level??'',comment:d.comment||'',instincts:(d.instincts||[]).map(i=>({name:i.name||'',level:i.level??'',comment:i.comment||''}))}))}))}))
    }))}));
  }
  function buildContext(c){
    return {
      profile:{name:c.name||'',city:c.city||'',age:c.age||'',birth:c.birth||'',gender:c.gender||'',country:c.country||'',initialProblem:c.initialProblem||'',mainRequest:c.mainRequest||'',tried:c.tried||'',didntHelp:c.didntHelp||'',desiredOutcome:c.desiredOutcome||'',clientNotes:c.clientNotes||c.notes||''},
      questionnaires:cleanQuestionnaires(c),requests:cleanRequests(c),
      sessions:(Array.isArray(c.sessions)?c.sessions:[]).slice(-20).map(s=>({date:s.date||'',requestId:s.requestId||'',notes:s.notes||'',sessionFormat:s.sessionFormat||''})),
      notes:notesOf(c).slice(-20).map(n=>({text:n.text||'',createdAt:n.createdAt||n.updatedAt||0}))
    };
  }
  function getAccessKey(){
    let key='';try{key=window.DiagnostikaRequestAI?.getConfig?.()?.key||'';}catch(_){}
    if(!key){try{window.DiagnostikaRequestAI?.configure?.();key=window.DiagnostikaRequestAI?.getConfig?.()?.key||'';}catch(err){throw err;}}
    if(!key)throw new Error('Для AI-чата нужен ключ доступа n8n.');
    return key;
  }
  async function fetchJson(url,payload){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);
    try{
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store',credentials:'omit',signal:controller.signal});
      const text=await r.text();let data={};try{data=text?JSON.parse(text):{};}catch(_){data={text};}return {r,data};
    }finally{clearTimeout(timer);}
  }
  function replyText(data){
    if(typeof data==='string')return data.trim();
    if(data?.reply)return String(data.reply).trim();if(data?.answer)return String(data.answer).trim();if(data?.message)return String(data.message).trim();if(data?.text)return String(data.text).trim();if(data?.output_text)return String(data.output_text).trim();
    let out='';for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&part?.text)out+=part.text;return out.trim();
  }
  async function askAi(c,message){
    const history=chatOf(c).slice(0,-1).slice(-16).map(m=>({role:m.role,text:m.text}));
    let payload={accessKey:getAccessKey(),clientId:String(c.id||''),clientName:c.name||'',message,clientContext:buildContext(c),chatHistory:history};
    try{
      const prepare=window.DiagnostikaClientAIChatView?.preparePayload;
      if(typeof prepare==='function')payload=prepare(payload)||payload;
      const enrich=window.DiagnostikaClientAIFullContext?.enrichPayload;
      if(typeof enrich==='function')payload=enrich(payload)||payload;
    }catch(err){
      console.warn('Client AI payload preparation failed',err);
    }
    let attempt;
    try{attempt=await fetchJson(TEST_URL,payload);}catch(_){attempt=null;}
    if(attempt?.r?.ok){const t=replyText(attempt.data);if(t)return t;}
    if(attempt?.r && [401,403].includes(attempt.r.status))throw new Error('n8n отклонил ключ доступа.');
    const prod=await fetchJson(PROD_URL,payload);
    if([404,405,409,410].includes(prod.r.status))throw new Error('AI-чат ещё не подключён в n8n. Нужно импортировать и включить workflow diagnostika-client-chat-v1.');
    if([401,403].includes(prod.r.status))throw new Error('n8n отклонил ключ доступа.');
    if(!prod.r.ok)throw new Error(`AI-чат: HTTP ${prod.r.status}`);
    const text=replyText(prod.data);if(!text)throw new Error('AI не вернул текст ответа.');return text;
  }

  function buildWidget(){
    const dash=document.querySelector('.home-dashboard');if(!dash)return false;
    const next=dash.querySelector('#hdPlanBtn')?.closest('.hd-widget')||dash.querySelector('#hdClientAiWidget');if(!next)return false;
    widget=next;widget.id='hdClientAiWidget';widget.classList.add('hd-ai-widget');
    widget.innerHTML=`<div class="hd-widget-title"><span>🤖</span><span>AI по клиенту</span></div><div class="hd-ai-client"></div><div class="hd-ai-quick"><button type="button" data-prompt="Что сейчас главное в работе с этим клиентом?">Что сейчас главное?</button><button type="button" data-prompt="Составь план следующей сессии по имеющимся данным.">План сессии</button><button type="button" data-prompt="Что я как специалист мог упустить в данных этого клиента?">Что я мог упустить?</button></div><div class="hd-ai-messages"></div><div class="hd-ai-compose"><input class="hd-ai-input" type="text" placeholder="Спроси AI о клиенте…"><button class="hd-ai-send" type="button">➤</button></div><div class="hd-ai-status"></div>`;
    widget.querySelectorAll('.hd-ai-quick button').forEach(b=>b.onclick=()=>send(b.dataset.prompt||''));
    widget.querySelector('.hd-ai-send').onclick=()=>send(widget.querySelector('.hd-ai-input').value);
    widget.querySelector('.hd-ai-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(e.currentTarget.value);}});
    return true;
  }

  function renderNotesPreview(){
    const dash=document.querySelector('.home-dashboard');if(!dash)return;const box=dash.querySelector('#hdOpenNotes');if(!box)return;
    box.onclick=e=>{e?.preventDefault?.();e?.stopPropagation?.();openNotes();};
    box.setAttribute('role','button');
    box.setAttribute('tabindex','0');
    if(box.dataset.clientNotesKeyboard!=='1'){
      box.dataset.clientNotesKeyboard='1';
      box.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openNotes();}});
    }
    const title=box.closest('.hd-widget')?.querySelector('.hd-widget-title span:last-child');if(title)title.textContent='Заметки клиента';
    const c=currentClient();
    if(!c){box.innerHTML='<div class="hd-note-preview-head">Клиент не выбран</div><div>Выберите клиента слева, чтобы открыть его заметки.</div>';return;}
    const notes=[...notesOf(c)].sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
    if(!notes.length){box.innerHTML=`<div class="hd-note-preview-head">${esc(c.name||'Клиент')}</div><div>Заметок пока нет. Нажмите, чтобы добавить.</div>`;return;}
    const last=notes[0];const text=String(last.text||'');box.innerHTML=`<div class="hd-note-preview-head">${esc(c.name||'Клиент')}</div><div>${esc(text.length>130?text.slice(0,130)+'…':text)}</div><div class="hd-note-preview-meta">Заметок: ${notes.length} • ${esc(fmt(last.updatedAt||last.createdAt))}</div>`;
  }
  function renderChat(){
    if(!widget&&!buildWidget())return;const c=currentClient();const input=widget.querySelector('.hd-ai-input'),sendBtn=widget.querySelector('.hd-ai-send'),quick=[...widget.querySelectorAll('.hd-ai-quick button')],clientEl=widget.querySelector('.hd-ai-client'),messages=widget.querySelector('.hd-ai-messages');
    const disabled=!c||sending;input.disabled=disabled;sendBtn.disabled=disabled;quick.forEach(b=>b.disabled=disabled);clientEl.textContent=c?`Контекст: ${c.name||'выбранный клиент'}`:'Выберите клиента слева';
    messages.innerHTML='';
    if(!c){messages.innerHTML='<div class="hd-ai-empty">Выберите клиента. AI будет видеть только данные выбранного клиента.</div>';return;}
    const history=chatOf(c);
    if(!history.length){messages.innerHTML='<div class="hd-ai-empty">Здесь будет отдельный AI-диалог по этому клиенту. Контекст других клиентов не отправляется.</div>';return;}
    history.slice(-30).forEach(m=>{const div=document.createElement('div');div.className=`hd-ai-msg ${m.role==='assistant'?'assistant':'user'}`;div.innerHTML=`${esc(m.text)}<span class="hd-ai-msg-time">${esc(fmt(m.createdAt))}</span>`;messages.appendChild(div);});messages.scrollTop=messages.scrollHeight;
  }
  function setStatus(text,kind=''){if(!widget)return;const s=widget.querySelector('.hd-ai-status');s.textContent=text||'';s.className=`hd-ai-status ${kind}`.trim();}
  async function send(raw){
    const message=String(raw||'').trim();
    const c=currentClient();
    if(!message||!c||sending)return;
    const api=window.DiagnostikaAI;
    if(!api?.moduleAware||typeof api.appendClientMessage!=='function'){
      setStatus('AI-модуль ещё не готов. Обновите страницу.','error');
      return;
    }

    const input=widget.querySelector('.hd-ai-input');
    input.value='';
    const userMessage=api.appendClientMessage(c.id,{
      id:uid('chat'),
      role:'user',
      text:message,
      createdAt:Date.now()
    },{client:c,source:'client-ai-chat-user'});
    if(!userMessage){
      setStatus('Не удалось сохранить сообщение клиента.','error');
      return;
    }

    sending=true;
    renderChat();
    setStatus('AI анализирует данные выбранного клиента…','busy');
    try{
      const answer=await askAi(c,message);
      const assistantMessage=api.appendClientMessage(c.id,{
        id:uid('chat'),
        role:'assistant',
        text:answer,
        createdAt:Date.now()
      },{client:c,source:'client-ai-chat-assistant'});
      if(!assistantMessage)throw new Error('Не удалось сохранить ответ AI.');
      setStatus('');
    }
    catch(err){
      console.warn('Client AI chat failed',err);
      setStatus(err?.message||'Не удалось получить ответ AI.','error');
    }
    finally{
      sending=false;
      renderChat();
      window.dispatchEvent(new CustomEvent('diagnostika-client-ai-chat-changed',{detail:{clientId:c.id}}));
    }
  }

  function refresh(){renderNotesPreview();renderChat();}
  function hookDashboard(){
    const hd=window.DiagnostikaHomeDashboard;
    if(hd?.refresh&&!hd.refresh.__clientWidgetsWrapped){const prev=hd.refresh;const wrapped=function(){const out=prev.apply(this,arguments);setTimeout(refresh,0);return out;};wrapped.__clientWidgetsWrapped=true;hd.refresh=wrapped;}
  }
  let aiEventsHooked=false;
  function hookAIEvents(){
    if(aiEventsHooked)return true;
    const events=window.DiagnostikaPlatform?.events;
    if(!events?.on)return false;
    events.on('ai-client-chat:updated',detail=>{
      const c=currentClient();
      if(!c||String(detail?.clientId)!==String(c.id))return;
      setTimeout(refresh,0);
    });
    aiEventsHooked=true;
    return true;
  }
  function init(){
    const b=buildWidget()||!!widget;
    hookDashboard();
    const e=hookAIEvents();
    refresh();
    if(b&&e)return;
    initAttempts++;
    if(initAttempts<40)setTimeout(init,250);
  }
  document.addEventListener('click',e=>{if(e.target?.closest?.('.hd-client-row'))setTimeout(refresh,0);},true);
  window.addEventListener('diagnostika-client-notes-changed',()=>setTimeout(refresh,0));
  window.addEventListener('diagnostika-client-ai-chat-changed',()=>setTimeout(refresh,0));
  window.DiagnostikaClientAIChat={refresh,openNotes,buildContext,send};
  init();
})();