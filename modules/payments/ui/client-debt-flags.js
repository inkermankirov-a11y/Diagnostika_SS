'use strict';

(() => {
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const ui=()=>window.DiagnostikaPaymentUIContext||null;
  const paymentWriter=()=>window.DiagnostikaPayments?.moduleAware===true?window.DiagnostikaPayments:null;

  const style=document.createElement('style');
  style.textContent=`
    .payment-dialog .payment-row{grid-template-columns:100px 110px minmax(130px,1fr) minmax(130px,1fr) 155px!important;align-items:center!important;overflow:visible!important}
    .payment-dialog .payment-row-actions{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:flex-end!important;gap:6px!important;min-width:155px!important;width:155px!important;grid-column:auto!important}
    .payment-dialog .payment-row-actions .pr-save,
    .payment-dialog .payment-row-actions .pr-delete{position:static!important;inset:auto!important;float:none!important;margin:0!important;transform:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important;height:32px!important;min-height:32px!important;box-sizing:border-box!important;padding:5px 9px!important;font-size:11px!important;line-height:1!important}
    .payment-dialog .payment-row-actions .pr-save{min-width:76px!important}
    .payment-dialog .payment-row-actions .pr-delete{min-width:70px!important}
    @media(max-width:760px){
      .payment-dialog .payment-row{grid-template-columns:1fr 1fr!important}
      .payment-dialog .payment-row-actions{grid-column:1/-1!important;width:100%!important;min-width:0!important;justify-content:flex-end!important}
    }
  `;
  document.head.appendChild(style);

  function activeRequest(c){
    const requests=ui()?.requestList?.(c)||[];
    if(!requests.length)return null;
    const current=ui()?.currentRequest?.(c);
    if(current&&requests.some(r=>String(r.id)===String(current.id)))return current;
    const remembered=requests.find(r=>String(r.id)===String(c?.currentRequestId||''))
      ||requests.find(r=>String(r.id)===String(c?.activeRequestId||''));
    return remembered||requests[0]||null;
  }

  function sessionsFor(c,r){
    if(!r?.id)return[];
    return ui()?.sessionsForRequest?.(c,r.id)||[];
  }

  function fallbackPaidTotal(c,r){
    const p=paymentWriter()?.request?.(r?.id,c)||r?.payment||{};
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
    const clients=ui()?.clientList?.()||[];

    document.querySelectorAll('.hd-client-row[data-id]').forEach(row=>{
      const c=clients.find(x=>String(x.id)===String(row.dataset.id));
      if(!c)return;
      const tools=row.querySelector('.hd-client-tools');
      if(!tools)return;

      const flags=Array.from(tools.querySelectorAll('.hd-unpaid-flag'));
      const hasDebt=clientHasDebt(c);

      if(!hasDebt){
        flags.forEach(flag=>flag.remove());
        return;
      }

      if(flags.length){
        flags.slice(1).forEach(flag=>flag.remove());
        return;
      }

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

  document.addEventListener('diagnostika:dashboard-clients-rendered',queue);
  window.addEventListener('diagnostika:payment-dialog-opened',queue);
  document.addEventListener('diagnostika:dashboard-sessions-rendered',queue);
  const events=window.DiagnostikaPlatform?.events;
  for(const type of ['client:selected','client:updated','request:selected','request:updated','payment:updated','payment:added','payment:deleted','session-payment:updated','session:created','session:updated','session:deleted'])events?.on?.(type,queue);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#paymentSaveSettings,.session-payment-toggle-stable,.session-editor-payment-state,.payment-edit-save,.payment-edit-delete'))setTimeout(queue,0);
  },true);
  setTimeout(queue,0);
  window.DiagnostikaClientPaymentFlags=Object.freeze({refresh:syncFlags,hasDebt:clientHasDebt,activeRequest,requestHasDebt,paidTotal});
})();
