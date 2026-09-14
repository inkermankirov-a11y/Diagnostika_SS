'use strict';

(() => {
  if (window.__diagnostikaClientAiChatViewReady) return;
  window.__diagnostikaClientAiChatViewReady = true;

  const EXPANDED_KEY='diagnostika-client-ai-chat-expanded-v1';
  const MODE_KEY='diagnostika-client-ai-answer-mode-v1';
  let attempts=0;
  let widget=null;
  let backdrop=null;
  let messagesObserver=null;
  let lastSeenCount=0;

  function getMode(){
    try{
      const saved=localStorage.getItem(MODE_KEY);
      return saved==='deep'?'deep':'short';
    }catch(_){return 'short';}
  }
  function setMode(mode){
    const next=mode==='deep'?'deep':'short';
    try{localStorage.setItem(MODE_KEY,next);}catch(_){}
    updateModeButtons();
  }
  function clip(value,max=700){
    if(value===null||value===undefined)return '';
    const s=String(value);
    return s.length>max?s.slice(0,max)+'…':s;
  }
  function compactContext(ctx){
    if(!ctx||typeof ctx!=='object')return ctx;
    const profile={};
    for(const [k,v] of Object.entries(ctx.profile||{}))profile[k]=clip(v,500);

    const questionnaires=(Array.isArray(ctx.questionnaires)?ctx.questionnaires:[]).slice(-2).map(q=>({
      source:clip(q?.source,120),
      receivedAt:q?.receivedAt||'',
      isPrimary:!!q?.isPrimary,
      answers:(Array.isArray(q?.answers)?q.answers:[]).slice(0,24).map(a=>({
        question:clip(a?.question,260),
        answer:clip(a?.answer,700)
      }))
    }));

    const requests=(Array.isArray(ctx.requests)?ctx.requests:[]).slice(-3).map(r=>({
      id:r?.id||'',
      title:clip(r?.title,500),
      situations:(Array.isArray(r?.situations)?r.situations:[]).slice(-10).map(s=>({
        name:clip(s?.name,400),
        level:s?.level??'',
        comment:clip(s?.comment,300),
        result:clip(s?.result,500),
        beliefs:(Array.isArray(s?.beliefs)?s.beliefs:[]).slice(-8).map(b=>({
          text:clip(b?.text,450),
          level:b?.level??'',
          comment:clip(b?.comment,250),
          feelings:(Array.isArray(b?.feelings)?b.feelings:[]).slice(-6).map(f=>({
            text:clip(f?.text,400),
            level:f?.level??'',
            comment:clip(f?.comment,220),
            deep:(Array.isArray(f?.deep)?f.deep:[]).slice(-4).map(d=>({
              text:clip(d?.text,400),
              level:d?.level??'',
              comment:clip(d?.comment,220),
              instincts:(Array.isArray(d?.instincts)?d.instincts:[]).slice(-4).map(i=>({
                name:clip(i?.name,180),
                level:i?.level??'',
                comment:clip(i?.comment,180)
              }))
            }))
          }))
        }))
      }))
    }));

    return {
      profile,
      questionnaires,
      requests,
      sessions:(Array.isArray(ctx.sessions)?ctx.sessions:[]).slice(-8).map(s=>({
        date:s?.date||'',
        requestId:s?.requestId||'',
        notes:clip(s?.notes,900),
        sessionFormat:clip(s?.sessionFormat,120)
      })),
      notes:(Array.isArray(ctx.notes)?ctx.notes:[]).slice(-8).map(n=>({
        text:clip(n?.text,800),
        createdAt:n?.createdAt||0
      }))
    };
  }

  function patchAiFetch(){
    if(window.__diagnostikaClientAiFetchModePatched)return;
    window.__diagnostikaClientAiFetchModePatched=true;
    const nativeFetch=window.fetch.bind(window);
    window.fetch=function(input,init){
      try{
        const url=typeof input==='string'?input:(input?.url||'');
        if(url.includes('/diagnostika-client-chat-v1')&&init?.body&&typeof init.body==='string'){
          const payload=JSON.parse(init.body);
          const mode=getMode();
          payload.responseMode=mode;

          if(mode==='short'){
            payload.message=
              'РЕЖИМ КОРОТКО. Ответь содержательно, но кратко: обычно 4–7 предложений или максимум 6 коротких пунктов. '+
              'Сначала дай главный вывод, затем только самое важное. Не пересказывай весь контекст клиента. '+
              'Если данных недостаточно, скажи об этом одной короткой фразой.\n\nВопрос пользователя: '+String(payload.message||'');
            payload.clientContext=compactContext(payload.clientContext);
            payload.chatHistory=(Array.isArray(payload.chatHistory)?payload.chatHistory:[]).slice(-6).map(m=>({
              role:m?.role||'user',
              text:clip(m?.text,900)
            }));
            payload.maxOutputTokens=500;
          }else{
            payload.message=
              'РЕЖИМ ГЛУБОКО. Дай подробный, но без лишних повторов анализ. Используй весь доступный контекст клиента.\n\nВопрос пользователя: '+
              String(payload.message||'');
            payload.maxOutputTokens=1800;
          }
          init={...init,body:JSON.stringify(payload)};
        }
      }catch(err){
        console.warn('AI response mode preparation failed',err);
      }
      return nativeFetch(input,init);
    };
  }

  const style=document.createElement('style');
  style.textContent=`
    .hd-ai-title-actions{margin-left:auto;display:flex;align-items:center;gap:5px}
    .hd-ai-expand-btn{width:28px;height:28px;border:1px solid #cbd9ea;border-radius:8px;background:#fff;color:#486581;display:grid;place-items:center;cursor:pointer;font-size:15px;line-height:1;padding:0}
    .hd-ai-expand-btn:hover{background:#f1f6fb}
    .hd-ai-backdrop{position:fixed;inset:0;z-index:13990;background:rgba(15,23,42,.28);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
    .hd-ai-backdrop[hidden]{display:none!important}
    .hd-ai-modebar{display:flex;align-items:center;gap:6px;margin:0 0 8px;font-size:10px;color:#75859a}
    .hd-ai-modebar-label{font-weight:700}
    .hd-ai-mode-btn{border:1px solid #cbd9ea;background:#fff;color:#52677d;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:800;cursor:pointer}
    .hd-ai-mode-btn.active{background:#2f7cf6;color:#fff;border-color:#2f7cf6}
    .hd-ai-mode-btn:hover{filter:brightness(.98)}
    #hdClientAiWidget.hd-ai-expanded{position:fixed!important;z-index:14000!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:min(900px,calc(100vw - 48px))!important;height:min(78vh,760px)!important;max-height:calc(100vh - 48px)!important;display:flex!important;flex-direction:column!important;box-sizing:border-box!important;padding:18px!important;background:#fff!important;border-radius:16px!important;box-shadow:0 28px 80px rgba(15,23,42,.38)!important}
    #hdClientAiWidget.hd-ai-expanded .hd-widget-title{font-size:17px!important;margin-bottom:8px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-client{font-size:12px!important;margin-bottom:8px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-modebar{font-size:11px;margin-bottom:10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-mode-btn{font-size:11px;padding:5px 10px}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-quick{margin-bottom:10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-quick button{font-size:11px!important;padding:6px 10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-messages{height:auto!important;min-height:0!important;flex:1 1 auto!important;font-size:14px!important;padding:12px!important;gap:10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-msg{font-size:14px!important;line-height:1.5!important;padding:10px 12px!important;max-width:84%!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-msg-time{font-size:10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-compose{grid-template-columns:1fr 44px!important;gap:8px!important;margin-top:10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-input{height:44px!important;font-size:14px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-send{width:44px!important;height:44px!important}
    @media(max-width:760px){#hdClientAiWidget.hd-ai-expanded{width:calc(100vw - 20px)!important;height:calc(100vh - 20px)!important;max-height:none!important;padding:12px!important}#hdClientAiWidget.hd-ai-expanded .hd-ai-msg{max-width:92%!important}}
  `;
  document.head.appendChild(style);

  function updateModeButtons(){
    if(!widget)return;
    const mode=getMode();
    widget.querySelectorAll('.hd-ai-mode-btn').forEach(btn=>{
      btn.classList.toggle('active',btn.dataset.mode===mode);
      btn.setAttribute('aria-pressed',btn.dataset.mode===mode?'true':'false');
    });
  }

  function installModeControls(){
    if(!widget||widget.querySelector('.hd-ai-modebar')){updateModeButtons();return;}
    const clientLine=widget.querySelector('.hd-ai-client');
    const quick=widget.querySelector('.hd-ai-quick');
    if(!clientLine&&!quick)return;
    const bar=document.createElement('div');
    bar.className='hd-ai-modebar';
    bar.innerHTML=
      '<span class="hd-ai-modebar-label">Ответ:</span>'+
      '<button type="button" class="hd-ai-mode-btn" data-mode="short" title="Краткий ответ и сокращённый контекст — меньше токенов">Коротко</button>'+
      '<button type="button" class="hd-ai-mode-btn" data-mode="deep" title="Подробный ответ с полным контекстом клиента">Глубоко</button>';
    bar.querySelectorAll('.hd-ai-mode-btn').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();
        setMode(btn.dataset.mode);
      });
    });
    if(clientLine)clientLine.insertAdjacentElement('afterend',bar);
    else quick.parentNode.insertBefore(bar,quick);
    updateModeButtons();
  }

  function setExpanded(expanded){
    if(!widget)return;
    widget.classList.toggle('hd-ai-expanded',expanded);
    if(backdrop)backdrop.hidden=!expanded;
    const btn=widget.querySelector('.hd-ai-expand-btn');
    if(btn){
      btn.textContent=expanded?'↙':'⛶';
      btn.title=expanded?'Свернуть чат':'Развернуть чат';
      btn.setAttribute('aria-label',btn.title);
    }
    try{localStorage.setItem(EXPANDED_KEY,expanded?'1':'0');}catch(_){ }
    if(expanded){
      const input=widget.querySelector('.hd-ai-input');
      setTimeout(()=>input?.focus(),0);
    }
  }

  function scrollAssistantToStart(){
    if(!widget)return;
    const messages=widget.querySelector('.hd-ai-messages');
    if(!messages)return;
    const items=[...messages.querySelectorAll('.hd-ai-msg')];
    const last=items[items.length-1];
    if(!last||!last.classList.contains('assistant'))return;
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        const box=messages.getBoundingClientRect();
        const row=last.getBoundingClientRect();
        const target=row.top-box.top+messages.scrollTop-8;
        messages.scrollTop=Math.max(0,target);
      });
    });
  }

  function watchMessages(){
    const messages=widget?.querySelector('.hd-ai-messages');
    if(!messages)return;
    messagesObserver?.disconnect();
    lastSeenCount=messages.querySelectorAll('.hd-ai-msg').length;
    messagesObserver=new MutationObserver(()=>{
      const count=messages.querySelectorAll('.hd-ai-msg').length;
      if(count>lastSeenCount){
        const last=messages.querySelector('.hd-ai-msg:last-child');
        if(last?.classList.contains('assistant'))scrollAssistantToStart();
      }
      lastSeenCount=count;
    });
    messagesObserver.observe(messages,{childList:true,subtree:false});
  }

  function install(){
    widget=document.getElementById('hdClientAiWidget');
    if(!widget)return false;

    if(!backdrop){
      backdrop=document.createElement('div');
      backdrop.className='hd-ai-backdrop';
      backdrop.hidden=true;
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click',()=>setExpanded(false));
    }

    const title=widget.querySelector('.hd-widget-title');
    if(title&&!title.querySelector('.hd-ai-expand-btn')){
      const actions=document.createElement('span');
      actions.className='hd-ai-title-actions';
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='hd-ai-expand-btn';
      btn.title='Развернуть чат';
      btn.setAttribute('aria-label','Развернуть чат');
      btn.textContent='⛶';
      btn.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        setExpanded(!widget.classList.contains('hd-ai-expanded'));
      });
      actions.appendChild(btn);
      title.appendChild(actions);
    }

    installModeControls();

    let shouldExpand=false;
    try{shouldExpand=localStorage.getItem(EXPANDED_KEY)==='1';}catch(_){ }
    setExpanded(shouldExpand);
    watchMessages();
    return true;
  }

  function init(){
    if(install())return;
    attempts++;
    if(attempts<60)setTimeout(init,250);
  }

  patchAiFetch();
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&widget?.classList.contains('hd-ai-expanded'))setExpanded(false);
  });
  window.addEventListener('diagnostika-client-ai-chat-changed',()=>setTimeout(()=>{install();scrollAssistantToStart();},0));

  init();
})();
