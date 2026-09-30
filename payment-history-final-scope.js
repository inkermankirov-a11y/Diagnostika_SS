'use strict';

(() => {
  const SYMBOLS={RUB:'₽',USD:'$',EUR:'€',KZT:'₸'};
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(num(v)).replace(/[\u00A0\u202F]/g,' ');
  const fmtDate=v=>{if(!v)return '—';const p=String(v).slice(0,10).split('-');return p.length===3?`${p[2]}.${p[1]}.${p[0]}`:String(v);};
  const ui=()=>window.DiagnostikaPaymentUIContext||null;
  const currentClient=()=>ui()?.currentClient?.()||null;
  const paymentWriter=()=>window.DiagnostikaPayments?.moduleAware===true?window.DiagnostikaPayments:null;
  const sessionPay=(s,c=currentClient())=>paymentWriter()?.session?.(s?.id,c)||(s?.payment&&typeof s.payment==='object'?s.payment:{});
  const paymentOf=(r,c=currentClient())=>paymentWriter()?.request?.(r?.id,c)||(r?.payment&&typeof r.payment==='object'?r.payment:{});
  const requestNumber=(c,r)=>window.DiagnostikaRequests?.requestNumber?.(c,r)||'—';
  const symbolFor=(c,r)=>SYMBOLS[paymentOf(r,c).currency||c?.currency||'RUB']||'₽';

  function globalSessionNumber(c,target){
    return window.DiagnostikaSessions?.sessionNumber?.(c,target)||'—';
  }

  function requestForSession(c,s){
    const rid=s?.requestId||sessionPay(s,c).requestId||'';
    return ui()?.requestById?.(c,rid)||null;
  }

  function requestFromOpenDialog(c,dlg){
    const id=dlg?.dataset?.requestId;
    return (id?ui()?.requestById?.(c,id):null)||ui()?.currentRequest?.(c)||null;
  }

  function allRows(c){
    const rows=[];
    const paidSessions=(ui()?.sessionList?.(c)||[]).filter(s=>sessionPay(s,c).paid===true);
    const paidIds=new Set(paidSessions.map(s=>String(s?.id||'')).filter(Boolean));

    (ui()?.requestList?.(c)||[]).forEach(r=>{
      const p=paymentOf(r,c),rn=requestNumber(c,r),sym=symbolFor(c,r);
      (Array.isArray(p.payments)?p.payments:[]).forEach(pay=>{
        if(pay?.sessionId&&paidIds.has(String(pay.sessionId)))return;
        rows.push({date:pay?.date||'',amount:num(pay?.amount),sym,title:pay?.note||`Платёж по запросу ${rn}`,sub:`Запрос ${rn}: ${r.title||'Без названия'}`});
      });
    });

    paidSessions.forEach(s=>{
      const sp=sessionPay(s),r=requestForSession(c,s);
      rows.push({
        date:sp.paidAt||s.date||'',
        amount:num(sp.amount),
        sym:r?symbolFor(c,r):(SYMBOLS[c?.currency||'RUB']||'₽'),
        title:`Сессия №${globalSessionNumber(c,s)}`,
        sub:r?`Запрос ${requestNumber(c,r)}: ${r.title||'Без названия'}`:'Запрос не указан'
      });
    });

    return rows.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  }

  function renderAll(){
    const dlg=document.querySelector('.all-client-payments-dialog');
    if(!dlg?.open)return;
    const c=currentClient();if(!c)return;
    dlg.querySelector('#allPaymentsList')?.style.setProperty('display','none','important');
    dlg.querySelector('#allPaymentsSummary')?.style.setProperty('display','none','important');
    dlg.querySelector('#allPaymentsListAuthority')?.style.setProperty('display','none','important');
    dlg.querySelector('#allPaymentsSummaryAuthority')?.style.setProperty('display','none','important');

    let summary=dlg.querySelector('#allPaymentsSummaryFinal');
    let list=dlg.querySelector('#allPaymentsListFinal');
    if(!summary){summary=document.createElement('div');summary.id='allPaymentsSummaryFinal';summary.className='all-payments-summary';dlg.querySelector('.payment-head')?.insertAdjacentElement('afterend',summary);}
    if(!list){list=document.createElement('div');list.id='allPaymentsListFinal';list.className='all-payments-list';summary.insertAdjacentElement('afterend',list);}

    const rows=allRows(c),totals={};rows.forEach(x=>totals[x.sym]=(totals[x.sym]||0)+x.amount);
    summary.textContent=rows.length?`Всего платежей: ${rows.length} · ${Object.entries(totals).map(([s,v])=>`${money(v)} ${s}`).join(' · ')}`:'Платежей пока нет';
    list.innerHTML='';
    rows.forEach(x=>{
      const row=document.createElement('div');row.className='all-payment-row';row.style.gridTemplateColumns='105px 120px 1fr';
      row.innerHTML=`<span>${x.date||'—'}</span><strong>${money(x.amount)} ${x.sym}</strong><div class="wide"><div>${x.title}</div><div class="all-payment-meta">${x.sub}</div></div>`;
      list.appendChild(row);
    });
  }

  function renderLedger(){
    const dlg=[...document.querySelectorAll('dialog.payment-dialog')].find(x=>x.querySelector('#paymentMode'));
    if(!dlg||dlg.querySelector('#paymentMode')?.value!=='session')return;
    const c=currentClient(),r=requestFromOpenDialog(c,dlg);if(!c||!r)return;
    dlg.querySelector('#sessionPaymentLedger')?.style.setProperty('display','none','important');
    dlg.querySelector('#sessionPaymentLedgerAuthority')?.style.setProperty('display','none','important');
    let box=dlg.querySelector('#sessionPaymentLedgerFinal');
    if(!box){box=document.createElement('div');box.id='sessionPaymentLedgerFinal';box.className='session-payment-ledger';(dlg.querySelector('#paymentSessionHint')||dlg.querySelector('#paymentSummary'))?.insertAdjacentElement('afterend',box);}
    const paid=(ui()?.sessionList?.(c)||[]).filter(s=>String(s?.requestId||sessionPay(s,c).requestId||'')===String(r.id)&&sessionPay(s,c).paid===true).sort((a,b)=>String(sessionPay(b).paidAt||b.date||'').localeCompare(String(sessionPay(a).paidAt||a.date||'')));
    box.innerHTML=`<div class="session-payment-ledger-title">ВЕДОМОСТЬ ОПЛАТЫ СЕССИЙ — ЗАПРОС ${requestNumber(c,r)}: ${r.title||'Без названия'}</div>`;
    if(!paid.length){box.insertAdjacentHTML('beforeend','<div class="session-payment-ledger-empty">По текущему запросу оплаченных сессий пока нет.</div>');return;}
    paid.forEach(s=>{const sp=sessionPay(s),row=document.createElement('div');row.className='session-payment-ledger-row';row.innerHTML=`<span>${fmtDate(sp.paidAt||s.date)}</span><span class="ok">✓ Сессия №${globalSessionNumber(c,s)} от ${fmtDate(sp.sessionDate||s.date)}</span><strong>${money(sp.amount)} ${symbolFor(c,r)}</strong>`;box.appendChild(row);});
  }

  function refresh(){renderLedger();renderAll();}
  window.addEventListener('diagnostika:payment-dialog-opened',()=>setTimeout(refresh,0));
  document.addEventListener('diagnostika:dashboard-sessions-rendered',()=>setTimeout(refresh,0));
  document.addEventListener('click',e=>{if(e.target?.closest?.('#allClientPaymentsBtn,.payment-dialog,.session-editor-payment-state,.session-pay-status'))setTimeout(refresh,0);},true);
  document.addEventListener('change',e=>{if(e.target?.closest?.('.payment-dialog')||e.target?.id==='requestSelect')setTimeout(refresh,0);},true);
  const events=window.DiagnostikaPlatform?.events;
  for(const type of ['client:selected','request:selected','request:updated','payment:updated','payment:added','payment:deleted','session-payment:updated','session:updated','session:deleted'])events?.on?.(type,()=>setTimeout(refresh,0));
  setTimeout(refresh,0);
  window.DiagnostikaPaymentHistoryFinal=Object.freeze({refresh,allRows});
})();