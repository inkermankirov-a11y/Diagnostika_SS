'use strict';

(() => {
  const oldWorkspace=document.querySelector('.workspace-grid');
  const header=document.querySelector('.app-header');
  if(!oldWorkspace||!header||document.querySelector('.home-dashboard')) return;

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
  const currentClient=()=>state?.clients?.find(c=>c.id===clientId)||null;

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
    clientId=id;requestId=null;situationId=null;selected=null;
    if(typeof renderClient==='function') renderClient();
    refresh();
  }

  function openCard(){
    if(window.DiagnostikaClientCard?.openExisting){window.DiagnostikaClientCard.openExisting();return;}
    document.getElementById('clientCardModeBtn')?.click();
  }

  function addClient(){
    if(window.DiagnostikaClientCard?.openNew){window.DiagnostikaClientCard.openNew();return;}
    document.getElementById('addClientBtn')?.click();
  }

  function openDiagnosis(){
    const c=currentClient();
    if(!c)return;
    mode='diagnosis';
    if(typeof renderMode==='function') renderMode();
  }

  function renderClients(){
    const q=(search.value||'').trim().toLowerCase();
    const clients=(state?.clients||[]).filter(c=>{
      if(!q)return true;
      return [c.name,c.city,c.phone,c.email].some(v=>String(v||'').toLowerCase().includes(q));
    });
    list.innerHTML='';
    if(!clients.length) list.innerHTML='<div class="hd-empty-list">Ничего не найдено</div>';
    clients.forEach(c=>{
      const row=document.createElement('div');
      row.className='hd-client-row'+(c.id===clientId?' active':'');
      row.dataset.id=c.id;
      const avatar=c.photoData?`<div class="hd-avatar"><img src="${esc(c.photoData)}" alt=""></div>`:`<div class="hd-avatar">${esc(initials(c.name))}</div>`;
      row.innerHTML=`${avatar}<div><div class="hd-client-name">${esc(c.name||'Без имени')}</div><div class="hd-client-meta">${esc(clientMeta(c))}</div></div><button class="hd-client-more" type="button" title="База клиентов">⋮</button>`;
      row.onclick=e=>{if(e.target.closest('.hd-client-more'))return;selectClient(c.id);};
      row.querySelector('.hd-client-more').onclick=e=>{e.stopPropagation();selectClient(c.id);document.getElementById('clientBaseBtn')?.click();};
      list.appendChild(row);
    });
    count.textContent=`Клиентов: ${(state?.clients||[]).length}`;
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
    heroActions.append(card,diag);

    const currentReq=(c.requests||[]).find(r=>r.id===requestId)||(c.requests||[])[0];
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
    oldWorkspace.style.display=diagnosis?'':'none';
  }

  function refresh(){renderClients();renderHero();syncVisibility();}

  $('#hdAddClient').onclick=addClient;
  search.addEventListener('input',renderClients);
  $('#hdOpenNotes').onclick=()=>document.getElementById('quickNotesBtn')?.click();
  $('#hdPlanBtn').onclick=()=>document.getElementById('quickNotesBtn')?.click();

  if(typeof renderClient==='function'){
    const prev=renderClient;
    renderClient=function(){const out=prev.apply(this,arguments);setTimeout(refresh,0);return out;};
  }
  if(typeof renderMode==='function'){
    const prev=renderMode;
    renderMode=function(){const out=prev.apply(this,arguments);setTimeout(syncVisibility,0);return out;};
  }

  const saveBtn=document.getElementById('saveClientBtn');
  if(saveBtn) saveBtn.hidden=true;

  refresh();
})();
