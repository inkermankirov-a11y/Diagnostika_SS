'use strict';

/* Home-only professional workspace. No client records are copied or uploaded. */
(() => {
  if(window.DiagnostikaHomeWorkspace)return;

  const home=document.querySelector('.home-dashboard #hdHomeView');
  const dashboard=home?.closest('.home-dashboard');
  const right=dashboard?.querySelector('.hd-right');
  if(!home||!dashboard||!right)return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[ch]));
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

  home.innerHTML=[
    '<div class="hws-workspace hws-workspace-simple">',
      '<div class="hws-hero hws-hero-compact">',
        '<div class="hws-hero-row"><h2 class="hws-heading">Мой рабочий день</h2>',
        '<div class="hws-today-date" id="hwsHeroDate"></div></div>',
      '</div>',
      '<div class="hws-metrics" id="hwsMetrics" aria-live="polite"></div>',
      '<section class="hws-card hws-schedule hws-schedule-only">',
        '<div class="hws-schedule-header hws-schedule-header-compact">',
          '<h2>Ближайшие события</h2>',
          '<button type="button" class="hws-text-action" data-action="calendar">Календарь <span aria-hidden="true">↗</span></button>',
        '</div>',
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
  const formatScheduledDate=date=>new Intl.DateTimeFormat('ru-RU',
    {day:'numeric',month:'long',year:'numeric'}).format(new Date(date+'T12:00:00'));
  const formatScheduledTime=time=>{
    const m=String(time||'').trim().match(/^(\d{1,2}):(\d{2})/);
    return m?m[1].padStart(2,'0')+':'+m[2]:'Время не указано';
  };
  const parseStart=(value,timeValue)=>{
    const date=String(value||'').trim();
    const m=date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m){
      const t=String(timeValue||'').match(/^(\d{1,2}):(\d{2})/);
      const d=new Date(+m[1],+m[2]-1,+m[3],t?+t[1]:23,t?+t[2]:59);
      // An invalid date must not turn into a different scheduled day.
      if(d.getFullYear()!==+m[1]||d.getMonth()!==+m[2]-1||d.getDate()!==+m[3])return NaN;
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

  function entries(){
    const raw=[];
    const api=calendar();
    try{
      const all=api?.list?.()||[];
      for(const e of Array.isArray(all)?all:[]){
        if(!e||isComplete(e))continue;
        // Calendar date/time are the scheduled appointment, unlike createdAt.
        const scheduledDate=String(e.date||'').trim().slice(0,10);
        const scheduledTime=String(e.time||'').trim();
        const at=parseStart(scheduledDate,scheduledTime);
        if(!Number.isFinite(at))continue;
        raw.push({key:'event:'+e.id,at,scheduledDate,scheduledTime,
          kind:eventType(e),clientId:e.clientId,
          label:String(e.title||e.type||'Запись').trim(),eventId:e.id,source:'calendar'});
      }
    }catch(error){console.warn('Home workspace calendar snapshot unavailable',error);}
    // Some legacy planned sessions have no associated calendar event.
    const known=new Set(raw.filter(x=>x.eventId).map(x=>String(x.eventId)));
    for(const c of clients()){
      for(const s of Array.isArray(c.sessions)?c.sessions:[]){
        if(!(s?.planned===true||s?.status==='planned')||isComplete(s))continue;
        if(s.calendarEventId&&known.has(String(s.calendarEventId)))continue;
        // A legacy session's "date" can be its creation date. Only show
        // standalone planned sessions when an explicit scheduled time exists.
        const scheduledDate=String(s.scheduledDate||s.plannedDate||s.date||'').trim().slice(0,10);
        const scheduledTime=String(s.scheduledTime||'').trim();
        if(!scheduledTime)continue;
        const at=parseStart(scheduledDate,scheduledTime);
        if(!Number.isFinite(at))continue;
        raw.push({key:'session:'+c.id+':'+s.id,at,scheduledDate,scheduledTime,
          kind:/диагност/i.test(String(s.appointmentType||''))?'diagnosis':'session',
          clientId:c.id,label:String(s.calendarTitle||s.appointmentType||'Сессия'),source:'session'});
      }
    }
    return raw.sort((a,b)=>a.at-b.at);
  }

  function renderSchedule(items){
    const now=Date.now();
    const today=new Date(now);
    // Seven calendar dates in the user's local timezone: today + six more.
    // Midnight of day eight is exclusive, so the window is DST-safe.
    const endExclusive=new Date(
      today.getFullYear(),today.getMonth(),today.getDate()+7
    ).getTime();
    // No count cap: show every upcoming calendar event in this week.
    const upcoming=items.filter(e=>Number.isFinite(e.at)&&e.at>=now&&e.at<endExclusive);
    $('#hwsSchedule').innerHTML=upcoming.length?upcoming.map(e=>{
      const c=clientFor(e.clientId);
      const scheduledDate=formatScheduledDate(e.scheduledDate);
      const scheduledTime=formatScheduledTime(e.scheduledTime);
      const name=c?String(c.name||'Без имени').trim():'Общая запись';
      return '<div class="hws-event-row"><div class="hws-event-type is-'+e.kind+'">'+
        (e.kind==='reminder'?'◎':'◷')+'</div><div class="hws-event-body">'+
        '<strong>'+esc(e.label)+'</strong>'+
        '<span class="hws-event-person">'+esc(name)+'</span>'+
        '<span class="hws-event-scheduled">Запланировано: <b>'+esc(scheduledDate)+'</b>'+
        ' <span class="hws-event-time">'+esc(scheduledTime)+'</span></span></div>'+
        (c?'<button type="button" data-action="open-client" data-client-id="'+esc(c.id)+'" aria-label="Открыть клиента">↗</button>':
           '<button type="button" data-action="calendar" aria-label="Открыть календарь">↗</button>')+'</div>';
    }).join(''):'<div class="hws-empty"><span class="hws-empty-symbol">✓</span><div><strong>Ближайших событий нет</strong><p>Запланируй встречу или напоминание в календаре.</p></div></div>';
  }
  function renderMetrics(items){
    const now=Date.now();
    const date=new Date();
    const start=new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime();
    const end=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1).getTime();
    const meetings=items.filter(e=>e.kind!=='reminder'&&e.at>=start&&e.at<end).length;
    const attention=items.filter(e=>e.kind==='reminder'&&e.at<=now).length;
    $('#hwsMetrics').innerHTML=[
      ['Встреч сегодня',meetings,'is-ocean','▦'],
      ['Ожидают внимания',attention,'is-amber','◉']
    ].map(([label,value,tone,icon])=>'<div class="hws-metric '+tone+'"><span class="hws-metric-icon">'+icon+
      '</span><span class="hws-metric-value">'+value+'</span><span class="hws-metric-label">'+label+'</span></div>').join('');
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
      const items=entries();
      renderMetrics(items);
      renderSchedule(items);
      const today=new Intl.DateTimeFormat('ru-RU',
        {weekday:'long',day:'numeric',month:'long'}).format(new Date());
      $('#hwsHeroDate').textContent=today;
      renderQuote();
      renderPrompt();
    }catch(error){console.error('Home workspace render failed',error);}
  }
  const openCalendar=()=>{
    if(typeof window.DiagnostikaCalendarUI?.open==='function'){window.DiagnostikaCalendarUI.open({mode:'overview'});return;}
    document.getElementById('headerCalendarBtn')?.click();
  };
  const openQuickThoughts=()=>window.DiagnostikaQuickNotes?.openQuickThoughts?.();
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
    if(action==='open-client'){window.DiagnostikaHomeDashboard?.openClient?.(button.dataset.clientId);return;}
    if(action==='calendar'){openCalendar();return;}
    if(action==='quick-thoughts'){openQuickThoughts();return;}
    if(action==='next-prompt'){promptIndex=(promptIndex+1)%practice.length;renderPrompt();return;}
    if(action==='copy-prompt'){await clipboard(practice[promptIndex]);return;}
    if(action==='save-thought'){
      const input=$('#hwsQuickThought'),status=$('#hwsNoteStatus');
      const note=input.value.trim();
      if(!note){status.textContent='Напиши сначала мысль';input.focus();return;}
      const api=window.DiagnostikaQuickNotes;
      if(typeof api?.addQuickThought!=='function'){status.textContent='Заметки ещё загружаются';return;}
      if(api.addQuickThought(note)){
        input.value='';
        status.textContent='✓ Сохранено в «Быстрые мысли»';
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
  window.DiagnostikaHomeWorkspace=Object.freeze({render,thoughtCount:thoughts.length,practiceCount:practice.length});
  render();
})();
