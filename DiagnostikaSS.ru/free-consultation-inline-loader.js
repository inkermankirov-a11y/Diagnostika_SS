'use strict';

(() => {
  if (window.__freeConsultationInlineLoaderReady) return;
  window.__freeConsultationInlineLoaderReady = true;

  const style = document.createElement('style');
  style.textContent = `
    .fc-inline-loader-wrap{display:inline-flex;align-items:center;gap:8px;min-height:22px;color:#6f86a0;font-size:12px;vertical-align:middle}
    .fc-inline-loader{position:relative;width:22px;height:22px;flex:0 0 22px}
    .fc-inline-loader span{position:absolute;left:10px;top:2px;width:3px;height:6px;border-radius:999px;background:#3f82e6;transform-origin:1.5px 9px;opacity:.18;animation:fcWinDot .88s linear infinite}
    .fc-inline-loader span:nth-child(1){transform:rotate(0deg);animation-delay:-.77s}
    .fc-inline-loader span:nth-child(2){transform:rotate(45deg);animation-delay:-.66s}
    .fc-inline-loader span:nth-child(3){transform:rotate(90deg);animation-delay:-.55s}
    .fc-inline-loader span:nth-child(4){transform:rotate(135deg);animation-delay:-.44s}
    .fc-inline-loader span:nth-child(5){transform:rotate(180deg);animation-delay:-.33s}
    .fc-inline-loader span:nth-child(6){transform:rotate(225deg);animation-delay:-.22s}
    .fc-inline-loader span:nth-child(7){transform:rotate(270deg);animation-delay:-.11s}
    .fc-inline-loader span:nth-child(8){transform:rotate(315deg);animation-delay:0s}
    @keyframes fcWinDot{0%,12.5%{opacity:1}25%{opacity:.72}50%{opacity:.34}75%,100%{opacity:.16}}
    .fc-ai[disabled]{cursor:wait;opacity:.82}
  `;
  document.head.appendChild(style);

  function loaderHtml(){
    return `<span class="fc-inline-loader-wrap"><span class="fc-inline-loader" aria-hidden="true">${'<span></span>'.repeat(8)}</span><span class="fc-inline-loader-text">Анализирую консультацию...</span></span>`;
  }

  function attach(){
    const dlg = document.getElementById('freeConsultationDialog');
    if (!dlg) return;
    const status = dlg.querySelector('.fc-status');
    if (!status || status.dataset.inlineLoaderReady === '1') return;
    status.dataset.inlineLoaderReady = '1';

    let internal = false;
    const sync = () => {
      if (internal) return;
      const text = (status.textContent || '').trim();
      const loading = /анализирую консультац/i.test(text);
      if (loading && !status.querySelector('.fc-inline-loader')) {
        internal = true;
        status.innerHTML = loaderHtml();
        internal = false;
      }
    };

    new MutationObserver(sync).observe(status,{childList:true,subtree:true,characterData:true});
    sync();
  }

  attach();
  new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});
})();
