'use strict';

(() => {
  const SYMBOLS={RUB:'₽',USD:'$',EUR:'€',KZT:'₸'};
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(num(v)).replace(/[\u00A0\u202F]/g,' ');
  const fmtDate=v=>{if(!v)return '—';const p=String(v).slice(0,10).split('-');return p.length===3?`${p[2]}.${p[1]}.${p[0]}`:String(v);};
  const currentClient=()=>typeof client==='function'?client():null;
  const sessionPay=s=>s?.payment&&typeof s.payment==='object'?s.payment:{};
  const paymentOf=r=>r?.payment&&typeof r.payment==='object'?r.payment:{};
  const symbolFor=(c,r)=>SYMBOLS[paymentOf(r).currency||c?.currency||'RUB']||'₽';
  const requestNumber=(c,r)=>{const i=(c?.requests||[]).findIndex(x=>String(x?.id)===String(r?.id));return i>=0?i+1:'—';};

  function currentRequest(c,dlg){
    if(!c)return null;
    try{
      if(typeof requestId!=='undefined'&&requestId){
        const r=(c.requests||[]).find(x=>String(x.id)===String(requestId));
        if(r)return r;
      }
    }catch(_){}
    try{
      const r=window.DiagnostikaRequests?.current?.(c);
      if(r)return r;
    }catch(_){}
    const text=dlg?.querySelector('#paymentRequestSub')?.textContent||'';
    const m=text.match(/Запрос\s+(\d+)/i);
    if(m){const r=(c.requests||[])[Number(m[1])-1];if(r)return r;}
    return (c.requests||[]).find(r=>String(r.id)===String(c.currentRequestId||''))||null;
  }

  function sessionBelongsToRequest(s,r){
    const rid=s?.requestId||sessionPay(s).requestId||'';
    return String(rid)===String(r?.id||'');
  }

  function globalSessionNumber(c,target){
    const arr=(c?.sessions||[]).map((s,index)=>({s,index,time:new Date(s.date||s.createdAt||0).getTime()||index})).sort((a,b)=>a.time-b.time||a.index-b.index);
    const i=arr.findIndex(x=>x.s===target||String(x.s?.id)===String(target?.id));
    return i>=0?i+1:'—';
  }

  function renderCurrentRequestLedger(){
    const dlg=[...document.querySelectorAll('dialog.payment-dialog')].find(x=>x.querySelector('#paymentMode'));
    if(!dlg)return;
    const mode=dlg.querySelector('#paymentMode')?.value||'';
    const old=dlg.querySelector('#sessionPaymentLedger');
    if(old)old.style.display='none';

    let box=dlg.querySelector('#sessionPaymentLedgerAuthority');
    if(mode!=='session'){
      if(box)box.hidden=true;
      return;
    }

    const c=currentClient(),r=currentRequest(c,dlg);
    if(!c||!r)return;

    if(!box){
      box=document.createElement('div');
      box.id='sessionPaymentLedgerAuthority';
      box.className='session-payment-ledger';
      const anchor=old||dlg.querySelector('#paymentSessionHint')||dlg.querySelector('#paymentSummary');
      anchor?.insertAdjacentElement('afterend',box);
    }
    box.hidden=false;

    const paid=(c.sessions||[])
      .filter(s=>sessionBelongsToRequest(s,r))
      .filter(s=>sessionPay(s).paid===true)
      .sort((a,b)=>String(sessionPay(b).paidAt||b.date||'').localeCompare(String(sessionPay(a).paidAt||a.date||'')));

    box.innerHTML=`<div class="session-payment-ledger-title">ВЕДОМОСТЬ ОПЛАТЫ СЕССИЙ — ЗАПРОС ${requestNumber(c,r)}: ${r.title||'Без названия'}</div>`;
    if(!paid.length){
      box.insertAdjacentHTML('beforeend','<div class="session-payment-ledger-empty">По текущему запросу оплаченных сессий пока нет.</div>');
      return;
    }

    const sym=symbolFor(c,r);
    paid.forEach(s=>{
      const sp=sessionPay(s);
      const row=document.createElement('div');
      row.className='session-payment-ledger-row';
      row.innerHTML=`<span>${fmtDate(sp.paidAt||s.date)}</span><span class="ok">✓ Сессия №${globalSessionNumber(c,s)} от ${fmtDate(sp.sessionDate||s.date)}</span><strong>${money(sp.amount)} ${sym}</strong>`;
      box.appendChild(row);
    });
  }

  function allRows(c){
    const rows=[];
    (c?.requests||[]).forEach(r=>{
      const p=paymentOf(r),rn=requestNumber(c,r),sym=symbolFor(c,r);

      (Array.isArray(p.payments)?p.payments:[]).forEach(pay=>{
        rows.push({
          date:pay?.date||'',amount:num(pay?.amount),sym,
          title:pay?.note||`Платёж по запросу ${rn}`,
          sub:`Запрос ${rn}: ${r.title||'Без названия'}`
        });
      });

      if(p.mode==='session'){
        (c.sessions||[]).filter(s=>sessionBelongsToRequest(s,r)&&sessionPay(s).paid===true).forEach(s=>{
          const sp=sessionPay(s);
          rows.push({
            date:sp.paidAt||s.date||'',amount:num(sp.amount),sym,
            title:`Сессия №${globalSessionNumber(c,s)}`,
            sub:`Запрос ${rn}: ${r.title||'Без названия'}`
          });
        });
      }
    });
    return rows.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  }

  function renderAllClientPayments(){
    const dlg=document.querySelector('.all-client-payments-dialog');
    if(!dlg?.open)return;
    const c=currentClient();if(!c)return;

    const oldList=dlg.querySelector('#allPaymentsList');
    if(oldList)oldList.style.display='none';
    const oldSummary=dlg.querySelector('#allPaymentsSummary');
    if(oldSummary)oldSummary.style.display='none';

    let summary=dlg.querySelector('#allPaymentsSummaryAuthority');
    let list=dlg.querySelector('#allPaymentsListAuthority');
    if(!summary){
      summary=document.createElement('div');
      summary.id='allPaymentsSummaryAuthority';
      summary.className='all-payments-summary';
      (oldSummary||dlg.querySelector('.payment-head'))?.insertAdjacentElement('afterend',summary);
    }
    if(!list){
      list=document.createElement('div');
      list.id='allPaymentsListAuthority';
      list.className='all-payments-list';
      summary.insertAdjacentElement('afterend',list);
    }

    const rows=allRows(c),totals={};
    rows.forEach(x=>totals[x.sym]=(totals[x.sym]||0)+x.amount);
    summary.textContent=rows.length
      ?`Всего платежей: ${rows.length} · ${Object.entries(totals).map(([s,v])=>`${money(v)} ${s}`).join(' · ')}`
      :'Платежей пока нет';

    list.innerHTML='';
    rows.forEach(x=>{
      const row=document.createElement('div');
      row.className='all-payment-row';
      row.style.gridTemplateColumns='105px 120px 1fr';
      row.innerHTML=`<span>${x.date||'—'}</span><strong>${money(x.amount)} ${x.sym}</strong><div class="wide"><div>${x.title}</div><div class="all-payment-meta">${x.sub}</div></div>`;
      list.appendChild(row);
    });
  }

  let queued=false;
  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      renderCurrentRequestLedger();
      renderAllClientPayments();
    });
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#allClientPaymentsBtn,.payment-dialog,.session-editor-payment-state,.session-pay-status'))setTimeout(queue,0);
  },true);
  document.addEventListener('change',e=>{
    if(e.target?.closest?.('.payment-dialog')||e.target?.id==='requestSelect')setTimeout(queue,0);
  },true);

  const observer=new MutationObserver(muts=>{
    const relevant=muts.some(m=>{
      const t=m.target;
      if(t?.id==='sessionPaymentLedgerAuthority'||t?.id==='allPaymentsListAuthority'||t?.id==='allPaymentsSummaryAuthority')return false;
      return t?.closest?.('.payment-dialog')||[...m.addedNodes].some(n=>n?.nodeType===1&&n.matches?.('.payment-dialog,#sessionPaymentLedger,#allPaymentsList,#allPaymentsSummary'));
    });
    if(relevant)queue();
  });
  observer.observe(document.body,{childList:true,subtree:true});

  setTimeout(queue,0);
  window.DiagnostikaPaymentScopeAuthority={refresh:queue,allRows};
})();