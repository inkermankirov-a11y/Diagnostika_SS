'use strict';

(() => {
  if (window.__diagnostikaSessionAiChatReady) return;
  window.__diagnostikaSessionAiChatReady = true;

  const PROD_URL='https://lugovoyn8n.ru/webhook/diagnostika-client-chat-v1';
  const MODE_KEY='diagnostika-client-ai-answer-mode-v1';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const uid=prefix=>`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const clip=(v,n=1200)=>{const s=String(v??'');return s.length>n?s.slice(0,n)+'…':s;};
  const fmt=ts=>{try{return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ts));}catch(_){return'';}};

  function currentClient(){
    return window.DiagnostikaAIUIContext?.currentClient?.()||null;
  }
  function getMode(){try{return localStorage.getItem(MODE_KEY)==='deep'?'deep':'short';}catch(_){return'short';}}
  function setMode(mode){
    const next=mode==='deep'?'deep':'short';
    const clientBtn=document.querySelector(`#hdClientAiWidget .hd-ai-mode-btn[data-mode="${next}"]`);
    if(clientBtn){clientBtn.click();return;}
    try{localStorage.setItem(MODE_KEY,next);}catch(_){}
    document.dispatchEvent(new CustomEvent('diagnostika-session-ai-mode-changed',{detail:{mode:next}}));
  }
  function getAccessKey(){
    let key='';
    try{key=window.DiagnostikaRequestAI?.getConfig?.()?.key||'';}catch(_){}
    if(!key)throw new Error('ИИ ещё синхронизирует общий доступ. Подожди несколько секунд и повтори.');
    return key;
  }
  function sessionChat(s,c){
    const hist=window.DiagnostikaAI?.sessionChat?.(s?.id,c?.id);
    return Array.isArray(hist)?hist:[];
  }
  function linkedRequest(c,s,dlg){
    const selected=dlg?.querySelector('.session-edit-grid select')?.value||s.requestId||'';
    return (c?.requests||[]).find(r=>String(r.id)===String(selected))||null;
  }
  function sanitizeRequest(r){
    if(!r)return null;
    return {
      id:r.id||'',title:clip(r.title,600),
      situations:(Array.isArray(r.situations)?r.situations:[]).slice(-10).map(s=>({
        name:clip(s.name,500),level:s.level??'',comment:clip(s.comment,450),result:clip(s.result,650),
        beliefs:(Array.isArray(s.beliefs)?s.beliefs:[]).slice(-8).map(b=>({
          text:clip(b.text,500),level:b.level??'',comment:clip(b.comment,350),
          feelings:(Array.isArray(b.feelings)?b.feelings:[]).slice(-6).map(f=>({
            text:clip(f.text,450),level:f.level??'',comment:clip(f.comment,300),
            deep:(Array.isArray(f.deep)?f.deep:[]).slice(-4).map(d=>({
              text:clip(d.text,450),level:d.level??'',comment:clip(d.comment,300),
              instincts:(Array.isArray(d.instincts)?d.instincts:[]).slice(-3).map(i=>({name:clip(i.name,220),level:i.level??'',comment:clip(i.comment,220)}))
            }))
          }))
        }))
      }))
    };
  }
  function buildSessionContext(c,s,dlg,number,materials={texts:[],images:[],skipped:[],count:0}){
    let base={};
    try{base=window.DiagnostikaClientAIChat?.buildContext?.(c)||{};}catch(_){}
    const req=linkedRequest(c,s,dlg);
    const notesInput=dlg?.querySelector('.session-edit-text');
    const planInput=dlg?.querySelector('.session-plan-editor-text');
    const dateInput=dlg?.querySelector('.session-edit-grid input[type="date"]');
    const formatSelect=dlg?.querySelector('.session-format-select');
    const formatOther=dlg?.querySelector('.session-format-other');
    return {
      profile:base.profile||{
        name:c.name||'',city:c.city||'',age:c.age||'',birth:c.birth||'',gender:c.gender||'',country:c.country||'',
        initialProblem:c.initialProblem||'',mainRequest:c.mainRequest||'',desiredOutcome:c.desiredOutcome||''
      },
      questionnaires:[],
      requests:req?[sanitizeRequest(req)]:[],
      sessions:[{
        id:s.id||'',number:number||'',date:dateInput?.value||s.date||'',requestId:req?.id||s.requestId||'',
        notes:clip(notesInput?.value??s.notes,5000),
        plan:clip(planInput?.value??s.plan,4000),
        sessionFormat:formatSelect?.value||s.sessionFormat||'',
        sessionFormatOther:clip(formatOther?.value??s.sessionFormatOther,300),
        youtubeUrl:s.youtubeUrl?'Есть ссылка на запись YouTube':''
      }],
      notes:[],
      sessionAttachments:{
        texts:materials.texts||[],
        skipped:materials.skipped||[],
        imageNames:(materials.images||[]).map(image=>image.name),
        total:materials.count||0
      },
      sessionScope:{
        instruction:'Это чат по одной конкретной сессии. В первую очередь используй заметки этой сессии и текст её приложенных файлов. Отличай расшифровку от подтверждённых действий специалиста. Не выдавай планы, общие сведения или записи других сессий за проведённую работу. Указывай источники: заметки сессии, файл по имени, текущая диагностика. Не выдумывай техники и результаты. Название изображения без его содержимого не является основанием для выводов; если изображение недоступно модели, прямо скажи об этом. Если материалов недостаточно, честно скажи.',
        sessionId:String(s.id||''),sessionNumber:number||''
      }
    };
  }
  function replyText(data){
    if(typeof data==='string')return data.trim();
    if(data?.reply)return String(data.reply).trim();
    if(data?.answer)return String(data.answer).trim();
    if(data?.message)return String(data.message).trim();
    if(data?.text)return String(data.text).trim();
    if(data?.output_text)return String(data.output_text).trim();
    let out='';for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==='output_text'&&part?.text)out+=part.text;return out.trim();
  }
  async function ask(c,s,dlg,number,message,onProgress=()=>{}){
    onProgress('Читаю вложения этой сессии…');
    let materials={texts:[],images:[],skipped:[],count:0};
    try{
      materials=await window.DiagnostikaSessionMaterials?.collect?.(s.id,c.id)||materials;
    }catch(error){
      materials.skipped.push({name:'Вложения',reason:error?.message||'Не удалось прочитать вложения'});
    }
    const history=sessionChat(s,c).slice(0,-1).slice(-12).map(m=>({role:m.role,text:m.text}));
    const attachmentCount=materials.texts.length+materials.images.length;
    const ignoredCount=materials.skipped.length;
    onProgress(attachmentCount
      ?'Читаю материалы: текстовых файлов '+materials.texts.length+
        ', изображений '+materials.images.length+
        (ignoredCount?'; не обработано '+ignoredCount:'')+'…'
      :ignoredCount?'Не удалось прочитать часть вложений; анализирую доступные заметки…'
        :'Вложений нет, анализирую текущую сессию…');
    const payload={
      accessKey:getAccessKey(),clientId:String(c.id||''),clientName:c.name||'',
      message:'ЧАТ ПО СЕССИИ №'+(number||'')+
        '. Отвечай исключительно по материалам этой сессии; не приписывай этой сессии действия из общей истории клиента. '+
        'Если вопрос о том, что было проведено, опирайся на приложенную расшифровку и заметки, а не на планы или предположения. '+
        'Если нет подтверждённых данных, сообщи об этом. Для кратких итогов перечисли только: что обсуждали, что делали, какой результат зафиксирован. '+
        'Предложения для следующей встречи помечай как рекомендации, а не как выполненную работу.\n\nВопрос специалиста: '+message,
      clientContext:buildSessionContext(c,s,dlg,number,materials),chatHistory:history,
      sessionAttachmentImages:materials.images.map(({name,mimeType,dataUrl})=>({name,mimeType,dataUrl})),
      sessionId:String(s.id||''),sessionNumber:number||''
    };
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),90000);
    try{
      onProgress('ИИ анализирует данные выбранной сессии…');
      const r=await fetch(PROD_URL,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),cache:'no-store',credentials:'omit',signal:controller.signal});
      const raw=await r.text();let data={};try{data=raw?JSON.parse(raw):{};}catch(_){data={text:raw};}
      if([401,403].includes(r.status))throw new Error('n8n отклонил ключ доступа.');
      if(!r.ok)throw new Error('ИИ помощник: HTTP '+r.status);
      const text=replyText(data);if(!text)throw new Error('ИИ не вернул текст ответа.');
      const processedImages=Number(data?.processedImageCount)||0;
      const notice=materials.images.length&&!processedImages
        ?'Изображения получены, но серверный ИИ не подтвердил их анализ. Нужно обновить обработчик n8n.'
        :materials.skipped.length
          ?'Не удалось обработать '+materials.skipped.length+' вложений. Проверьте форматы или размер.'
          :materials.texts.length
            ?'Учтены текстовые материалы этой сессии: '+materials.texts.length+'.'
            :'';
      return {text,notice,materials,processedImages};
    }finally{clearTimeout(timer);}
  }

  const style=document.createElement('style');
  style.textContent=`
    .hd-ai-clear-btn{height:28px;border:1px solid #d7e0ea;border-radius:8px;background:#fff;color:#64748b;padding:0 9px;font:700 10px/1 'Segoe UI',Arial,sans-serif;cursor:pointer}.hd-ai-clear-btn:hover{background:#fff5f5;border-color:#fecaca;color:#b91c1c}
    .session-ai-box{margin:14px 0 2px;border:1px solid #dbe6f2;border-radius:12px;background:#f8fbff;overflow:hidden}
    .session-ai-head{display:flex;align-items:center;gap:9px;padding:10px 12px;border-bottom:1px solid #e2eaf3;background:#fff}
    .session-ai-icon{width:29px;height:29px;flex:0 0 29px;border-radius:9px;background:#eef5ff;display:grid;place-items:center}
    .session-ai-icon:before{content:'';width:18px;height:18px;background:center/contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%232f7cf6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z'/%3E%3Cpath d='M8 9h.01'/%3E%3Cpath d='M12 9h.01'/%3E%3Cpath d='M16 9h.01'/%3E%3C/svg%3E")}
    .session-ai-head-text{min-width:0;flex:1}.session-ai-title{font-size:13px;font-weight:800;color:#172b4d}.session-ai-sub{margin-top:2px;font-size:10px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .session-ai-clear{height:28px;border:1px solid #d7e0ea;border-radius:8px;background:#fff;color:#64748b;padding:0 9px;font-size:10px;font-weight:700;cursor:pointer}.session-ai-clear:hover{background:#fff5f5;color:#b91c1c;border-color:#fecaca}
    .session-ai-messages{height:180px;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:7px;background:#fbfdff;box-sizing:border-box}
    .session-ai-empty{margin:auto;text-align:center;color:#8797aa;font-size:11px;line-height:1.45;padding:12px}
    .session-ai-msg{max-width:88%;padding:7px 9px;border-radius:10px;font-size:11px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}.session-ai-msg.user{align-self:flex-end;background:#2f7cf6;color:#fff;border-bottom-right-radius:4px}.session-ai-msg.assistant{align-self:flex-start;background:#fff;border:1px solid #d8e4f2;color:#314861;border-bottom-left-radius:4px}.session-ai-time{display:block;font-size:9px;opacity:.6;margin-top:4px}
    .session-ai-tools{display:flex;align-items:center;justify-content:flex-end;padding:7px 9px 0}.session-ai-mode{display:flex;gap:2px;padding:2px;background:#edf2f7;border-radius:8px}.session-ai-mode button{border:0;background:transparent;border-radius:6px;padding:5px 8px;color:#64748b;font-size:10px;font-weight:700;cursor:pointer}.session-ai-mode button.active{background:#fff;color:#2563eb;box-shadow:0 1px 3px rgba(15,23,42,.10)}
    .session-ai-compose{display:grid;grid-template-columns:1fr 40px;gap:6px;padding:7px 9px 9px}.session-ai-input{height:40px;border:1px solid #cfdbea;border-radius:10px;background:#fff;padding:0 11px;font:12px 'Segoe UI',Arial,sans-serif;outline:none;min-width:0}.session-ai-input:focus{border-color:#72a6f2;box-shadow:0 0 0 2px rgba(47,124,246,.10)}.session-ai-send{height:40px;width:40px;border:0;border-radius:10px;background:#2f7cf6;color:#fff;font-size:17px;font-weight:900;cursor:pointer}.session-ai-send:disabled,.session-ai-input:disabled{opacity:.5;cursor:not-allowed}
    .session-ai-status{min-height:13px;padding:0 10px 7px;color:#64748b;font-size:9px}.session-ai-status.error{color:#b91c1c}.session-ai-status.busy{color:#2563eb}
    .session-ai-hints{padding:9px 10px 3px;border-top:1px solid #e7edf6}
    .session-ai-hints-title{font-size:10px;font-weight:850;color:#456486;margin-bottom:7px;letter-spacing:.025em}
    .session-ai-hint-chips{display:flex;flex-wrap:wrap;gap:5px}
    .session-ai-hint-chips button{border:1px solid #bbd3ee;background:#f2f7fe;border-radius:9px;color:#285b91;font-size:10.5px;font-weight:750;padding:6px 9px;cursor:pointer}
    .session-ai-hint-chips button:hover{background:#e3f0ff}
    .session-ai-hint-chips button:disabled{opacity:.5;cursor:wait}
    .session-ai-materials-note{font-size:10px;color:#7c8ea4;padding:6px 10px 2px;line-height:1.4}
    .session-ai-status.warning{color:#a96317}
    @media(max-width:640px){.session-ai-messages{height:210px}.session-ai-msg{max-width:94%}.session-ai-head{align-items:flex-start}.session-ai-clear{margin-left:auto}}
  `;
  document.head.appendChild(style);

  function installClientClear(){
    const w=document.getElementById('hdClientAiWidget');if(!w)return false;
    const title=w.querySelector('.hd-widget-title');if(!title)return false;
    let actions=title.querySelector('.hd-ai-title-actions');
    if(!actions){actions=document.createElement('span');actions.className='hd-ai-title-actions';title.appendChild(actions);}
    if(actions.querySelector('.hd-ai-clear-btn'))return true;
    const btn=document.createElement('button');btn.type='button';btn.className='hd-ai-clear-btn';btn.textContent='Очистить';btn.title='Очистить историю этого чата';
    btn.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      const c=currentClient();if(!c)return;
      const api=window.DiagnostikaAI;
      const history=api?.clientChat?.(c.id);
      const count=Array.isArray(history)?history.length:0;if(!count)return;
      if(!confirm('Очистить переписку ИИ помощника по клиенту «'+(c.name||'Клиент')+'»?'))return;
      const cleared=api?.clearClientChat?.(c.id,{client:c,source:'session-ai-client-clear'});
      if(!Array.isArray(cleared))return;
      window.DiagnostikaClientAIChat?.refresh?.();
      window.dispatchEvent(new CustomEvent('diagnostika-client-ai-chat-changed',{detail:{clientId:c.id}}));
    };
    actions.insertBefore(btn,actions.firstChild);return true;
  }

  function sessionByDialog(dlg){
    const c=currentClient();if(!c)return {c:null,s:null};
    const id=dlg?.dataset?.sessionId||'';
    const s=window.DiagnostikaAIUIContext?.sessionById?.(id,c)||null;
    return {c,s};
  }
  function sessionNumber(c,s){
    if(!c||!s)return'';
    const arr=(c.sessions||[]).map((x,i)=>({x,i,t:typeof sessionTimeValue==='function'?sessionTimeValue(x,i):(new Date(x.date||0).getTime()||i)})).sort((a,b)=>a.t-b.t||a.i-b.i);
    const i=arr.findIndex(v=>v.x===s||v.x.id===s.id);return i>=0?i+1:'';
  }
  function updateSessionMode(box){
    if(!box)return;const mode=getMode();box.querySelectorAll('.session-ai-mode button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  }
  function renderSessionChat(box,c,s){
    const root=box.querySelector('.session-ai-messages');root.innerHTML='';const hist=sessionChat(s,c);
    if(!hist.length){root.innerHTML='<div class="session-ai-empty">Отдельный диалог только по этой сессии. Можно спросить, что важно в заметках, что могло быть упущено и на что обратить внимание дальше.</div>';return;}
    hist.slice(-30).forEach(m=>{const d=document.createElement('div');d.className=`session-ai-msg ${m.role==='assistant'?'assistant':'user'}`;d.innerHTML=`${esc(m.text)}<span class="session-ai-time">${esc(fmt(m.createdAt))}</span>`;root.appendChild(d);});
    root.scrollTop=root.scrollHeight;
  }
  function scrollLastAnswerToStart(box){
    const root=box.querySelector('.session-ai-messages');const items=[...root.querySelectorAll('.session-ai-msg')];const last=items[items.length-1];if(!last?.classList.contains('assistant'))return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{const a=root.getBoundingClientRect(),b=last.getBoundingClientRect();root.scrollTop=Math.max(0,b.top-a.top+root.scrollTop-7);}));
  }
  function enhanceSessionDialog(dlg){
    if(!dlg||dlg.dataset.sessionAiReady==='1')return false;
    const card=dlg.querySelector('.session-edit-card');const actions=dlg.querySelector('.session-edit-actions');if(!card||!actions)return false;
    const {c,s}=sessionByDialog(dlg);if(!c||!s){setTimeout(()=>enhanceSessionDialog(dlg),40);return false;}
    dlg.dataset.sessionAiReady='1';dlg.dataset.sessionId=s.id;
    const number=sessionNumber(c,s);
    const box=document.createElement('section');box.className='session-ai-box';
    box.innerHTML=`<div class="session-ai-head"><span class="session-ai-icon" aria-hidden="true"></span><div class="session-ai-head-text"><div class="session-ai-title">ИИ помощник по сессии</div><div class="session-ai-sub">Сессия №${esc(number)} · ${esc(c.name||'Клиент')}</div></div><button type="button" class="session-ai-clear">Очистить</button></div><div class="session-ai-messages"></div><div class="session-ai-hints"><div class="session-ai-hints-title">Подсказки по этой сессии</div><div class="session-ai-hint-chips"><button type="button" data-session-hint="summary">Итоги сессии</button><button type="button" data-session-hint="questions">Что уточнить</button><button type="button" data-session-hint="next">Следующие шаги</button><button type="button" data-session-hint="gaps">Что упущено</button></div></div><div class="session-ai-materials-note">Тексты этой сессии передаются ИИ. Обработка фото требует поддержки на сервере; её результат будет указан ниже. Материалы отправляются в подключённый ИИ-сервис.</div><div class="session-ai-tools"><div class="session-ai-mode"><button type="button" data-mode="short">Кратко</button><button type="button" data-mode="deep">Глубоко</button></div></div><div class="session-ai-compose"><input class="session-ai-input" type="text" placeholder="Спроси ИИ по этой сессии…"><button class="session-ai-send" type="button">➤</button></div><div class="session-ai-status"></div>`;
    card.insertBefore(box,actions);
    updateSessionMode(box);renderSessionChat(box,c,s);
    box.querySelectorAll('.session-ai-mode button').forEach(b=>b.onclick=()=>{setMode(b.dataset.mode);setTimeout(()=>{updateSessionMode(box);document.querySelectorAll('.session-ai-box').forEach(updateSessionMode);},0);});
    document.addEventListener('diagnostika-session-ai-mode-changed',()=>updateSessionMode(box),{signal:(()=>{const ctr=new AbortController();dlg.addEventListener('close',()=>ctr.abort(),{once:true});return ctr.signal;})()});
    const status=box.querySelector('.session-ai-status'),input=box.querySelector('.session-ai-input'),sendBtn=box.querySelector('.session-ai-send');
    const hintButtons=[...box.querySelectorAll('.session-ai-hint-chips button')];
    const hintTexts={
      summary:'Кратко и по фактам: что было проведено на этой сессии? Используй записи и прикреплённые файлы именно этой сессии. Отдельно укажи, что обсуждали, какие действия специалиста подтверждены, и какой результат зафиксирован. Ничего не додумывай.',
      questions:'Какие конкретные уточняющие вопросы по этой сессии стоит задать клиенту? Опирайся на её заметки и вложения; укажи, что требует проверки.',
      next:'Какие обоснованные следующие шаги можно предложить после этой сессии? Отделяй сделанное от предложений на будущую встречу.',
      gaps:'Что важного могло остаться невыясненным именно в этой сессии? Отдели факты из материалов от гипотез и предложи вопросы для проверки.'
    };
    let sending=false;
    const setStatus=(text,kind='')=>{status.textContent=text||'';status.className=`session-ai-status ${kind}`.trim();};
    const send=async()=>{
      const message=input.value.trim();if(!message||sending)return;input.value='';
      const api=window.DiagnostikaAI;
      const addedUser=api?.appendSessionMessage?.(s.id,{id:uid('session-chat'),role:'user',text:message,createdAt:Date.now()},{client:c,source:'session-ai-chat-user'});
      if(!addedUser){setStatus('Не удалось сохранить сообщение сессии.','error');return;}
      renderSessionChat(box,c,s);
      sending=true;input.disabled=true;sendBtn.disabled=true;hintButtons.forEach(btn=>btn.disabled=true);
      setStatus('ИИ изучает материалы этой сессии…','busy');
      try{
        const result=await ask(c,s,dlg,number,message,text=>setStatus(text,'busy'));
        const addedAssistant=api?.appendSessionMessage?.(s.id,{id:uid('session-chat'),role:'assistant',text:result.text,createdAt:Date.now()},{client:c,source:'session-ai-chat-assistant'});
        if(!addedAssistant)throw new Error('Не удалось сохранить ответ ИИ по сессии.');
        renderSessionChat(box,c,s);scrollLastAnswerToStart(box);
        setStatus(result.notice||'',result.notice?.includes('не подтвердил')?'warning':'');
      }catch(err){console.warn('Session AI chat failed',err);setStatus(err?.message||'Не удалось получить ответ ИИ.','error');}
      finally{sending=false;input.disabled=false;sendBtn.disabled=false;hintButtons.forEach(btn=>btn.disabled=false);input.focus();}
    };
    hintButtons.forEach(btn=>btn.onclick=()=>{
      if(sending)return;
      input.value=hintTexts[btn.dataset.sessionHint]||'';
      send();
    });
    sendBtn.onclick=send;input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
    box.querySelector('.session-ai-clear').onclick=()=>{
      const hist=sessionChat(s,c);if(!hist.length)return;
      if(!confirm(`Очистить переписку ИИ помощника по сессии №${number}?`))return;
      const cleared=window.DiagnostikaAI?.clearSessionChat?.(s.id,{client:c,source:'session-ai-chat-clear'});
      if(!Array.isArray(cleared)){setStatus('Не удалось очистить историю сессии.','error');return;}
      renderSessionChat(box,c,s);setStatus('');
    };
    return true;
  }

  document.addEventListener('diagnostika:session-editor-opened',event=>{
    const dlg=event.detail?.dialog;
    const session=event.detail?.session;
    if(!dlg||!session?.id)return;
    dlg.dataset.sessionId=String(session.id);
    setTimeout(()=>enhanceSessionDialog(dlg),0);
  });

  window.addEventListener('diagnostika:client-ai-widget-ready',()=>setTimeout(installClientClear,0));
  document.addEventListener('diagnostika:dashboard-clients-rendered',()=>setTimeout(installClientClear,0));
  window.addEventListener('diagnostika-client-ai-chat-changed',()=>setTimeout(installClientClear,0));
  window.addEventListener('load',()=>setTimeout(installClientClear,0),{once:true});

  document.querySelectorAll('dialog.session-edit-dialog').forEach(dlg=>setTimeout(()=>enhanceSessionDialog(dlg),0));
  installClientClear();
})();
