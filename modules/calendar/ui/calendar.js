'use strict';

(() => {
  if (document.getElementById('diagnostikaCalendarOverlay')) return;

  const MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const WEEK=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const TIME_GRID_START=0;
  const TIME_GRID_END=24;
  const TIME_GRID_HOUR_PX=56;
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
    .cal-panel{width:min(1040px,calc(100vw - 28px));height:min(690px,calc(100dvh - 36px));min-height:min(690px,calc(100dvh - 36px));max-height:none;overflow:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:18px;box-shadow:0 28px 80px rgba(15,23,42,.38);padding:18px;box-sizing:border-box;color:#243447}
    .cal-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}.cal-head h2{margin:0;font-size:24px}.cal-close{width:40px;height:40px;padding:0!important;font-size:20px!important}
    .cal-toolbar{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;margin-bottom:12px}.cal-nav{display:flex;gap:7px}.cal-nav button,.cal-today{height:38px!important;padding:0 12px!important}.cal-month-title{text-align:center;font-size:20px;font-weight:900;color:#1e293b}
    .cal-toolbar-right{display:flex;align-items:center;gap:8px}.cal-view-switch{display:flex;gap:4px;padding:3px;border:1px solid #d5dfeb;border-radius:9px;background:#eef3f8}.cal-view-btn{height:32px!important;padding:0 10px!important;border-radius:7px!important}.cal-view-btn.active,.cal-today.active{background:#2f80ed!important;color:#fff!important;border-color:#2f80ed!important}
    .cal-layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(300px,.85fr);gap:16px;align-items:start}
    .cal-card{background:#fff;border:1px solid #d9e3ed;border-radius:14px;padding:12px;box-shadow:0 5px 18px rgba(15,23,42,.05)}
    .cal-week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px}.cal-week div{text-align:center;font-size:11px;font-weight:900;color:#64748b;padding:6px 0}.cal-week div:nth-child(6),.cal-week div:nth-child(7){color:#b45309}
    .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
    .cal-day{position:relative;min-height:92px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;padding:7px;box-sizing:border-box;cursor:pointer;transition:.14s ease;overflow:visible}.cal-day:hover{border-color:#93b4dc;background:#f8fbff}.cal-day.out{opacity:.35;background:#f8fafc}.cal-day.selected{border-color:#2f80ed;box-shadow:0 0 0 2px rgba(47,128,237,.14);background:#f3f8ff}.cal-day.today{border-color:#40a36b}.cal-day.today .cal-num{background:#2f855a;color:#fff}
    .cal-num{width:27px;height:27px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:900;color:#243447}.cal-day-weekend .cal-num{color:#b45309}
    .cal-day.has-events{--cal-beacon:#f4b72a;--cal-beacon-ring:#e4bd59;--cal-beacon-rgb:244,183,42;--cal-event-border:#e8c86a;--cal-event-border-strong:#d9ad2d;--cal-tooltip-bg:#fffdf6;--cal-tooltip-time:#8a5b00;border-color:var(--cal-event-border)}
    .cal-day.has-events.is-reminder{--cal-beacon:#8b5cf6;--cal-beacon-ring:#7c3aed;--cal-beacon-rgb:139,92,246;--cal-event-border:#b79af7;--cal-event-border-strong:#8b5cf6;--cal-tooltip-bg:#faf7ff;--cal-tooltip-time:#6d45b8}
    .cal-day.has-events.is-diagnosis{--cal-beacon:#f59e0b;--cal-beacon-ring:#d97706;--cal-beacon-rgb:245,158,11;--cal-event-border:#f2c26b;--cal-event-border-strong:#d97706;--cal-tooltip-bg:#fffaf0;--cal-tooltip-time:#a45b04}
    .cal-day.has-events.is-session{--cal-beacon:#3b82f6;--cal-beacon-ring:#2563eb;--cal-beacon-rgb:59,130,246;--cal-event-border:#93b8f5;--cal-event-border-strong:#2563eb;--cal-tooltip-bg:#f4f8ff;--cal-tooltip-time:#245db5}
    .cal-day.has-events.is-free-consultation{--cal-beacon:#22c55e;--cal-beacon-ring:#16a34a;--cal-beacon-rgb:34,197,94;--cal-event-border:#86d9a4;--cal-event-border-strong:#22c55e;--cal-tooltip-bg:#f1fff6;--cal-tooltip-time:#176a36}
    .cal-day.has-events.is-call{--cal-beacon:#06b6d4;--cal-beacon-ring:#0891b2;--cal-beacon-rgb:6,182,212;--cal-event-border:#7bd7e7;--cal-event-border-strong:#0891b2;--cal-tooltip-bg:#f1fcfe;--cal-tooltip-time:#0e7490}
    .cal-day.has-events.is-neutral{--cal-beacon:#94a3b8;--cal-beacon-ring:#64748b;--cal-beacon-rgb:148,163,184;--cal-event-border:#cbd5e1;--cal-event-border-strong:#64748b;--cal-tooltip-bg:#f8fafc;--cal-tooltip-time:#475569}
    .cal-day.has-events:hover,.cal-day.has-events:focus{z-index:30;outline:none;border-color:var(--cal-event-border-strong);box-shadow:0 0 0 2px rgba(var(--cal-beacon-rgb),.12)}
    .cal-day-beacon{position:absolute;top:9px;right:9px;width:10px;height:10px;border-radius:50%;background:var(--cal-beacon);border:2px solid #fff;box-shadow:0 0 0 1px var(--cal-beacon-ring),0 0 0 0 rgba(var(--cal-beacon-rgb),.18);animation:calDayBeaconPulse 1.25s ease-in-out infinite}
    @keyframes calDayBeaconPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 1px var(--cal-beacon-ring),0 0 0 0 rgba(var(--cal-beacon-rgb),.12)}50%{transform:scale(1.14);box-shadow:0 0 0 1px var(--cal-beacon-ring),0 0 0 5px rgba(var(--cal-beacon-rgb),.20)}}
    .cal-hover-tooltip{position:fixed;z-index:30200;width:min(380px,calc(100vw - 24px));max-width:380px;padding:14px 16px;border:1px solid var(--cal-event-border,#e8c86a);border-radius:12px;background:var(--cal-tooltip-bg,#fffdf6);box-shadow:0 16px 40px rgba(32,37,51,.28);text-align:left;box-sizing:border-box;pointer-events:auto}
    .cal-hover-tooltip[hidden]{display:none!important}
    .cal-hover-tooltip.is-reminder{--cal-beacon-rgb:139,92,246;--cal-event-border:#b79af7;--cal-tooltip-bg:#faf7ff;--cal-tooltip-time:#6d45b8}
    .cal-hover-tooltip.is-diagnosis{--cal-beacon-rgb:245,158,11;--cal-event-border:#f2c26b;--cal-tooltip-bg:#fffaf0;--cal-tooltip-time:#a45b04}
    .cal-hover-tooltip.is-session{--cal-beacon-rgb:59,130,246;--cal-event-border:#93b8f5;--cal-tooltip-bg:#f4f8ff;--cal-tooltip-time:#245db5}
    .cal-hover-tooltip.is-free-consultation{--cal-beacon-rgb:34,197,94;--cal-event-border:#86d9a4;--cal-tooltip-bg:#f1fff6;--cal-tooltip-time:#176a36}
    .cal-hover-tooltip.is-call{--cal-beacon-rgb:6,182,212;--cal-event-border:#7bd7e7;--cal-tooltip-bg:#f1fcfe;--cal-tooltip-time:#0e7490}
    .cal-hover-tooltip.is-neutral{--cal-beacon-rgb:148,163,184;--cal-event-border:#cbd5e1;--cal-tooltip-bg:#f8fafc;--cal-tooltip-time:#475569}
    .cal-day-tooltip-row{width:100%;display:grid;grid-template-columns:56px 44px minmax(0,1fr);gap:10px;align-items:center;font-size:13px;line-height:1.35;color:#334155;text-align:left;border:0;background:transparent;padding:4px 2px;font-family:inherit}
    .cal-day-tooltip-row+.cal-day-tooltip-row{margin-top:8px;padding-top:10px;border-top:1px solid rgba(148,163,184,.24)}
    .cal-day-tooltip-client-link{cursor:pointer;border-radius:8px}.cal-day-tooltip-client-link:hover{background:rgba(var(--cal-beacon-rgb),.08)}
    .cal-day-tooltip-time{font-weight:900;color:var(--cal-tooltip-time);font-size:13px}
    .cal-day-tooltip-avatar{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:#e7eef7;color:#315475;font-size:12px;font-weight:900;box-shadow:0 0 0 1px #d4deea}.cal-day-tooltip-avatar img{width:100%;height:100%;object-fit:cover}
    .cal-day-tooltip-details{min-width:0;display:grid;gap:4px}.cal-day-tooltip-client{display:block;font-weight:900;font-size:13px;line-height:1.3;overflow-wrap:anywhere;color:#27384b}
    .cal-day-tooltip-row{--cal-row-accent:#64748b;--cal-row-soft:#f1f5f9}.cal-day-tooltip-row.is-reminder{--cal-row-accent:#7c3aed;--cal-row-soft:#f3e8ff}.cal-day-tooltip-row.is-diagnosis{--cal-row-accent:#d97706;--cal-row-soft:#fff1d6}.cal-day-tooltip-row.is-session{--cal-row-accent:#2563eb;--cal-row-soft:#eaf2ff}.cal-day-tooltip-row.is-free-consultation{--cal-row-accent:#16a34a;--cal-row-soft:#eaf8ef}.cal-day-tooltip-row.is-call{--cal-row-accent:#0891b2;--cal-row-soft:#e8fafd}
    .cal-day-tooltip-action{display:inline-flex;justify-self:start;align-items:center;min-height:20px;padding:2px 8px;border-radius:999px;background:var(--cal-row-soft);color:var(--cal-row-accent);font-size:11px;font-weight:900;line-height:1.25}
    .cal-day-tooltip-note{display:block;padding:5px 7px;border-left:3px solid var(--cal-row-accent);border-radius:5px;background:var(--cal-row-soft);color:var(--cal-row-accent);font-size:11px;font-weight:700;line-height:1.35;overflow-wrap:anywhere}
    .cal-side-title{font-size:15px;font-weight:900;margin-bottom:4px}.cal-selected-date{font-size:12px;color:#64748b;margin-bottom:10px}.cal-events{display:grid;gap:7px;max-height:300px;overflow:auto;margin-bottom:12px}.cal-empty{padding:14px;border:1px dashed #d6dee8;border-radius:10px;text-align:center;color:#94a3b8;font-size:12px}.cal-event{display:grid;grid-template-columns:52px 1fr auto;gap:8px;align-items:start;padding:9px;border:1px solid #e0e7ef;border-radius:10px;background:#f8fafc}.cal-event.is-reminder{border-color:#c4b5fd;background:#faf7ff}.cal-event.is-reminder .cal-event-time,.cal-event.is-reminder .cal-event-title{color:#6d45b8}.cal-event.is-diagnosis{border-color:#f2c26b;background:#fffaf0}.cal-event.is-diagnosis .cal-event-time,.cal-event.is-diagnosis .cal-event-title{color:#a45b04}.cal-event.is-session{border-color:#93b8f5;background:#f4f8ff}.cal-event.is-session .cal-event-time,.cal-event.is-session .cal-event-title{color:#245db5}.cal-event.is-free-consultation{border-color:#86d9a4;background:#f1fff6}.cal-event.is-free-consultation .cal-event-time,.cal-event.is-free-consultation .cal-event-title{color:#176a36}.cal-event.is-call{border-color:#7bd7e7;background:#f1fcfe}.cal-event.is-call .cal-event-time,.cal-event.is-call .cal-event-title{color:#0e7490}.cal-event.is-targeted{border-color:#7c3aed!important;background:#f5efff!important;box-shadow:0 0 0 3px rgba(124,58,237,.18),0 8px 20px rgba(92,54,170,.12);animation:calTargetEventPulse 1.1s ease-in-out 2}@keyframes calTargetEventPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.015)}}.cal-event-time{font-size:12px;font-weight:900;color:#334155}.cal-event-title{font-size:12px;font-weight:900;color:#1e293b}.cal-event-meta{font-size:10px;color:#64748b;margin-top:2px}.cal-delete{width:28px;height:28px!important;padding:0!important;font-size:13px!important;color:#b42318!important}
    .cal-quick-assign{width:100%;height:38px!important;margin:2px 0 12px;background:linear-gradient(#4b90ed,#2f74d6)!important;color:#fff!important;font-weight:900!important}.cal-overlay.client-mode .cal-quick-assign{display:none}.cal-overlay.overview-mode .cal-form{display:none}.cal-overlay.overview-mode.assign-open .cal-form{display:block}
    .cal-form{border-top:1px solid #e2e8f0;padding-top:12px}.cal-form-title{font-size:13px;font-weight:900;margin-bottom:8px}.cal-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cal-form label{display:grid;gap:4px;font-size:10px;font-weight:800;color:#64748b}.cal-form input,.cal-form select,.cal-form textarea{width:100%;box-sizing:border-box;border:1px solid #c6d2df;border-radius:8px;background:#fff;padding:0 9px;font:600 12px 'Segoe UI',Arial,sans-serif;color:#243447}.cal-form input,.cal-form select{height:36px}.cal-form textarea{min-height:64px;padding-top:8px;resize:vertical}.cal-span2{grid-column:1/-1}.cal-client-time-preview{grid-column:1/-1;display:flex;align-items:center;gap:8px;min-height:38px;padding:8px 10px;border:1px solid #d7e0eb;border-radius:8px;background:#f7f9fc;color:#53657a;font-size:11px;font-weight:800;box-sizing:border-box}.cal-client-time-preview strong{font-size:12px;color:#243447}.cal-client-time-preview.ok{border-color:#a9d9bd;background:#f1fbf5}.cal-client-time-preview.caution{border-color:#e8c86a;background:#fffaf0;color:#805900}.cal-client-time-preview.night{border-color:#e7a0a0;background:#fff3f3;color:#a63737}.cal-client-time-preview.night strong{color:#a63737}.cal-client-time-preview.unknown{border-color:#d7dde5;background:#f7f8fa;color:#6b7a8d}.cal-save{width:100%;margin-top:9px;height:38px!important;background:linear-gradient(#48a873,#278656)!important;color:#fff!important;font-weight:900!important}
    .cal-overlay.week-view .cal-week,.cal-overlay.day-view .cal-week{display:none}
    .cal-overlay.week-view .cal-grid,.cal-overlay.day-view .cal-grid{display:block}
    .cal-overlay.week-view .cal-card:first-child,.cal-overlay.day-view .cal-card:first-child{padding:0;overflow:hidden}
    .cal-timegrid{height:474px;display:flex;flex-direction:column;background:#fff}
    .cal-timegrid-head{display:grid;flex:0 0 58px;box-sizing:border-box;border-bottom:1px solid #dadce0;background:#fff}
    .cal-time-axis-head{border-right:1px solid #eef0f2;background:#fff}
    .cal-time-day-head{min-width:0;height:58px!important;min-height:58px!important;margin:0!important;padding:0!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:0!important;border-left:1px solid #eef0f2!important;border-radius:0!important;background:#fff!important;color:#5f6368;cursor:pointer;font-family:'Segoe UI',Arial,sans-serif!important;box-shadow:none!important;transform:none!important;filter:none!important}
    .cal-time-day-head:hover{background:#f8fafd!important;box-shadow:none!important;transform:none!important}
    .cal-time-day-head.selected{background:#f1f6ff!important}
    .cal-time-day-weekday{font-size:12px;font-weight:800;line-height:1.1;text-transform:uppercase;letter-spacing:.03em}
    .cal-time-day-number{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-size:15px;font-weight:800;line-height:1;color:#3c4043}
    .cal-time-day-head.today .cal-time-day-number{background:#1a73e8;color:#fff}
    .cal-timegrid-scroll{position:relative;flex:1;overflow:auto;background:#fff;scrollbar-gutter:stable}
    .cal-timegrid-body{display:grid;position:relative;min-width:0}
    .cal-time-axis{position:relative;border-right:1px solid #eef0f2;background:#fff}
    .cal-time-label{position:absolute;right:10px;transform:translateY(-8px);font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:700;line-height:16px;color:#5f6368;white-space:nowrap}
    .cal-time-column{position:relative;min-width:0;border-left:1px solid #eef0f2;background:repeating-linear-gradient(to bottom,transparent 0,transparent 27px,#f1f3f4 27px,#f1f3f4 28px,transparent 28px,transparent 55px,#dadce0 55px,#dadce0 56px);cursor:crosshair}
    .cal-time-column.selected{background-color:#fbfdff}
    .cal-time-column.today{box-shadow:inset 0 0 0 1px rgba(26,115,232,.08)}
    .cal-time-event{position:absolute;left:4px;right:4px;z-index:4;min-height:30px;padding:5px 7px;border:1px solid #9ec1f6;border-left:4px solid #1a73e8;border-radius:6px;background:#d2e3fc;color:#174ea6;box-sizing:border-box;overflow:hidden;text-align:left;cursor:pointer;box-shadow:0 1px 2px rgba(60,64,67,.12);font-family:inherit}
    .cal-time-event:hover{box-shadow:0 2px 6px rgba(60,64,67,.16)}
    .cal-time-event.is-reminder{border-color:#b79af7;border-left-color:#7c3aed;background:#f3e8ff;color:#6d45b8}.cal-time-event.is-diagnosis{border-color:#f2c26b;border-left-color:#d97706;background:#fff1d6;color:#a45b04}.cal-time-event.is-session{border-color:#93b8f5;border-left-color:#2563eb;background:#eaf2ff;color:#245db5}.cal-time-event.is-free-consultation{border-color:#86d9a4;border-left-color:#16a34a;background:#eaf8ef;color:#176a36}.cal-time-event.is-call{border-color:#7bd7e7;border-left-color:#0891b2;background:#e8fafd;color:#0e7490}.cal-time-event.is-neutral{border-color:#cbd5e1;border-left-color:#64748b;background:#f1f5f9;color:#475569}
    .cal-time-event-time{font-size:12px;font-weight:900;line-height:1.2}
    .cal-time-event-title{margin-top:2px;font-size:13px;font-weight:800;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cal-time-event-meta{margin-top:2px;font-size:11px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.9}
    .cal-now-line{position:absolute;left:0;right:0;z-index:6;height:2px;background:#d93025;pointer-events:none}
    .cal-now-line:before{content:"";position:absolute;left:-5px;top:-4px;width:10px;height:10px;border-radius:50%;background:#d93025}
    .cal-time-empty-note{position:absolute;top:14px;left:14px;z-index:2;color:#80868b;font-size:13px;font-weight:600;pointer-events:none}
    @media(max-width:820px){.cal-layout{grid-template-columns:1fr}.cal-day{min-height:76px}.cal-panel{padding:12px}.cal-toolbar{grid-template-columns:1fr}.cal-month-title{order:-1}.cal-nav{justify-content:center}.cal-today{justify-self:center}.cal-timegrid{height:430px}}
    @media(max-width:560px){.cal-overlay{padding:0;place-items:end center}.cal-panel{width:100%;height:94dvh;min-height:94dvh;max-height:none;border-radius:18px 18px 0 0}.cal-grid,.cal-week{gap:3px}.cal-day{min-height:62px;padding:4px}.cal-chip,.cal-more{display:none}.cal-num{width:24px;height:24px}.cal-form-grid{grid-template-columns:1fr}.cal-span2{grid-column:auto}.cal-timegrid{height:420px}.cal-timegrid-head,.cal-timegrid-body{min-width:700px}.cal-overlay.day-view .cal-timegrid-head,.cal-overlay.day-view .cal-timegrid-body{min-width:0}}
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
              <label>Дата<input class="cal-date" type="date" lang="ru-RU"></label>
              <label>Время<input class="cal-time" type="time" value="19:00"></label>
              <label class="cal-span2">Клиент<select class="cal-client"></select></label>
              <div class="cal-client-time-preview unknown" role="status" aria-live="polite">🕒 <strong>Время клиента:</strong> выберите клиента</div>
              <label class="cal-span2">Тип<select class="cal-type"><option>Сессия</option><option>Диагностика</option><option>Бесплатная консультация</option><option>Созвон</option><option>Напоминание</option><option>Другое</option></select></label>
              <label class="cal-span2">Комментарий<textarea class="cal-note" placeholder="Что запланировано"></textarea></label>
            </div>
            <button type="button" class="tk-btn cal-save">Сохранить запись</button>
          </div>
        </div>
      </div>
    </section>`;
  document.body.appendChild(overlay);

  const hoverTooltip=document.createElement('div');
  hoverTooltip.className='cal-hover-tooltip is-neutral';
  hoverTooltip.hidden=true;
  hoverTooltip.setAttribute('role','tooltip');
  overlay.appendChild(hoverTooltip);

  let hoverTooltipHideTimer=0;
  function cancelHoverTooltipHide(){
    if(hoverTooltipHideTimer){clearTimeout(hoverTooltipHideTimer);hoverTooltipHideTimer=0;}
  }
  function hideHoverTooltip(){
    cancelHoverTooltipHide();
    hoverTooltip.hidden=true;
    hoverTooltip.innerHTML='';
    hoverTooltip.style.left='';
    hoverTooltip.style.top='';
  }
  function scheduleHoverTooltipHide(){
    cancelHoverTooltipHide();
    hoverTooltipHideTimer=setTimeout(hideHoverTooltip,120);
  }
  function calendarTooltipTheme(kind){
    return ['reminder','diagnosis','session','free-consultation','call','neutral'].includes(kind)?kind:'neutral';
  }
  function eventActionLabel(e){
    const type=String(e?.type||'').trim();
    const title=String(e?.title||'').trim();
    if(type)return type;
    if(/^сессия(?:\s*№\s*\d+)?$/i.test(title))return 'Сессия';
    return title||'Запись';
  }
  function eventTooltipNote(e){
    return String(e?.note||e?.meta||'').trim();
  }
  function eventTooltipLabel(e){
    const action=eventActionLabel(e);
    const note=eventTooltipNote(e);
    return note?action+' — '+note:action;
  }
  function positionHoverTooltip(anchor){
    if(!anchor||hoverTooltip.hidden)return;
    const rect=anchor.getBoundingClientRect();
    const tip=hoverTooltip.getBoundingClientRect();
    const margin=12;
    let left=rect.left+(rect.width-tip.width)/2;
    left=Math.max(margin,Math.min(window.innerWidth-tip.width-margin,left));
    let top=rect.bottom+8;
    if(top+tip.height>window.innerHeight-margin)top=rect.top-tip.height-8;
    top=Math.max(margin,Math.min(window.innerHeight-tip.height-margin,top));
    hoverTooltip.style.left=Math.round(left)+'px';
    hoverTooltip.style.top=Math.round(top)+'px';
  }
  function showHoverTooltip(anchor,evs){
    cancelHoverTooltipHide();
    const rows=Array.isArray(evs)?evs:[];
    const kind=calendarTooltipTheme(calendarDayKind(rows));
    hoverTooltip.className='cal-hover-tooltip is-'+kind;
    hoverTooltip.innerHTML=rows.map(e=>{
      const client=clientById(e.clientId);
      const name=client?.name||e.clientName||'Без клиента';
      const rowKind=calendarEventKind(e);
      const action=eventActionLabel(e);
      const note=eventTooltipNote(e);
      const tag=client&&e.clientId?'button':'div';
      const classes='cal-day-tooltip-row'+(client&&e.clientId?' cal-day-tooltip-client-link':'')+' is-'+rowKind;
      const attrs=client&&e.clientId?` type="button" class="${classes}" data-client-id="${esc(e.clientId)}"`:` class="${classes}"`;
      return `<${tag}${attrs}><span class="cal-day-tooltip-time">${esc(e.time||'—')}</span>${clientAvatarHtml(client)}<span class="cal-day-tooltip-details"><span class="cal-day-tooltip-client">${esc(name)}</span><span class="cal-day-tooltip-action">${esc(action)}</span>${note?`<span class="cal-day-tooltip-note">${esc(note)}</span>`:''}</span></${tag}>`;
    }).join('');
    hoverTooltip.hidden=false;
    hoverTooltip.querySelectorAll('.cal-day-tooltip-client-link').forEach(link=>{
      link.addEventListener('click',event=>{
        event.stopPropagation();
        openClientFromCalendar(link.dataset.clientId);
      });
    });
    requestAnimationFrame(()=>positionHoverTooltip(anchor));
  }
  hoverTooltip.addEventListener('mouseenter',cancelHoverTooltipHide);
  hoverTooltip.addEventListener('mouseleave',scheduleHoverTooltipHide);

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
  let targetedEventId='';
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
  function calendarEventKind(event){
    const type=String(event?.type||'').trim().toLowerCase();
    const title=String(event?.title||'').trim().toLowerCase();
    if(type==='напоминание'||title==='напоминание')return 'reminder';
    if(type==='диагностика'||title==='диагностика')return 'diagnosis';
    if(type==='сессия'||/^сессия №\d+$/i.test(String(event?.title||'').trim()))return 'session';
    if(type==='бесплатная консультация'||title==='бесплатная консультация')return 'free-consultation';
    if(type==='созвон'||title==='созвон')return 'call';
    return 'neutral';
  }
  function calendarDayKind(rows){
    const kinds=(rows||[]).map(calendarEventKind);
    if(kinds.includes('reminder'))return 'reminder';
    if(kinds.includes('diagnosis'))return 'diagnosis';
    if(kinds.includes('session'))return 'session';
    if(kinds.includes('free-consultation'))return 'free-consultation';
    if(kinds.includes('call'))return 'call';
    return 'neutral';
  }
  function eventIsCompleted(event){
    const status=String(event?.status||'').trim().toLowerCase();
    return event?.sessionCompleted===true
      || Boolean(event?.completedAt||event?.conductedAt)
      || ['completed','done','cancelled','canceled'].includes(status);
  }
  function eventShouldSignal(event,now=new Date()){
    if(!event||eventIsCompleted(event))return false;
    const date=String(event.date||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
    const today=iso(now.getFullYear(),now.getMonth(),now.getDate());
    if(date<today)return false;
    if(date>today)return true;
    const match=String(event.time||'').trim().match(/^(\d{1,2}):(\d{2})/);
    if(!match)return true;
    const [year,month,day]=date.split('-').map(Number);
    const at=new Date(year,month-1,day,Number(match[1]),Number(match[2]),0,0);
    return at.getTime()>now.getTime();
  }
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
      row.className=`cal-event is-${calendarEventKind(e)}`;
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
    monthTitle.textContent=`${MONTHS[m]} ${y}`;
    overlay.classList.remove('week-view','day-view');
    overlay.querySelectorAll('.cal-view-btn').forEach(button=>button.classList.toggle('active',button.dataset.view==='month'));
    overlay.querySelector('.cal-today')?.classList.remove('active');
    grid.innerHTML='';

    const first=new Date(y,m,1);
    const shift=(first.getDay()+6)%7;
    const start=new Date(y,m,1-shift);

    for(let i=0;i<42;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);
      const ds=iso(d.getFullYear(),d.getMonth(),d.getDate());
      const evs=eventsOn(ds);
      const signalEvents=evs.filter(event=>eventShouldSignal(event));
      const cell=document.createElement('div');
      cell.dataset.date=ds;
      const weekend=(i%7)>=5;
      const hasRecords=evs.length>0;
      const hasSignal=signalEvents.length>0;
      const eventClass=hasSignal?` has-events is-${calendarDayKind(signalEvents)}`:(hasRecords?' has-records':'');
      const outside=d.getMonth()!==m;
      cell.className='cal-day'+(outside?' out':'')+(ds===selected?' selected':'')+(ds===today?' today':'')+(weekend?' cal-day-weekend':'')+eventClass;
      if(hasRecords)cell.tabIndex=0;

      cell.innerHTML=`<div class="cal-num">${d.getDate()}</div>${hasSignal?'<span class="cal-day-beacon" aria-hidden="true"></span>':''}`;
      if(hasSignal){
        cell.setAttribute('aria-label',signalEvents.map(e=>`${e.time||'—'} ${clientById(e.clientId)?.name||e.clientName||'Без клиента'} — ${eventTooltipLabel(e)}`).join('; '));
        cell.addEventListener('mouseenter',()=>showHoverTooltip(cell,signalEvents));
        cell.addEventListener('mouseleave',scheduleHoverTooltipHide);
        cell.addEventListener('focusin',()=>showHoverTooltip(cell,signalEvents));
        cell.addEventListener('focusout',scheduleHoverTooltipHide);
      }
      cell.onclick=()=>{
        selected=ds;
        if(d.getMonth()!==m)cursor=new Date(d.getFullYear(),d.getMonth(),1);
        render();
      };
      grid.appendChild(cell);
    }
  }

  function eventMinutes(event){
    const match=String(event?.time||'').match(/^(\d{1,2}):(\d{2})/);
    if(!match)return TIME_GRID_START*60;
    const hours=Math.max(0,Math.min(23,Number(match[1])||0));
    const minutes=Math.max(0,Math.min(59,Number(match[2])||0));
    return hours*60+minutes;
  }

  function timeGridDays(){
    if(viewMode==='day')return [new Date(selected+'T12:00:00')];
    const start=weekStart(new Date(selected+'T12:00:00'));
    return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});
  }

  function timeGridHeaderLabel(date){
    const weekday=new Intl.DateTimeFormat('ru-RU',{weekday:'short'}).format(date).replace('.','');
    return {weekday,day:String(date.getDate())};
  }

  function dayHeadForDate(head,date){
    return Array.from(head.querySelectorAll('.cal-time-day-head')).find(x=>x.dataset.date===date)||null;
  }

  function renderTimeGrid(){
    const today=todayIso();
    const days=timeGridDays();
    const start=days[0];
    monthTitle.textContent=viewMode==='day'?dayTitle(start):weekTitle(start);
    overlay.classList.toggle('week-view',viewMode==='week');
    overlay.classList.toggle('day-view',viewMode==='day');
    overlay.querySelectorAll('.cal-view-btn').forEach(button=>button.classList.toggle('active',button.dataset.view===viewMode));
    overlay.querySelector('.cal-today')?.classList.toggle('active',viewMode==='day'&&selected===today);
    grid.innerHTML='';

    const wrap=document.createElement('div');
    wrap.className='cal-timegrid';

    const head=document.createElement('div');
    head.className='cal-timegrid-head';
    head.style.gridTemplateColumns=`64px repeat(${days.length},minmax(0,1fr))`;
    const axisHead=document.createElement('div');
    axisHead.className='cal-time-axis-head';
    head.appendChild(axisHead);

    days.forEach(d=>{
      const ds=iso(d.getFullYear(),d.getMonth(),d.getDate());
      const label=timeGridHeaderLabel(d);
      const dayHead=document.createElement('button');
      dayHead.type='button';
      dayHead.dataset.date=ds;
      dayHead.className='cal-time-day-head'+(ds===today?' today':'')+(ds===selected?' selected':'');
      dayHead.innerHTML=`<span class="cal-time-day-weekday">${esc(label.weekday)}</span><span class="cal-time-day-number">${esc(label.day)}</span>`;
      dayHead.onclick=()=>{
        selected=ds;
        renderDayDetails();
        updateClientTimePreview();
        head.querySelectorAll('.cal-time-day-head').forEach(x=>x.classList.toggle('selected',x.dataset.date===ds));
        body.querySelectorAll('.cal-time-column').forEach(x=>x.classList.toggle('selected',x.dataset.date===ds));
      };
      head.appendChild(dayHead);
    });

    const scroll=document.createElement('div');
    scroll.className='cal-timegrid-scroll';

    const body=document.createElement('div');
    body.className='cal-timegrid-body';
    body.style.gridTemplateColumns=`64px repeat(${days.length},minmax(0,1fr))`;
    const totalHeight=(TIME_GRID_END-TIME_GRID_START)*TIME_GRID_HOUR_PX;
    body.style.height=totalHeight+'px';

    const axis=document.createElement('div');
    axis.className='cal-time-axis';
    axis.style.height=totalHeight+'px';
    for(let hour=TIME_GRID_START;hour<TIME_GRID_END;hour++){
      const label=document.createElement('span');
      label.className='cal-time-label';
      label.style.top=(hour===TIME_GRID_START?'4px':((hour-TIME_GRID_START)*TIME_GRID_HOUR_PX)+'px');
      if(hour===TIME_GRID_START)label.style.transform='none';
      label.textContent=pad(hour)+':00';
      axis.appendChild(label);
    }
    body.appendChild(axis);

    days.forEach(d=>{
      const ds=iso(d.getFullYear(),d.getMonth(),d.getDate());
      const col=document.createElement('div');
      col.className='cal-time-column'+(ds===selected?' selected':'')+(ds===today?' today':'');
      col.dataset.date=ds;
      col.style.height=totalHeight+'px';

      const dayEvents=eventsOn(ds);
      if(!dayEvents.length&&viewMode==='day'){
        const empty=document.createElement('div');
        empty.className='cal-time-empty-note';
        empty.textContent='Свободный день';
        col.appendChild(empty);
      }

      dayEvents.forEach(e=>{
        const mins=eventMinutes(e);
        const clamped=Math.max(TIME_GRID_START*60,Math.min(TIME_GRID_END*60-15,mins));
        const top=((clamped-TIME_GRID_START*60)/60)*TIME_GRID_HOUR_PX;
        const item=document.createElement('button');
        item.type='button';
        item.className='cal-time-event is-'+calendarEventKind(e);
        item.style.top=Math.max(0,top+2)+'px';
        item.style.height=Math.max(34,TIME_GRID_HOUR_PX*.78)+'px';
        const client=clientById(e.clientId);
        const title=client?.name||e.clientName||e.title||e.type||'Запись';
        const action=eventActionLabel(e);
        const note=eventTooltipNote(e);
        const meta=[action,note].filter(Boolean).join(' • ');
        item.innerHTML=`<div class="cal-time-event-time">${esc(e.time||'Без времени')}</div><div class="cal-time-event-title">${esc(title)}</div><div class="cal-time-event-meta">${esc(action)}</div>${note?`<div class="cal-time-event-meta">${esc(note)}</div>`:''}`;
        item.title=[e.time,title,action,note].filter(Boolean).join(' · ');
        item.onclick=event=>{
          event.stopPropagation();
          selected=ds;
          dateInput.value=ds;
          if(e.time)timeInput.value=e.time;
          renderDayDetails();
          updateClientTimePreview();
          head.querySelectorAll('.cal-time-day-head').forEach(x=>x.classList.toggle('selected',x.dataset.date===ds));
          body.querySelectorAll('.cal-time-column').forEach(x=>x.classList.toggle('selected',x.dataset.date===ds));
        };
        col.appendChild(item);
      });

      if(ds===today){
        const now=new Date();
        const mins=now.getHours()*60+now.getMinutes();
        if(mins>=TIME_GRID_START*60&&mins<=TIME_GRID_END*60){
          const line=document.createElement('div');
          line.className='cal-now-line';
          line.style.top=(((mins-TIME_GRID_START*60)/60)*TIME_GRID_HOUR_PX)+'px';
          col.appendChild(line);
        }
      }

      col.onclick=event=>{
        if(event.target.closest('.cal-time-event'))return;
        const rect=col.getBoundingClientRect();
        const y=Math.max(0,Math.min(totalHeight,event.clientY-rect.top));
        const raw=TIME_GRID_START*60+(y/TIME_GRID_HOUR_PX)*60;
        const snapped=Math.round(raw/15)*15;
        const clampedMinutes=Math.max(TIME_GRID_START*60,Math.min(TIME_GRID_END*60-15,snapped));
        const hours=Math.floor(clampedMinutes/60);
        const minutes=clampedMinutes%60;
        selected=ds;
        dateInput.value=ds;
        timeInput.value=pad(hours)+':'+pad(minutes);
        renderDayDetails();
        updateClientTimePreview();
        head.querySelectorAll('.cal-time-day-head').forEach(x=>x.classList.toggle('selected',x.dataset.date===ds));
        body.querySelectorAll('.cal-time-column').forEach(x=>x.classList.toggle('selected',x.dataset.date===ds));
      };
      body.appendChild(col);
    });

    scroll.appendChild(body);
    wrap.append(head,scroll);
    grid.appendChild(wrap);

    requestAnimationFrame(()=>{
      const scrollbarWidth=Math.max(0,scroll.offsetWidth-scroll.clientWidth);
      head.style.paddingRight=scrollbarWidth+'px';
      scroll.scrollTop=0;
    });
  }

  function renderCalendarSurface(){
    if(viewMode==='month')renderMonth();
    else renderTimeGrid();
  }

  function syncModeUi(){
    overlay.classList.toggle('overview-mode',openMode==='overview');
    overlay.classList.toggle('client-mode',openMode==='client');
    overlay.classList.toggle('assign-open',assignOpen);
    const quick=overlay.querySelector('.cal-quick-assign');
    if(quick)quick.textContent=assignOpen?'Скрыть назначение':'＋ Выбрать и назначить';
  }

  function focusTargetedEvent(){
    if(!targetedEventId)return;
    requestAnimationFrame(()=>{
      const row=eventsBox.querySelector('[data-calendar-event-id="'+CSS.escape(String(targetedEventId))+'"]');
      if(!row)return;
      eventsBox.querySelectorAll('.cal-event.is-targeted').forEach(x=>x.classList.remove('is-targeted'));
      row.classList.add('is-targeted');
      row.scrollIntoView({block:'center',behavior:'smooth'});
      row.setAttribute('tabindex','-1');
      try{row.focus({preventScroll:true});}catch(_){}
    });
  }

  function render(){
    hideHoverTooltip();
    syncModeUi();
    fillClientOptions();
    renderCalendarSurface();
    renderDayDetails();
    updateClientTimePreview();
    focusTargetedEvent();
  }

  function openCalendar(options={}){
    const now=new Date();
    openMode=options?.mode==='overview'?'overview':'client';
    viewMode=options?.view==='week'?'week':'month';
    assignOpen=false;
    targetedEventId=String(options?.eventId||'').trim();

    let target=null;
    if(targetedEventId){
      const rows=calendarApi()?.list?.();
      target=Array.isArray(rows)?rows.find(event=>String(event?.id||'')===targetedEventId)||null:null;
    }

    if(target?.date&&/^\d{4}-\d{2}-\d{2}$/.test(String(target.date))){
      selected=String(target.date);
      const d=new Date(selected+'T12:00:00');
      cursor=new Date(d.getFullYear(),d.getMonth(),1);
      viewMode='month';
    }else{
      selected=todayIso();
      cursor=new Date(now.getFullYear(),now.getMonth(),1);
      targetedEventId='';
    }

    if(openMode==='overview')clientSelect.value='';
    render();
    if(!overlay.open)overlay.showModal();
    document.documentElement.style.overflow='hidden';
    return true;
  }

  function openEvent(eventId,options={}){
    if(eventId===undefined||eventId===null||eventId==='')return false;
    return openCalendar({...options,eventId:String(eventId)});
  }
  function closeCalendar(){hideHoverTooltip();if(overlay.open)overlay.close();document.documentElement.style.overflow='';}

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
    const plannedSessionSkeleton=['Сессия','Диагностика','Бесплатная консультация','Созвон','Другое'].includes(type);
    const item={date,time:timeInput.value||'',clientId:clientIdValue,clientName:c?.name||'',type,title:type,note,plannedSessionSkeleton};
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

  const ui=Object.freeze({version:'8E',open:openCalendar,openEvent,refresh:render});
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