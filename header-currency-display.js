'use strict';

(() => {
  function apply(){
    const btn=document.getElementById('headerCurrencyBtn');
    if(!btn)return false;
    const icon=btn.querySelector('.hu-icon');
    const main=btn.querySelector('.hu-main');
    const sub=btn.querySelector('.hu-sub');
    if(icon) icon.textContent='$';
    if(main){
      const clean=main.textContent.replace(/\s*₽\s*$/,'').trim();
      if(clean!==main.textContent) main.textContent=clean;
    }
    if(sub && !sub.textContent.trim()) sub.textContent='USD';
    btn.classList.add('currency-compact-display');
    return true;
  }

  const style=document.createElement('style');
  style.textContent=`
    #headerCurrencyBtn.currency-compact-display{
      grid-template-columns:28px 1fr!important;
      grid-template-rows:16px 18px!important;
      grid-template-areas:'icon code' 'icon rate'!important;
      column-gap:7px!important;
      row-gap:2px!important;
      align-items:center!important;
      padding:4px 8px!important;
    }
    #headerCurrencyBtn.currency-compact-display .hu-icon{
      grid-area:icon!important;
      font-size:24px!important;
      font-weight:900!important;
      line-height:1!important;
      text-align:center!important;
      padding-right:6px!important;
      border-right:1px solid rgba(255,255,255,.28)!important;
    }
    #headerCurrencyBtn.currency-compact-display .hu-sub{
      grid-area:code!important;
      margin:0!important;
      max-width:none!important;
      overflow:visible!important;
      text-overflow:clip!important;
      text-align:left!important;
      justify-self:start!important;
      font-size:10px!important;
      font-weight:800!important;
      letter-spacing:.7px!important;
      line-height:1!important;
      align-self:end!important;
      color:#dbeafe!important;
    }
    #headerCurrencyBtn.currency-compact-display .hu-main{
      grid-area:rate!important;
      text-align:left!important;
      justify-self:start!important;
      font-size:13px!important;
      font-weight:900!important;
      line-height:1!important;
      align-self:start!important;
      overflow:visible!important;
      text-overflow:clip!important;
      color:#fff!important;
    }
  `;
  document.head.appendChild(style);

  let observer=null;
  function start(){
    if(!apply()){setTimeout(start,100);return;}
    const btn=document.getElementById('headerCurrencyBtn');
    observer=new MutationObserver(()=>{
      const main=btn?.querySelector('.hu-main');
      if(!main)return;
      const clean=main.textContent.replace(/\s*₽\s*$/,'').trim();
      if(clean!==main.textContent) main.textContent=clean;
      const icon=btn.querySelector('.hu-icon');
      if(icon&&icon.textContent!=='$')icon.textContent='$';
    });
    observer.observe(btn,{subtree:true,childList:true,characterData:true});
  }
  start();
})();

(() => {
  if(document.querySelector('script[data-currency-calculator-history]')) return;
  const s=document.createElement('script');
  s.src='currency-calculator-history.js';
  s.dataset.currencyCalculatorHistory='1';
  document.body.appendChild(s);
})();
