'use strict';

/* Home-only professional workspace. No client records are copied or uploaded. */
(() => {
  if(window.DiagnostikaHomeWorkspace)return;

  const home=document.querySelector('.home-dashboard #hdHomeView');
  const dashboard=home?.closest('.home-dashboard');
  const right=dashboard?.querySelector('.hd-right');
  if(!home||!dashboard||!right)return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[ch]));
  const PREF_PREFIX='diagnostika-home-workspace-';
  const getStored=(key,fallback='')=>{try{return localStorage.getItem(PREF_PREFIX+key)??fallback;}catch(_){return fallback;}};
  const putStored=(key,value)=>{try{localStorage.setItem(PREF_PREFIX+key,String(value));return true;}catch(_){return false;}};
  const clients=()=>window.DiagnostikaClients?.list?.()||[];
  const calendar=()=>window.DiagnostikaCalendar?.moduleAware===true?window.DiagnostikaCalendar:window.DiagnostikaPlatform?.services?.calendar;
  const clientFor=id=>clients().find(c=>String(c?.id)===String(id))||null;
  const visible=()=>window.DiagnostikaHomeDashboard?.currentView?.()==='home'&&!dashboard.hidden;

  const thoughts=[
    ['Не всякая мысль о себе является фактом. Иногда это лишь старый способ объяснять происходящее.','Что сегодня ты считаешь фактом, хотя это может быть только убеждением?'],
    ['Свобода выбора начинается с возможности заметить привычный сценарий до того, как он повторится.','В какой ситуации привычная реакция опережает осознанный выбор?'],
    ['То, что помогало выживать вчера, не всегда помогает жить сегодня.','Какую защитную стратегию уже можно пересмотреть?'],
    ['Перемены начинаются не с идеального решения, а с честного взгляда на то, что происходит.','Какой факт сейчас важнее привычного объяснения?'],
    ['Человек может испытывать страх и всё же действовать в соответствии со своими ценностями.','Какой небольшой шаг возможен даже при наличии страха?'],
    ['Границы обозначают не отсутствие любви, а присутствие собственного выбора.','Где сегодня требуется спокойное и ясное «нет»?'],
    ['Убеждение становится ограничением, когда незаметно превращается в единственную возможную правду.','Какие другие объяснения доступны в этой ситуации?'],
    ['Сравнение показывает различия, но само по себе ничего не говорит о ценности человека.','Что меняется, если убрать сравнение с другими?'],
    ['Сложные чувства становятся понятнее, когда им дают имя, а не оценку.','Какое чувство сейчас нуждается в точном названии?'],
    ['Признание собственной уязвимости не отменяет способности влиять на происходящее.','Где человек недооценивает свой реальный выбор?'],
    ['Привычное не всегда означает безопасное, а новое не обязательно означает опасное.','Какую угрозу стоит проверить фактами?'],
    ['Ответственность начинается там, где появляется различие между тем, что подвластно нам, и тем, что нет.','На что действительно можно повлиять сегодня?'],
    ['Уважение к себе проявляется в поступках, а не только в мыслях о собственной ценности.','Какое действие сегодня подтвердит уважение к себе?'],
    ['Нельзя изменить прошлое, но можно изменить его место в сегодняшних решениях.','Какой прошлый опыт продолжает незаметно определять выбор?'],
    ['Сомнение в старом убеждении — это не потеря опоры, а поиск более точного основания.','Какое убеждение стоит исследовать, а не опровергать силой?'],
    ['Ценность человека не сводится к количеству результатов, которых он достиг.','Где оценка себя полностью зависит от результата?'],
    ['Чувство не требует немедленного действия. Между ним и поступком есть пространство для выбора.','Какой импульс сегодня можно сначала просто заметить?'],
    ['Иногда самый важный шаг — перестать доказывать то, что не нуждается в доказательстве.','Чьё одобрение незаметно управляет решениями?'],
    ['Понимание причины поведения создаёт возможность выбора, но не заменяет самого действия.','Какой практический шаг следует из нового понимания?'],
    ['Спокойствие не всегда означает отсутствие трудностей. Иногда это способность оставаться с собой внутри них.','Что помогает сохранять устойчивость, не избегая проблемы?'],
    ['Один и тот же факт может вызывать разные переживания в зависимости от того, что он для нас означает.','Какой смысл человек приписывает происходящему?'],
    ['Право менять решение — часть зрелой ответственности, а не признак слабости.','Какое решение можно пересмотреть без самообвинения?'],
    ['Привычка заботиться обо всех может скрывать трудность замечать собственные потребности.','Какая потребность сегодня осталась без внимания?'],
    ['Не нужно знать весь путь, чтобы сделать первый проверяемый шаг.','Какое действие даст новую информацию вместо бесконечных прогнозов?'],
    ['Признать ограничение — не значит согласиться с ним навсегда.','Что сейчас воспринимается неизменным без достаточных оснований?'],
    ['То, как человек разговаривает с собой после ошибки, влияет на его следующий выбор.','Какими словами можно описать ошибку без унижения себя?'],
    ['Желание всем нравиться нередко вступает в конфликт с возможностью быть собой.','Где согласие даётся ценой собственных границ?'],
    ['Уверенность может прийти после действия, а не до него.','Какой опыт помог бы проверить собственные способности?'],
    ['Гнев может указывать на нарушенную границу, но не всегда точно определяет виновного.','О чём сигнализирует эмоция, если отделить её от обвинения?'],
    ['Честный вопрос иногда полезнее быстрого, но привычного ответа.','Какой вопрос сегодня способен сдвинуть работу с места?']
  ];
  const practice=[
    'Что ты говоришь себе о себе в тот момент, когда это происходит?',
    'Если эта мысль была бы правдой, что самого страшного это означало бы для тебя?',
    'Где ты ещё замечаешь такое же восприятие себя?',
    'Какие факты подтверждают эту мысль, а какие ей противоречат?',
    'Что ты чувствуешь сразу после того, как начинаешь так воспринимать себя?',
    'На что тебе хочется решиться, но ты останавливаешь себя?',
    'Чего ты пытаешься избежать, когда выбираешь привычную реакцию?',
    'Что бы изменилось, если бы ты не сравнивал себя с другими?',
    'Какую потребность ты пытаешься защитить в этой ситуации?',
    'Как бы ты отнёсся к близкому человеку, оказавшемуся в таком же положении?',
    'Что ты можешь сделать сейчас, даже если чувство пока остаётся?',
    'Какой самый маленький безопасный эксперимент поможет проверить эту мысль?'
  ];
  // One thought for the entire local day. Switches only when date changes.
  const dayKey=()=>{
    const d=new Date();
    return String(d.getFullYear())+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  };
  const todayIndex=()=>{
    const d=new Date();
    return Math.abs(Math.floor(new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()/86400000))%thoughts.length;
  };
  let quoteDate='';
  let quoteIndex=0;
  let promptIndex=0;
  let hideNames=getStored('hide-names','false')==='true';

  home.innerHTML=[
    '<div class="hws-workspace hws-workspace-simple">',
      '<section class="hws-card hws-schedule hws-schedule-only">',
        '<div class="hws-schedule-header">',
          '<div class="hws-schedule-intro"><div class="hws-overline">РАБОЧИЙ КАЛЕНДАРЬ</div>',
          '<h2>Ближайшие события</h2>',
          '<p>Встречи, консультации и напоминания</p></div>',
          '<button type="button" class="hws-text-action" data-action="calendar">Открыть календарь <span aria-hidden="true">↗</span></button>',
        '</div>',
        '<div class="hws-schedule-toolbar"><span id="hwsCurrentDate" class="hws-current-date"></span>',
        '<button type="button" class="hws-privacy" data-action="privacy" aria-pressed="false"></button></div>',
        '<div id="hwsSchedule" class="hws-rows" aria-live="polite"></div>',
      '</section>',
    '</div>'
  ].join('');

  const rail=document.createElement('div');
  rail.className='hd-home-only hws-rail';
  rail.innerHTML=[
    '<section class="hws-wisdom">',
      '<div class="hws-quote-aura" aria-hidden="true"></div>',
      '<div class="hws-rail-kicker"><span class="hws-kicker-mark">✧</span> ПАУЗА ДЛЯ МЫСЛИ</div>',
      '<div class="hws-wisdom-meta">Мысль дня</div>',
      '<div class="hws-quote-glyph" aria-hidden="true">“</div>',
      '<blockquote id="hwsQuoteText"></blockquote>',
      '<div class="hws-wisdom-divider"></div>',
      '<div class="hws-reflect-label">ВОПРОС ДЛЯ РАЗМЫШЛЕНИЯ</div>',
      '<p class="hws-reflect-text" id="hwsReflect"></p>',
    '</section>',
    '<section class="hws-tool-card">',
      '<div class="hws-tool-eyebrow"><span class="hws-tool-icon">✦</span> ПРАКТИКА</div>',
      '<h3>Вопрос для сессии</h3>',
      '<p id="hwsPractice"></p>',
      '<div class="hws-tool-actions"><button type="button" data-action="next-prompt">Следующий <span aria-hidden="true">↻</span></button>',
        '<button type="button" data-action="copy-prompt" title="Скопировать вопрос">Скопировать</button></div>',
    '</section>',
    '<section class="hws-capture">',
      '<div class="hws-tool-eyebrow"><span class="hws-tool-icon">✎</span> БЫСТРЫЕ МЫСЛИ</div>',
      '<h3>Записать мысль</h3>',
      '<textarea id="hwsQuickThought" maxlength="800" rows="3" placeholder="Записать мысль, наблюдение или идею…"></textarea>',
      '<div class="hws-capture-bottom"><span id="hwsNoteStatus" role="status" aria-live="polite"></span>',
        '<button type="button" data-action="save-thought">Сохранить <span aria-hidden="true">↗</span></button></div>',
      '<button type="button" class="hws-capture-link" data-action="quick-thoughts">Открыть быстрые мысли в заметках</button>',
    '</section>'
  ].join('');
  right.appendChild(rail);

  const $=selector=>dashboard.querySelector(selector);
  const formatDate=timestamp=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(timestamp));
  const parseStart=(value,timeValue)=>{
    const date=String(value||'').trim();
    const m=date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m){
      const t=String(timeValue||'').match(/^(\d{1,2}):(\d{2})/);
      const d=new Date(+m[1],+m[2]-1,+m[3],t?+t[1]:12,t?+t[2]:0);
      return d.getTime();
    }
    const stamp=Date.parse(date);
    return Number.isFinite(stamp)?stamp:NaN;
  };
  const eventType=e=>{
    const type=(String(e?.type||'')+' '+String(e?.title||'')).toLowerCase();
    if(/напомин|remind|задач/.test(type))return 'reminder';
    if(/диагност/.test(type))return 'diagnosis';
    if(/консультац/.test(type))return 'consultation';
    if(/сесси/.test(type))return 'session';
    return 'meeting';
  };
  const isComplete=e=>e?.completedAt||e?.sessionCompleted===true||['completed','done','cancelled','canceled'].includes(String(e?.status||'').toLowerCase());
  const kindLabel={reminder:'Напоминание',session:'Сессия',diagnosis:'Диагностика',consultation:'Консультация',meeting:'Встреча'};
  const cleanName=c=>String(c?.name||'').trim()||'Без имени';
  const showName=c=>hideNames?'Имя скрыто':cleanName(c);
  function entries(){
    const raw=[];
    const api=calendar();
    try{
      const all=api?.list?.()||[];
      for(const e of Array.isArray(all)?all:[]){
        if(!e||isComplete(e))continue;
        const at=parseStart(e.date,e.time);
        if(!Number.isFinite(at))continue;
        raw.push({key:'event:'+e.id,at,kind:eventType(e),clientId:e.clientId,
          label:String(e.title||e.type||'Запись').trim(),eventId:e.id,source:'calendar'});
      }
    }catch(error){console.warn('Home workspace calendar snapshot unavailable',error);}
    // Some legacy planned sessions have no associated calendar event.
    const known=new Set(raw.filter(x=>x.eventId).map(x=>String(x.eventId)));
    for(const c of clients()){
      for(const s of Array.isArray(c.sessions)?c.sessions:[]){
        if(!(s?.planned===true||s?.status==='planned')||isComplete(s))continue;
        if(s.calendarEventId&&known.has(String(s.calendarEventId)))continue;
        const at=parseStart(s.date,s.scheduledTime||s.time);
        if(!Number.isFinite(at))continue;
        raw.push({key:'session:'+c.id+':'+s.id,at,kind:/диагност/i.test(String(s.appointmentType||''))?'diagnosis':'session',
          clientId:c.id,label:String(s.appointmentType||s.calendarTitle||'Сессия'),source:'session'});
      }
    }
    return raw.sort((a,b)=>a.at-b.at);
  }

  function renderSchedule(items){
    const now=Date.now();
    const upcoming=items.filter(e=>e.at>=now&&!isNaN(e.at)).slice(0,4);
    $('#hwsSchedule').innerHTML=upcoming.length?upcoming.map(e=>{
      const c=clientFor(e.clientId);
      return '<div class="hws-event-row"><div class="hws-event-type is-'+e.kind+'">'+
        (e.kind==='reminder'?'◎':'◷')+'</div><div class="hws-event-body"><strong>'+esc(hideNames?kindLabel[e.kind]:e.label)+'</strong>'+
        '<span>'+esc(c?showName(c):'Общая запись')+' · '+esc(formatDate(e.at))+'</span></div>'+
        (c?'<button type="button" data-action="open-client" data-client-id="'+esc(c.id)+'" aria-label="Открыть клиента">↗</button>':
           '<button type="button" data-action="calendar" aria-label="Открыть календарь">↗</button>')+'</div>';
    }).join(''):'<div class="hws-empty"><span class="hws-empty-symbol">✓</span><div><strong>Ближайших событий нет</strong><p>Запланируй встречу или напоминание в календаре.</p></div></div>';
  }
  function renderQuote(){
    const today=dayKey();
    if(today!==quoteDate){
      quoteDate=today;
      quoteIndex=todayIndex();
    }
    const q=thoughts[quoteIndex];
    $('#hwsQuoteText').textContent=q[0];
    $('#hwsReflect').textContent=q[1];
  }
  function renderPrompt(){
    $('#hwsPractice').textContent=practice[promptIndex];
  }
  function render(){
    if(!visible())return;
    try{
      renderSchedule(entries());
      $('#hwsCurrentDate').textContent=new Intl.DateTimeFormat('ru-RU',
        {weekday:'long',day:'numeric',month:'long'}).format(new Date());
      const privacy=$('[data-action="privacy"]');
      privacy.textContent=hideNames?'◉ Показать имена':'◉ Скрыть имена';
      privacy.setAttribute('aria-pressed',hideNames?'true':'false');
      renderQuote();
      renderPrompt();
    }catch(error){console.error('Home workspace render failed',error);}
  }
  const openCalendar=()=>{
    if(typeof window.DiagnostikaCalendarUI?.open==='function'){window.DiagnostikaCalendarUI.open({mode:'overview'});return;}
    document.getElementById('headerCalendarBtn')?.click();
  };
  const openNotes=()=>window.DiagnostikaQuickNotes?.open?.();
  async function clipboard(text){
    try{
      if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      saveMessage='Скопировано';
    }catch(_){saveMessage='Не удалось скопировать';}
    renderQuote();
  }
  async function onAction(button){
    const action=button.dataset.action||'';
    if(action==='privacy'){hideNames=!hideNames;putStored('hide-names',String(hideNames));render();return;}
    if(action==='open-client'){window.DiagnostikaHomeDashboard?.openClient?.(button.dataset.clientId);return;}
    if(action==='new-client'){window.DiagnostikaHomeDashboard?.addClient?.();return;}
    if(action==='calendar'){openCalendar();return;}
    if(action==='notes'){openNotes();return;}
    if(action==='complete-reminder'){
      const id=button.dataset.eventId;
      if(!id||!calendar()?.update)return;
      const updated=calendar().update(id,{status:'completed',completedAt:new Date().toISOString()},
        {source:'home-workspace-reminder-complete'});
      if(updated)render();
      return;
    }
    if(action==='next-quote'){
      const favorites=validFavorites();
      if(showFavorites&&favorites.length){
        const i=favorites.indexOf(quoteIndex);
        quoteIndex=favorites[(i+1)%favorites.length];
      }else{
        quoteIndex=(quoteIndex+1)%thoughts.length;
        saveJson('daily-thought',{date:dayKey(),index:quoteIndex});
      }
      saveMessage='';renderQuote();return;
    }
    if(action==='favorite'){
      const list=validFavorites();
      const next=list.includes(quoteIndex)?list.filter(x=>x!==quoteIndex):[...list,quoteIndex];
      if(saveJson('favorites',next))saveMessage=next.includes(quoteIndex)?'Добавлено':'Убрано';
      else saveMessage='Не удалось сохранить';
      renderQuote();return;
    }
    if(action==='favorites'){
      const saved=validFavorites();
      if(!saved.length){saveMessage='Избранных мыслей пока нет';renderQuote();return;}
      showFavorites=!showFavorites;
      if(showFavorites)quoteIndex=saved[0];
      else quoteIndex=currentQuote();
      saveMessage='';renderQuote();return;
    }
    if(action==='copy-quote'){await clipboard(thoughts[quoteIndex][0]+'\n\n'+thoughts[quoteIndex][1]);return;}
    if(action==='next-prompt'){promptIndex=(promptIndex+1)%practice.length;renderPrompt();return;}
    if(action==='copy-prompt'){await clipboard(practice[promptIndex]);return;}
    if(action==='save-thought'){
      const input=$('#hwsQuickThought'),status=$('#hwsNoteStatus');
      const note=input.value.trim();
      if(!note){status.textContent='Напиши сначала мысль';input.focus();return;}
      const api=window.DiagnostikaQuickNotes;
      if(typeof api?.add!=='function'){status.textContent='Заметки ещё загружаются';return;}
      if(api.add(note)){
        input.value='';
        status.textContent='✓ Сохранено в заметках';
      }else status.textContent='Не удалось сохранить';
    }
  }
  dashboard.addEventListener('click',event=>{
    if(!visible())return;
    const button=event.target.closest('.hws-workspace [data-action],.hws-rail [data-action]');
    if(!button||!dashboard.contains(button))return;
    onAction(button);
  });
  document.addEventListener('diagnostika:dashboard-home-opened',render);
  document.addEventListener('diagnostika:dashboard-clients-rendered',render);
  window.addEventListener('diagnostika-general-notes-changed',()=>{if(visible())$('#hwsNoteStatus').textContent='Заметки обновлены';});
  const events=window.DiagnostikaPlatform?.events;
  if(events?.on)events.on('client:selected',d=>{
    if(d?.source==='last-client-restore')return;
    if(d?.clientId)rememberClient(d.clientId);
  });
  window.DiagnostikaHomeWorkspace=Object.freeze({render,thoughtCount:thoughts.length,practiceCount:practice.length});
  render();
})();
