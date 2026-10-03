'use strict';

(() => {
  if (window.__diagnostikaClientAiChatViewReady) return;
  window.__diagnostikaClientAiChatViewReady = true;

  const EXPANDED_KEY='diagnostika-client-ai-chat-expanded-v1';
  const MODE_KEY='diagnostika-client-ai-answer-mode-v1';
  let attempts=0;
  let widget=null;
  let backdrop=null;
  let platformEventsHooked=false;
  let activeHintsMenu=null;
  let activeHintsButton=null;

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
      source:clip(q?.source,120),receivedAt:q?.receivedAt||'',isPrimary:!!q?.isPrimary,
      answers:(Array.isArray(q?.answers)?q.answers:[]).slice(0,24).map(a=>({question:clip(a?.question,260),answer:clip(a?.answer,700)}))
    }));

    const requests=(Array.isArray(ctx.requests)?ctx.requests:[]).slice(-3).map(r=>({
      id:r?.id||'',title:clip(r?.title,500),
      situations:(Array.isArray(r?.situations)?r.situations:[]).slice(-10).map(s=>({
        name:clip(s?.name,400),level:s?.level??'',comment:clip(s?.comment,300),result:clip(s?.result,500),
        beliefs:(Array.isArray(s?.beliefs)?s.beliefs:[]).slice(-8).map(b=>({
          text:clip(b?.text,450),level:b?.level??'',comment:clip(b?.comment,250),
          feelings:(Array.isArray(b?.feelings)?b.feelings:[]).slice(-6).map(f=>({
            text:clip(f?.text,400),level:f?.level??'',comment:clip(f?.comment,220),
            deep:(Array.isArray(f?.deep)?f.deep:[]).slice(-4).map(d=>({
              text:clip(d?.text,400),level:d?.level??'',comment:clip(d?.comment,220),
              instincts:(Array.isArray(d?.instincts)?d.instincts:[]).slice(-4).map(i=>({name:clip(i?.name,180),level:i?.level??'',comment:clip(i?.comment,180)}))
            }))
          }))
        }))
      }))
    }));

    return {
      profile,questionnaires,requests,
      sessions:(Array.isArray(ctx.sessions)?ctx.sessions:[]).slice(-8).map(s=>({date:s?.date||'',requestId:s?.requestId||'',notes:clip(s?.notes,900),sessionFormat:clip(s?.sessionFormat,120)})),
      notes:(Array.isArray(ctx.notes)?ctx.notes:[]).slice(-8).map(n=>({text:clip(n?.text,800),createdAt:n?.createdAt||0}))
    };
  }

  function preparePayload(payload){
    if(!payload||typeof payload!=='object'||payload.sessionId)return payload;
    try{
      const next={...payload};
      const mode=getMode();
      next.responseMode=mode;
      if(mode==='short'){
        next.message='РЕЖИМ КОРОТКО. Ответь содержательно, но кратко: обычно 4–7 предложений или максимум 6 коротких пунктов. Сначала дай главный вывод, затем только самое важное. ОФОРМЛЕНИЕ: разбей ответ на 2–4 коротких смысловых блока; каждый блок начинай с короткого заголовка; ключевые выводы, риски, гипотезы и действия выделяй как **ключевой текст**; последовательности оформляй пунктами через «- ». Не пиши сплошной стеной текста. Не пересказывай весь контекст клиента. Если данных недостаточно, скажи об этом одной короткой фразой.\n\nВопрос пользователя: '+String(next.message||'');
        next.clientContext=compactContext(next.clientContext);
        next.chatHistory=(Array.isArray(next.chatHistory)?next.chatHistory:[]).slice(-6).map(m=>({role:m?.role||'user',text:clip(m?.text,900)}));
        next.maxOutputTokens=500;
      }else{
        next.message='РЕЖИМ ГЛУБОКО. Дай подробный, но без лишних повторов анализ. Используй весь доступный контекст клиента. ОФОРМЛЕНИЕ: раздели ответ на понятные смысловые блоки с короткими заголовками; ключевые выводы, риски, гипотезы, факты и следующие действия выделяй как **ключевой текст**; где есть последовательность или план — используй пункты через «- » или нумерацию. Абзацы делай короткими, не пиши сплошной стеной текста.\n\nВопрос пользователя: '+String(next.message||'');
        next.maxOutputTokens=1800;
      }
      return next;
    }catch(err){
      console.warn('AI response mode preparation failed',err);
      return payload;
    }
  }

  const style=document.createElement('style');
  style.textContent=`
    .hd-ai-title-actions{margin-left:auto;display:flex;align-items:center;gap:5px}
    .hd-ai-expand-btn{width:28px;height:28px;border:1px solid #d7e0ea;border-radius:9px;background:#fff;color:#536b82;display:grid;place-items:center;cursor:pointer;font-size:15px;line-height:1;padding:0;box-shadow:none}
    .hd-ai-expand-btn:hover{background:#f6f8fb}
    .hd-ai-backdrop{position:fixed;inset:0;z-index:13990;background:rgba(15,23,42,.28);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
    .hd-ai-backdrop[hidden]{display:none!important}

    #hdClientAiWidget.hd-ai-widget{padding:13px!important;display:flex!important;flex-direction:column!important;box-sizing:border-box!important;height:auto!important;min-height:0!important;max-height:none!important}
    #hdClientAiWidget .hd-widget-title{margin-bottom:8px!important;color:#172b4d!important;font-weight:800!important}
    #hdClientAiWidget .hd-widget-title>span:nth-child(2){font-size:15px!important;letter-spacing:-.1px}
    #hdClientAiWidget .hd-ai-client{display:block!important;font-size:12px!important;line-height:1.35!important;color:#334155!important;font-weight:700!important;margin:4px 0 12px!important;padding-left:2px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #hdClientAiWidget .hd-ai-quick{display:none!important}
    #hdClientAiWidget .hd-ai-messages{height:clamp(150px,22dvh,190px)!important;min-height:150px!important;max-height:190px!important;flex:0 0 auto!important;overflow-y:auto!important;overflow-x:hidden!important;border:1px solid rgba(120,174,226,.48)!important;background:rgba(248,252,255,.68)!important;border-radius:15px!important;padding:9px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.96),0 0 0 1px rgba(255,255,255,.28)!important}
    #hdClientAiWidget .hd-ai-compose{grid-template-columns:1fr 42px!important;gap:7px!important;margin-top:7px!important;flex:0 0 auto!important}
    #hdClientAiWidget .hd-ai-input{height:42px!important;border-radius:11px!important;border-color:#d5deea!important;background:#fff!important;padding:0 12px!important;font-size:12px!important}
    #hdClientAiWidget .hd-ai-send{width:42px!important;height:42px!important;border-radius:11px!important;box-shadow:none!important}
    #hdClientAiWidget .hd-ai-status{margin-top:5px!important;min-height:12px!important;font-size:9px!important;flex:0 0 auto!important}

    .hd-ai-footer-tools{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;position:relative;flex:0 0 auto}
    .hd-ai-hints-wrap{position:relative}
    .hd-ai-hints-btn{height:28px;border:1px solid #d9e2ec;background:#fff;color:#64748b;border-radius:8px;padding:0 9px;font-size:10px;font-weight:700;cursor:pointer}
    .hd-ai-hints-btn:hover{background:#f8fafc}
    .hd-ai-hints-menu{position:fixed;z-index:20050;width:220px;max-width:calc(100vw - 16px);max-height:min(420px,calc(100dvh - 16px));overflow-y:auto;overflow-x:hidden;padding:5px;background:#fff;border:1px solid #dbe3ec;border-radius:10px;box-shadow:0 14px 36px rgba(15,23,42,.22);box-sizing:border-box}
    .hd-ai-hints-menu[hidden]{display:none!important}
    .hd-ai-hint-item{display:block;width:100%;border:0;background:transparent;text-align:left;border-radius:7px;padding:8px 9px;color:#334155;font-size:11px;cursor:pointer}
    .hd-ai-hint-item:hover{background:#f1f5f9}

    .hd-ai-modebar{display:flex;align-items:center;gap:3px;padding:2px;background:#f1f5f9;border-radius:9px}
    .hd-ai-mode-btn{border:0;background:transparent;color:#64748b;border-radius:7px;padding:5px 8px;font-size:10px;font-weight:700;cursor:pointer;line-height:1}
    .hd-ai-mode-btn.active{background:#fff;color:#2563eb;box-shadow:0 1px 3px rgba(15,23,42,.10)}
    .hd-ai-mode-btn:hover{color:#334155}

    #hdClientAiWidget.hd-ai-expanded{position:fixed!important;z-index:14000!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:min(900px,calc(100vw - 48px))!important;height:min(78vh,760px)!important;max-height:calc(100vh - 48px)!important;display:flex!important;flex-direction:column!important;box-sizing:border-box!important;padding:18px!important;background:#fff!important;border-radius:16px!important;box-shadow:0 28px 80px rgba(15,23,42,.38)!important}
    #hdClientAiWidget.hd-ai-expanded .hd-widget-title{font-size:17px!important;margin-bottom:8px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-client{display:block!important;font-size:13px!important;line-height:1.4!important;margin:4px 0 12px!important;padding-left:2px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-messages{height:auto!important;min-height:0!important;flex:1 1 auto!important;font-size:14px!important;padding:12px!important;gap:10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-msg{font-size:14.5px!important;line-height:1.62!important;padding:13px 15px!important;max-width:90%!important;font-weight:500!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-msg.assistant{max-width:92%!important;color:#1f3348!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-section-title{font-size:13px!important;margin:13px 0 6px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-rich p{margin-bottom:10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-list{margin:5px 0 11px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-list li{margin:5px 0!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-msg-time{font-size:10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-footer-tools{margin-top:10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-hints-btn{height:32px;font-size:11px;padding:0 11px}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-mode-btn{font-size:11px;padding:6px 10px}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-compose{grid-template-columns:1fr 44px!important;gap:8px!important;margin-top:8px!important}
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

  function makeModeBar(){
    const bar=document.createElement('div');
    bar.className='hd-ai-modebar';
    bar.setAttribute('aria-label','Длина ответа');
    bar.innerHTML='<button type="button" class="hd-ai-mode-btn" data-mode="short" title="Краткий ответ — меньше токенов">Кратко</button><button type="button" class="hd-ai-mode-btn" data-mode="deep" title="Подробный анализ">Глубоко</button>';
    bar.querySelectorAll('.hd-ai-mode-btn').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setMode(btn.dataset.mode);}));
    return bar;
  }

  function positionHintsMenu(btn,menu){
    if(!btn||!menu||menu.hidden)return;
    const rect=btn.getBoundingClientRect();
    const viewportW=Math.max(320,window.innerWidth||document.documentElement.clientWidth||0);
    const viewportH=Math.max(240,window.innerHeight||document.documentElement.clientHeight||0);
    const width=Math.min(220,viewportW-16);
    menu.style.width=width+'px';
    menu.style.maxHeight=Math.max(120,viewportH-16)+'px';
    menu.style.left=Math.max(8,Math.min(rect.left,viewportW-width-8))+'px';
    menu.style.top='8px';
    const menuH=Math.min(menu.scrollHeight,viewportH-16);
    const below=viewportH-rect.bottom-8;
    const above=rect.top-8;
    const preferBelow=below>=Math.min(menuH,180)||below>=above;
    const top=preferBelow
      ?Math.min(viewportH-menuH-8,rect.bottom+6)
      :Math.max(8,rect.top-menuH-6);
    menu.style.top=Math.max(8,top)+'px';
  }

  function hideHintsMenu(){
    if(activeHintsMenu)activeHintsMenu.hidden=true;
    activeHintsMenu=null;
    activeHintsButton=null;
  }

  function makeHints(){
    const wrap=document.createElement('div');
    wrap.className='hd-ai-hints-wrap';
    const btn=document.createElement('button');
    btn.type='button';btn.className='hd-ai-hints-btn';btn.textContent='Подсказки ▾';btn.title='Быстрые вопросы';
    const menu=document.createElement('div');
    menu.className='hd-ai-hints-menu hd-ai-hints-menu-portal';menu.hidden=true;
    const sourceButtons=[...widget.querySelectorAll('.hd-ai-quick button')];
    sourceButtons.forEach(source=>{
      const item=document.createElement('button');
      item.type='button';item.className='hd-ai-hint-item';item.textContent=source.textContent||'Быстрый вопрос';
      item.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();hideHintsMenu();source.click();});
      menu.appendChild(item);
    });
    btn.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      const opening=menu.hidden;
      hideHintsMenu();
      if(opening){
        menu.hidden=false;
        activeHintsMenu=menu;
        activeHintsButton=btn;
        positionHintsMenu(btn,menu);
      }
    });
    wrap.append(btn);
    document.body.appendChild(menu);
    return wrap;
  }

  function installFooterControls(){
    if(!widget)return;
    let tools=widget.querySelector('.hd-ai-footer-tools');
    if(!tools){
      const messages=widget.querySelector('.hd-ai-messages');
      const compose=widget.querySelector('.hd-ai-compose');
      if(!messages||!compose)return;
      tools=document.createElement('div');
      tools.className='hd-ai-footer-tools';
      tools.append(makeHints(),makeModeBar());
      compose.parentNode.insertBefore(tools,compose);
    }
    updateModeButtons();
  }

  function normalizeHeader(){
    if(!widget)return;
    const title=widget.querySelector('.hd-widget-title');
    if(title){
      const parts=[...title.children].filter(el=>!el.classList.contains('hd-ai-title-actions'));
      if(parts[1])parts[1].textContent='ИИ помощник по клиенту';
    }
    const clientEl=widget.querySelector('.hd-ai-client');
    if(clientEl){
      const current=String(clientEl.textContent||'');
      if(current.startsWith('Контекст: '))clientEl.textContent=current.slice('Контекст: '.length);
    }
  }

  function setExpanded(expanded){
    if(!widget)return;
    widget.classList.toggle('hd-ai-expanded',expanded);
    if(backdrop)backdrop.hidden=!expanded;
    const btn=widget.querySelector('.hd-ai-expand-btn');
    if(btn){btn.textContent=expanded?'↙':'⛶';btn.title=expanded?'Свернуть чат':'Развернуть чат';btn.setAttribute('aria-label',btn.title);}
    try{localStorage.setItem(EXPANDED_KEY,expanded?'1':'0');}catch(_){ }
    if(expanded){const input=widget.querySelector('.hd-ai-input');setTimeout(()=>input?.focus(),0);}
  }

  function scrollAssistantToStart(){
    if(!widget)return;
    const messages=widget.querySelector('.hd-ai-messages');
    if(!messages)return;
    const items=[...messages.querySelectorAll('.hd-ai-msg')];
    const last=items[items.length-1];
    if(!last||!last.classList.contains('assistant'))return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const box=messages.getBoundingClientRect();
      const row=last.getBoundingClientRect();
      const target=row.top-box.top+messages.scrollTop-8;
      messages.scrollTop=Math.max(0,target);
    }));
  }

  function hookPlatformEvents(){
    if(platformEventsHooked)return true;
    const events=window.DiagnostikaPlatform?.events;
    if(!events?.on)return false;
    for(const type of ['client:selected','client:updated','client:created','client:restored']){
      events.on(type,()=>setTimeout(normalizeHeader,0));
    }
    platformEventsHooked=true;
    return true;
  }

  function install(){
    widget=document.getElementById('hdClientAiWidget');
    if(!widget)return false;

    if(!backdrop){
      backdrop=document.createElement('div');backdrop.className='hd-ai-backdrop';backdrop.hidden=true;document.body.appendChild(backdrop);
      backdrop.addEventListener('click',()=>setExpanded(false));
    }

    const title=widget.querySelector('.hd-widget-title');
    if(title&&!title.querySelector('.hd-ai-expand-btn')){
      const actions=document.createElement('span');actions.className='hd-ai-title-actions';
      const btn=document.createElement('button');btn.type='button';btn.className='hd-ai-expand-btn';btn.title='Развернуть чат';btn.setAttribute('aria-label','Развернуть чат');btn.textContent='⛶';
      btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setExpanded(!widget.classList.contains('hd-ai-expanded'));});
      actions.appendChild(btn);title.appendChild(actions);
    }

    normalizeHeader();
    installFooterControls();

    let shouldExpand=false;
    try{shouldExpand=localStorage.getItem(EXPANDED_KEY)==='1';}catch(_){ }
    setExpanded(shouldExpand);
    hookPlatformEvents();
    return true;
  }

  function init(){
    if(install())return;
    attempts++;
    if(attempts<60)setTimeout(init,250);
  }

  document.addEventListener('click',e=>{
    if(activeHintsMenu&&!activeHintsMenu.hidden&&!activeHintsMenu.contains(e.target)&&e.target!==activeHintsButton)hideHintsMenu();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(activeHintsMenu&&!activeHintsMenu.hidden){hideHintsMenu();return;}
      if(widget?.classList.contains('hd-ai-expanded'))setExpanded(false);
    }
  });
  window.addEventListener('resize',()=>{if(activeHintsMenu&&!activeHintsMenu.hidden)positionHintsMenu(activeHintsButton,activeHintsMenu);});
  window.addEventListener('scroll',()=>{if(activeHintsMenu&&!activeHintsMenu.hidden)positionHintsMenu(activeHintsButton,activeHintsMenu);},true);
  window.addEventListener('diagnostika:client-ai-widget-ready',()=>setTimeout(()=>{install();normalizeHeader();},0));
  document.addEventListener('diagnostika:dashboard-clients-rendered',()=>setTimeout(normalizeHeader,0));
  window.addEventListener('diagnostika:platform-core-ready',()=>hookPlatformEvents(),{once:true});
  window.addEventListener('diagnostika-client-ai-chat-changed',()=>setTimeout(()=>{install();normalizeHeader();scrollAssistantToStart();},0));

  window.DiagnostikaClientAIChatView=Object.freeze({preparePayload,getMode,setMode});
  init();
})();