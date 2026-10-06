'use strict';

(() => {
  const dashboard=document.querySelector('.home-dashboard');
  if(!dashboard) return;

  const features=dashboard.querySelector('.hd-features');
  if(features) features.remove();

  const summary=dashboard.querySelector('#hdSummary');
  const host=dashboard.querySelector('.hd-main-inner');
  if(!host) return;

  let section=dashboard.querySelector('.hd-sessions-section');
  if(!section){
    section=document.createElement('section');
    section.className='hd-sessions-section';
    if(summary) summary.insertAdjacentElement('afterend',section); else host.appendChild(section);
  }

  section.innerHTML=`
    <div class="hd-sessions-head">
      <div>
        <div class="hd-sessions-title">Сессии</div>
        <div id="hdSessionsCount" class="hd-sessions-count"></div>
      </div>
      <div class="hd-sessions-actions">
        <button id="hdSessionArchive" class="hd-secondary hd-session-archive-btn" type="button">Архив сессий</button>
        <button id="hdAddSession" class="hd-primary hd-add-session" type="button">＋ Добавить сессию</button>
      </div>
    </div>
    <div id="hdSessionsList" class="hd-sessions-list"></div>
  `;

  const list=section.querySelector('#hdSessionsList');
  const count=section.querySelector('#hdSessionsCount');
  const add=section.querySelector('#hdAddSession');
  const archiveBtn=section.querySelector('#hdSessionArchive');

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const getClient=()=>window.DiagnostikaClients?.current?.()||null;
  const sessionRequestId=s=>String(s?.requestId||s?.payment?.requestId||'');

  function sessionsApi(){
    return window.DiagnostikaSessions?.moduleAware===true
      ? window.DiagnostikaSessions
      : window.DiagnostikaPlatform?.services?.sessions||null;
  }

  function createSession(c,r){
    const api=sessionsApi();
    if(!c||!r||!api?.create)return null;
    return api.create(
      {notes:''},
      {client:c,requestId:r.id,source:'home-dashboard-session-create'}
    );
  }

  function currentRequest(c){
    if(!c)return null;
    try{
      const r=window.DiagnostikaRequests?.current?.(c);
      if(r)return r;
    }catch(_){}
    try{
      if(typeof requestId!=='undefined'&&requestId){
        const r=(c.requests||[]).find(x=>String(x.id)===String(requestId));
        if(r)return r;
      }
    }catch(_){}
    return (c.requests||[]).find(r=>String(r.id)===String(c.currentRequestId||''))||(c.requests||[])[0]||null;
  }

  function requestForSession(c,s){
    const id=sessionRequestId(s);
    return (c?.requests||[]).find(r=>String(r.id)===id)||null;
  }

  function requestName(c,s){
    return requestForSession(c,s)?.title||'Без связи с запросом';
  }

  function belongsTo(s,r){
    return !!r&&sessionRequestId(s)===String(r.id);
  }

  function isPlannedSession(s){
    return !!s&&(s.planned===true||String(s.status||'')==='planned');
  }

  function appointmentLabel(s){
    const raw=String(s?.appointmentType||s?.calendarTitle||'').trim();
    return raw||'Сессия';
  }

  function appointmentTitle(s,number){
    return `${appointmentLabel(s)} №${number}`;
  }

  function calendarApi(){
    return window.DiagnostikaCalendar?.moduleAware===true
      ?window.DiagnostikaCalendar
      :window.DiagnostikaPlatform?.services?.calendar||null;
  }

  function scheduledTimeValue(s){
    const rawDate=String(s?.date||'').trim();
    if(!rawDate)return NaN;
    const iso=rawDate.slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(iso)){
      const [year,month,day]=iso.split('-').map(Number);
      const match=String(s?.scheduledTime||'').trim().match(/^(\d{1,2}):(\d{2})/);
      const hour=match?Number(match[1]):23;
      const minute=match?Number(match[2]):59;
      return new Date(year,month-1,day,hour,minute,match?0:59,match?0:999).getTime();
    }
    const parsed=Date.parse(rawDate);
    return Number.isFinite(parsed)?parsed:NaN;
  }

  function isOverduePlanned(s,now=Date.now()){
    if(!isPlannedSession(s))return false;
    const at=scheduledTimeValue(s);
    return Number.isFinite(at)&&at<now;
  }

  async function confirmAction(message,title='Подтверждение',ok='Продолжить'){
    if(window.AppDialog?.confirm)return window.AppDialog.confirm(message,title,ok,'Отмена');
    return window.confirm(`${title}\n\n${message}`);
  }

  async function markConducted(c,s){
    if(!c||!s||!isPlannedSession(s))return false;
    const ok=await confirmAction(
      `Отметить «${appointmentLabel(s)}» от ${scheduledLabel(s)} как проведённую?`,
      `${appointmentLabel(s)} проведена?`,
      'Да, проведена'
    );
    if(!ok)return false;

    const api=sessionsApi();
    if(!api?.update)return false;
    const completedAt=new Date().toISOString();
    const updated=api.update(s.id,{
      planned:false,
      status:'completed',
      completedAt,
      conductedAt:completedAt
    },{client:c,source:'home-dashboard-session-complete'});
    if(!updated)return false;

    if(s.calendarEventId){
      try{
        calendarApi()?.update?.(s.calendarEventId,{
          plannedSessionSkeleton:false,
          sessionCompleted:true,
          status:'completed',
          completedAt
        },{source:'home-dashboard-session-complete'});
      }catch(_){}
    }
    try{window.DiagnostikaCalendarSessionPlanning?.refresh?.();}catch(_){}
    render();
    return true;
  }

  async function deletePlanned(c,s,number){
    if(!c||!s)return false;
    const title=appointmentTitle(s,number);
    const ok=await confirmAction(
      `Удалить «${title}»? Будет удалена и связанная запись в календаре.`,
      'Удалить запись?',
      'Удалить'
    );
    if(!ok)return false;

    if(s.calendarEventId){
      try{calendarApi()?.remove?.(s.calendarEventId,{source:'home-dashboard-session-delete'});}catch(_){}
    }
    const api=sessionsApi();
    if(!api?.remove)return false;
    const removed=api.remove(s.id,{client:c,source:'home-dashboard-session-delete'});
    if(!removed)return false;

    try{window.DiagnostikaCalendarSessionPlanning?.refresh?.();}catch(_){}
    render();
    return true;
  }

  function reschedulePlanned(s){
    if(!s)return false;
    if(s.calendarEventId&&window.DiagnostikaCalendarUI?.openEvent){
      return window.DiagnostikaCalendarUI.openEvent(s.calendarEventId,{mode:'client'})!==false;
    }
    if(window.DiagnostikaCalendarUI?.open){
      window.DiagnostikaCalendarUI.open({mode:'client'});
      return true;
    }
    return false;
  }

  function formatRuDate(value,fallback='—'){
    const raw=String(value||'').trim();
    if(!raw)return fallback;
    const iso=raw.slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(iso)){
      const [year,month,day]=iso.split('-').map(Number);
      return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(year,month-1,day,12,0,0));
    }
    const d=new Date(raw);
    if(Number.isNaN(d.getTime()))return raw;
    return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
  }

  function scheduledLabel(s){
    const date=formatRuDate(s?.date,'Дата не указана');
    const time=String(s?.scheduledTime||'').trim();
    return time?`${date} • ${time}`:date;
  }

  function numberedSessions(c){
    const sessions=Array.isArray(c?.sessions)?c.sessions:[];
    const chronological=sessions
      .map((s,index)=>({s,index,time:typeof sessionTimeValue==='function'?sessionTimeValue(s,index):new Date(s.date||0).getTime()||index}))
      .sort((a,b)=>a.time-b.time||a.index-b.index);
    chronological.forEach((item,i)=>item.number=i+1);
    return chronological.reverse();
  }

  function openEditor(c,s,number){
    if(typeof openSessionEditor!=='function') return;
    try{if(typeof selectedSessionId!=='undefined') selectedSessionId=s.id;}catch(_){}
    openSessionEditor(c,s,number);
  }

  function updateDashboardSummary(c,r,currentItems){
    const sum=dashboard.querySelector('#hdSummary');
    if(!sum)return;
    const boxes=[...sum.querySelectorAll('.hd-summary-box')];
    const byLabel=label=>boxes.find(box=>(box.querySelector('.hd-summary-label')?.textContent||'').trim().toLowerCase()===label.toLowerCase());
    const conducted=currentItems.filter(item=>!isPlannedSession(item.s));
    const sessionsBox=byLabel('Сессии');
    if(sessionsBox){const v=sessionsBox.querySelector('.hd-summary-value');if(v)v.textContent=String(conducted.length);}
    const lastBox=byLabel('Последняя сессия');
    if(lastBox){
      const v=lastBox.querySelector('.hd-summary-value');
      if(v)v.textContent=formatRuDate(conducted[0]?.s?.date);
    }
    const reqBox=byLabel('Текущий запрос');
    if(reqBox&&r){const v=reqBox.querySelector('.hd-summary-value');if(v)v.textContent=r.title||'Не указан';}
  }

  function ensureArchiveDialog(){
    let dlg=document.querySelector('#hdSessionArchiveDialog');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');
    dlg.id='hdSessionArchiveDialog';
    dlg.className='hd-session-archive-dialog';
    dlg.innerHTML=`
      <div class="hd-session-archive-window">
        <div class="hd-session-archive-head">
          <div><strong>АРХИВ СЕССИЙ</strong><div class="hd-session-archive-sub">Сессии по другим запросам клиента</div></div>
          <button type="button" class="tk-btn hd-session-archive-close">×</button>
        </div>
        <div class="hd-session-archive-list"></div>
      </div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('.hd-session-archive-close').onclick=()=>dlg.close();
    dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
    return dlg;
  }

  function renderArchive(){
    const c=getClient(),r=currentRequest(c),dlg=ensureArchiveDialog(),root=dlg.querySelector('.hd-session-archive-list');
    if(!c){root.innerHTML='<div class="hd-sessions-empty">Клиент не выбран.</div>';return;}
    const archived=numberedSessions(c).filter(item=>!belongsTo(item.s,r));
    root.innerHTML='';
    if(!archived.length){
      root.innerHTML='<div class="hd-sessions-empty">Сессий по другим запросам нет.</div>';
      return;
    }
    archived.forEach(({s,number})=>{
      const req=requestForSession(c,s);
      const paid=Boolean(s?.payment?.paid);
      const row=document.createElement('article');
      row.className='hd-session-archive-row';
      row.tabIndex=0;
      row.innerHTML=`
        <div class="hd-session-archive-main">
          <strong>${esc(appointmentTitle(s,number))}</strong>
          <span>${esc(formatRuDate(s.date))}</span>
        </div>
        <div class="hd-session-archive-request">${esc(req?.title||'Без связи с запросом')}</div>
        <span class="hd-session-pay ${paid?'paid':'unpaid'}"><span class="hd-session-flag">⚑</span>${paid?'Оплачено':'Не оплачено'}</span>`;
      const open=()=>{dlg.close();openEditor(c,s,number);};
      row.onclick=open;
      row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
      root.appendChild(row);
    });
  }

  function emitSessionsRendered(){document.dispatchEvent(new CustomEvent('diagnostika:dashboard-sessions-rendered'));}

  function render(){
    const c=getClient();
    if(!c){
      section.hidden=true;
      emitSessionsRendered();
      return;
    }
    section.hidden=false;
    const r=currentRequest(c);
    const all=numberedSessions(c);
    const display=all;
    const plannedCount=display.filter(item=>isPlannedSession(item.s)).length;
    const overdueItems=display.filter(item=>isOverduePlanned(item.s));
    const conductedCount=display.length-plannedCount;
    count.textContent=display.length
      ?(plannedCount?`Всего: ${display.length} · Проведено: ${conductedCount} · Запланировано: ${plannedCount}`:`Всего: ${conductedCount}`)
      :'Сессий пока нет';
    archiveBtn.hidden=true;
    list.innerHTML='';
    updateDashboardSummary(c,r,display);


    if(!display.length){
      list.innerHTML='<div class="hd-sessions-empty">Сессий пока нет. Здесь будет вся история работы с клиентом.</div>';
      emitSessionsRendered();
      return;
    }

    display.forEach(({s,number})=>{
      const card=document.createElement('article');
      card.className='hd-session-card hd-session-card-openable';
      card.dataset.sessionId=String(s.id||'');
      card.tabIndex=0;
      card.title='Открыть и редактировать сессию';
      const planned=isPlannedSession(s);
      const overdue=isOverduePlanned(s);
      const type=appointmentLabel(s);
      const diagnosis=/диагност/i.test(type);
      card.classList.toggle('is-planned',planned);
      card.classList.toggle('is-diagnosis',diagnosis);
      card.classList.toggle('is-overdue',overdue);
      const notes=String(s.notes||'').trim();
      const plan=String(s.plan||'').trim();
      const req=requestForSession(c,s);
      const showPayment=!planned&&req?.payment?.mode==='session';
      const paid=Boolean(s?.payment?.paid);
      const paymentHtml=showPayment?`<span class="hd-session-pay ${paid?'paid':'unpaid'}"><span class="hd-session-flag">⚑</span>${paid?'Оплачено':'Не оплачено'}</span>`:'';
      const plannedHtml=planned
        ?`<span class="hd-session-planned-badge">● ЗАПЛАНИРОВАНО</span><span class="${overdue?'hd-session-overdue-badge':'hd-session-not-done'}">${overdue?'⚠ ПРОСРОЧЕНО':'НЕ ПРОВЕДЕНА'}</span>`
        :'';
      const typeHtml=planned&&type&&type!=='Сессия'?`<span class="hd-session-type">${esc(type)}</span>`:'';
      const plannedActions=planned
        ?`<div class="hd-session-card-actions"><button type="button" class="hd-session-complete-btn">✓ Проведена</button><button type="button" class="hd-session-reschedule-btn">Перенести</button><button type="button" class="hd-session-delete-planned-btn">Удалить</button></div>`
        :'';
      const bodyHtml=planned
        ?`<div class="hd-session-plan-label">ПЛАН НА СЕССИЮ</div><div class="hd-session-plan ${plan?'':'empty'}">${plan?esc(plan):'План пока не заполнен — откройте карточку и подготовьте его заранее.'}</div>${plannedActions}`
        :(notes?`<div class="hd-session-note-label">ЗАМЕТКА</div><div class="hd-session-note">${esc(notes)}</div>`:'<div class="hd-session-note hd-session-note-empty">Заметка не добавлена</div>');
      card.innerHTML=`
        <div class="hd-session-top">
          <strong>${esc(appointmentTitle(s,number))}</strong>
          ${plannedHtml}
          <span class="hd-session-date">${planned?(overdue?'Было назначено:':'Назначено:'):'◷'} ${esc(planned?scheduledLabel(s):formatRuDate(s.date))}</span>
          ${typeHtml}
          <span class="hd-session-request">• ${esc(requestName(c,s))}</span>
          ${paymentHtml}
          <span class="hd-session-edit-hint">${planned?'Открыть план':'Редактировать'}</span>
        </div>
        ${bodyHtml}
      `;
      card.querySelector('.hd-session-complete-btn')?.addEventListener('click',async e=>{
        e.preventDefault();e.stopPropagation();
        await markConducted(c,s);
      });
      card.querySelector('.hd-session-reschedule-btn')?.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        if(!reschedulePlanned(s))openEditor(c,s,number);
      });
      card.querySelector('.hd-session-delete-planned-btn')?.addEventListener('click',async e=>{
        e.preventDefault();e.stopPropagation();
        await deletePlanned(c,s,number);
      });
      card.addEventListener('click',e=>{
        if(e.target.closest('button,a,input,select,textarea,label')) return;
        openEditor(c,s,number);
      });
      card.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){e.preventDefault();openEditor(c,s,number);}
      });
      list.appendChild(card);
    });
    emitSessionsRendered();
  }

  archiveBtn.addEventListener('click',()=>{
    renderArchive();
    const dlg=ensureArchiveDialog();
    if(!dlg.open)dlg.showModal();
  });

  add.addEventListener('click',()=>{
    const c=getClient(),r=currentRequest(c);
    if(!c||!r)return;
    const fresh=createSession(c,r);
    if(!fresh){render();return;}
    const updated=getClient()||c;
    const numbered=numberedSessions(updated).find(x=>x.s===fresh||x.s.id===fresh.id);
    if(numbered)openEditor(updated,fresh,numbered.number);
  });

  document.addEventListener('click',e=>{
    if(e.target.closest('.hd-client-row,.hd-add-client,.request-current-btn,.request-resume-btn,.request-finish-btn'))setTimeout(render,20);
  },true);
  document.addEventListener('change',e=>{
    if(e.target?.id==='requestSelect')setTimeout(render,0);
  },true);
  document.addEventListener('close',e=>{
    if(e.target?.matches?.('dialog.session-edit-dialog'))setTimeout(render,0);
  },true);
  const events=window.DiagnostikaPlatform?.events;
  events?.on?.('session:created',render);
  events?.on?.('session:updated',render);
  events?.on?.('session:deleted',render);

  if(typeof renderClient==='function'){
    const prev=renderClient;
    if(!prev.__hdSessionsScoped){
      const wrapped=function(){const out=prev.apply(this,arguments);setTimeout(render,0);return out;};
      wrapped.__hdSessionsScoped=true;
      renderClient=wrapped;
    }
  }

  const hd=window.DiagnostikaHomeDashboard;
  if(hd?.refresh&&!hd.refresh.__hdSessionsScoped){
    const prev=hd.refresh;
    const wrapped=function(){const out=prev.apply(this,arguments);setTimeout(render,0);return out;};
    wrapped.__hdSessionsScoped=true;
    hd.refresh=wrapped;
  }

  const style=document.createElement('style');
  style.textContent=`
    .hd-sessions-section{width:100%;max-width:none;margin-top:24px;text-align:left;border:2px solid #b9d3ea;border-radius:17px;background:linear-gradient(145deg,#ffffff,#f8fbff);padding:18px;box-sizing:border-box;box-shadow:0 8px 22px rgba(31,71,122,.075),inset 0 1px 0 rgba(255,255,255,.98)}
    .hd-sessions-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px;padding-bottom:13px;border-bottom:1px solid #d7e5f2}
    .hd-sessions-title{font-size:22px;font-weight:900;color:#132747}
    .hd-sessions-count{margin-top:4px;font-size:13px;line-height:1.35;color:#536b89;font-weight:750}
    .hd-sessions-actions{display:flex;align-items:center;gap:8px}
    .hd-add-session,.hd-session-archive-btn{height:40px;padding:0 16px;font-size:13px}
    .hd-session-archive-btn{background:linear-gradient(#fff,#edf2f7)!important;color:#31536f!important;border:1px solid #c8d5e3!important}
    .hd-sessions-list{display:grid;gap:11px;width:100%}
    .hd-session-card{border:2px solid #d2e1f0;border-left:5px solid #6ea4ef;border-radius:12px;background:#fff;box-shadow:0 4px 12px rgba(31,71,122,.06);overflow:hidden;transition:.15s ease}
    .hd-session-card-openable{cursor:pointer}.hd-session-card-openable:hover{border-color:#9ec2f3;box-shadow:0 5px 14px rgba(31,71,122,.10);transform:translateY(-1px)}
    .hd-session-card.is-diagnosis{border-color:#f0c96b;border-left-color:#e5a20a;background:#fffdf4;box-shadow:0 4px 14px rgba(180,119,10,.09)}
    .hd-session-card.is-diagnosis .hd-session-top{background:linear-gradient(180deg,#fff9df,#fff4c5)}
    .hd-session-card.is-planned{border-color:#f0c96b;border-left-color:#f59e0b;background:#fffdf6;box-shadow:0 4px 14px rgba(180,119,10,.10)}
    .hd-session-card.is-planned:hover,.hd-session-card.is-diagnosis:hover{border-color:#e9b840;box-shadow:0 7px 20px rgba(180,119,10,.16)}
    .hd-session-card.is-overdue{border-color:#e68772;border-left-color:#d94b36;background:#fff9f7;box-shadow:0 5px 16px rgba(177,60,41,.12)}
    .hd-session-card.is-overdue:hover{border-color:#d86650;box-shadow:0 7px 20px rgba(177,60,41,.16)}
    .hd-session-card-openable:focus{outline:3px solid rgba(47,124,246,.16);outline-offset:2px}
    .hd-session-card.hd-session-focus-unpaid{border-color:#ef7777;border-left-color:#dc2626;box-shadow:0 0 0 3px rgba(220,38,38,.16),0 8px 22px rgba(185,28,28,.14);animation:hdSessionUnpaidFocus 1.1s ease-in-out 2}
    @keyframes hdSessionUnpaidFocus{0%,100%{box-shadow:0 0 0 3px rgba(220,38,38,.12),0 8px 22px rgba(185,28,28,.10)}50%{box-shadow:0 0 0 5px rgba(220,38,38,.22),0 10px 28px rgba(185,28,28,.18)}}
    .hd-session-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;background:#f5f9fe;color:#173154;font-size:13px}.hd-session-top strong{font-size:14px}
    .hd-session-card.is-planned .hd-session-top{background:linear-gradient(180deg,#fff8dd,#fff3c4)}
    .hd-session-date,.hd-session-request,.hd-session-type{padding:4px 9px;border:1px solid #dce8f5;border-radius:999px;background:#fff;color:#647b99;font-size:12px}
    .hd-session-card.is-planned .hd-session-date{border-color:#edc86f;background:#fffdf5;color:#7c5a12;font-weight:800}
    .hd-session-planned-badge{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:#f59e0b;color:#fff;font-size:10px;font-weight:900;letter-spacing:.04em;box-shadow:0 2px 6px rgba(180,119,10,.18)}
    .hd-session-not-done{padding:4px 8px;border:1px solid #e4b95c;border-radius:999px;background:#fff7db;color:#8a6212;font-size:10px;font-weight:900;letter-spacing:.04em}
    .hd-session-overdue-badge{padding:4px 8px;border:1px solid #d96b55;border-radius:999px;background:#df553d;color:#fff;font-size:10px;font-weight:900;letter-spacing:.04em;box-shadow:0 2px 6px rgba(175,55,35,.18)}
    .hd-session-type{border-color:#d7c8f4;background:#f6f0ff;color:#6d49a3;font-weight:800}
    .hd-session-pay{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;border:1px solid transparent;white-space:nowrap}.hd-session-pay.paid{background:#e9f8ef;color:#247a49;border-color:#bfe7ce}.hd-session-pay.unpaid{background:#fdecec;color:#b33a3a;border-color:#f1c3c3}.hd-session-flag{font-size:13px;line-height:1}
    .hd-session-card-actions{display:flex;gap:8px;padding:0 14px 13px}.hd-session-card-actions button{height:34px;border-radius:8px;padding:0 13px;font-size:12px;font-weight:850;cursor:pointer}.hd-session-complete-btn{border:1px solid #8fcca7;background:#eaf8ef;color:#287447}.hd-session-complete-btn:hover{background:#dff3e7}.hd-session-reschedule-btn{border:1px solid #c9d5e4;background:#fff;color:#36546f}.hd-session-reschedule-btn:hover{background:#f2f6fa}.hd-session-delete-planned-btn{border:1px solid #e4aaa2;background:#fff5f4;color:#a63b2c}.hd-session-delete-planned-btn:hover{background:#fde6e3}
    .hd-session-edit-hint{margin-left:auto;color:#2f70d4;font-size:12px;font-weight:800}.hd-session-note-label,.hd-session-plan-label{padding:11px 14px 0;color:#a17b55;font-size:10px;font-weight:800;letter-spacing:.08em}.hd-session-note,.hd-session-plan{padding:7px 14px 14px;color:#243a58;font-size:13px;line-height:1.45;white-space:pre-wrap}.hd-session-note-empty{color:#9aa9bc;font-style:italic;padding-top:13px}.hd-session-plan-label{color:#976a0a}.hd-session-plan{color:#654c17;font-weight:700}.hd-session-plan.empty{color:#a2854a;font-weight:600;font-style:italic}.hd-sessions-empty{min-height:68px;padding:20px 22px;border:2px dashed #b9cee3;border-radius:12px;text-align:center;color:#4e6482;background:linear-gradient(145deg,#ffffff,#f4f8fc);font-size:14px;line-height:1.45;font-weight:700;display:grid;place-items:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.96)}
    .hd-session-archive-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}.hd-session-archive-dialog::backdrop{background:rgba(15,23,42,.44);backdrop-filter:blur(5px)}.hd-session-archive-window{width:min(720px,calc(100vw - 24px));max-height:86vh;overflow:auto;background:#f8fafc;border:1px solid #d5dee8;border-radius:14px;box-shadow:0 24px 65px rgba(15,23,42,.28);padding:18px;box-sizing:border-box}.hd-session-archive-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.hd-session-archive-head strong{font-size:19px;color:#26384b}.hd-session-archive-sub{margin-top:3px;font-size:12px;color:#7b8ba0}.hd-session-archive-close{width:36px;height:36px;border-radius:8px!important;padding:0!important}.hd-session-archive-list{display:grid;gap:8px}.hd-session-archive-row{display:grid;grid-template-columns:150px 1fr auto;gap:12px;align-items:center;padding:11px 12px;border:1px solid #dbe4ed;border-radius:9px;background:#fff;cursor:pointer}.hd-session-archive-row:hover{background:#f8fbff}.hd-session-archive-main{display:grid;gap:3px}.hd-session-archive-main span{font-size:12px;color:#718198}.hd-session-archive-request{font-size:13px;color:#334155}
    @media(max-width:820px){.hd-sessions-section{padding:14px}.hd-sessions-head{align-items:stretch;flex-direction:column}.hd-sessions-actions{width:100%}.hd-sessions-actions button{flex:1}.hd-session-edit-hint{width:100%;margin-left:0}.hd-session-archive-row{grid-template-columns:1fr}.hd-session-pay{justify-self:start}}
  `;
  document.head.appendChild(style);

  function actionContext(sessionId){
    const c=getClient();
    const s=(c?.sessions||[]).find(item=>String(item?.id||'')===String(sessionId||''));
    if(!c||!s)return null;
    const numbered=numberedSessions(c).find(item=>String(item.s?.id||'')===String(s.id));
    return {c,s,number:numbered?.number||1};
  }

  async function completePlannedById(sessionId){
    const ctx=actionContext(sessionId);
    return ctx?markConducted(ctx.c,ctx.s):false;
  }

  function reschedulePlannedById(sessionId){
    const ctx=actionContext(sessionId);
    return ctx?reschedulePlanned(ctx.s):false;
  }

  async function deletePlannedById(sessionId){
    const ctx=actionContext(sessionId);
    return ctx?deletePlanned(ctx.c,ctx.s,ctx.number):false;
  }

  render();
  window.DiagnostikaDashboardSessions=Object.freeze({
    refresh:render,
    completePlanned:completePlannedById,
    reschedulePlanned:reschedulePlannedById,
    deletePlanned:deletePlannedById
  });
  window.dispatchEvent(new Event('diagnostika:dashboard-loaded'));
})();
