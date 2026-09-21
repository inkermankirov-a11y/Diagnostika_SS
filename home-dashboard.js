'use strict';

(() => {
  const diagnosisWorkspace=document.getElementById('diagnosisWorkspace');
  const header=document.querySelector('.app-header');
  if(!diagnosisWorkspace||!header||document.querySelector('.home-dashboard')) return;

  const dashboard=document.createElement('section');
  dashboard.className='home-dashboard';
  dashboard.innerHTML=`
    <aside class="hd-sidebar hd-card">
      <div class="hd-side-title"><span>Клиенты</span><span aria-hidden="true">⌕</span></div>
      <div class="hd-search"><input id="hdClientSearch" type="search" placeholder="Поиск по клиентам…" autocomplete="off"></div>
      <button id="hdAddClient" class="hd-add-client" type="button">＋ Новый клиент</button>
      <div id="hdClientList" class="hd-client-list"></div>
      <div id="hdClientCount" class="hd-client-count"></div>
    </aside>

    <main class="hd-main hd-card">
      <div class="hd-main-inner">
        <div class="hd-hero-icon" aria-hidden="true"></div>
        <h2 id="hdHeroTitle">Начните работу: выберите клиента слева или создайте нового</h2>
        <div id="hdHeroSub" class="hd-main-sub">Здесь будет отображаться карточка клиента, история работы, результаты диагностики и другие данные.</div>
        <div id="hdHeroActions" class="hd-client-actions"></div>
        <div id="hdSummary" class="hd-selected-summary" hidden></div>
        <div class="hd-features">
          <div class="hd-feature"><div class="hd-feature-icon">♙</div>Храните историю<br>клиентов</div>
          <div class="hd-feature"><div class="hd-feature-icon">▥</div>Проводите<br>диагностику</div>
          <div class="hd-feature"><div class="hd-feature-icon">▤</div>Делайте заметки<br>и планируйте работу</div>
        </div>
      </div>
    </main>

    <aside class="hd-right">
      <section class="hd-widget hd-card">
        <div class="hd-widget-title"><span>🚀</span><span>Быстрый старт</span></div>
        <div class="hd-step"><div class="hd-step-num">1</div><div><strong>Создайте клиента</strong>Добавьте нового или выберите существующего.</div></div>
        <div class="hd-step"><div class="hd-step-num">2</div><div><strong>Заполните карточку</strong>Основные данные и контакты клиента.</div></div>
        <div class="hd-step"><div class="hd-step-num">3</div><div><strong>Сформулируйте запрос</strong>Зафиксируйте текущий запрос клиента.</div></div>
        <div class="hd-step"><div class="hd-step-num">4</div><div><strong>Проведите диагностику</strong>Перейдите к рабочей схеме диагностики.</div></div>
        <div class="hd-step"><div class="hd-step-num">5</div><div><strong>Зафиксируйте следующий шаг</strong>Сессия, заметка или дальнейшая работа.</div></div>
      </section>

      <section class="hd-widget hd-card">
        <div class="hd-widget-title"><span>▤</span><span>Заметки</span></div>
        <div id="hdOpenNotes" class="hd-note-box">Здесь будут ваши быстрые заметки. Нажмите, чтобы открыть заметки и записать идею или важную мысль.</div>
      </section>

      <section class="hd-widget hd-card">
        <div class="hd-widget-title"><span>▣</span><span>Следующий шаг</span></div>
        <div class="hd-next-box"><strong>Нет запланированных задач</strong>После работы с клиентом здесь можно зафиксировать следующий шаг.<br><button id="hdPlanBtn" class="hd-plan-btn" type="button">＋ Запланировать</button></div>
      </section>
    </aside>`;
  header.insertAdjacentElement('afterend',dashboard);

  const $=s=>dashboard.querySelector(s);
  const list=$('#hdClientList');
  const search=$('#hdClientSearch');
  const count=$('#hdClientCount');
  const heroIcon=$('.hd-hero-icon');
  const heroTitle=$('#hdHeroTitle');
  const heroSub=$('#hdHeroSub');
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
  const clientsApi=()=>window.DiagnostikaClients||null;
  const requestsApi=()=>window.DiagnostikaRequests||null;
  const allClients=()=>clientsApi()?.list?.()||[];
  const currentClient=()=>clientsApi()?.current?.()||null;
  const currentClientId=()=>clientsApi()?.currentId?.()||null;

  function unavailable(message,title='Ошибка'){
    if(window.AppDialog?.alert){window.AppDialog.alert(message,title);return;}
    window.alert(message);
  }

  function unpaidSessionCount(c){
    if(!c||!Array.isArray(c.sessions))return 0;
    const requests=Array.isArray(c.requests)?c.requests:[];
    const sessionModeRequests=requests.filter(r=>r?.payment?.mode==='session');
    return c.sessions.filter(s=>{
      if(s?.payment?.paid===true)return false;
      const linkedId=s?.payment?.requestId||s?.requestId||'';
      const linked=requests.find(r=>r.id===linkedId)||null;
      if(linked?.payment?.mode==='session')return true;
      if(s?.payment&&('paid' in s.payment||Number(s.payment.amount)>0||s.payment.manualAmount))return true;
      if(!linkedId&&sessionModeRequests.length===1)return true;
      return false;
    }).length;
  }

  function isNewClient(c){
    return !!c && (!Array.isArray(c.sessions) || c.sessions.length===0);
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
    if(clientsApi()?.select?.(id)){refresh();return;}
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

  function renderClients(){
    const q=(search.value||'').trim().toLowerCase();
    const all=allClients();
    const activeId=currentClientId();
    const pinOrder=clientsApi()?.pinnedIds?.()||[];
    const pinRank=new Map(pinOrder.map((id,index)=>[String(id),index]));
    const clients=all
      .map((c,index)=>({c,index}))
      .filter(({c})=>{
        if(!q)return true;
        return [c.name,c.city,c.phone,c.email].some(v=>String(v||'').toLowerCase().includes(q));
      })
      .sort((a,b)=>{
        const ar=pinRank.has(String(a.c.id))?pinRank.get(String(a.c.id)):Number.POSITIVE_INFINITY;
        const br=pinRank.has(String(b.c.id))?pinRank.get(String(b.c.id)):Number.POSITIVE_INFINITY;
        if(ar!==br)return ar-br;
        return a.index-b.index;
      })
      .map(({c})=>c);
    list.innerHTML='';
    if(!clients.length) list.innerHTML='<div class="hd-empty-list">Ничего не найдено</div>';
    clients.forEach(c=>{
      const row=document.createElement('div');
      row.className='hd-client-row'+(c.id===activeId?' active':'');
      row.dataset.id=c.id;
      const avatar=c.photoData?`<div class="hd-avatar"><img src="${esc(c.photoData)}" alt=""></div>`:`<div class="hd-avatar">${esc(initials(c.name))}</div>`;
      const unpaid=unpaidSessionCount(c);
      const flag=unpaid?`<span class="hd-unpaid-flag" aria-label="Есть неоплаченные сессии" title="Есть неоплаченные сессии">⚑</span>`:'';
      const newClientDot=isNewClient(c)?`<span class="hd-new-client-dot" aria-label="Новый клиент" title="Новый клиент"></span>`:'';
      const pinned=pinRank.has(String(c.id));
      const pin=pinned?`<span class="hd-client-pin" aria-label="Закреплённый клиент" title="Закреплён">📌</span>`:'';
      row.classList.toggle('pinned',pinned);
      row.innerHTML=`${avatar}<div><div class="hd-client-name">${esc(c.name||'Без имени')}</div><div class="hd-client-meta">${esc(clientMeta(c))}</div></div><div class="hd-client-tools">${pin}${newClientDot}${flag}<button class="hd-client-more" type="button" title="Действия с клиентом" aria-haspopup="menu" aria-expanded="false">⋮</button></div>`;
      row.onclick=e=>{if(e.target.closest('.hd-client-more'))return;selectClient(c.id);};
      row.querySelector('.hd-client-more').onclick=e=>{e.stopPropagation();openClientMenu(c,e.currentTarget);};
      list.appendChild(row);
    });
    count.textContent=`Клиентов: ${all.length}`;
  }

  function renderHero(){
    const c=currentClient();
    const meaningful=c&&!placeholderName(c.name);
    heroActions.innerHTML='';
    summary.innerHTML='';
    summary.hidden=true;
    renderHeroVisual(c);

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
    const diag=document.createElement('button');diag.className='hd-primary';diag.type='button';diag.textContent='Диагностика';diag.onclick=openDiagnosis;
    const payment=document.createElement('button');payment.className='hd-secondary hd-payment-btn';payment.type='button';payment.textContent='Оплата';payment.onclick=openPayment;
    heroActions.append(card,diag,payment);

    const currentReq=requestsApi()?.current?.()||(c.requests||[])[0]||null;
    const lastSession=(c.sessions||[]).slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))[0];
    const desiredResults=(currentReq?.situations||[]).map(s=>String(s.result||'').trim()).filter(Boolean);
    const desiredResult=desiredResults.length?desiredResults[desiredResults.length-1]:'Не указан';
    const items=[
      ['Текущий запрос',currentReq?.title||'Не указан','wide'],
      ['Сессии',String((c.sessions||[]).length),''],
      ['Последняя сессия',lastSession?.date||'—',''],
      ['Желаемый итог',desiredResult,'wide']
    ];
    summary.innerHTML=items.map(([a,b,cls])=>`<div class="hd-summary-box ${cls==='wide'?'hd-summary-wide':''}"><div class="hd-summary-label">${esc(a)}</div><div class="hd-summary-value">${esc(b)}</div></div>`).join('');
    summary.hidden=false;
  }

  function syncVisibility(){
    const diagnosis=mode==='diagnosis';
    dashboard.hidden=diagnosis;
    diagnosisWorkspace.hidden=!diagnosis;
  }

  function refresh(){renderClients();renderHero();syncVisibility();}

  $('#hdAddClient').onclick=addClient;
  search.addEventListener('input',renderClients);
  $('#hdOpenNotes').onclick=openQuickNotes;
  $('#hdPlanBtn').onclick=openQuickNotes;

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.hd-client-menu')||e.target?.closest?.('.hd-client-more'))return;
    closeClientMenu();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeClientMenu();});
  list.addEventListener('scroll',closeClientMenu,{passive:true});
  window.addEventListener('resize',closeClientMenu,{passive:true});

  const dashboardEvents=[
    'client:created','client:selected','client:updated','client:deleted','client:restored','client:purged',
    'request:created','request:selected','request:activated','request:completed','request:resumed',
    'session:created','session:updated',
    'payment:updated','payment:added','payment:deleted','session-payment:updated'
  ];
  let eventBusBound=false;
  function bindPlatformEvents(){
    if(eventBusBound)return true;
    const events=window.DiagnostikaPlatform?.events;
    if(!events?.on)return false;
    for(const type of dashboardEvents)events.on(type,()=>setTimeout(refresh,0));
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

  window.DiagnostikaHomeDashboard={refresh,renderClients,openCard,addClient,openClientDatabase};

  refresh();
})();
