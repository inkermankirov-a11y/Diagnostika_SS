'use strict';

(() => {
  let scheduled=false;

  function cleanup(){
    scheduled=false;
    let changed=false;

    document.querySelectorAll('.hd-client-more').forEach(el=>{el.remove();changed=true;});

    document.querySelectorAll('.hd-unpaid-flag').forEach(flag=>{
      const title=(flag.getAttribute('title')||'').toLowerCase();
      const aria=(flag.getAttribute('aria-label')||'').toLowerCase();
      if(title.includes('неоплаченные сессии')||aria.includes('неоплаченные сессии')){
        flag.remove();changed=true;
      }
    });

    if(changed){
      setTimeout(()=>{
        try{window.DiagnostikaClientPaymentFlags?.refresh?.();}catch(_){}
      },0);
    }
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(cleanup);
  }

  const observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.payment-dialog,.hd-client-row'))setTimeout(schedule,0);
  },true);
  document.addEventListener('close',e=>{
    if(e.target?.matches?.('dialog.payment-dialog,dialog.session-edit-dialog'))setTimeout(schedule,0);
  },true);

  setTimeout(schedule,0);

  if(!document.querySelector('script[data-payment-full-mode-ui]')){
    const script=document.createElement('script');
    script.src='payment-full-mode-ui.js?v=20260912-70';
    script.dataset.paymentFullModeUi='1';
    document.body.appendChild(script);
  }

  if(!document.querySelector('script[data-payment-save-normalizer]')){
    const script=document.createElement('script');
    script.src='payment-save-normalizer.js?v=20260912-71';
    script.dataset.paymentSaveNormalizer='1';
    document.body.appendChild(script);
  }

  if(!document.querySelector('script[data-all-payments-complete]')){
    const script=document.createElement('script');
    script.src='all-payments-complete.js?v=20260912-75';
    script.dataset.allPaymentsComplete='1';
    document.body.appendChild(script);
  }

  // session-ledger-current-request.js уже подключён напрямую в index.html.
  // Второй динамический запуск здесь раньше создавал дубли MutationObserver/listeners.
})();
