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
      grid-template-columns:22px 1fr!important;
      grid-template-rows:1fr 1fr!important;
      grid-template-areas:'icon code' 'icon rate'!important;
      column-gap:5px!important;
      row-gap:0!important;
      align-items:center!important;
      padding:4px 8px!important;
    }
    #headerCurrencyBtn.currency-compact-display .hu-icon{
      grid-area:icon!important;
      font-size:23px!important;
      font-weight:900!important;
      line-height:1!important;
      text-align:center!important;
    }
    #headerCurrencyBtn.currency-compact-display .hu-sub{
      grid-area:code!important;
      margin:0!important;
      max-width:none!important;
      overflow:visible!important;
      text-overflow:clip!important;
      text-align:center!important;
      font-size:11px!important;
      font-weight:900!important;
      line-height:1!important;
      align-self:end!important;
    }
    #headerCurrencyBtn.currency-compact-display .hu-main{
      grid-area:rate!important;
      text-align:center!important;
      font-size:12px!important;
      font-weight:900!important;
      line-height:1!important;
      align-self:start!important;
      overflow:visible!important;
      text-overflow:clip!important;
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
