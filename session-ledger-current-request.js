'use strict';

(() => {
  if(window.__diagnostikaSessionLedgerCurrentRequestReady)return;
  window.__diagnostikaSessionLedgerCurrentRequestReady=true;

  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(num(v)).replace(/[\u00A0\u202F]/g,' ');
  const fmtDate=v=>{if(!v)return '—';const p=String(v).slice(0,10).split('-');return p.length===3?`${p[2]}.${p[1]}.${p[0]}`:v;};
  const currentClient=()=>typeof client==='function'?client():null;

  function requestShownInDialog(c,dlg){
    if(!c||!dlg)return null;
    const text=dlg.querySelector('#paymentRequestSub')?.textContent||'';
    const m=text.match(/Запрос\s+(\d+)/i);
    if(m){
      const idx=Number(m[1])-1;
      if(c.requests?.[idx])return c.requests[idx];
    }
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
    return null;
  }

  function sessionPayment(s){return s?.payment&&typeof s.payment==='object'?s.payment:{};}
  function globalSessionNumber(c,target){
    const arr=(c?.sessions||[]).map((s,index)=>({s,index,time:new Date(s.date||s.createdAt||0).getTime()||index})).sort((a,b)=>a.time-b.time||a.index-b.index);
    const i=arr.findIndex(x=>x.s===target||String(x.s?.id)===String(target?.id));
    return i>=0?i+1:'—';
  }

  function render(){
    const dlg=[...document.querySelectorAll('dialog.payment-dialog')].find(x=>x.querySelector('#paymentMode'));
    if(!dlg)return;
    const ledger=dlg.querySelector('#sessionPaymentLedger');
    if(!ledger)return;
    const mode=dlg.querySelector('#paymentMode')?.value||'';
    if(mode!=='session')return;

    const c=currentClient(),r=requestShownInDialog(c,dlg);
    if(!c||!r)return;

    const sessions=(c.sessions||[])
      .filter(s=>String(s?.requestId||sessionPayment(s).requestId||'')===String(r.id))
      .filter(s=>sessionPayment(s).paid===true)
      .sort((a,b)=>String(sessionPayment(b).paidAt||b.date||'').localeCompare(String(sessionPayment(a).paidAt||a.date||'')));

    const requestIndex=(c.requests||[]).findIndex(x=>String(x.id)===String(r.id));
    const requestLabel=`Запрос ${requestIndex>=0?requestIndex+1:'—'}: ${r.title||'Без названия'}`;
    let html=`<div class="session-payment-ledger-title">ВЕДОМОСТЬ ОПЛАТЫ СЕССИЙ — ${requestLabel}</div>`;

    if(!sessions.length){
      html+='<div class="session-payment-ledger-empty">По текущему запросу оплаченных сессий пока нет.</div>';
    }else{
      sessions.forEach(s=>{
        const sp=sessionPayment(s);
        html+=`<div class="session-payment-ledger-row"><span>${fmtDate(sp.paidAt||s.date||'')}</span><span class="ok">✓ Сессия №${globalSessionNumber(c,s)} от ${fmtDate(sp.sessionDate||s.date||'')}</span><strong>${money(sp.amount)} ₽</strong></div>`;
      });
    }

    if(ledger.innerHTML!==html)ledger.innerHTML=html;
  }

  let queued=false;
  const queue=()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;render();});
  };

  const observer=new MutationObserver(mutations=>{
    const ledgerAdded=mutations.some(m=>[...m.addedNodes].some(n=>n?.nodeType===1&&(n.id==='sessionPaymentLedger'||n.querySelector?.('#sessionPaymentLedger'))));
    if(ledgerAdded)queue();
  });
  observer.observe(document.body,{childList:true,subtree:true});

  document.addEventListener('click',e=>{if(e.target?.closest?.('.payment-dialog,.session-editor-payment-state,.session-payment-toggle-stable'))setTimeout(render,0);},true);
  document.addEventListener('change',e=>{if(e.target?.closest?.('.payment-dialog'))setTimeout(render,0);},true);
  document.addEventListener('input',e=>{if(e.target?.closest?.('.payment-dialog'))setTimeout(render,0);},true);
  setTimeout(render,0);
})();
