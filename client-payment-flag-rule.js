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

  function fullRequestHasDebt(r){
    const p=r?.payment||{};
    if(p.mode!=='full')return false;
    const total=Math.max(0,num(p.total));
    if(total<=0)return false;
    const paid=(Array.isArray(p.payments)?p.payments:[]).reduce((sum,x)=>sum+Math.max(0,num(x?.amount)),0);
    return paid+0.000001<total;
  }

  function clientHasDebt(c){
    const requests=Array.isArray(c?.requests)?c.requests:[];
    return requests.some(fullRequestHasDebt);
  }

  function activeRequest(c){
    const requests=Array.isArray(c?.requests)?c.requests:[];
    if(!requests.length)return null;
    try{
      const fromModule=window.DiagnostikaRequests?.current?.(c);
      if(fromModule&&requests.some(r=>String(r.id)===String(fromModule.id)))return fromModule;
    }catch(_){}
    try{
      if(typeof requestId!=='undefined'&&requestId){
        const byGlobal=requests.find(r=>String(r.id)===String(requestId));
        if(byGlobal)return byGlobal;
      }
    }catch(_){}
    return requests.find(r=>String(r.id)===String(c?.currentRequestId||''))
      ||requests.find(r=>String(r.id)===String(c?.activeRequestId||''))
      ||requests[requests.length-1]
      ||null;
  }

  function syncFlags(){
    if(!window.state||!Array.isArray(state.clients))return;
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
      flag.setAttribute('aria-label','Не оплачена полная стоимость работы');
      flag.title='Не оплачена полная стоимость работы';
      tools.appendChild(flag);
    });
  }

  let queued=false;
  const queue=()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;syncFlags();});
  };

  const mo=new MutationObserver(queue);
  mo.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.payment-dialog,#paymentAddBtn,.payment-remove,.pr-save,.pr-delete,.payment-edit-save,.payment-edit-delete,.hd-client-row,#paymentSaveSettings'))setTimeout(syncFlags,0);
  },true);
  document.addEventListener('input',e=>{
    if(e.target?.closest?.('.payment-dialog'))setTimeout(syncFlags,0);
  },true);
  document.addEventListener('change',e=>{
    if(e.target?.closest?.('.payment-dialog'))setTimeout(syncFlags,0);
  },true);
  document.addEventListener('close',e=>{
    if(e.target?.matches?.('dialog.payment-dialog'))setTimeout(syncFlags,0);
  },true);

  setTimeout(syncFlags,0);
  window.DiagnostikaClientPaymentFlags={refresh:syncFlags,hasDebt:clientHasDebt,activeRequest};
})();
