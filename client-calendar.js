'use strict';

(() => {
  if (document.getElementById('diagnostikaCalendarOverlay')) return;

  const MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const WEEK=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const pad=n=>String(n).padStart(2,'0');
  const iso=(y,m,d)=>`${y}-${pad(m+1)}-${pad(d)}`;
  const todayIso=()=>{const d=new Date();return iso(d.getFullYear(),d.getMonth(),d.getDate());};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));

  const style=document.createElement('style');
  style.textContent=`
    .cal-overlay{position:fixed;inset:0;z-index:30000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.58);backdrop-filter:blur(6px)}
    .cal-overlay[hidden]{display:none!important}
    .cal-panel{width:min(1040px,calc(100vw - 28px));max-height:92dvh;overflow:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:18px;box-shadow:0 28px 80px rgba(15,23,42,.38);padding:18px;box-sizing:border-box;color:#243447}
    .cal-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}.cal-head h2{margin:0;font-size:24px}.cal-close{width:40px;height:40px;padding:0!important;font-size:20px!important}
    .cal-toolbar{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;margin-bottom:12px}.cal-nav{display:flex;gap:7px}.cal-nav button,.cal-today{height:38px!important;padding:0 12px!important}.cal-month-title{text-align:center;font-size:20px;font-weight:900;color:#1e293b}
    .cal-layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(300px,.85fr);gap:16px;align-items:start}
    .cal-card{background:#fff;border:1px solid #d9e3ed;border-radius:14px;padding:12px;box-shadow:0 5px 18px rgba(15,23,42,.05)}
    .cal-week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px}.cal-week div{text-align:center;font-size:11px;font-weight:900;color:#64748b;padding:6px 0}.cal-week div:nth-child(6),.cal-week div:nth-child(7){color:#b45309}
    .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
    .cal-day{position:relative;min-height:92px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;padding:7px;box-sizing:border-box;cursor:pointer;transition:.14s ease;overflow:hidden}.cal-day:hover{border-color:#93b4dc;background:#f8fbff}.cal-day.out{opacity:.35;background:#f8fafc}.cal-day.selected{border-color:#2f80ed;box-shadow:0 0 0 2px rgba(47,128,237,.14);background:#f3f8ff}.cal-day.today{border-color:#40a36b}.cal-day.today .cal-num{background:#2f855a;color:#fff}
    .cal-num{width:27px;height:27px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:900;color:#243447}.cal-day-weekend .cal-num{color:#b45309}
    .cal-day-events{display:grid;gap:3px;margin-top:5px}.cal-chip{font-size:9px;line-height:1.2;padding:4px 5px;border-radius:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#e8f1ff;color:#215ca8;font-weight:800}.cal-chip.manual{background:#fff3d9;color:#9a5b00}.cal-more{font-size:9px;color:#64748b;font-weight:800;padding-left:3px}
    .cal-side-title{font-size:15px;font-weight:900;margin-bottom:4px}.cal-selected-date{font-size:12px;color:#64748b;margin-bottom:10px}.cal-events{display:grid;gap:7px;max-height:300px;overflow:auto;margin-bottom:12px}.cal-empty{padding:14px;border:1px dashed #d6dee8;border-radius:10px;text-align:center;color:#94a3b8;font-size:12px}.cal-event{display:grid;grid-template-columns:52px 1fr auto;gap:8px;align-items:start;padding:9px;border:1px solid #e0e7ef;border-radius:10px;background:#f8fafc}.cal-event-time{font-size:12px;font-weight:900;color:#334155}.cal-event-title{font-size:12px;font-weight:900;color:#1e293b}.cal-event-meta{font-size:10px;color:#64748b;margin-top:2px}.cal-delete{width:28px;height:28px!important;padding:0!important;font-size:13px!important;color:#b42318!important}
    .cal-form{border-top:1px solid #e2e8f0;padding-top:12px}.cal-form-title{font-size:13px;font-weight:900;margin-bottom:8px}.cal-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cal-form label{display:grid;gap:4px;font-size:10px;font-weight:800;color:#64748b}.cal-form input,.cal-form select,.cal-form textarea{width:100%;box-sizing:border-box;border:1px solid #c6d2df;border-radius:8px;background:#fff;padding:0 9px;font:600 12px 'Segoe UI',Arial,sans-serif;color:#243447}.cal-form input,.cal-form select{height:36px}.cal-form textarea{min-height:64px;padding-top:8px;resize:vertical}.cal-span2{grid-column:1/-1}.cal-save{width:100%;margin-top:9px;height:38px!important;background:linear-gradient(#48a873,#278656)!important;color:#fff!important;font-weight:900!important}
    @media(max-width:820px){.cal-layout{grid-template-columns:1fr}.cal-day{min-height:76px}.cal-panel{padding:12px}.cal-toolbar{grid-template-columns:1fr}.cal-month-title{order:-1}.cal-nav{justify-content:center}.cal-today{justify-self:center}}
    @media(max-width:560px){.cal-overlay{place-items:end center;padding:0}.cal-panel{width:100%;max-height:94dvh;border-radius:18px 18px 0 0}.cal-grid,.cal-week{gap:3px}.cal-day{min-height:62px;padding:4px}.cal-chip{display:none}.cal-more{display:none}.cal-num{width:24px;height:24px}.cal-form-grid{grid-template-columns:1fr}.cal-span2{grid-column:auto}}
  `;
  document.head.appendChild(style);

  const overlay=document.createElement('div');
  overlay.id='diagnostikaCalendarOverlay';
  overlay.className='cal-overlay';
  overlay.hidden=true;
  overlay.innerHTML=`
    <section class="cal-panel" role="dialog" aria-modal="true" aria-label="Календарь">
      <div class="cal-head"><h2>📅 Календарь</h2><button type="button" class="tk-btn cal-close">×</button></div>
      <div class="cal-toolbar">
        <div class="cal-nav"><button type="button" class="tk-btn cal-prev">←</button><button type="button" class="tk-btn cal-next">→</button></div>
        <div class="cal-month-title"></div>
        <button type="button" class="tk-btn cal-today">Сегодня</button>
      </div>
      <div class="cal-layout">
        <div class="cal-card">
          <div class="cal-week">${WEEK.map(x=>`<div>${x}</div>`).join('')}</div>
          <div class="cal-grid"></div>
        </div>
        <div class="cal-card cal-side">
          <div class="cal-side-title">Расписание на день</div>
          <div class="cal-selected-date"></div>
          <div class="cal-events"></div>
          <div class="cal-form">
            <div class="cal-form-title">+ Добавить запись</div>
            <div class="cal-form-grid">
              <label>Дата<input class="cal-date" type="date"></label>
              <label>Время<input class="cal-time" type="time" value="19:00"></label>
              <label class="cal-span2">Клиент<select class="cal-client"></select></label>
              <label class="cal-span2">Тип<select class="cal-type"><option>Сессия</option><option>Бесплатная консультация</option><option>Созвон</option><option>Напоминание</option><option>Другое</option></select></label>
              <label class="cal-span2">Комментарий<textarea class="cal-note" placeholder="Что запланировано"></textarea></label>
            </div>
            <button type="button" class="tk-btn cal-save">Сохранить запись</button>
          </div>
        </div>
      </div>
    </section>`;
  document.body.appendChild(overlay);

  const grid=overlay.querySelector('.cal-grid');
  const monthTitle=overlay.querySelector('.cal-month-title');
  const eventsBox=overlay.querySelector('.cal-events');
  const selectedDateLabel=overlay.querySelector('.cal-selected-date');
  const dateInput=overlay.querySelector('.cal-date');
  const timeInput=overlay.querySelector('.cal-time');
  const clientSelect=overlay.querySelector('.cal-client');
  const typeSelect=overlay.querySelector('.cal-type');
  const noteInput=overlay.querySelector('.cal-note');

  let cursor=new Date(); cursor.setDate(1);
  let selected=todayIso();

  function getState(){
    try{return typeof state!=='undefined'?state:null;}catch(_){return null;}
  }
  function clients(){
    const st=getState();
    return Array.isArray(st?.clients)?st.clients:[];
  }
  function customEvents(){
    const st=getState();
    if(!st)return [];
    if(!Array.isArray(st.calendarEvents))st.calendarEvents=[];
    return st.calendarEvents;
  }
  function requestName(c,s){
    const rid=s?.payment?.requestId||s?.requestId||'';
    const r=(c?.requests||[]).find(x=>String(x.id)===String(rid));
    return r?.title||'';
  }
  function allEvents(){
    const out=[];
    clients().forEach(c=>{
      (c.sessions||[]).forEach((s,i)=>{
        if(!s?.date)return;
        out.push({id:`session:${c.id}:${s.id||i}`,kind:'session',date:String(s.date).slice(0,10),time:s.time||s.startTime||'',title:`Сессия №${s.number||i+1}`,clientId:c.id,clientName:c.name||'Без имени',meta:requestName(c,s)});
      });
    });
    customEvents().forEach(e=>out.push({...e,kind:'manual'}));
    return out.sort((a,b)=>String(a.time||'99:99').localeCompare(String(b.time||'99:99'))||String(a.title||'').localeCompare(String(b.title||'')));
  }
  function eventsOn(date){return allEvents().filter(e=>e.date===date);}
  function currentClientId(){
    try{const c=typeof client==='function'?client():null;if(c?.id)return c.id;}catch(_){}
    try{if(typeof clientId!=='undefined'&&clientId)return clientId;}catch(_){}
    return '';
  }
  function fillClientOptions(){
    const current=currentClientId();
    clientSelect.innerHTML='<option value="">— Без клиента —</option>'+clients().map(c=>`<option value="${esc(c.id)}">${esc(c.name||'Без имени')}</option>`).join('');
    if(current&&clients().some(c=>String(c.id)===String(current)))clientSelect.value=String(current);
  }
  function humanDate(date){
    const d=new Date(date+'T12:00:00');
    return new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
  }

  function renderDayDetails(){
    selectedDateLabel.textContent=humanDate(selected);
    dateInput.value=selected;
    const evs=eventsOn(selected);
    eventsBox.innerHTML='';
    if(!evs.length){eventsBox.innerHTML='<div class="cal-empty">На этот день записей нет</div>';return;}
    evs.forEach(e=>{
      const row=document.createElement('div');
      row.className='cal-event';
      const meta=[e.clientName,e.meta,e.note].filter(Boolean).join(' • ');
      row.innerHTML=`<div class="cal-event-time">${esc(e.time||'—')}</div><div><div class="cal-event-title">${esc(e.title||e.type||'Запись')}</div><div class="cal-event-meta">${esc(meta)}</div></div>${e.kind==='manual'?'<button type="button" class="tk-btn cal-delete" title="Удалить">×</button>':''}`;
      if(e.kind==='manual')row.querySelector('.cal-delete').onclick=()=>{
        const arr=customEvents();
        const idx=arr.findIndex(x=>String(x.id)===String(e.id));
        if(idx>=0)arr.splice(idx,1);
        if(typeof save==='function')save();
        render();
      };
      eventsBox.appendChild(row);
    });
  }

  function renderMonth(){
    const y=cursor.getFullYear(),m=cursor.getMonth();
    monthTitle.textContent=`${MONTHS[m]} ${y}`;
    grid.innerHTML='';
    const first=new Date(y,m,1);
    const shift=(first.getDay()+6)%7;
    const start=new Date(y,m,1-shift);
    const today=todayIso();
    for(let i=0;i<42;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);
      const ds=iso(d.getFullYear(),d.getMonth(),d.getDate());
      const evs=eventsOn(ds);
      const cell=document.createElement('div');
      const weekend=((i%7)>=5);
      cell.className='cal-day'+(d.getMonth()!==m?' out':'')+(ds===selected?' selected':'')+(ds===today?' today':'')+(weekend?' cal-day-weekend':'');
      const chips=evs.slice(0,2).map(e=>`<div class="cal-chip ${e.kind==='manual'?'manual':''}">${esc((e.time?e.time+' ':'')+(e.clientName||e.title||''))}</div>`).join('');
      cell.innerHTML=`<div class="cal-num">${d.getDate()}</div><div class="cal-day-events">${chips}${evs.length>2?`<div class="cal-more">ещё ${evs.length-2}</div>`:''}</div>`;
      cell.onclick=()=>{selected=ds;if(d.getMonth()!==m)cursor=new Date(d.getFullYear(),d.getMonth(),1);render();};
      grid.appendChild(cell);
    }
  }

  function render(){fillClientOptions();renderMonth();renderDayDetails();}

  function openCalendar(){
    const now=new Date();
    selected=todayIso();
    cursor=new Date(now.getFullYear(),now.getMonth(),1);
    overlay.hidden=false;
    document.documentElement.style.overflow='hidden';
    render();
  }
  function closeCalendar(){overlay.hidden=true;document.documentElement.style.overflow='';}

  overlay.querySelector('.cal-close').onclick=closeCalendar;
  overlay.querySelector('.cal-prev').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);renderMonth();};
  overlay.querySelector('.cal-next').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);renderMonth();};
  overlay.querySelector('.cal-today').onclick=()=>{const n=new Date();selected=todayIso();cursor=new Date(n.getFullYear(),n.getMonth(),1);render();};
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeCalendar();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)closeCalendar();});

  overlay.querySelector('.cal-save').onclick=()=>{
    const date=dateInput.value||selected;
    const clientIdValue=clientSelect.value||'';
    const c=clients().find(x=>String(x.id)===String(clientIdValue));
    const type=typeSelect.value||'Запись';
    const note=noteInput.value.trim();
    const item={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random()),date,time:timeInput.value||'',clientId:clientIdValue,clientName:c?.name||'',type,title:type,note,createdAt:new Date().toISOString()};
    customEvents().push(item);
    if(typeof save==='function')save();
    noteInput.value='';
    selected=date;
    const d=new Date(date+'T12:00:00');cursor=new Date(d.getFullYear(),d.getMonth(),1);
    render();
  };

  function attach(){
    const btn=document.getElementById('ccCalendarBtn');
    if(!btn||btn.dataset.realCalendar==='1')return false;
    btn.dataset.realCalendar='1';
    btn.onclick=openCalendar;
    return true;
  }
  attach();
  const mo=new MutationObserver(()=>attach());
  mo.observe(document.body,{childList:true,subtree:true});

  window.DiagnostikaCalendar={open:openCalendar,refresh:render};
})();
