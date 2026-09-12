'use strict';

(() => {
  const currentClient=()=>typeof client==='function'?client():null;

  function sessionFromDialog(dlg,c){
    if(!dlg||!c)return null;
    const id=dlg.dataset.sessionId;
    if(id){const s=(c.sessions||[]).find(x=>x.id===id);if(s)return s;}
    const title=dlg.querySelector('h1,h2,h3,.session-edit-title')?.textContent||'';
    const m=title.match(/Сессия\s*№\s*(\d+)/i);
    if(m){
      const arr=(c.sessions||[]).map((s,i)=>({s,i,t:new Date(s.date||s.createdAt||0).getTime()||i})).sort((a,b)=>a.t-b.t||a.i-b.i);
      return arr[Number(m[1])-1]?.s||null;
    }
    return null;
  }

  function requestForDialog(c,s,dlg){
    const requestId=dlg.querySelector('.session-edit-grid select')?.value||s?.requestId||s?.payment?.requestId||'';
    return (c?.requests||[]).find(r=>r.id===requestId)||null;
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
      try{window.DiagnostikaSessionPaymentUiSync?.refresh?.();}catch(_){}
    }
  }

  function cleanSessionCards(){
    const c=currentClient();if(!c)return;
    document.querySelectorAll('.session-card').forEach(card=>{
      const title=card.querySelector('.session-card-title')?.textContent||'';
      const m=title.match(/№(\d+)/);if(!m)return;
      const arr=(c.sessions||[]).map((s,i)=>({s,i,t:new Date(s.date||s.createdAt||0).getTime()||i})).sort((a,b)=>a.t-b.t||a.i-b.i);
      const s=arr[Number(m[1])-1]?.s;if(!s)return;
      const requestId=s.requestId||s.payment?.requestId||'';
      const r=(c.requests||[]).find(x=>x.id===requestId)||null;
      if(r?.payment?.mode!=='session')card.querySelectorAll('.session-pay-status').forEach(el=>el.remove());
    });
  }

  function refresh(){
    document.querySelectorAll('dialog.session-edit-dialog').forEach(applyDialogRule);
    cleanSessionCards();
  }

  const observer=new MutationObserver(()=>setTimeout(refresh,0));
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.closest?.('dialog.session-edit-dialog'))setTimeout(refresh,0);},true);
  document.addEventListener('click',e=>{if(e.target?.closest?.('.session-card,.session-edit-dialog'))setTimeout(refresh,0);},true);

  setTimeout(refresh,0);
  setTimeout(refresh,250);
  setTimeout(refresh,800);
  window.DiagnostikaSessionPaymentModeRule={refresh};
})();
