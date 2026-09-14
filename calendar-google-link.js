'use strict';

(() => {
  if (window.DiagnostikaGoogleCalendarLink) return;

  const style=document.createElement('style');
  style.textContent=`
    .cal-event-actions{display:flex;flex-direction:column;gap:5px;align-items:stretch;min-width:118px}
    .cal-google-btn{height:30px!important;min-width:118px!important;padding:0 8px!important;border:1px solid #b9cbe3!important;border-radius:7px!important;background:#fff!important;color:#1a73e8!important;font-size:10px!important;font-weight:900!important;white-space:nowrap!important;box-shadow:0 1px 2px rgba(15,23,42,.08)!important}
    .cal-google-btn:hover{background:#f3f8ff!important;border-color:#8eb1df!important}
    .cal-event-actions .cal-delete{width:100%!important;height:28px!important}
    @media(max-width:560px){.cal-event{grid-template-columns:44px minmax(0,1fr)!important}.cal-event-actions{grid-column:1/-1;flex-direction:row;min-width:0}.cal-google-btn{flex:1;min-width:0!important}.cal-event-actions .cal-delete{width:42px!important}}
  `;
  document.head.appendChild(style);

  const pad=n=>String(n).padStart(2,'0');
  const clean=s=>String(s||'').trim();

  function compactDate(date){return clean(date).replace(/-/g,'');}

  function timedStamp(date,time){
    const [y,m,d]=date.split('-').map(Number);
    const [hh,mm]=time.split(':').map(Number);
    const x=new Date(y,m-1,d,hh||0,mm||0,0,0);
    return `${x.getFullYear()}${pad(x.getMonth()+1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
  }

  function addMinutes(date,time,minutes){
    const [y,m,d]=date.split('-').map(Number);
    const [hh,mm]=time.split(':').map(Number);
    const x=new Date(y,m-1,d,hh||0,mm||0,0,0);
    x.setMinutes(x.getMinutes()+minutes);
    return `${x.getFullYear()}${pad(x.getMonth()+1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
  }

  function nextDay(date){
    const [y,m,d]=date.split('-').map(Number);
    const x=new Date(y,m-1,d,12,0,0,0);
    x.setDate(x.getDate()+1);
    return `${x.getFullYear()}${pad(x.getMonth()+1)}${pad(x.getDate())}`;
  }

  function googleUrl(row){
    const dialog=row.closest('#diagnostikaCalendarOverlay');
    const date=clean(dialog?.querySelector('.cal-date')?.value);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';

    const rawTime=clean(row.querySelector('.cal-event-time')?.textContent);
    const time=/^\d{2}:\d{2}$/.test(rawTime)?rawTime:'';
    const eventTitle=clean(row.querySelector('.cal-event-title')?.textContent)||'Запись';
    const meta=clean(row.querySelector('.cal-event-meta')?.textContent);
    const parts=meta.split(' • ').map(x=>x.trim()).filter(Boolean);
    const clientName=parts.shift()||'';
    const comment=parts.join(' • ');

    const text=clientName?`${eventTitle} — ${clientName}`:eventTitle;
    const details=[];
    if(clientName) details.push(`Клиент: ${clientName}`);
    if(comment) details.push(`Комментарий: ${comment}`);
    details.push('Создано из программы «Психологическая диагностика».');

    let dates='';
    if(time){
      dates=`${timedStamp(date,time)}/${addMinutes(date,time,60)}`;
    }else{
      dates=`${compactDate(date)}/${nextDay(date)}`;
    }

    const params=new URLSearchParams({
      action:'TEMPLATE',
      text,
      dates,
      details:details.join('\n')
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function attachRow(row){
    if(!row||row.dataset.googleCalendarReady==='1') return;
    row.dataset.googleCalendarReady='1';

    const actions=document.createElement('div');
    actions.className='cal-event-actions';

    const google=document.createElement('button');
    google.type='button';
    google.className='tk-btn cal-google-btn';
    google.textContent='Google Календарь';
    google.title='Добавить в Google Календарь';
    google.onclick=e=>{
      e.preventDefault();
      e.stopPropagation();
      const url=googleUrl(row);
      if(!url) return;
      window.open(url,'_blank','noopener,noreferrer');
    };

    actions.appendChild(google);
    const del=row.querySelector(':scope > .cal-delete');
    if(del) actions.appendChild(del);
    row.appendChild(actions);
  }

  function sync(){
    document.querySelectorAll('#diagnostikaCalendarOverlay .cal-event').forEach(attachRow);
  }

  const observer=new MutationObserver(sync);
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#ccCalendarBtn,.cal-day,.cal-prev,.cal-next,.cal-today,.cal-save')) setTimeout(sync,0);
  },true);
  setTimeout(sync,0);

  window.DiagnostikaGoogleCalendarLink={refresh:sync};
})();

// This is the final startup script in index.html. Reveal the UI only after all
// synchronous modules above have finished transforming the legacy HTML shell.
requestAnimationFrame(()=>requestAnimationFrame(()=>{
  document.body.classList.add('diagnostika-ready');
}));
