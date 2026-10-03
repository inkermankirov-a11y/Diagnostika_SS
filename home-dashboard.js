'use strict';

(() => {
  const diagnosisWorkspace=document.getElementById('diagnosisWorkspace');
  const header=document.querySelector('.app-header');
  if(!diagnosisWorkspace||!header||document.querySelector('.home-dashboard')) return;

  const dashboard=document.createElement('section');
  dashboard.className='home-dashboard dashboard-home-mode';
  dashboard.innerHTML=`
    <aside class="hd-sidebar hd-card">
      <div class="hd-side-title"><div id="hdClientBaseSlot" class="hd-client-base-slot"></div><span aria-hidden="true">⌕</span></div>
      <div class="hd-search"><input id="hdClientSearch" type="search" placeholder="Поиск по клиентам…" autocomplete="off"></div>
      <div class="hd-client-filters" role="group" aria-label="Фильтры клиентов">
        <button type="button" class="hd-client-filter" data-filter="new" aria-pressed="false" title="Показать новых клиентов">Новые</button>
        <button type="button" class="hd-client-filter" data-filter="upcoming" aria-pressed="false" title="Показать клиентов с ближайшей записью">Ближайшие</button>
        <button type="button" class="hd-client-filter" data-filter="unpaid" aria-pressed="false" title="Показать клиентов с неоплаченными сессиями">Не оплатил</button>
      </div>
      <div id="hdClientList" class="hd-client-list"></div>
      <div id="hdClientCount" class="hd-client-count"></div>
    </aside>

    <main class="hd-main hd-card">
      <div id="hdHomeView" class="hd-home-view" aria-label="Главная"></div>

      <div id="hdClientView" class="hd-main-inner hd-client-view">
        <section class="hd-client-profile">
          <div class="hd-client-profile-head">
            <div class="hd-client-photo-stack">
              <div class="hd-hero-icon" aria-hidden="true"></div>
              <div id="hdClientSocials" class="hd-client-socials" aria-label="Социальные сети клиента"></div>
            </div>
            <div class="hd-client-profile-copy">
              <h2 id="hdHeroTitle">Выберите клиента</h2>
              <div id="hdHeroSub" class="hd-main-sub"></div>
              <div id="hdHeroActions" class="hd-client-actions"></div>
            </div>
          </div>
          <div id="hdSummary" class="hd-selected-summary" hidden></div>
        </section>
        <aside class="hd-client-right-rail" aria-label="Напоминание и специалист">
          <div class="hd-reminder-slot">
            <aside id="hdHeroReminder" class="hd-hero-reminder" hidden aria-live="polite"></aside>
          </div>
          <div id="hdClientSpecialistSlot" class="hd-client-specialist-slot" aria-live="polite"></div>
        </aside>
        <div class="hd-features">
          <div class="hd-feature"><div class="hd-feature-icon">♙</div>Храните историю<br>клиентов</div>
          <div class="hd-feature"><div class="hd-feature-icon">▥</div>Проводите<br>диагностику</div>
          <div class="hd-feature"><div class="hd-feature-icon">▤</div>Делайте заметки<br>и планируйте работу</div>
        </div>
      </div>
    </main>

    <aside class="hd-right">
      <section class="hd-widget hd-card hd-client-only hd-client-notes-widget">
        <div class="hd-widget-title"><span>▤</span><span>Заметки</span></div>
        <div id="hdOpenNotes" class="hd-note-box">Выберите клиента, чтобы открыть его заметки.</div>
      </section>

      <section class="hd-widget hd-card hd-client-only hd-client-ai-slot">
        <div class="hd-widget-title"><span>▣</span><span>Следующий шаг</span></div>
        <div class="hd-next-box"><strong>Нет запланированных задач</strong>После работы с клиентом здесь можно зафиксировать следующий шаг.<br><button id="hdPlanBtn" class="hd-plan-btn" type="button">＋ Запланировать</button></div>
      </section>
    </aside>`;
  header.insertAdjacentElement('afterend',dashboard);

  const clientBaseButton=document.getElementById('clientBaseBtn');
  const clientBaseSlot=dashboard.querySelector('#hdClientBaseSlot');
  if(clientBaseButton&&clientBaseSlot){
    clientBaseButton.classList.remove('header-btn');
    clientBaseButton.classList.add('hd-client-base-btn');
    clientBaseButton.removeAttribute('style');
    clientBaseButton.textContent='Клиенты';
    clientBaseSlot.appendChild(clientBaseButton);
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  }

  const $=s=>dashboard.querySelector(s);
  const list=$('#hdClientList');
  const search=$('#hdClientSearch');
  const count=$('#hdClientCount');
  const filterButtons=[...dashboard.querySelectorAll('.hd-client-filter')];
  const homeView=$('#hdHomeView');
  const clientView=$('#hdClientView');
  const mainInner=$('.hd-main-inner');
  const heroIcon=$('.hd-hero-icon');
  const heroTitle=$('#hdHeroTitle');
  const heroSub=$('#hdHeroSub');
  const heroSocials=$('#hdClientSocials');
  const heroReminder=$('#hdHeroReminder');
  const heroActions=$('#hdHeroActions');
  const summary=$('#hdSummary');

  const placeholderName=v=>{
    const s=String(v||'').trim().toLowerCase();
    return !s||['новый клиент','new client','nouveau client','neuer kunde','nuovo cliente'].includes(s);
  };
  const initials=name=>{
    const p=String(name||'').trim().split(/\s+/).filter(Boolean);
    if(!p.length)return 'К';
    return ((p[0]?.[0]||'')+(p[1]?.[0]||'')).toUpperCase();
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function formatRuDate(value,fallback='—'){
    const raw=String(value||'').trim();
    if(!raw)return fallback;
    const iso=raw.slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(iso)){
      const [year,month,day]=iso.split('-').map(Number);
      return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(year,month-1,day,12,0,0));
    }
    const date=new Date(raw);
    if(Number.isNaN(date.getTime()))return raw;
    return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
  }
  const clientsApi=()=>window.DiagnostikaClients||null;
  const requestsApi=()=>window.DiagnostikaRequests||null;
  const calendarApi=()=>window.DiagnostikaCalendar?.moduleAware===true
    ? window.DiagnostikaCalendar
    : window.DiagnostikaPlatform?.services?.calendar||null;
  const allClients=()=>clientsApi()?.list?.()||[];
  const currentClient=()=>clientsApi()?.current?.()||null;
  const currentClientId=()=>clientsApi()?.currentId?.()||null;
  const CLIENT_FILTER_KEY='diagnostika-dashboard-client-filter-v1';
  const VALID_CLIENT_FILTERS=new Set(['new','upcoming','unpaid']);
  let clientFilter=(()=>{
    try{
      const saved=localStorage.getItem(CLIENT_FILTER_KEY)||'';
      return VALID_CLIENT_FILTERS.has(saved)?saved:'all';
    }catch(_){return'all';}
  })();
  let dashboardView='home';

  function unavailable(message,title='Ошибка'){
    if(window.AppDialog?.alert){window.AppDialog.alert(message,title);return;}
    window.alert(message);
  }

  function paymentNumber(value){
    const n=Number(String(value??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));
    return Number.isFinite(n)?n:0;
  }

  function unpaidSessionCount(c){
    if(!c)return 0;
    const requests=Array.isArray(c.requests)?c.requests:[];
    const sessions=Array.isArray(c.sessions)?c.sessions:[];
    const sessionModeRequests=requests.filter(r=>r?.payment?.mode==='session');
    let unpaid=0;

    for(const r of requests){
      const p=r?.payment;
      if(!p||typeof p!=='object'||!p.mode)continue;

      if(p.mode==='session'){
        const linkedSessions=sessions.filter(s=>{
          if(s?.planned===true||String(s?.status||'')==='planned')return false;
          const linkedId=s?.payment?.requestId||s?.requestId||'';
          if(linkedId)return String(linkedId)===String(r.id);
          return sessionModeRequests.length===1;
        });
        unpaid+=linkedSessions.filter(s=>s?.payment?.paid!==true).length;
        continue;
      }

      if(p.mode==='full'||p.mode==='parts'){
        const total=Math.max(0,paymentNumber(p.total));
        if(total<=0)continue;
        const paid=(Array.isArray(p.payments)?p.payments:[])
          .reduce((sum,item)=>sum+Math.max(0,paymentNumber(item?.amount)),0);
        if(paid<total)unpaid++;
      }
    }

    return unpaid;
  }

  function sessionStartTime(session){
    const raw=String(session?.date||'').trim();
    if(!raw)return NaN;
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
      const [year,month,day]=raw.split('-').map(Number);
      return new Date(year,month-1,day,12,0,0,0).getTime();
    }
    const parsed=Date.parse(raw);
    return Number.isFinite(parsed)?parsed:NaN;
  }

  function isNewClient(c){
    if(!c)return false;
    const sessions=Array.isArray(c.sessions)?c.sessions:[];
    if(!sessions.length)return true;
    const now=Date.now();
    return !sessions.some(session=>{
      if(session?.planned===true||String(session?.status||'')==='planned')return false;
      const time=sessionStartTime(session);
      return Number.isFinite(time)&&time<=now;
    });
  }

  function calendarEventStartTime(event){
    const rawDate=String(event?.date||'').trim();
    if(!rawDate)return NaN;
    if(/^\d{4}-\d{2}-\d{2}$/.test(rawDate)){
      const [year,month,day]=rawDate.split('-').map(Number);
      const rawTime=String(event?.time||'').trim();
      const match=rawTime.match(/^(\d{1,2}):(\d{2})/);
      const hour=match?Number(match[1]):12;
      const minute=match?Number(match[2]):0;
      return new Date(year,month-1,day,hour,minute,0,0).getTime();
    }
    const parsed=Date.parse(rawDate);
    return Number.isFinite(parsed)?parsed:NaN;
  }

  function calendarEventsForClient(c){
    if(!c?.id)return [];
    try{
      const api=calendarApi();
      const rows=api?.forClient?.(c.id)||api?.list?.({clientId:c.id})||[];
      return Array.isArray(rows)?rows:[];
    }catch(_){return [];}
  }

  function nextUpcomingInteraction(c){
    const now=Date.now();
    let best=null;
    for(const event of calendarEventsForClient(c)){
      const time=calendarEventStartTime(event);
      if(!Number.isFinite(time)||time<now)continue;
      if(!best||time<best.time)best={event,time};
    }
    return best;
  }

  function nextUpcomingReminder(c){
    const now=Date.now();
    let best=null;
    for(const event of calendarEventsForClient(c)){
      if(upcomingBeaconKind(event)!=='reminder')continue;
      const time=calendarEventStartTime(event);
      if(!Number.isFinite(time)||time<now)continue;
      if(!best||time<best.time)best={event,time};
    }
    return best;
  }

  function upcomingBeaconKind(event){
    const type=String(event?.type||'').trim().toLowerCase();
    const title=String(event?.title||'').trim().toLowerCase();
    if(type==='напоминание'||title==='напоминание')return 'reminder';
    if(type==='бесплатная консультация'||title==='бесплатная консультация')return 'free-consultation';
    if(type==='сессия'||/^сессия №\d+$/i.test(String(event?.title||'').trim()))return 'session';
    return 'neutral';
  }

  function upcomingBeaconTypeLabel(event){
    const kind=upcomingBeaconKind(event);
    if(kind==='session')return 'Сессия';
    if(kind==='reminder')return 'Напоминание';
    if(kind==='free-consultation')return 'Бесплатная консультация';
    return String(event?.type||event?.title||'Запись').trim()||'Запись';
  }

  function nextInteractionTime(c){
    return nextUpcomingInteraction(c)?.time??Number.POSITIVE_INFINITY;
  }

  function hasUpcomingInteraction(c,days=7){
    const next=nextUpcomingInteraction(c);
    return !!next&&next.time<Date.now()+days*24*60*60*1000;
  }

  function upcomingInteractionLabel(upcoming){
    if(!upcoming?.event)return '';
    const event=upcoming.event;
    const rawDate=String(event.date||'').trim();
    let dateText=rawDate||'Дата не указана';
    if(/^\d{4}-\d{2}-\d{2}$/.test(rawDate)){
      const [year,month,day]=rawDate.split('-').map(Number);
      dateText=formatRuDate(rawDate,'Дата не указана');
    }
    const rawTime=String(event.time||'').trim();
    const timeMatch=rawTime.match(/^(\d{1,2}):(\d{2})/);
    const timeText=timeMatch?`${pad2(timeMatch[1])}:${pad2(timeMatch[2])}`:'время не указано';
    return `${upcomingBeaconTypeLabel(event)} • ${dateText} • ${timeText}`;
  }

  function calendarEventDateLabel(event){
    const rawDate=String(event?.date||'').trim();
    let dateText=rawDate||'Дата не указана';
    if(/^\d{4}-\d{2}-\d{2}$/.test(rawDate)){
      const [year,month,day]=rawDate.split('-').map(Number);
      dateText=formatRuDate(rawDate,'Дата не указана');
    }
    const rawTime=String(event?.time||'').trim();
    const timeMatch=rawTime.match(/^(\d{1,2}):(\d{2})/);
    const timeText=timeMatch?`${pad2(timeMatch[1])}:${pad2(timeMatch[2])}`:'время не указано';
    return `${dateText} • ${timeText}`;
  }

  function renderHeroReminder(c){
    if(!heroReminder)return;
    heroReminder.hidden=true;
    heroReminder.replaceChildren();
    if(!c)return;

    const upcoming=nextUpcomingReminder(c);
    if(!upcoming)return;
    if(upcomingBeaconKind(upcoming.event)!=='reminder')return;

    const event=upcoming.event;
    const note=String(event?.note||'').trim()||'Напомнить клиенту связаться и согласовать следующую запись.';

    const head=document.createElement('div');head.className='hd-hero-reminder-head';
    const badge=document.createElement('span');badge.className='hd-hero-reminder-badge';badge.textContent='● НАПОМИНАНИЕ';
    const source=document.createElement('span');source.className='hd-hero-reminder-source';source.textContent='из календаря';
    head.append(badge,source);

    const when=document.createElement('div');when.className='hd-hero-reminder-when';when.textContent=calendarEventDateLabel(event);
    const text=document.createElement('div');text.className='hd-hero-reminder-text';text.textContent=note;

    heroReminder.append(head,when,text);
    heroReminder.hidden=false;
  }

  function pad2(value){return String(value??'').padStart(2,'0');}

  function syncDashboardView(){
    const homeMode=dashboardView==='home';
    dashboard.classList.toggle('dashboard-home-mode',homeMode);
    dashboard.classList.toggle('dashboard-client-mode',!homeMode);
    homeView.hidden=!homeMode;
    clientView.hidden=homeMode;
  }

  function showHome(){
    dashboardView='home';
    const shell=window.DiagnostikaPlatform?.shell;
    if(shell?.currentMode?.()==='diagnosis'){
      shell.setMode?.('card');
      shell.renderMode?.();
    }
    closeClientMenu();
    refresh();
    setTimeout(()=>window.DiagnostikaClientAIChat?.refresh?.(),0);
    document.dispatchEvent(new CustomEvent('diagnostika:dashboard-home-opened'));
    return true;
  }

  function renderHeroVisual(c){
    heroIcon.innerHTML='';
    heroIcon.classList.remove('has-photo');
    if(c?.photoData){
      const img=document.createElement('img');
      img.className='hd-hero-photo';
      img.src=c.photoData;
      img.alt=c.name?`Фото ${c.name}`:'Фото клиента';
      heroIcon.appendChild(img);
      heroIcon.classList.add('has-photo');
      return;
    }
    heroIcon.innerHTML='<div class="hd-hero-cloud"></div><div class="hd-folder"></div><div class="hd-person"></div>';
  }

  function socialHref(kind,value){
    const raw=String(value||'').trim();
    if(!raw)return'';
    if(/^https?:\/\//i.test(raw))return raw;
    const clean=raw.replace(/^@/,'').replace(/^\/+|\/+$/g,'');
    if(kind==='vk')return 'https://vk.com/'+clean.replace(/^vk\.com\//i,'');
    if(kind==='telegram')return 'https://t.me/'+clean.replace(/^(?:t\.me|telegram\.me)\//i,'');
    if(kind==='max')return 'https://max.ru/'+clean.replace(/^max\.ru\//i,'');
    return raw;
  }

  function socialIcon(kind){
    if(kind==='vk')return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="6" fill="#2787F5"/><text x="12" y="15.2" text-anchor="middle" font-size="8.7" font-weight="900" font-family="Arial,sans-serif" fill="#fff">VK</text></svg>';
    if(kind==='telegram')return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#2AABEE"/><path d="M5.2 11.6 18.4 6.5c.61-.22 1.15.15.95.99l-2.25 10.6c-.17.75-.61.93-1.24.58l-3.43-2.53-1.65 1.59c-.18.18-.34.34-.69.34l.25-3.49 6.35-5.73c.28-.25-.06-.38-.43-.14l-7.85 4.94-3.38-1.06c-.73-.23-.75-.73.16-1.08Z" fill="#fff"/></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="maxg" x1="3" y1="3" x2="21" y2="21"><stop stop-color="#24C7C8"/><stop offset=".55" stop-color="#3478F6"/><stop offset="1" stop-color="#7B61FF"/></linearGradient></defs><rect x="1" y="1" width="22" height="22" rx="7" fill="url(#maxg)"/><path d="M6.4 16.6V7.6l5.6 4.8 5.6-4.8v9" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function renderHeroSocials(c){
    if(!heroSocials)return;
    heroSocials.innerHTML='';
    const items=[
      ['vk','VK',c?.vk],
      ['max','MAX',c?.max],
      ['telegram','Telegram',c?.telegram]
    ];
    items.forEach(([kind,label,value])=>{
      const href=socialHref(kind,value);
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='hd-social-btn is-'+kind;
      btn.innerHTML=socialIcon(kind);
      btn.title=href?label+': открыть':' '+label+': не указан';
      btn.setAttribute('aria-label',href?label+': открыть':label+': не указан');
      btn.disabled=!href;
      if(href)btn.onclick=()=>window.open(href,'_blank','noopener,noreferrer');
      heroSocials.appendChild(btn);
    });
  }

  function clientMeta(c){
    const parts=[];
    if(c.city)parts.push(c.city);
    let age='';
    try{age=typeof calcAge==='function'?calcAge(c):(c.age||'');}catch(_){age=c.age||'';}
    if(age)parts.push(`${age} ${Number(age)%10===1&&Number(age)%100!==11?'год':([2,3,4].includes(Number(age)%10)&&![12,13,14].includes(Number(age)%100)?'года':'лет')}`);
    return parts.join(' • ')||'Данные не заполнены';
  }

  function selectClient(id){
    if(!id)return;
    const previousView=dashboardView;
    dashboardView='client';
    syncDashboardView();
    if(clientsApi()?.select?.(id,{source:'home-dashboard-open-client'})){
      refresh();
      setTimeout(()=>window.DiagnostikaClientAIChat?.refresh?.(),0);
      setTimeout(()=>window.DiagnostikaClientAIChat?.refresh?.(),90);
      return;
    }
    dashboardView=previousView;
    syncDashboardView();
    unavailable('Модуль выбора клиента не загрузился. Обновите страницу.','Клиенты');
  }

  function openCard(){
    if(window.DiagnostikaClientCard?.openExisting){window.DiagnostikaClientCard.openExisting();return;}
    unavailable('Модуль карточки клиента не загрузился. Обновите страницу.','Карточка клиента');
  }

  function addClient(){
    if(window.DiagnostikaClientCard?.openNew){window.DiagnostikaClientCard.openNew();return;}
    unavailable('Модуль создания клиента не загрузился. Обновите страницу.','Новый клиент');
  }

  function openClientDatabase(){
    if(clientsApi()?.openDatabase?.())return;
    unavailable('Модуль базы клиентов не загрузился. Обновите страницу.','База клиентов');
  }

  function openDiagnosis(){
    if(window.DiagnostikaDiagnosis?.open){window.DiagnostikaDiagnosis.open();return;}
    unavailable('Модуль диагностики не загрузился. Обновите страницу.','Диагностика');
  }

  function openPayment(){
    if(window.DiagnostikaPayments?.open){window.DiagnostikaPayments.open();return;}
    unavailable('Модуль оплаты не загрузился. Обновите страницу.','Оплата');
  }

  function openQuickNotes(){
    if(window.DiagnostikaQuickNotes?.open){window.DiagnostikaQuickNotes.open();return;}
    document.dispatchEvent(new CustomEvent('diagnostika:quick-notes-open'));
  }

  let clientMenu=null;
  let clientMenuButton=null;
  let upcomingTooltip=null;

  function ensureUpcomingTooltip(){
    if(upcomingTooltip)return upcomingTooltip;
    upcomingTooltip=document.createElement('div');
    upcomingTooltip.className='hd-upcoming-tooltip';
    upcomingTooltip.hidden=true;
    upcomingTooltip.setAttribute('role','tooltip');
    document.body.appendChild(upcomingTooltip);
    return upcomingTooltip;
  }

  function hideUpcomingTooltip(){
    if(upcomingTooltip)upcomingTooltip.hidden=true;
  }

  function showUpcomingTooltip(dot){
    const text=dot?.dataset?.tooltip||'';
    if(!text)return;
    const tooltip=ensureUpcomingTooltip();
    const kind=dot?.dataset?.kind||'neutral';
    tooltip.className=`hd-upcoming-tooltip is-${kind}`;
    tooltip.textContent=text;
    tooltip.hidden=false;
    const rect=dot.getBoundingClientRect();
    const box=tooltip.getBoundingClientRect();
    let left=rect.left-box.width-10;
    if(left<8)left=rect.right+10;
    left=Math.max(8,Math.min(window.innerWidth-box.width-8,left));
    let top=rect.top+(rect.height-box.height)/2;
    top=Math.max(8,Math.min(window.innerHeight-box.height-8,top));
    tooltip.style.left=Math.round(left)+'px';
    tooltip.style.top=Math.round(top)+'px';
  }

  function bindUpcomingTooltip(dot){
    if(!dot)return;
    dot.addEventListener('mouseenter',()=>showUpcomingTooltip(dot));
    dot.addEventListener('mouseleave',hideUpcomingTooltip);
    dot.addEventListener('focus',()=>showUpcomingTooltip(dot));
    dot.addEventListener('blur',hideUpcomingTooltip);
  }

  function closeClientMenu(){
    if(clientMenu)clientMenu.hidden=true;
    if(clientMenuButton)clientMenuButton.setAttribute('aria-expanded','false');
    clientMenuButton=null;
  }

  function ensureClientMenu(){
    if(clientMenu)return clientMenu;
    clientMenu=document.createElement('div');
    clientMenu.className='hd-client-menu';
    clientMenu.hidden=true;
    clientMenu.setAttribute('role','menu');
    document.body.appendChild(clientMenu);
    return clientMenu;
  }

  function placeClientMenu(button){
    if(!clientMenu||!button)return;
    const rect=button.getBoundingClientRect();
    const width=clientMenu.offsetWidth||210;
    const left=Math.max(8,Math.min(window.innerWidth-width-8,rect.right-width));
    const top=Math.min(window.innerHeight-(clientMenu.offsetHeight||48)-8,rect.bottom+6);
    clientMenu.style.left=`${left}px`;
    clientMenu.style.top=`${Math.max(8,top)}px`;
  }

  function openClientMenu(c,button){
    const api=clientsApi();
    if(!api?.pin||!api?.unpin||!api?.isPinned){
      unavailable('Модуль закрепления клиентов не загрузился. Обновите страницу.','Клиенты');
      return;
    }

    const menu=ensureClientMenu();
    const pinned=api.isPinned(c.id);
    closeClientMenu();
    clientMenuButton=button;
    button.setAttribute('aria-expanded','true');
    menu.innerHTML=`<button type="button" class="hd-client-menu-item" role="menuitem"><span class="hd-client-menu-icon">📌</span><span>${pinned?'Открепить клиента':'Закрепить клиента'}</span></button>`;
    menu.hidden=false;
    placeClientMenu(button);

    menu.querySelector('.hd-client-menu-item').onclick=e=>{
      e.stopPropagation();
      const result=pinned
        ? api.unpin(c.id,{source:'home-dashboard-unpin'})
        : api.pin(c.id,{source:'home-dashboard-pin'});
      closeClientMenu();
      if(!result?.ok){
        if(result?.reason==='limit'){
          unavailable(`Можно закрепить не больше ${result.limit||10} клиентов. Сначала открепите одного из уже закреплённых.`,'Закрепление клиентов');
        }else{
          unavailable('Не удалось изменить закрепление клиента.','Закрепление клиентов');
        }
        return;
      }
      renderClients();
    };
  }

  function matchesClientFilter(c){
    if(clientFilter==='new')return isNewClient(c);
    if(clientFilter==='upcoming')return hasUpcomingInteraction(c,7);
    if(clientFilter==='unpaid')return unpaidSessionCount(c)>0;
    return true;
  }

  function syncClientFilterButtons(){
    for(const button of filterButtons){
      const active=button.dataset.filter===clientFilter;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    }
  }

  function setClientFilter(next){
    clientFilter=clientFilter===next?'all':next;
    try{
      if(clientFilter==='all')localStorage.removeItem(CLIENT_FILTER_KEY);
      else localStorage.setItem(CLIENT_FILTER_KEY,clientFilter);
    }catch(_){}
    syncClientFilterButtons();
    renderClients();
  }

  function renderClients(){
    const q=(search.value||'').trim().toLowerCase();
    const all=allClients();
    const activeId=currentClientId();
    const pinOrder=clientsApi()?.pinnedIds?.()||[];
    const pinRank=new Map(pinOrder.map((id,index)=>[String(id),index]));
    const clients=all
      .map((c,index)=>{
        const id=String(c.id);
        const pinned=pinRank.has(id);
        return {
          c,
          index,
          pinned,
          pinRank:pinned?pinRank.get(id):Number.POSITIVE_INFINITY,
          nextAt:nextInteractionTime(c)
        };
      })
      .filter(({c})=>{
        if(!matchesClientFilter(c))return false;
        if(!q)return true;
        return [c.name,c.city,c.phone,c.email].some(v=>String(v||'').toLowerCase().includes(q));
      })
      .sort((a,b)=>{
        if(a.pinned!==b.pinned)return a.pinned?-1:1;
        if(a.nextAt!==b.nextAt)return a.nextAt-b.nextAt;
        if(a.pinned&&a.pinRank!==b.pinRank)return a.pinRank-b.pinRank;
        return a.index-b.index;
      })
      .map(({c})=>c);
    list.innerHTML='';
    if(!clients.length) list.innerHTML='<div class="hd-empty-list">Ничего не найдено</div>';
    clients.forEach(c=>{
      const row=document.createElement('div');
      row.className='hd-client-row'+(dashboardView==='client'&&String(c.id)===String(activeId)?' active':'');
      row.dataset.id=c.id;
      const avatar=c.photoData?`<div class="hd-avatar"><img src="${esc(c.photoData)}" alt=""></div>`:`<div class="hd-avatar">${esc(initials(c.name))}</div>`;
      const unpaid=unpaidSessionCount(c);
      const flag=unpaid?`<span class="hd-unpaid-flag" aria-label="Есть неоплаченные сессии" title="Есть неоплаченные сессии">⚑</span>`:'';
      const newClient=isNewClient(c);
      const upcomingInfo=nextUpcomingInteraction(c);
      const upcoming=!!upcomingInfo&&upcomingInfo.time<Date.now()+7*24*60*60*1000;
      const upcomingText=upcoming?upcomingInteractionLabel(upcomingInfo):'';
      const upcomingKind=upcoming?upcomingBeaconKind(upcomingInfo.event):'neutral';
      const upcomingDot=upcoming?`<span class="hd-upcoming-session-dot is-${upcomingKind}" tabindex="0" aria-label="Ближайшая запись: ${esc(upcomingText)}" data-kind="${upcomingKind}" data-tooltip="${esc(upcomingText)}"></span>`:'';
      const reminderInfo=nextUpcomingReminder(c);
      const reminderIsTop=!!reminderInfo&&upcoming&&upcomingBeaconKind(upcomingInfo.event)==='reminder'
        &&(reminderInfo.event===upcomingInfo.event||(reminderInfo.event?.id&&String(reminderInfo.event.id)===String(upcomingInfo.event?.id||'')));
      const reminderText=reminderInfo?upcomingInteractionLabel(reminderInfo):'';
      const reminderDot=reminderInfo&&!reminderIsTop
        ?`<span class="hd-upcoming-session-dot is-reminder" tabindex="0" aria-label="Напоминание: ${esc(reminderText)}" data-kind="reminder" data-tooltip="${esc(reminderText)}"></span>`
        :'';
      const pinned=pinRank.has(String(c.id));
      const pin=pinned?`<span class="hd-client-pin" aria-label="Закреплённый клиент" title="Закреплён">📌</span>`:'';
      row.classList.toggle('pinned',pinned);
      row.classList.toggle('new-client',newClient);
      row.innerHTML=`${avatar}<div class="hd-client-info"><div class="hd-client-name">${esc(c.name||'Без имени')}</div><div class="hd-client-meta">${esc(clientMeta(c))}</div></div><div class="hd-client-tools"><span class="hd-client-pin-cell">${pin}</span><span class="hd-client-status-stack" aria-label="Статусы клиента"><span class="hd-client-status-slot hd-client-status-top">${upcomingDot}</span><span class="hd-client-status-slot hd-client-status-middle">${reminderDot}</span><span class="hd-client-status-slot hd-client-status-bottom">${flag}</span></span><button class="hd-client-more" type="button" title="Действия с клиентом" aria-haspopup="menu" aria-expanded="false">⋮</button></div>`;
      row.onclick=e=>{if(e.target.closest('.hd-client-more'))return;selectClient(c.id);};
      row.querySelector('.hd-client-more').onclick=e=>{e.stopPropagation();openClientMenu(c,e.currentTarget);};
      row.querySelectorAll('.hd-upcoming-session-dot').forEach(bindUpcomingTooltip);
      list.appendChild(row);
    });
    count.textContent=clientFilter==='all'
      ?`Клиентов: ${all.length}`
      :`Показано: ${clients.length} из ${all.length}`;
    document.dispatchEvent(new CustomEvent('diagnostika:dashboard-clients-rendered'));
  }

  function renderHero(){
    const c=currentClient();
    mainInner.classList.toggle('has-client',!!c);
    const meaningful=c&&!placeholderName(c.name);
    heroActions.innerHTML='';
    summary.innerHTML='';
    summary.hidden=true;
    renderHeroReminder(c);
    renderHeroVisual(c);
    renderHeroSocials(c);

    if(!c){
      heroTitle.textContent='Начните работу: выберите клиента слева или создайте нового';
      heroSub.textContent='Чтобы создать клиента, используйте кнопку «Новый клиент» слева.';
      return;
    }

    if(!meaningful){
      heroTitle.textContent='Новый клиент';
      heroSub.textContent='Заполните карточку клиента. После сохранения здесь появятся его данные.';
      const card=document.createElement('button');card.className='hd-primary';card.type='button';card.textContent='Заполнить карточку клиента';card.onclick=openCard;heroActions.appendChild(card);
      return;
    }

    heroTitle.textContent=c.name;
    heroSub.textContent=clientMeta(c);
    const card=document.createElement('button');card.className='hd-secondary';card.type='button';card.textContent='Карточка клиента';card.onclick=openCard;
    heroActions.append(card);

    const currentReq=requestsApi()?.current?.()||(c.requests||[])[0]||null;
    const lastSession=(c.sessions||[]).filter(s=>!(s?.planned===true||String(s?.status||'')==='planned')).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))[0];
    const desiredResults=(currentReq?.situations||[]).map(s=>String(s.result||'').trim()).filter(Boolean);
    const desiredResult=desiredResults.length?desiredResults[desiredResults.length-1]:'Не указан';
    const items=[
      ['Текущий запрос',currentReq?.title||'Не указан','hd-summary-current'],
      ['Сессии',String((c.sessions||[]).length),'hd-summary-sessions'],
      ['Последняя сессия',formatRuDate(lastSession?.date),'hd-summary-last'],
      ['Желаемый результат',desiredResult,'hd-summary-result']
    ];
    summary.innerHTML=items.map(([a,b,cls])=>`<div class="hd-summary-box ${cls}"><div class="hd-summary-label">${esc(a)}</div><div class="hd-summary-value">${esc(b)}</div></div>`).join('');
    summary.hidden=false;
  }

  function syncVisibility(){
    const diagnosis=mode==='diagnosis';
    dashboard.hidden=diagnosis;
    diagnosisWorkspace.hidden=!diagnosis;
  }

  function refresh(){
    syncDashboardView();
    renderClients();
    if(dashboardView==='client')renderHero();
    syncVisibility();
  }

  syncClientFilterButtons();
  for(const button of filterButtons)button.addEventListener('click',()=>setClientFilter(button.dataset.filter));
  search.addEventListener('input',renderClients);
  $('#hdOpenNotes').onclick=openQuickNotes;
  $('#hdPlanBtn').onclick=openQuickNotes;

  const homeTrigger=header.querySelector('h1');
  if(homeTrigger){
    homeTrigger.classList.add('hd-home-trigger');
    homeTrigger.setAttribute('role','button');
    homeTrigger.setAttribute('tabindex','0');
    homeTrigger.setAttribute('title','На главную');
    homeTrigger.onclick=showHome;
    homeTrigger.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();showHome();}
    });
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.hd-client-menu')||e.target?.closest?.('.hd-client-more'))return;
    closeClientMenu();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeClientMenu();});
  list.addEventListener('scroll',()=>{closeClientMenu();hideUpcomingTooltip();},{passive:true});
  window.addEventListener('resize',()=>{closeClientMenu();hideUpcomingTooltip();},{passive:true});

  const dashboardEvents=[
    'client:created','client:selected','client:updated','client:deleted','client:restored','client:purged',
    'request:created','request:selected','request:activated','request:completed','request:resumed',
    'session:created','session:updated','session:deleted',
    'calendar:event-created','calendar:event-updated','calendar:event-deleted','calendar:events-replaced',
    'payment:updated','payment:added','payment:deleted','session-payment:updated'
  ];
  let eventBusBound=false;
  function bindPlatformEvents(){
    if(eventBusBound)return true;
    const events=window.DiagnostikaPlatform?.events;
    if(!events?.on)return false;
    for(const type of dashboardEvents)events.on(type,detail=>{
      if(type==='client:selected'&&detail?.source!=='last-client-restore'){
        dashboardView='client';
      }
      setTimeout(refresh,0);
    });
    eventBusBound=true;
    return true;
  }
  bindPlatformEvents();
  window.addEventListener('diagnostika:platform-core-ready',bindPlatformEvents,{once:true});

  if(typeof renderMode==='function'){
    const prev=renderMode;
    renderMode=function(){const out=prev.apply(this,arguments);setTimeout(syncVisibility,0);return out;};
  }

  document.addEventListener('close',e=>{
    if(e.target?.matches?.('dialog.session-edit-dialog,dialog.payment-dialog'))setTimeout(renderClients,0);
  },true);

  window.DiagnostikaHomeDashboard={refresh,renderClients,openCard,openClientDatabase,showHome,openClient:selectClient,currentView:()=>dashboardView};

  showHome();
})();
