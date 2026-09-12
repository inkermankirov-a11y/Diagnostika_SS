'use strict';

(() => {
  const textarea = document.querySelector('#requestTitle');
  if (!textarea) return;

  const label = textarea.previousElementSibling;
  const wrap = document.createElement('div');
  wrap.className = 'request-title-display-wrap';
  wrap.innerHTML = `
    <div class="request-title-display" id="requestTitleDisplay">—</div>
    <button type="button" class="tk-btn request-title-edit" id="requestTitleEditBtn">Редактировать</button>
  `;
  textarea.insertAdjacentElement('beforebegin', wrap);
  textarea.style.display = 'none';
  if (label && label.classList.contains('small-section-title')) label.textContent = 'ОСНОВНОЙ ЗАПРОС';

  const style = document.createElement('style');
  style.textContent = `
    .request-title-display-wrap{display:flex;align-items:center;gap:10px;margin:5px 0 12px}
    .request-title-display{flex:1;min-width:0;padding:11px 13px;border:1px solid #c8d5e5;border-left:5px solid #4b67dc;border-radius:8px;background:linear-gradient(180deg,#f8fbff,#eef4ff);color:#22324a;font-size:17px;font-weight:800;line-height:1.28;box-shadow:0 1px 2px rgba(15,23,42,.08);word-break:break-word}
    .request-title-edit{flex:0 0 auto;min-height:40px!important;padding:8px 12px!important;font-size:11px!important}
    @media(max-width:700px){.request-title-display-wrap{align-items:stretch;flex-direction:column;gap:7px}.request-title-display{font-size:16px}.request-title-edit{align-self:flex-start}}
  `;
  document.head.appendChild(style);

  function getCurrentRequest(){
    const c = typeof client === 'function' ? client() : null;
    if (!c) return null;
    return c.requests?.find(r => r.id === requestId) || null;
  }

  function sync(){
    const r = getCurrentRequest();
    const display = document.querySelector('#requestTitleDisplay');
    if (display) display.textContent = r?.title?.trim() || 'Запрос не заполнен';
    textarea.style.display = 'none';
    if (label && label.classList.contains('small-section-title')) label.textContent = 'ОСНОВНОЙ ЗАПРОС';
  }

  document.querySelector('#requestTitleEditBtn')?.addEventListener('click', () => {
    const r = getCurrentRequest();
    if (!r) return;
    const next = window.prompt('Редактировать основной запрос', r.title || '');
    if (next === null) return;
    const value = next.trim();
    if (!value) return;
    r.title = value;
    textarea.value = value;
    r.updatedAt = new Date().toISOString();
    if (typeof save === 'function') save();
    if (typeof renderRequests === 'function') renderRequests();
    sync();
  });

  const oldRenderRequests = window.renderRequests;
  if (typeof oldRenderRequests === 'function' && !oldRenderRequests.__requestTitleDisplayPatched) {
    const wrapped = function(){
      const result = oldRenderRequests.apply(this, arguments);
      setTimeout(sync, 0);
      return result;
    };
    wrapped.__requestTitleDisplayPatched = true;
    window.renderRequests = wrapped;
  }

  document.querySelector('#requestSelect')?.addEventListener('change', () => setTimeout(sync, 0));
  sync();
})();

(() => {
  function loadOnce(src, marker){
    if(document.querySelector(`script[${marker}]`)) return;
    const s=document.createElement('script');
    s.src=src;
    s.setAttribute(marker,'1');
    document.body.appendChild(s);
  }
  loadOnce('currency-calculator-history.js?v=2','data-currency-calculator-direct');
  loadOnce('quick-notes.js?v=1','data-quick-notes-direct');
})();

// Main home screen redesign. Loaded last so it can reuse the existing application logic safely.
(() => {
  if(!document.querySelector('link[data-home-dashboard]')){
    const l=document.createElement('link');
    l.rel='stylesheet';
    l.href='home-dashboard.css?v=20260912-37';
    l.setAttribute('data-home-dashboard','1');
    document.head.appendChild(l);
  }
  if(!document.querySelector('script[data-home-dashboard]')){
    const s=document.createElement('script');
    s.src='home-dashboard.js?v=20260912-37';
    s.setAttribute('data-home-dashboard','1');
    s.onload=()=>{
      if(!document.querySelector('script[data-home-dashboard-sessions]')){
        const x=document.createElement('script');
        x.src='home-dashboard-sessions.js?v=20260912-37';
        x.setAttribute('data-home-dashboard-sessions','1');
        document.body.appendChild(x);
      }
    };
    document.body.appendChild(s);
  }else if(!document.querySelector('script[data-home-dashboard-sessions]')){
    const x=document.createElement('script');
    x.src='home-dashboard-sessions.js?v=20260912-37';
    x.setAttribute('data-home-dashboard-sessions','1');
    document.body.appendChild(x);
  }
})();
