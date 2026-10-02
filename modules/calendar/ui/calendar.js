'use strict';

(() => {
  if (document.getElementById('diagnostikaCalendarOverlay')) return;

  const MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const WEEK=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const pad=n=>String(n).padStart(2,'0');
  const iso=(y,m,d)=>`${y}-${pad(m+1)}-${pad(d)}`;
  const todayIso=()=>{const d=new Date();return iso(d.getFullYear(),d.getMonth(),d.getDate());};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const style=document.createElement('style');
  style.textContent=`
    .cal-overlay{position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:18px;border:0;background:transparent;box-sizing:border-box;place-items:center;z-index:30000}
    .cal-overlay:not([open]){display:none!important}
    .cal-overlay[open]{display:grid!important}
    .cal-overlay::backdrop{background:rgba(15,23,42,.58);backdrop-filter:blur(6px)}
    .cal-panel{width:min(1040px,calc(100vw - 28px));max-height:92dvh;overflow:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:18px;box-shadow:0 28px 80px rgba(15,23,42,.38);padding:18px;box-sizing:border-box;color:#243447}
    .cal-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}.cal-head h2{margin:0;font-size:24px}.cal-close{width:40px;height:40px;padding:0!important;font-size:20px!important}
    .cal-toolbar{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;margin-bottom:12px}.cal-nav{display:flex;gap:7px}.cal-nav button,.cal-today{height:38px!important;padding:0 12px!important}.cal-month-title{text-align:center;font-size:20px;font-weight:900;color:#1e293b}
    .cal-toolbar-right{display:flex;align-items:center;gap:8px}.cal-view-switch{display:flex;gap:4px;padding:3px;border:1px solid #d5dfeb;border-radius:9px;background:#eef3f8}.cal-view-btn{height:32px!important;padding:0 10px!important;border-radius:7px!important}.cal-view-btn.active,.cal-today.active{background:#2f80ed!important;color:#fff!important;border-color:#2f80ed!important}.cal-overlay.client-mode .cal-view-switch{display:none}
    .cal-layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(300px,.85fr);gap:16px;align-items:start}
    .cal-card{background:#fff;border:1px solid #d9e3ed;border-radius:14px;padding:12px;box-shadow:0 5px 18px rgba(15,23,42,.05)}
    .cal-week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px}.cal-week div{text-align:center;font-size:11px;font-weight:900;color:#64748b;padding:6px 0}.cal-week div:nth-child(6),.cal-week div:nth-child(7){color:#b45309}
    .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
    .cal-day{position:relative;min-height:92px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;padding:7px;box-sizing:border-box;cursor:pointer;transition:.14s ease;overflow:visible}.cal-day:hover{border-color:#93b4dc;background:#f8fbff}.cal-day.out{opacity:.35;background:#f8fafc}.cal-day.selected{border-color:#2f80ed;box-shadow:0 0 0 2px rgba(47,128,237,.14);background:#f3f8ff}.cal-day.today{border-color:#40a36b}.cal-day.today .cal-num{background:#2f855a;color:#fff}
    .cal-num{width:27px;height:27px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:900;color:#243447}.cal-day-weekend .cal-num{color:#b45309}
    .cal-day.has-events{border-color:#e8c86a}.cal-day.has-events:hover,.cal-day.has-events:focus{z-index:30;outline:none;border-color:#d9ad2d;box-shadow:0 0 0 2px rgba(244,183,42,.12)}
    .cal-day-beacon{position:absolute;top:9px;right:9px;width:10px;height:10px;border-radius:50%;background:#f4b72a;border:2px solid #fff;box-shadow:0 0 0 1px #e4bd59,0 0 0 0 rgba(244,183,42,.18);animation:calDayBeaconPulse 1.25s ease-in-out infinite}
    @keyframes calDayBeaconPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 1px #e4bd59,0 0 0 0 rgba(244,183,42,.12)}50%{transform:scale(1.14);box-shadow:0 0 0 1px #dcae38,0 0 0 5px rgba(244,183,42,.20)}}
    .cal-day-tooltip{position:absolute;left:50%;top:38px;transform:translate(-50%,-4px);width:min(360px,calc(100vw - 48px));min-width:300px;max-width:360px;padding:14px 16px;border:1px solid #e2bd55;border-radius:12px;background:#fffdf6;box-shadow:0 14px 36px rgba(54,45,18,.22);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s ease,transform .12s ease;z-index:60;text-align:left}
    .cal-day.has-events:hover .cal-day-tooltip,.cal-day.has-events:focus-within .cal-day-tooltip{opacity:1;visibility:visible;transform:translate(-50%,0);pointer-events:auto}
    .cal-day-tooltip-row{width:100%;display:grid;grid-template-columns:58px 44px minmax(0,1fr);gap:10px;align-items:center;font-size:13px;line-height:1.35;color:#334155;text-align:left;border:0;background:transparent;padding:4px 2px;font-family:inherit}.cal-day-tooltip-row+.cal-day-tooltip-row{margin-top:8px;padding-top:10px;border-top:1px solid #f0e2b5}.cal-day-tooltip-client-link{cursor:pointer;border-radius:8px}.cal-day-tooltip-client-link:hover{background:#fff5d6}.cal-day-tooltip-time{font-weight:900;color:#8a5b00;font-size:13px}.cal-day-tooltip-avatar{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:#e7eef7;color:#315475;font-size:12px;font-weight:900;box-shadow:0 0 0 1px #d4deea}.cal-day-tooltip-avatar img{width:100%;height:100%;object-fit:cover}.cal-day-tooltip-client{font-weight:800;font-size:13px;overflow-wrap:anywhere}
    .cal-side-title{font-size:15px;font-weight:900;margin-bottom:4px}.cal-selected-date{font-size:12px;color:#64748b;margin-bottom:10px}.cal-events{display:grid;gap:7px;max-height:300px;overflow:auto;margin-bottom:12px}.cal-empty{padding:14px;border:1px dashed #d6dee8;border-radius:10px;text-align:center;color:#94a3b8;font-size:12px}.cal-event{display:grid;grid-template-columns:52px 1fr auto;gap:8px;align-items:start;padding:9px;border:1px solid #e0e7ef;border-radius:10px;background:#f8fafc}.cal-event-time{font-size:12px;font-weight:900;color:#334155}.cal-event-title{font-size:12px;font-weight:900;color:#1e293b}.cal-event-meta{font-size:10px;color:#64748b;margin-top:2px}.cal-delete{width:28px;height:28px!important;padding:0!important;font-size:13px!important;color:#b42318!important}
    .cal-quick-assign{width:100%;height:38px!important;margin:2px 0 12px;background:linear-gradient(#4b90ed,#2f74d6)!important;color:#fff!important;font-weight:900!important}.cal-overlay.client-mode .cal-quick-assign{display:none}.cal-overlay.overview-mode .cal-form{display:none}.cal-overlay.overview-mode.assign-open .cal-form{display:block}
    .cal-form{border-top:1px solid #e2e8f0;padding-top:12px}.cal-form-title{font-size:13px;font-weight:900;margin-bottom:8px}.cal-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cal-form label{display:grid;gap:4px;font-size:10px;font-weight:800;color:#64748b}.cal-form input,.cal-form select,.cal-form textarea{width:100%;box-sizing:border-box;border:1px solid #c6d2df;border-radius:8px;background:#fff;padding:0 9px;font:600 12px 'Segoe UI',Arial,sans-serif;color:#243447}.cal-form input,.cal-form select{height:36px}.cal-form textarea{min-height:64px;padding-top:8px;resize:vertical}.cal-span2{grid-column:1/-1}.cal-client-time-preview{grid-column:1/-1;display:flex;align-items:center;gap:8px;min-height:38px;padding:8px 10px;border:1px solid #d7e0eb;border-radius:8px;background:#f7f9fc;color:#53657a;font-size:11px;font-weight:800;box-sizing:border-box}.cal-client-time-preview strong{font-size:12px;color:#243447}.cal-client-time-preview.ok{border-color:#a9d9bd;background:#f1fbf5}.cal-client-time-preview.caution{border-color:#e8c86a;background:#fffaf0;color:#805900}.cal-client-time-preview.night{border-color:#e7a0a0;background:#fff3f3;color:#a63737}.cal-client-time-preview.night strong{color:#a63737}.cal-client-time-preview.unknown{border-color:#d7dde5;background:#f7f8fa;color:#6b7a8d}.cal-save{width:100%;margin-top:9px;height:38px!important;background:linear-gradient(#48a873,#278656)!important;color:#fff!important;font-weight:900!important}
    .cal-overlay.week-view .cal-day{min-height:150px}
    .cal-overlay.day-view .cal-week{display:none}
    .cal-overlay.day-view .cal-grid{grid-template-columns:1fr}
    .cal-overlay.day-view .cal-day{min-height:220px}
    @media(max-width:820px){.cal-layout{grid-template-columns:1fr}.cal-day{min-height:76px}.cal-panel{padding:12px}.cal-toolbar{grid-template-columns:1fr}.cal-month-title{order:-1}.cal-nav{justify-content:center}.cal-today{justify-self:center}}
    @media(max-width:560px){.cal-overlay{padding:0;place-items:end center}.cal-panel{width:100%;max-height:94dvh;border-radius:18px 18px 0 0}.cal-grid,.cal-week{gap:3px}.cal-day{min-height:62px;padding:4px}.cal-chip,.cal-more{display:none}.cal-num{width:24px;height:24px}.cal-form-grid{grid-template-columns:1fr}.cal-span2{grid-column:auto}}
  `;
  document.head.appendChild(style);

  const overlay=document.createElement('dialog');
  overlay.id='diagnostikaCalendarOverlay';
  overlay.className='cal-overlay';
  overlay.innerHTML=`
    <section class="cal-panel" aria-label="Календарь">
      <div class="cal-head"><h2>📅 Календарь</h2><button type="button" class="tk-btn cal-close">×</button></div>
      <div class="cal-toolbar">
        <div class="cal-nav"><button type="button" class="tk-btn cal-prev">←</button><button type="button" class="tk-btn cal-next">→</button></div>
        <div class="cal-month-title"></div>
        <div class="cal-toolbar-right"><div class="cal-view-switch"><button type="button" class="tk-btn cal-view-btn cal-view-month" data-view="month">Месяц</button><button type="button" class="tk-btn cal-view-btn cal-view-week" data-view="week">Неделя</button></div><button type="button" class="tk-btn cal-today">Сегодня</button></div>
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
          <button type="button" class="tk-btn cal-quick-assign">＋ Выбрать и назначить</button>
          <div class="cal-form">
            <div class="cal-form-title">+ Добавить запись</div>
            <div class="cal-form-grid">
              <label>Дата<input class="cal-date" type="date"></label>
              <label>Время<input class="cal-time" type="time" value="19:00"></label>
              <label class="cal-span2">Клиент<select class="cal-client"></select></label>
              <div class="cal-client-time-preview unknown" role="status" aria-live="polite">🕒 <strong>Время клиента:</strong> выберите клиента</div>
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
  const clientTimePreview=overlay.querySelector('.cal-client-time-preview');
  const typeSelect=overlay.querySelector('.cal-type');
  const noteInput=overlay.querySelector('.cal-note');

  let cursor=new Date();cursor.setDate(1);
  let selected=todayIso();
  let openMode='client';
  let viewMode='month';
  let assignOpen=false;
  let locationCatalogPromise=null;
  let clientTimePreviewRequest=0;

  function calendarApi(){
    const facade=window.DiagnostikaCalendar;
    if(facade?.moduleAware===true)return facade;
    return window.DiagnostikaPlatform?.services?.calendar||null;
  }
  function clientsApi(){
    const facade=window.DiagnostikaClients;
    if(facade?.moduleAware===true)return facade;
    return window.DiagnostikaPlatform?.services?.clients||null;
  }
  function clients(){
    try{
      const rows=clientsApi()?.list?.();
      return Array.isArray(rows)?rows:[];
    }catch(_){return [];}
  }
  function clientById(id){
    if(id===undefined||id===null||id==='')return null;
    return clients().find(c=>String(c.id)===String(id))||null;
  }
  function initials(name){
    const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
    if(!parts.length)return'К';
    return parts.slice(0,2).map(part=>part[0]||'').join('').toUpperCase();
  }
  function clientAvatarHtml(c){
    if(c?.photoData)return `<span class="cal-day-tooltip-avatar"><img src="${esc(c.photoData)}" alt=""></span>`;
    return `<span class="cal-day-tooltip-avatar">${esc(initials(c?.name))}</span>`;
  }

  function normalizePlace(value){
    return String(value||'')
      .trim()
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g,'е')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zа-я0-9]+/gi,' ')
      .trim()
      .replace(/\s+/g,' ');
  }

  const COUNTRY_ALIASES=Object.freeze({
    'russia':'россия','russian federation':'россия','российская федерация':'россия',
    'germany':'германия','deutschland':'германия','poland':'польша',
    'czechia':'чехия','czech republic':'чехия','finland':'финляндия',
    'belarus':'беларусь','kazakhstan':'казахстан','georgia':'грузия',
    'armenia':'армения','turkey':'турция','turkiye':'турция',
    'france':'франция','united kingdom':'великобритания','uk':'великобритания',
    'great britain':'великобритания','italy':'италия'
  });

  function normalizeCountry(value){
    const key=normalizePlace(value);
    return COUNTRY_ALIASES[key]||key;
  }

  function loadLocationCatalog(){
    if(locationCatalogPromise)return locationCatalogPromise;
    locationCatalogPromise=fetch('./weather-locations.json?v=20261002-calendar-client-time-1',{cache:'force-cache',credentials:'same-origin'})
      .then(response=>{
        if(!response.ok)throw new Error('location-catalog-'+response.status);
        return response.json();
      })
      .then(data=>Array.isArray(data?.cities)?data.cities:[])
      .catch(error=>{
        console.warn('[Diagnostika] calendar timezone catalog unavailable',error);
        return [];
      });
    return locationCatalogPromise;
  }

  function findClientLocation(rows,city,country){
    const cityKey=normalizePlace(city);
    if(!cityKey)return null;
    const countryKey=normalizeCountry(country);
    const candidates=(rows||[]).filter(row=>{
      const names=[row?.name,...(Array.isArray(row?.aliases)?row.aliases:[])].map(normalizePlace);
      return names.includes(cityKey);
    });
    if(!candidates.length)return null;
    if(candidates.length===1)return candidates[0];
    if(countryKey){
      const matched=candidates.find(row=>normalizeCountry(row?.country)===countryKey);
      if(matched)return matched;
    }
    return null;
  }

  function timeZoneOffsetMinutes(date,timeZone){
    const parts=new Intl.DateTimeFormat('en-CA',{
      timeZone,year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
    }).formatToParts(date);
    const map=Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
    const utcLike=Date.UTC(
      Number(map.year),Number(map.month)-1,Number(map.day),
      Number(map.hour),Number(map.minute),Number(map.second)
    );
    const instant=Math.floor(date.getTime()/1000)*1000;
    return Math.round((utcLike-instant)/60000);
  }

  function formatOffsetDifference(minutes){
    const rounded=Math.round(minutes);
    if(!rounded)return 'то же время';
    const abs=Math.abs(rounded);
    const hours=Math.floor(abs/60);
    const mins=abs%60;
    const amount=[hours?hours+' ч':'',mins?mins+' мин':''].filter(Boolean).join(' ');
    return rounded>0?'+'+amount:'−'+amount;
  }

  function clientDayRelation(localDate,clientParts){
    const [year,month,day]=String(localDate||'').split('-').map(Number);
    if(!year||!month||!day)return '';
    const localDay=Date.UTC(year,month-1,day);
    const clientDay=Date.UTC(Number(clientParts.year),Number(clientParts.month)-1,Number(clientParts.day));
    const diff=Math.round((clientDay-localDay)/86400000);
    if(diff===1)return 'следующий день';
    if(diff===-1)return 'предыдущий день';
    if(diff>1)return 'через '+diff+' дн.';
    if(diff<-1)return Math.abs(diff)+' дн. назад';
    return '';
  }

  function setClientTimePreview(state,text,title=''){
    if(!clientTimePreview)return;
    clientTimePreview.className='cal-client-time-preview '+state;
    clientTimePreview.innerHTML='🕒 <strong>Время клиента:</strong> '+esc(text);
    clientTimePreview.title=title;
  }

  async function updateClientTimePreview(){
    const requestId=++clientTimePreviewRequest;
    const clientIdValue=clientSelect.value||'';
    const c=clientById(clientIdValue);
    if(!c){
      setClientTimePreview('unknown','выберите клиента');
      return;
    }

    const date=dateInput.value||selected;
    const time=timeInput.value||'';
    if(!date||!time){
      setClientTimePreview('unknown','укажите дату и время');
      return;
    }
    if(!c.city){
      setClientTimePreview('unknown','у клиента не указан город');
      return;
    }

    setClientTimePreview('unknown','определяю…');
    const rows=await loadLocationCatalog();
    if(requestId!==clientTimePreviewRequest)return;
    const location=c.timezone?{
      name:c.city||'',
      country:c.country||'',
      timezone:c.timezone,
      latitude:c.latitude,
      longitude:c.longitude
    }:findClientLocation(rows,c.city,c.country);
    if(!location?.timezone){
      setClientTimePreview('unknown','часовой пояс не найден · '+c.city);
      return;
    }

    const localInstant=new Date(date+'T'+time+':00');
    if(Number.isNaN(localInstant.getTime())){
      setClientTimePreview('unknown','некорректная дата или время');
      return;
    }

    try{
      const parts=new Intl.DateTimeFormat('en-CA',{
        timeZone:location.timezone,year:'numeric',month:'2-digit',day:'2-digit',
        hour:'2-digit',minute:'2-digit',hourCycle:'h23'
      }).formatToParts(localInstant);
      const map=Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
      const clientTime=map.hour+':'+map.minute;
      const relation=clientDayRelation(date,map);
      const clientOffset=timeZoneOffsetMinutes(localInstant,location.timezone);
      const localOffset=-localInstant.getTimezoneOffset();
      const offsetText=formatOffsetDifference(clientOffset-localOffset);
      const hour=Number(map.hour);
      const state=hour>=0&&hour<6?'night':(hour>=22||hour<8?'caution':'ok');
      const warning=state==='night'?'ночь':(state==='caution'?'позднее/раннее время':'');
      const details=[clientTime,relation,offsetText,warning].filter(Boolean).join(' · ');
      setClientTimePreview(state,details,(location.name||c.city)+' · '+location.timezone);
    }catch(error){
      console.warn('[Diagnostika] calendar client-time preview failed',error);
      setClientTimePreview('unknown','не удалось рассчитать время');
    }
  }
  function customEvents(){
    try{
      const rows=calendarApi()?.list?.();
      return Array.isArray(rows)?rows:[];
    }catch(_){return [];}
  }
  function allEvents(){
    return customEvents()
      .map(e=>({...e,kind:'manual'}))
      .sort((a,b)=>String(a.time||'99:99').localeCompare(String(b.time||'99:99'))||String(a.title||'').localeCompare(String(b.title||'')));
  }
  function eventsOn(date){return allEvents().filter(e=>e.date===date);}
  function currentClientId(){
    try{
      const id=clientsApi()?.currentId?.();
      if(id!==undefined&&id!==null&&id!=='')return id;
    }catch(_){}
    return '';
  }
  function fillClientOptions(){
    const rows=clients();
    const current=currentClientId();
    const previous=clientSelect.value||'';
    clientSelect.innerHTML='<option value="">— Выбрать клиента —</option>'+rows.map(c=>`<option value="${esc(c.id)}">${esc(c.name||'Без имени')}</option>`).join('');
    if(openMode==='client'&&current&&rows.some(c=>String(c.id)===String(current)))clientSelect.value=String(current);
    else if(previous&&rows.some(c=>String(c.id)===String(previous)))clientSelect.value=String(previous);
    else clientSelect.value='';
  }
  function humanDate(date){const d=new Date(date+'T12:00:00');return new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);}

  function renderDayDetails(){
    selectedDateLabel.textContent=humanDate(selected);
    dateInput.value=selected;
    const evs=eventsOn(selected);
    eventsBox.innerHTML='';
    if(!evs.length){eventsBox.innerHTML='<div class="cal-empty">На этот день записей нет</div>';return;}
    evs.forEach(e=>{
      const row=document.createElement('div');
      row.className='cal-event';
      row.dataset.calendarEventId=String(e.id||'');
      const meta=[e.clientName,e.meta,e.note].filter(Boolean).join(' • ');
      row.innerHTML=`<div class="cal-event-time">${esc(e.time||'—')}</div><div><div class="cal-event-title">${esc(e.title||e.type||'Запись')}</div><div class="cal-event-meta">${esc(meta)}</div></div><button type="button" class="tk-btn cal-delete" title="Удалить">×</button>`;
      row.querySelector('.cal-delete').onclick=()=>{
        const api=calendarApi();
        if(typeof api?.remove!=='function')return;
        if(!api.remove(e.id,{source:'calendar-ui-delete'}))return;
        render();
      };
      eventsBox.appendChild(row);
    });
  }

  function weekStart(date){
    const d=new Date(date);
    d.setHours(12,0,0,0);
    const shift=(d.getDay()+6)%7;
    d.setDate(d.getDate()-shift);
    return d;
  }

  function weekTitle(start){
    const end=new Date(start);end.setDate(start.getDate()+6);
    const left=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long'}).format(start);
    const right=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(end);
    return `${left} — ${right}`;
  }

  function dayTitle(date){
    return new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date);
  }

  function openClientFromCalendar(clientId){
    if(!clientId)return false;
    const api=clientsApi();
    if(typeof api?.select!=='function'||!api.select(clientId,{source:'calendar-tooltip-open-client'}))return false;
    const shell=window.DiagnostikaPlatform?.shell;
    shell?.setMode?.('card');
    shell?.renderMode?.();
    closeCalendar();
    const card=document.getElementById('clientCardDialog');
    if(card?.open)card.close();
    setTimeout(()=>{
      shell?.refreshDashboard?.();
      window.DiagnostikaHomeDashboard?.refresh?.();
    },0);
    return true;
  }

  function renderMonth(){
    const y=cursor.getFullYear(),m=cursor.getMonth();
    const today=todayIso();
    let start,cellCount;

    if(viewMode==='day'){
      start=new Date(selected+'T12:00:00');
      cellCount=1;
      monthTitle.textContent=dayTitle(start);
    }else if(viewMode==='week'){
      start=weekStart(new Date(selected+'T12:00:00'));
      cellCount=7;
      monthTitle.textContent=weekTitle(start);
    }else{
      monthTitle.textContent=`${MONTHS[m]} ${y}`;
      const first=new Date(y,m,1);
      const shift=(first.getDay()+6)%7;
      start=new Date(y,m,1-shift);
      cellCount=42;
    }

    overlay.classList.toggle('week-view',viewMode==='week');
    overlay.classList.toggle('day-view',viewMode==='day');
    overlay.querySelectorAll('.cal-view-btn').forEach(button=>button.classList.toggle('active',button.dataset.view===viewMode));
    overlay.querySelector('.cal-today')?.classList.toggle('active',viewMode==='day'&&selected===today);
    grid.innerHTML='';

    for(let i=0;i<cellCount;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);
      const ds=iso(d.getFullYear(),d.getMonth(),d.getDate());
      const evs=eventsOn(ds);
      const cell=document.createElement('div');
      const weekend=viewMode==='day'?(d.getDay()===0||d.getDay()===6):(i%7)>=5;
      const hasEvents=evs.length>0;
      const outside=viewMode==='month'&&d.getMonth()!==m;
      cell.className='cal-day'+(outside?' out':'')+(ds===selected?' selected':'')+(ds===today?' today':'')+(weekend?' cal-day-weekend':'')+(hasEvents?' has-events':'');
      if(hasEvents)cell.tabIndex=0;

      const tooltip=hasEvents
        ? `<div class="cal-day-tooltip" role="tooltip">${evs.map(e=>{
            const c=clientById(e.clientId);
            const name=c?.name||e.clientName||e.title||e.type||'Запись';
            const tag=c&&e.clientId?'button':'div';
            const attrs=c&&e.clientId?` type="button" class="cal-day-tooltip-row cal-day-tooltip-client-link" data-client-id="${esc(e.clientId)}"`:' class="cal-day-tooltip-row"';
            return `<${tag}${attrs}><span class="cal-day-tooltip-time">${esc(e.time||'—')}</span>${clientAvatarHtml(c)}<span class="cal-day-tooltip-client">${esc(name)}</span></${tag}>`;
          }).join('')}</div>`
        : '';

      cell.innerHTML=`<div class="cal-num">${d.getDate()}</div>${hasEvents?'<span class="cal-day-beacon" aria-hidden="true"></span>':''}${tooltip}`;
      if(hasEvents)cell.setAttribute('aria-label',evs.map(e=>`${e.time||'—'} ${clientById(e.clientId)?.name||e.clientName||e.title||e.type||'Запись'}`).join('; '));

      cell.querySelectorAll('.cal-day-tooltip-client-link').forEach(link=>{
        link.addEventListener('click',event=>{
          event.stopPropagation();
          openClientFromCalendar(link.dataset.clientId);
        });
      });

      cell.onclick=()=>{
        selected=ds;
        if(viewMode==='month'&&d.getMonth()!==m)cursor=new Date(d.getFullYear(),d.getMonth(),1);
        render();
      };
      grid.appendChild(cell);
    }
  }

  function syncModeUi(){
    overlay.classList.toggle('overview-mode',openMode==='overview');
    overlay.classList.toggle('client-mode',openMode==='client');
    overlay.classList.toggle('assign-open',assignOpen);
    const quick=overlay.querySelector('.cal-quick-assign');
    if(quick)quick.textContent=assignOpen?'Скрыть назначение':'＋ Выбрать и назначить';
  }

  function render(){syncModeUi();fillClientOptions();renderMonth();renderDayDetails();updateClientTimePreview();}

  function openCalendar(options={}){
    const now=new Date();
    openMode=options?.mode==='overview'?'overview':'client';
    viewMode=openMode==='overview'&&options?.view==='week'?'week':'month';
    assignOpen=false;
    selected=todayIso();
    cursor=new Date(now.getFullYear(),now.getMonth(),1);
    if(openMode==='overview')clientSelect.value='';
    render();
    if(!overlay.open)overlay.showModal();
    document.documentElement.style.overflow='hidden';
    return true;
  }
  function closeCalendar(){if(overlay.open)overlay.close();document.documentElement.style.overflow='';}

  overlay.querySelector('.cal-close').onclick=closeCalendar;
  overlay.querySelector('.cal-prev').onclick=()=>{
    if(viewMode==='day'){
      const d=new Date(selected+'T12:00:00');d.setDate(d.getDate()-1);selected=iso(d.getFullYear(),d.getMonth(),d.getDate());cursor=new Date(d.getFullYear(),d.getMonth(),1);
    }else if(viewMode==='week'){
      const d=new Date(selected+'T12:00:00');d.setDate(d.getDate()-7);selected=iso(d.getFullYear(),d.getMonth(),d.getDate());cursor=new Date(d.getFullYear(),d.getMonth(),1);
    }else cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);
    render();
  };
  overlay.querySelector('.cal-next').onclick=()=>{
    if(viewMode==='day'){
      const d=new Date(selected+'T12:00:00');d.setDate(d.getDate()+1);selected=iso(d.getFullYear(),d.getMonth(),d.getDate());cursor=new Date(d.getFullYear(),d.getMonth(),1);
    }else if(viewMode==='week'){
      const d=new Date(selected+'T12:00:00');d.setDate(d.getDate()+7);selected=iso(d.getFullYear(),d.getMonth(),d.getDate());cursor=new Date(d.getFullYear(),d.getMonth(),1);
    }else cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);
    render();
  };
  overlay.querySelector('.cal-today').onclick=()=>{const n=new Date();viewMode='day';selected=todayIso();cursor=new Date(n.getFullYear(),n.getMonth(),1);render();};
  overlay.querySelectorAll('.cal-view-btn').forEach(button=>button.onclick=()=>{viewMode=button.dataset.view==='week'?'week':'month';render();});
  overlay.querySelector('.cal-quick-assign').onclick=()=>{
    assignOpen=!assignOpen;
    if(assignOpen&&openMode==='overview')clientSelect.value='';
    syncModeUi();
    if(assignOpen)clientSelect.focus();
  };
  dateInput.addEventListener('input',updateClientTimePreview);
  timeInput.addEventListener('input',updateClientTimePreview);
  clientSelect.addEventListener('change',updateClientTimePreview);
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeCalendar();});
  overlay.addEventListener('cancel',e=>{e.preventDefault();closeCalendar();});

  overlay.querySelector('.cal-save').onclick=()=>{
    const date=dateInput.value||selected;
    const clientIdValue=clientSelect.value||'';
    const c=clients().find(x=>String(x.id)===String(clientIdValue));
    const type=typeSelect.value||'Запись';
    const note=noteInput.value.trim();
    const api=calendarApi();
    if(typeof api?.create!=='function')return;
    const item={date,time:timeInput.value||'',clientId:clientIdValue,clientName:c?.name||'',type,title:type,note};
    if(!api.create(item,{source:'calendar-ui-create'}))return;
    noteInput.value='';
    selected=date;
    const d=new Date(date+'T12:00:00');cursor=new Date(d.getFullYear(),d.getMonth(),1);
    if(openMode==='overview')assignOpen=false;
    render();
  };

  function attach(){
    const btn=document.getElementById('ccCalendarBtn');
    if(!btn||btn.dataset.realCalendar==='1')return false;
    btn.dataset.realCalendar='1';
    btn.onclick=()=>openCalendar({mode:'client'});
    return true;
  }
  attach();

  const ui=Object.freeze({version:'8D',open:openCalendar,refresh:render});
  window.DiagnostikaCalendarUI=ui;
  if(window.DiagnostikaCalendar?.moduleAware!==true)window.DiagnostikaCalendar=ui;

  let eventRefreshBound=false;
  function bindCalendarEvents(){
    if(eventRefreshBound)return true;
    const bus=window.DiagnostikaPlatform?.events;
    if(!bus?.on)return false;
    ['calendar:event-created','calendar:event-updated','calendar:event-deleted','calendar:events-replaced'].forEach(type=>{
      bus.on(type,()=>{
        if(overlay.open)setTimeout(render,0);
      });
    });
    eventRefreshBound=true;
    return true;
  }
  bindCalendarEvents();
  Promise.resolve(window.DiagnostikaPlatform?.ready).then(bindCalendarEvents).catch(()=>{});
})();