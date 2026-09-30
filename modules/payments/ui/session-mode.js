'use strict';

(() => {
  const ui=()=>window.DiagnostikaPaymentUIContext||null;
  const currentClient=()=>ui()?.currentClient?.()||null;

  function sessionFromDialog(dlg,c){
    if(!dlg||!c)return null;
    const id=dlg.dataset.sessionId;
    return id?ui()?.sessionById?.(c,id)||null:null;
  }

  function requestForDialog(c,s,dlg){
    const requestId=dlg.querySelector('.session-edit-grid select')?.value||s?.requestId||s?.payment?.requestId||'';
    return ui()?.requestById?.(c,requestId)||null;
  }

  function applyDialogRule(dlg){
    const c=currentClient(),s=sessionFromDialog(dlg,c);if(!c||!s)return;
    const r=requestForDialog(c,s,dlg);
    const perSession=r?.payment?.mode==='session';

    // Новое правило: элементы оплаты внутри сессии существуют только для режима "Оплата за каждую сессию".
    dlg.querySelectorAll('.session-editor-payment,.session-payment-field').forEach(el=>{
      el.hidden=!perSession;
      el.style.display=perSession?'':'none';
    });

    if(perSession){
      const modern=dlg.querySelector('.session-editor-payment');
      if(modern)modern.style.display='flex';
      const amountWrap=dlg.querySelector('.session-editor-payment-amount-wrap');
      if(amountWrap){amountWrap.hidden=false;amountWrap.style.display='flex';}
      const legacy=dlg.querySelector('.session-payment-field');
      if(legacy)legacy.style.display='grid';
      window.DiagnostikaSessionPaymentEditor?.refresh?.();
    }
  }

  function cleanSessionCards(){
    const c=currentClient();if(!c)return;
    document.querySelectorAll('.session-card').forEach(card=>{
      const title=card.querySelector('.session-card-title')?.textContent||'';
      const m=title.match(/№(\d+)/);if(!m)return;
      const sessions=ui()?.sessionList?.(c)||[];
      const arr=sessions.map((s,i)=>({s,i,t:new Date(s.date||s.createdAt||0).getTime()||i})).sort((a,b)=>a.t-b.t||a.i-b.i);
      const s=arr[Number(m[1])-1]?.s;if(!s)return;
      const requestId=s.requestId||s.payment?.requestId||'';
      const r=ui()?.requestById?.(c,requestId)||null;
      if(r?.payment?.mode!=='session')card.querySelectorAll('.session-pay-status').forEach(el=>el.remove());
    });
  }

  function refresh(){
    document.querySelectorAll('dialog.session-edit-dialog').forEach(applyDialogRule);
    cleanSessionCards();
  }

  document.addEventListener('diagnostika:session-editor-opened',event=>{
    const dlg=event.detail?.dialog;
    if(dlg)setTimeout(()=>applyDialogRule(dlg),0);
  });
  document.addEventListener('change',e=>{if(e.target?.closest?.('dialog.session-edit-dialog'))setTimeout(refresh,0);},true);
  const events=window.DiagnostikaPlatform?.events;
  for(const type of ['client:selected','request:selected','request:updated','session:created','session:updated','session:deleted','session-payment:updated','payment:updated'])events?.on?.(type,()=>setTimeout(refresh,0));
  setTimeout(refresh,0);
  window.DiagnostikaSessionPaymentModeRule={refresh};
})();
