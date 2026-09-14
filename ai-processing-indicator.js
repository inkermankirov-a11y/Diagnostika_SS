'use strict';

(() => {
  if(window.__diagnostikaAiProcessingIndicatorReady) return;
  window.__diagnostikaAiProcessingIndicatorReady=true;

  const style=document.createElement('style');
  style.textContent=`
    .fc-status{display:inline-flex;align-items:center;min-height:24px}
    .fc-inline-ai-loading{display:inline-flex;align-items:center;gap:9px;color:#70859d;font-size:12px;white-space:nowrap}
    .fc-inline-ai-spinner{position:relative;width:22px;height:22px;flex:0 0 22px}
    .fc-inline-ai-spinner i{position:absolute;left:9.5px;top:1px;width:3px;height:6px;border-radius:999px;background:#347fe8;transform-origin:1.5px 10px;opacity:.14;animation:fcAiDotFade .88s linear infinite}
    .fc-inline-ai-spinner i:nth-child(1){transform:rotate(0deg);animation-delay:-.77s}.fc-inline-ai-spinner i:nth-child(2){transform:rotate(45deg);animation-delay:-.66s}.fc-inline-ai-spinner i:nth-child(3){transform:rotate(90deg);animation-delay:-.55s}.fc-inline-ai-spinner i:nth-child(4){transform:rotate(135deg);animation-delay:-.44s}.fc-inline-ai-spinner i:nth-child(5){transform:rotate(180deg);animation-delay:-.33s}.fc-inline-ai-spinner i:nth-child(6){transform:rotate(225deg);animation-delay:-.22s}.fc-inline-ai-spinner i:nth-child(7){transform:rotate(270deg);animation-delay:-.11s}.fc-inline-ai-spinner i:nth-child(8){transform:rotate(315deg);animation-delay:0s}
    .fc-ai[disabled]{cursor:wait;opacity:.82}
    #freeConsultationDialog .fcq-answer{background:#f1fbf4!important;border-color:#b9ddc5!important}
    #freeConsultationDialog .fcq-value{color:#146534!important;font-weight:700!important}
    @keyframes fcAiDotFade{0%,12.5%{opacity:1}25%{opacity:.72}50%{opacity:.36}75%,100%{opacity:.14}}
    @media(prefers-reduced-motion:reduce){.fc-inline-ai-spinner i{animation-duration:1.8s}}
  `;
  document.head.appendChild(style);

  function spinnerHtml(){
    return `<span class="fc-inline-ai-loading"><span class="fc-inline-ai-spinner" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span>Анализирую консультацию...</span></span>`;
  }

  function attach(){
    const status=document.querySelector('#freeConsultationDialog .fc-status');
    if(!status||status.dataset.aiInlineLoader==='1') return false;
    status.dataset.aiInlineLoader='1';
    let changing=false;
    const sync=()=>{
      if(changing)return;
      const text=(status.textContent||'').trim();
      if(/анализирую консультац/i.test(text)&&!status.querySelector('.fc-inline-ai-loading')){
        changing=true;
        status.innerHTML=spinnerHtml();
        changing=false;
      }
    };
    new MutationObserver(sync).observe(status,{childList:true,subtree:true,characterData:true});
    sync();
    return true;
  }

  if(!attach()){
    let tries=0;
    const retry=()=>{
      tries+=1;
      if(attach()||tries>=20) return;
      setTimeout(retry,100);
    };
    setTimeout(retry,100);
  }
})();
