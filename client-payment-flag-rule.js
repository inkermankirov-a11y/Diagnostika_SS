'use strict';

(() => {
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};

  const style=document.createElement('style');
  style.textContent=`
    .payment-dialog .payment-row{grid-template-columns:100px 110px minmax(130px,1fr) minmax(130px,1fr) 155px!important;align-items:center!important;overflow:visible!important}
    .payment-dialog .payment-row-actions{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:flex-end!important;gap:6px!important;min-width:155px!important;width:155px!important;grid-column:auto!important}
    .payment-dialog .payment-row-actions .pr-save,
    .payment-dialog .payment-row-actions .pr-delete{position:static!important;inset:auto!important;float:none!important;margin:0!important;transform:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important;height:32px!important;min-height:32px!important;box-sizing:border-box!important;padding:5px 9px!important;font-size:11px!important;line-height:1!important}
    .payment-dialog .payment-row-actions .pr-save{min-width:76px!important}
    .payment-dialog .payment-row-actions .pr-delete{min-width:70px!important}
    .hd-client-more{display:none!important}
    @media(max-width:760px){
      .payment-dialog .payment-row{grid-template-columns:1fr 1fr!important}
      .payment-dialog .payment-row-actions{grid-column:1/-1!important;width:100%!important;min-width:0!important;justify-content:flex-end!important}
    }
  `;
  document.head.appendChild(style);

  function activeRequest(c){
    const requests=Array.isArray(c?.requests)?c.requests:[];
    if(!requests.length)return null;

    try{
      if(typeof clientId!=='undefined'&&String(c?.id)===String(clientId)&&typeof requestId!=='undefined'&&requestId){
        const selected=requests.find(r=>String(r.id)===String(requestId));
        if(selected)return selected;
      }
    }catch(_){}

    const remembered=requests.find(r=>String(r.id)===String(c?.currentRequestId||''))
      ||requests.find(r=>String(r.id)===String(c?.activeRequestId||''));
    if(remembered)return remembered;

    return requests[0]||null;
  }

  function sessionsFor(c,r){
    const rid=String(r?.id||'');
    if(!rid)return[];
    return (Array.isArray(c?.sessions)?c.sessions:[]).filter(s=>String(s?.requestId||s?.payment?.requestId||'')===rid);
  }

  function fallbackPaidTotal(c,r){
    const p=r?.payment||{};
    const paidSessions=sessionsFor(c,r).filter(s=>s?.payment?.paid===true&&num(s?.payment?.amount)>0);
    const paidSessionIds=new Set(paidSessions.map(s=>String(s?.id||'')).filter(Boolean));

    const direct=(Array.isArray(p.payments)?p.payments:[]).reduce((sum,pay)=>{
      const amount=num(pay?.amount);
      if(amount<=0)return sum;
      if(pay?.sessionId&&paidSessionIds.has(String(pay.sessionId)))return sum;
      return sum+amount;
    },0);
    const sessionTotal=paidSessions.reduce((sum,s)=>sum+num(s?.payment?.amount),0);
    return direct+sessionTotal;
  }

  function paidTotal(c,r){
    try{
      const fn=window.DiagnostikaPaymentConsistency?.paidTotalForRequest;
      if(typeof fn==='function')return Math.max(0,num(fn(c,r)));
    }catch(_){}
    return Math.max(0,fallbackPaidTotal(c,r));
  }

  function requestHasDebt(c,r){
    const p=r?.payment||{};
    const mode=p.mode||'';

    if(mode==='full'||mode==='parts'){
      const total=Math.max(0,num(p.total));
      if(total<=0)return false;
      return paidTotal(c,r)+0.000001<total;
    }

    if(mode==='session'){
      const sessions=sessionsFor(c,r);
      if(!sessions.length)return false;
      return sessions.some(s=>s?.payment?.paid!==true);
    }

    return false;
  }

  function clientHasDebt(c){
    const r=activeRequest(c);
    return !!(r&&requestHasDebt(c,r));
  }

  function syncFlags(){
    if(typeof state==='undefined'||!Array.isArray(state?.clients))return;

    document.querySelectorAll('.hd-client-more').forEach(btn=>btn.remove());

    document.querySelectorAll('.hd-client-row[data-id]').forEach(row=>{
      const c=state.clients.find(x=>String(x.id)===String(row.dataset.id));
      if(!c)return;
      const tools=row.querySelector('.hd-client-tools');
      if(!tools)return;

      tools.querySelectorAll('.hd-unpaid-flag').forEach(flag=>flag.remove());
      if(!clientHasDebt(c))return;

      const flag=document.createElement('span');
      flag.className='hd-unpaid-flag';
      flag.textContent='⚑';
      flag.setAttribute('aria-label','Есть непогашенный долг по текущему запросу');
      flag.title='Есть непогашенный долг по текущему запросу';
      tools.appendChild(flag);
    });
  }

  let queued=false;
  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;syncFlags();});
  }

  const mo=new MutationObserver(queue);
  mo.observe(document.body,{childList:true,subtree:true});

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.payment-dialog,#paymentAddBtn,.payment-remove,.pr-save,.pr-delete,.payment-edit-save,.payment-edit-delete,.hd-client-row,#paymentSaveSettings,.session-payment-toggle-stable,.session-editor-payment-state')){
      setTimeout(syncFlags,0);setTimeout(syncFlags,80);
    }
  },true);
  document.addEventListener('input',e=>{
    if(e.target?.closest?.('.payment-dialog'))setTimeout(syncFlags,0);
  },true);
  document.addEventListener('change',e=>{
    if(e.target?.id==='requestSelect'){
      try{
        const c=typeof client==='function'?client():null;
        if(c&&e.target.value){c.currentRequestId=e.target.value;if(typeof save==='function')save();}
      }catch(_){}
    }
    if(e.target?.closest?.('.payment-dialog,dialog.session-edit-dialog')||e.target?.id==='requestSelect'){
      setTimeout(syncFlags,0);setTimeout(syncFlags,80);
    }
  },true);
  document.addEventListener('close',e=>{
    if(e.target?.matches?.('dialog.payment-dialog,dialog.session-edit-dialog')){
      setTimeout(syncFlags,0);setTimeout(syncFlags,80);
    }
  },true);

  setTimeout(syncFlags,0);
  setTimeout(syncFlags,250);
  window.DiagnostikaClientPaymentFlags={refresh:syncFlags,hasDebt:clientHasDebt,activeRequest,requestHasDebt,paidTotal};
})();

(() => {
  if(document.querySelector('script[data-payment-total-stability]'))return;
  const s=document.createElement('script');
  s.src='payment-total-input-stability.js?v=20260913-105';
  s.dataset.paymentTotalStability='1';
  document.head.appendChild(s);
})();
