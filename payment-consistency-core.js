'use strict';

(() => {
  const SYMBOLS={RUB:'₽',USD:'$',EUR:'€',KZT:'₸'};
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(num(v)).replace(/[\u00A0\u202F]/g,' ');
  const currentClient=()=>typeof client==='function'?client():null;

  function requestNumber(c,r){
    try{return window.DiagnostikaRequests?.requestNumber?.(c,r)||((c?.requests||[]).findIndex(x=>String(x?.id)===String(r?.id))+1)||0;}catch(_){return 0;}
  }

  function paymentOf(r){
    if(!r?.payment||typeof r.payment!=='object')return{};
    return r.payment;
  }

  function sessionPayment(s){
    return s?.payment&&typeof s.payment==='object'?s.payment:{};
  }

  function requestForSession(c,s){
    const rid=s?.requestId||sessionPayment(s).requestId||'';
    return (c?.requests||[]).find(r=>String(r?.id)===String(rid))||null;
  }

  function symbolFor(c,r){
    const p=paymentOf(r);
    return SYMBOLS[p.currency||c?.currency||'RUB']||'₽';
  }

  function sessionsFor(c,r){
    return (c?.sessions||[]).filter(s=>String(s?.requestId||sessionPayment(s).requestId||'')===String(r?.id||''));
  }

  function positivePaidSessions(c,r){
    return sessionsFor(c,r).filter(s=>sessionPayment(s).paid===true&&num(sessionPayment(s).amount)>0);
  }

  function paidTotalForRequest(c,r){
    const p=paymentOf(r);
    const paidSessions=positivePaidSessions(c,r);
    const paidSessionIds=new Set(paidSessions.map(s=>String(s?.id||'')).filter(Boolean));
    const direct=(Array.isArray(p.payments)?p.payments:[]).reduce((sum,pay)=>{
      const amount=num(pay?.amount);
      if(amount<=0)return sum;
      if(pay?.sessionId&&paidSessionIds.has(String(pay.sessionId)))return sum;
      return sum+amount;
    },0);
    const fromSessions=paidSessions.reduce((sum,s)=>sum+num(sessionPayment(s).amount),0);
    return direct+fromSessions;
  }

  function requestFromPaymentDialog(c,dlg){
    const text=dlg?.querySelector('#paymentRequestSub')?.textContent||'';
    const m=text.match(/Запрос\s+(\d+)/i);
    if(m){
      const idx=Number(m[1])-1;
      if(idx>=0&&c?.requests?.[idx])return c.requests[idx];
    }
    try{
      const r=window.DiagnostikaRequests?.current?.(c);
      if(r)return r;
    }catch(_){}
    try{
      if(typeof requestId!=='undefined'&&requestId){
        const r=(c?.requests||[]).find(x=>String(x.id)===String(requestId));
        if(r)return r;
      }
    }catch(_){}
    return null;
  }

  function refreshMainSummary(){
    const dlg=[...document.querySelectorAll('dialog.payment-dialog')].find(x=>x.querySelector('#paymentMode'));
    if(!dlg?.open)return;
    const c=currentClient();
    if(!c)return;
    const r=requestFromPaymentDialog(c,dlg);
    if(!r)return;
    const p=paymentOf(r);
    if(p.mode==='session')return;

    const total=Math.max(0,num(p.total));
    const paid=paidTotalForRequest(c,r);
    const summary=dlg.querySelector('#paymentSummary');
    if(!summary)return;
    const sym=symbolFor(c,r);

    let status='none',label='Не указано';
    if(total>0||paid>0){
      if(paid<=0){status='unpaid';label='Нет';}
      else if(total>0&&paid>=total){status='paid';label='Оплачено';}
      else{status='partial';label='Частично';}
    }

    summary.innerHTML=`<span class="pay-chip ${status}">${label}</span><span><strong>Оплачено:</strong> ${money(paid)} ${sym}</span>${total>0?`<span><strong>Стоимость:</strong> ${money(total)} ${sym}</span><span><strong>Остаток:</strong> ${money(Math.max(0,total-paid))} ${sym}</span>`:''}`;
  }

  function globalSessionNumber(c,target){
    const arr=(c?.sessions||[]).map((s,index)=>({s,index,time:new Date(s.date||s.createdAt||0).getTime()||index})).sort((a,b)=>a.time-b.time||a.index-b.index);
    const i=arr.findIndex(x=>x.s===target||String(x.s?.id)===String(target?.id));
    return i>=0?i+1:'—';
  }

  function allRows(c){
    const rows=[];
    const paidSessions=(c?.sessions||[]).filter(s=>sessionPayment(s).paid===true&&num(sessionPayment(s).amount)>0);
    const paidSessionIds=new Set(paidSessions.map(s=>String(s?.id||'')).filter(Boolean));

    (c?.requests||[]).forEach(r=>{
      const p=paymentOf(r),rn=requestNumber(c,r),sym=symbolFor(c,r);
      (Array.isArray(p.payments)?p.payments:[]).forEach(pay=>{
        const amount=num(pay?.amount);
        if(amount<=0)return;
        if(pay?.sessionId&&paidSessionIds.has(String(pay.sessionId)))return;
        rows.push({
          date:pay?.date||'',amount,sym,
          title:pay?.note||`Платёж по запросу ${rn}`,
          sub:`Запрос ${rn}: ${r?.title||'Без названия'}`
        });
      });
    });

    paidSessions.forEach(s=>{
      const sp=sessionPayment(s),r=requestForSession(c,s);
      rows.push({
        date:sp.paidAt||s?.date||'',
        amount:num(sp.amount),
        sym:r?symbolFor(c,r):(SYMBOLS[c?.currency||'RUB']||'₽'),
        title:`Сессия №${globalSessionNumber(c,s)}`,
        sub:r?`Запрос ${requestNumber(c,r)}: ${r?.title||'Без названия'}`:'Запрос не указан'
      });
    });

    return rows.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  }

  function renderAll(){
    const dlg=document.querySelector('.all-client-payments-dialog');
    if(!dlg?.open)return;
    const c=currentClient();
    if(!c)return;

    dlg.querySelectorAll('.all-payments-summary,.all-payments-list').forEach(el=>{
      if(el.id!=='allPaymentsUnifiedSummary'&&el.id!=='allPaymentsUnifiedList')el.style.display='none';
    });

    let summary=dlg.querySelector('#allPaymentsUnifiedSummary');
    let list=dlg.querySelector('#allPaymentsUnifiedList');
    if(!summary){
      summary=document.createElement('div');
      summary.id='allPaymentsUnifiedSummary';
      summary.className='all-payments-summary';
      dlg.querySelector('.payment-head')?.insertAdjacentElement('afterend',summary);
    }
    if(!list){
      list=document.createElement('div');
      list.id='allPaymentsUnifiedList';
      list.className='all-payments-list';
      summary.insertAdjacentElement('afterend',list);
    }
    summary.style.display='';
    list.style.display='';

    const rows=allRows(c),totals={};
    rows.forEach(x=>totals[x.sym]=(totals[x.sym]||0)+x.amount);
    summary.textContent=rows.length
      ?`Всего платежей: ${rows.length} · ${Object.entries(totals).map(([sym,val])=>`${money(val)} ${sym}`).join(' · ')}`
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

  function refresh(){
    refreshMainSummary();
    renderAll();
  }

  const schedule=()=>{setTimeout(refresh,0);setTimeout(refresh,50);};
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.payment-dialog,#allClientPaymentsBtn,.client-payment-btn,.pr-save,.pr-delete,#paymentAddBtn'))schedule();
  },true);
  document.addEventListener('change',e=>{if(e.target?.closest?.('.payment-dialog'))schedule();},true);
  document.addEventListener('input',e=>{if(e.target?.closest?.('.payment-dialog'))schedule();},true);
  document.addEventListener('close',e=>{if(e.target?.matches?.('dialog.payment-dialog'))schedule();},true);

  window.DiagnostikaPaymentConsistency={refresh,allRows,paidTotalForRequest};
  setTimeout(refresh,0);
})();
