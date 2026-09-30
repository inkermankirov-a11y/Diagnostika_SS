'use strict';

(() => {
  let scheduled=false;

  function cleanup(){
    scheduled=false;
    let changed=false;

    // Remove only retired legacy debt flags. Current payment flags are owned by Payments UI.
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

  document.addEventListener('diagnostika:dashboard-clients-rendered',schedule);
  document.addEventListener('diagnostika:dashboard-sessions-rendered',schedule);
  window.addEventListener('diagnostika:payment-dialog-opened',schedule);
  window.addEventListener('diagnostika:session-editor-opened',schedule);

  let platformEventsBound=false;
  function bindPlatformEvents(){
    if(platformEventsBound)return true;
    const events=window.DiagnostikaPlatform?.events;
    if(!events?.on)return false;
    for(const type of [
      'client:selected','client:updated',
      'request:selected','request:updated',
      'payment:updated','payment:added','payment:deleted',
      'session-payment:updated','session:created','session:updated','session:deleted'
    ])events.on(type,schedule);
    platformEventsBound=true;
    return true;
  }

  bindPlatformEvents();
  window.addEventListener('diagnostika:platform-core-ready',bindPlatformEvents,{once:true});

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.payment-dialog,.hd-client-row'))setTimeout(schedule,0);
  },true);
  document.addEventListener('close',e=>{
    if(e.target?.matches?.('dialog.payment-dialog,dialog.session-edit-dialog'))setTimeout(schedule,0);
  },true);

  setTimeout(schedule,0);

  // Payment UI is owned by modules/payments/ui; legacy dynamic payment shims are retired.
})();
