'use strict';

(() => {
  if(window.__diagnostikaHeaderCurrencyDisplayReady) return;
  window.__diagnostikaHeaderCurrencyDisplayReady=true;

  const style=document.createElement('style');
  style.textContent=`
    #headerCurrencyBtn.currency-compact-display{grid-template-columns:28px 1fr!important;grid-template-rows:16px 18px!important;grid-template-areas:'icon code' 'icon rate'!important;column-gap:7px!important;row-gap:2px!important;align-items:center!important;padding:4px 8px!important}
    #headerCurrencyBtn.currency-compact-display .hu-icon{grid-area:icon!important;font-size:24px!important;font-weight:900!important;line-height:1!important;text-align:center!important;padding-right:6px!important;border-right:1px solid rgba(255,255,255,.28)!important}
    #headerCurrencyBtn.currency-compact-display .hu-sub{grid-area:code!important;margin:0!important;max-width:none!important;overflow:visible!important;text-overflow:clip!important;text-align:left!important;justify-self:start!important;font-size:10px!important;font-weight:800!important;letter-spacing:.7px!important;line-height:1!important;align-self:end!important;color:#dbeafe!important}
    #headerCurrencyBtn.currency-compact-display .hu-main{grid-area:rate!important;text-align:left!important;justify-self:start!important;font-size:13px!important;font-weight:900!important;line-height:1!important;align-self:start!important;overflow:visible!important;text-overflow:clip!important;color:#fff!important}

    /* The dollar icon is a compact status beacon, the whole button stays unchanged. */
    #headerCurrencyBtn.currency-compact-display .hu-icon{
      border-radius:7px!important;border-right:0!important;
      color:#fff!important;
      background:linear-gradient(145deg,#498b7d,#195d55)!important;
      box-shadow:inset 0 1px 1px rgba(255,255,255,.35),0 0 0 1px rgba(119,233,196,.46)!important;
      transition:background .2s ease,box-shadow .2s ease!important;
    }
    #headerCurrencyBtn.currency-compact-display[data-rate-state="sync"] .hu-icon{
      background:linear-gradient(145deg,#e8b54d,#ab6a0a)!important;
      box-shadow:inset 0 1px 1px rgba(255,255,255,.45),0 0 0 1px rgba(255,197,75,.75)!important;
      animation:diagnostika-currency-sync 1.15s ease-in-out infinite!important;
    }
    #headerCurrencyBtn.currency-compact-display[data-rate-state="error"] .hu-icon{
      background:linear-gradient(145deg,#db6e68,#8d252c)!important;
      box-shadow:inset 0 1px 1px rgba(255,255,255,.25),0 0 0 1px rgba(255,103,110,.75)!important;
      animation:none!important;
    }
    #headerCurrencyBtn.currency-compact-display[data-rate-state="ready"] .hu-icon{
      animation:none!important;
    }
    @keyframes diagnostika-currency-sync{
      0%,100%{filter:brightness(.88)}
      50%{filter:brightness(1.28)}
    }
    @media(prefers-reduced-motion:reduce){
      #headerCurrencyBtn.currency-compact-display[data-rate-state="sync"] .hu-icon{animation:none!important}
    }
  `;
  document.head.appendChild(style);

  function apply(){
    const btn=document.getElementById('headerCurrencyBtn');
    if(!btn)return false;
    const icon=btn.querySelector('.hu-icon');
    const main=btn.querySelector('.hu-main');
    const sub=btn.querySelector('.hu-sub');
    if(icon && icon.textContent !== '$')icon.textContent='$';
    // Keep the national-currency symbol after the exchange-rate amount.
    if(sub&&!sub.textContent.trim())sub.textContent='USD';
    btn.classList.add('currency-compact-display');
    return true;
  }

  function bind(){
    if(!apply()) return false;
    const btn=document.getElementById('headerCurrencyBtn');
    if(!btn||btn.dataset.currencyDisplayBound==='1') return Boolean(btn);
    btn.dataset.currencyDisplayBound='1';
    const observer=new MutationObserver(()=>apply());
    observer.observe(btn,{subtree:true,childList:true,characterData:true});
    return true;
  }

  if(!bind()){
    let tries=0;
    const retry=()=>{
      tries+=1;
      if(bind()||tries>=30) return;
      setTimeout(retry,100);
    };
    setTimeout(retry,100);
  }
})();
