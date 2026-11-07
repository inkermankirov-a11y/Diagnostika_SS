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
  const readJson=(key,fallback)=>{try{return JSON.parse(getStored(key,''))||fallback;}catch(_){return fallback;}};
  const saveJson=(key,value)=>putStored(key,JSON.stringify(value));
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
  const dayKey=()=>{
    const d=new Date();
    return String(d.getFullYear())+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  };
  const todayIndex=()=>{
    const d=new Date();
    return Math.floor(new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()/86400000)%thoughts.length;
  };
  const currentQuote=()=>{
    const saved=readJson('daily-thought',null);
    if(saved?.date===dayKey()&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<thoughts.length)return saved.index;
    return todayIndex();
  };
  let quoteIndex=currentQuote();
  let promptIndex=0;
  let hideNames=getStored('hide-names','false')==='true';
  let showFavorites=false;
  let saveMessage='';

  home.innerHTML=[
    '<div class="hws-workspace">',
      '<div class="hws-hero">',
        '<div class="hws-hero-glow" aria-hidden="true"></div>',
        '<div class="hws-eyebrow"><span class="hws-live-dot"></span> РАБОЧЕЕ ПРОСТРАНСТВО</div>',
        '<div class="hws-hero-row"><div><h2 class="hws-heading">Мой рабочий день</h2>',
        '<p>Встречи, приоритеты и следующий шаг — в одном месте.</p></div>',
        '<div class="hws-today-date" id="hwsCurrentDate"></div></div>',
        '<button type="button" class="hws-privacy" data-action="privacy" aria-pressed="false"></button>',
      '</div>',
      '<div class="hws-metrics" id="hwsMetrics" aria-live="polite"></div>',
      '<section class="hws-card hws-schedule">',
        '<div class="hws-section-header"><div><div class="hws-overline">ПЛАН ДНЯ</div>',
        '<h3>Ближайшие события</h3></div>',
        '<button type="button" class="hws-text-action" data-action="calendar">Весь календарь <span aria-hidden="true">↗</span></button></div>',
        '<div id="hwsSchedule" class="hws-rows" aria-live="polite"></div>',
      '</section>',
      '<section class="hws-card hws-priorities">',
        '<div class="hws-section-header"><div><div class="hws-overline">ФОКУС</div><h3>Требует внимания</h3></div>',
        '<span class="hws-card-hint">Только актуальное</span></div>',
        '<div id="hwsPriorityList" class="hws-rows"></div>',
      '</section>',
      '<section class="hws-card hws-resume">',
        '<div class="hws-section-header"><div><div class="hws-overline">БЫСТРЫЙ ВОЗВРАТ</div>',
        '<h3>Продолжить работу</h3></div></div>',
        '<div id="hwsResumeList" class="hws-resume-list"></div>',
      '</section>',
      '<div class="hws-action-row">',
        '<button type="button" class="hws-main-action" data-action="new-client"><span class="hws-action-symbol">＋</span> Новый клиент</button>',
        '<button type="button" class="hws-sub-action" data-action="calendar"><span aria-hidden="true">▦</span> Календарь</button>',
        '<button type="button" class="hws-sub-action" data-action="notes"><span aria-hidden="true">▤</span> Заметки</button>',
      '</div>',
    '</div>'
  ].join('');

  const rail=document.createElement('div');
  rail.className='hd-home-only hws-rail';
  rail.innerHTML=[
    '<section class="hws-wisdom">',
      '<div class="hws-quote-aura" aria-hidden="true"></div>',
      '<div class="hws-rail-kicker"><span class="hws-kicker-mark">✧</span> ПАУЗА ДЛЯ МЫСЛИ</div>',
      '<div class="hws-wisdom-meta">Мысль дня <span id="hwsQuoteNumber"></span></div>',
      '<div class="hws-quote-glyph" aria-hidden="true">“</div>',
      '<blockquote id="hwsQuoteText"></blockquote>',
      '<div class="hws-wisdom-note">Авторская философская подборка</div>',
      '<div class="hws-wisdom-divider"></div>',
      '<div class="hws-reflect-label">ВОПРОС ДЛЯ РАЗМЫШЛЕНИЯ</div>',
      '<p class="hws-reflect-text" id="hwsReflect"></p>',
      '<div class="hws-quote-actions">',
        '<button type="button" data-action="next-quote" title="Другая мысль">Другая мысль <span aria-hidden="true">↻</span></button>',
        '<button type="button" data-action="favorite" id="hwsFavorite" aria-pressed="false" title="Добавить в избранное">☆</button>',
        '<button type="button" data-action="copy-quote" title="Скопировать мысль">▢</button>',
      '</div>',
      '<div class="hws-quote-subrow"><button type="button" data-action="favorites" id="hwsFavoritesToggle">Избранные мысли</button>',
        '<span id="hwsQuoteStatus" role="status" aria-live="polite"></span></div>',
    '</section>',
    '<section class="hws-tool-card">',
      '<div class="hws-tool-eyebrow"><span class="hws-tool-icon">✦</span> ПРАКТИКА</div>',
      '<h3>Вопрос для сессии</h3>',
      '<p id="hwsPractice"></p>',
      '<div class="hws-tool-actions"><button type="button" data-action="next-prompt">Следующий <span aria-hidden="true">↻</span></button>',
        '<button type="button" data-action="copy-prompt" title="Скопировать вопрос">Скопировать</button></div>',
    '</section>',
    '<section class="hws-capture">',
      '<div class="hws-tool-eyebrow"><span class="hws-tool-icon">✎</span> БЫСТРАЯ МЫСЛЬ</div>',
      '<h3>Не потерять идею</h3>',
      '<textarea id="hwsQuickThought" maxlength="800" rows="3" placeholder="Записать мысль, наблюдение или идею…"></textarea>',
      '<div class="hws-capture-bottom"><span id="hwsNoteStatus" role="status" aria-live="polite"></span>',
        '<button type="button" data-action="save-thought">Сохранить <span aria-hidden="true">↗</span></button></div>',
      '<button type="button" class="hws-capture-link" data-action="notes">Открыть все заметки</button>',
    '</section>'
  ].join('');
  right.appendChild(rail);

  const $=selector=>dashboard.querySelector(selector);
  const formatDate=timestamp=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(timestamp));
  const dateDay=timestamp=>new Date(timestamp).toDateString();
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
  const newClientName=c=>!c||['Новый клиент','New client',''].includes(String(c.name||'').trim());
  const isRequestActive=r=>r&&r.status!=='completed';
  const startOfToday=()=>{
    const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  };
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

  function rememberClient(id){
    if(!id)return;
    const next=[String(id),...readJson('recent-clients',[]).map(String).filter(x=>x!==String(id))].slice(0,5);
    saveJson('recent-clients',next);
  }
  function resumeClients(){
    const all=clients();
    const recent=readJson('recent-clients',[]);
    const order=new Map((Array.isArray(recent)?recent:[]).map((id,i)=>[String(id),i]));
    return all.filter(c=>!newClientName(c))
      .map(c=>({c,active:(c.requests||[]).filter(isRequestActive).length,order:order.get(String(c.id))??999}))
      .filter(x=>x.order!==999||x.active>0)
      .sort((a,b)=>a.order-b.order||b.active-a.active)
      .slice(0,3);
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
  function renderPriorities(items){
    const now=Date.now();
    const pending=items.filter(e=>e.kind==='reminder'&&e.at<=now).slice(0,3);
    const el=$('#hwsPriorityList');
    if(!pending.length){
      el.innerHTML='<div class="hws-empty hws-empty-success"><span class="hws-empty-symbol">✓</span><div><strong>Срочных напоминаний нет</strong><p>Здесь появятся задачи, которые пора выполнить.</p></div></div>';
      return;
    }
    el.innerHTML=pending.map(e=>'<div class="hws-priority-row"><div class="hws-priority-flag">!</div>'+
      '<div><strong>'+esc(hideNames?kindLabel[e.kind]:e.label)+'</strong><span>'+esc(e.clientId?showName(clientFor(e.clientId)):'Общая задача')+
      ' · '+esc(formatDate(e.at))+'</span></div>'+
      (e.source==='calendar'&&e.eventId?'<button type="button" data-action="complete-reminder" data-event-id="'+esc(e.eventId)+'" title="Отметить выполненным" aria-label="Выполнено">✓</button>':'')+'</div>').join('');
  }
  function renderResume(){
    const list=resumeClients();
    $('#hwsResumeList').innerHTML=list.length?list.map(({c,active})=>{
      const initials=cleanName(c).split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
      return '<button type="button" data-action="open-client" data-client-id="'+esc(c.id)+'" class="hws-resume-person">'+
        '<span class="hws-resume-avatar">'+(hideNames?'•':esc(initials))+'</span>'+
        '<span class="hws-resume-info"><strong>'+esc(showName(c))+'</strong>'+
        '<small>'+esc(active?active+' незавершённых '+(active===1?'запрос':'запросов'):'Недавняя работа')+'</small></span>'+
        '<span class="hws-resume-arrow">↗</span></button>';
    }).join(''):'<div class="hws-resume-empty">Выбери клиента слева — он появится здесь для быстрого возврата.</div>';
  }
  function renderMetrics(items){
    const today=startOfToday(),tomorrow=today+86400000,now=Date.now();
    const todayMeetings=items.filter(e=>e.kind!=='reminder'&&e.at>=today&&e.at<tomorrow).length;
    const due=items.filter(e=>e.kind==='reminder'&&e.at<=now).length;
    const requests=clients().reduce((n,c)=>n+(c.requests||[]).filter(isRequestActive).length,0);
    $('#hwsMetrics').innerHTML=[
      ['calendar','Встреч сегодня',todayMeetings,'is-ocean','▦'],
      ['alert','Ожидают внимания',due,'is-amber','◉'],
      ['requests','Активных запросов',requests,'is-lilac','◇']
    ].map(([id,label,value,tone,icon])=>'<div class="hws-metric '+tone+'"><span class="hws-metric-icon">'+icon+
      '</span><span class="hws-metric-value">'+value+'</span><span class="hws-metric-label">'+label+'</span></div>').join('');
    $('#hwsCurrentDate').textContent=new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  }
  function renderQuote(){
    const favorites=readJson('favorites',[]);
    const saved=Array.isArray(favorites)?favorites:[];
    if(showFavorites&&!saved.length)showFavorites=false;
    if(showFavorites&&!saved.includes(quoteIndex))quoteIndex=saved[0];
    const q=thoughts[quoteIndex];
    $('#hwsQuoteText').textContent=q[0];
    $('#hwsReflect').textContent=q[1];
    $('#hwsQuoteNumber').textContent=(quoteIndex+1)+' / '+thoughts.length;
    $('#hwsFavorite').textContent=saved.includes(quoteIndex)?'★':'☆';
    $('#hwsFavorite').setAttribute('aria-pressed',saved.includes(quoteIndex)?'true':'false');
    $('#hwsFavoritesToggle').textContent=showFavorites?'Все мысли':'Избранные мысли'+(saved.length?' · '+saved.length:'');
    $('#hwsQuoteStatus').textContent=saveMessage;
  }
  function renderPrompt(){
    $('#hwsPractice').textContent=practice[promptIndex];
  }
  function render(){
    if(!visible())return;
    try{
      const items=entries();
      renderMetrics(items);
      renderSchedule(items);
      renderPriorities(items);
      renderResume();
      $('[data-action="privacy"]').textContent=hideNames?'◉ Показать имена':'◉ Скрыть имена';
      $('[data-action="privacy"]').setAttribute('aria-pressed',hideNames?'true':'false');
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
      const favorites=readJson('favorites',[]);
      if(showFavorites&&Array.isArray(favorites)&&favorites.length){
        const i=favorites.indexOf(quoteIndex);
        quoteIndex=favorites[(i+1)%favorites.length];
      }else{
        quoteIndex=(quoteIndex+1)%thoughts.length;
        saveJson('daily-thought',{date:dayKey(),index:quoteIndex});
      }
      saveMessage='';renderQuote();return;
    }
    if(action==='favorite'){
      const saved=readJson('favorites',[]),list=Array.isArray(saved)?saved.filter(x=>Number.isInteger(x)):[];
      const next=list.includes(quoteIndex)?list.filter(x=>x!==quoteIndex):[...list,quoteIndex];
      if(saveJson('favorites',next))saveMessage=next.includes(quoteIndex)?'Добавлено':'Убрано';
      else saveMessage='Не удалось сохранить';
      renderQuote();return;
    }
    if(action==='favorites'){
      const saved=readJson('favorites',[]);
      if(!Array.isArray(saved)||!saved.length){saveMessage='Избранных мыслей пока нет';renderQuote();return;}
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
