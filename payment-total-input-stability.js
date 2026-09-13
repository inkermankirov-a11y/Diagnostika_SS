'use strict';

(() => {
  if (window.DiagnostikaPaymentTotalInputStability) return;

  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const currentClient=()=>typeof client==='function'?client():null;

  function currentRequest(c){
    if(!c)return null;
    try{
      const r=window.DiagnostikaRequests?.current?.(c);
      if(r)return r;
    }catch(_){}
    try{
      if(typeof requestId!=='undefined'&&requestId){
        const r=(c.requests||[]).find(x=>String(x.id)===String(requestId));
        if(r)return r;
      }
    }catch(_){}
    return (c.requests||[]).find(r=>String(r.id)===String(c.currentRequestId||''))
      ||(c.requests||[]).find(r=>String(r.id)===String(c.activeRequestId||''))
      ||(c.requests||[])[0]
      ||null;
  }

  function paymentOf(c,r){
    try{
      const p=window.DiagnostikaPayments?.paymentOfRequest?.(c,r);
      if(p)return p;
    }catch(_){}
    if(!r)return null;
    if(!r.payment||typeof r.payment!=='object')r.payment={mode:'',total:0,payments:[],currency:c?.currency||'RUB'};
    if(!Array.isArray(r.payment.payments))r.payment.payments=[];
    return r.payment;
  }

  function lightRefresh(){
    try{window.DiagnostikaPaymentConsistency?.refresh?.();}catch(_){}
    try{window.DiagnostikaClientPaymentFlags?.refresh?.();}catch(_){}
  }

  function fullRefresh(){
    try{window.DiagnostikaPayments?.refresh?.();}catch(_){}
    try{window.DiagnostikaPaymentConsistency?.refresh?.();}catch(_){}
    try{window.DiagnostikaClientPaymentFlags?.refresh?.();}catch(_){}
    try{window.DiagnostikaHomeDashboard?.refresh?.();}catch(_){}
  }

  function install(){
    const field=document.getElementById('paymentTotal');
    if(!field||field.dataset.totalInputStable==='1')return false;
    field.dataset.totalInputStable='1';

    // Replace the old per-keystroke handler. It used to launch several global
    // rerenders on every digit, which could switch/reset the active request.
    field.oninput=e=>{
      const c=currentClient(),r=currentRequest(c);if(!c||!r)return;
      const p=paymentOf(c,r);if(!p)return;
      p.total=Math.max(0,num(e.target.value));
      try{if(typeof save==='function')save();}catch(_){}
      lightRefresh();
    };

    const commit=e=>{
      const c=currentClient(),r=currentRequest(c);if(!c||!r)return;
      const p=paymentOf(c,r);if(!p)return;
      p.total=Math.max(0,num(e.target.value));
      try{if(typeof save==='function')save();}catch(_){}
      fullRefresh();
    };

    field.onchange=commit;
    field.addEventListener('blur',commit);
    return true;
  }

  const observer=new MutationObserver(()=>install());
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(install,0);

  window.DiagnostikaPaymentTotalInputStability={refresh:install};
})();
