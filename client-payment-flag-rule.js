'use strict';

(() => {
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};

  function requestHasDebt(c,r){
    const p=r?.payment||{};
    const mode=p.mode||'';
    if(!mode)return false;

    if(mode==='session'){
      const sessions=Array.isArray(c?.sessions)?c.sessions:[];
      const requests=Array.isArray(c?.requests)?c.requests:[];
      const sessionModeRequests=requests.filter(x=>x?.payment?.mode==='session');
      return sessions.some(s=>{
        const linkedId=s?.payment?.requestId||s?.requestId||'';
        const belongs=linkedId===r.id||(!linkedId&&sessionModeRequests.length===1&&sessionModeRequests[0]?.id===r.id);
        return belongs&&s?.payment?.paid!==true;
      });
    }

    if(mode==='full'||mode==='parts'){
      const total=Math.max(0,num(p.total));
      if(total<=0)return false;
      const paid=(Array.isArray(p.payments)?p.payments:[]).reduce((sum,x)=>sum+Math.max(0,num(x?.amount)),0);
      return paid+0.000001<total;
    }

    return false;
  }

  function activeRequest(c){
    const requests=Array.isArray(c?.requests)?c.requests:[];
    if(!requests.length)return null;
    return requests.find(r=>String(r.id)===String(c?.currentRequestId||''))
      || requests.find(r=>String(r.id)===String(c?.activeRequestId||''))
      || requests[requests.length-1]
      || null;
  }

  function clientHasDebt(c){
    const r=activeRequest(c);
    return r?requestHasDebt(c,r):false;
  }

  function syncFlags(){
    if(!window.state||!Array.isArray(state.clients))return;
    document.querySelectorAll('.hd-client-row[data-id]').forEach(row=>{
      const c=state.clients.find(x=>String(x.id)===String(row.dataset.id));
      if(!c)return;
      const tools=row.querySelector('.hd-client-tools');
      if(!tools)return;
      let flag=tools.querySelector('.hd-unpaid-flag');
      const debt=clientHasDebt(c);
      if(!debt){flag?.remove();return;}
      if(!flag){
        flag=document.createElement('span');
        flag.className='hd-unpaid-flag';
        flag.textContent='⚑';
        const more=tools.querySelector('.hd-client-more');
        if(more)tools.insertBefore(flag,more);else tools.appendChild(flag);
      }
      flag.setAttribute('aria-label','Есть задолженность по текущему запросу');
      flag.title='Есть задолженность по текущему запросу';
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
    if(e.target?.closest?.('.payment-dialog,#paymentAddBtn,.payment-remove,.pr-save,.pr-delete,.payment-edit-save,.payment-edit-delete'))setTimeout(syncFlags,0);
  },true);
  document.addEventListener('change',e=>{
    if(e.target?.closest?.('.payment-dialog'))setTimeout(syncFlags,0);
  },true);
  document.addEventListener('close',e=>{
    if(e.target?.matches?.('dialog.payment-dialog'))setTimeout(syncFlags,0);
  },true);

  setTimeout(syncFlags,0);
  window.DiagnostikaClientPaymentFlags={refresh:syncFlags,hasDebt:clientHasDebt};
})();