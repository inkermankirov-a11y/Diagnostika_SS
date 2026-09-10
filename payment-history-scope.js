'use strict';

(() => {
  const currentClient=()=>typeof client==='function'?client():null;
  const fmtDate=v=>{if(!v)return '—';const p=String(v).slice(0,10).split('-');return p.length===3?`${p[2]}.${p[1]}.${p[0]}`:String(v);};
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v)||0).replace(/[\u00A0\u202F]/g,' ');
  const symbolMap={RUB:'₽',USD:'$',EUR:'€',KZT:'₸'};
  const paymentOf=r=>{if(!r.payment||typeof r.payment!=='object')r.payment={mode:'',total:0,payments:[]};if(!Array.isArray(r.payment.payments))r.payment.payments=[];return r.payment;};
  const sessionPay=s=>{if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0};return s.payment;};
  const requestNumber=(c,r)=>{const i=(c?.requests||[]).findIndex(x=>x.id===r?.id);return i>=0?i+1:'—';};
  const requestById=(c,id)=>(c?.requests||[]).find(r=>r.id===id)||null;
  const currencySymbol=(c,r)=>symbolMap[paymentOf(r||{}).currency||c?.currency||'RUB']||'₽';
  function requestFromDialog(c,dlg){
    const text=dlg?.querySelector('#paymentRequestSub')?.textContent||'';
    const m=text.match(/Запрос\s+(\d+)/i);
    if(m&&c?.requests?.[Number(m[1])-1])return c.requests[Number(m[1])-1];
    return window.DiagnostikaRequests?.current?.(c)||c?.requests?.find(r=>r.id===c?.currentRequestId)||null;
  }
  function globalSessionNumber(c,target){
    const arr=(c?.sessions||[]).map((s,i)=>({s,i,t:new Date(s.date||s.createdAt||0).getTime()||i})).sort((a,b)=>a.t-b.t||a.i-b.i);
    const i=arr.findIndex(x=>x.s===target||x.s.id===target?.id);return i>=0?i+1:'—';
  }

  function renderCurrentSessionHistory(){
    const dlg=document.querySelector('.payment-dialog');if(!dlg?.open)return;
    const mode=dlg.querySelector('#paymentMode')?.value||'';
    const ledger=dlg.querySelector('#sessionPaymentLedger');
    if(mode!=='session'){if(ledger)ledger.hidden=true;return;}
    const c=currentClient(),r=requestFromDialog(c,dlg);if(!c||!r||!ledger)return;
    ledger.hidden=false;
    ledger.innerHTML='<div class="session-payment-ledger-title">ИСТОРИЯ ПЛАТЕЖЕЙ</div>';
    const paid=(c.sessions||[]).filter(s=>sessionPay(s).paid&&(sessionPay(s).requestId===r.id||s.requestId===r.id));
    if(!paid.length){ledger.insertAdjacentHTML('beforeend','<div class="session-payment-ledger-empty">По этому запросу оплаченных сессий пока нет.</div>');return;}
    paid.sort((a,b)=>String(sessionPay(a).paidAt||a.date||'').localeCompare(String(sessionPay(b).paidAt||b.date||''))).forEach(s=>{
      const sp=sessionPay(s),amount=Number(sp.amount)||0,sym=currencySymbol(c,r),num=globalSessionNumber(c,s);
      const row=document.createElement('div');row.className='session-payment-ledger-row';
      row.innerHTML=`<span>${fmtDate(sp.paidAt||s.date)}</span><span class="ok">✓ Сессия №${num} от ${fmtDate(sp.sessionDate||s.date)}</span><strong>${money(amount)} ${sym}</strong>`;
      ledger.appendChild(row);
    });
  }

  function renameRequestHistory(){
    const dlg=document.querySelector('.payment-dialog');if(!dlg?.open)return;
    const title=dlg.querySelector('.payment-history-title');if(title)title.textContent='ИСТОРИЯ ПЛАТЕЖЕЙ';
  }

  const allDlg=document.createElement('dialog');
  allDlg.className='payment-dialog all-client-payments-dialog';
  allDlg.innerHTML='<div class="payment-window"><div class="payment-head"><strong>ВСЕ ПЛАТЕЖИ КЛИЕНТА</strong><button type="button" class="payment-x">×</button></div><div id="allClientPaymentsList" class="session-payment-ledger"></div><div class="payment-footer"><button type="button" class="tk-btn all-payments-close">Закрыть</button></div></div>';
  document.body.appendChild(allDlg);
  allDlg.querySelector('.payment-x').onclick=()=>allDlg.close();
  allDlg.querySelector('.all-payments-close').onclick=()=>allDlg.close();
  allDlg.addEventListener('click',e=>{if(e.target===allDlg)allDlg.close();});

  function renderAllPayments(){
    const c=currentClient(),root=allDlg.querySelector('#allClientPaymentsList');if(!c)return;
    const rows=[];
    (c.requests||[]).forEach(r=>{
      const p=paymentOf(r),rn=requestNumber(c,r),sym=currencySymbol(c,r);
      (p.payments||[]).forEach(pay=>rows.push({date:pay.date||'',sort:pay.date||'',desc:`Запрос ${rn}: ${r.title||'Без названия'}`,sub:pay.note||'Платёж по запросу',amount:Number(pay.amount)||0,sym}));
    });
    (c.sessions||[]).forEach(s=>{
      const sp=sessionPay(s);if(!sp.paid)return;
      const r=requestById(c,sp.requestId||s.requestId),rn=r?requestNumber(c,r):'—',sym=currencySymbol(c,r),sn=globalSessionNumber(c,s);
      rows.push({date:sp.paidAt||s.date||'',sort:sp.paidAt||s.date||'',desc:`Сессия №${sn} от ${fmtDate(sp.sessionDate||s.date)}`,sub:r?`Запрос ${rn}: ${r.title||'Без названия'}`:'Запрос не указан',amount:Number(sp.amount)||0,sym});
    });
    rows.sort((a,b)=>String(b.sort).localeCompare(String(a.sort)));
    root.innerHTML='<div class="session-payment-ledger-title">ИСТОРИЯ ПЛАТЕЖЕЙ — ВСЕ ЗАПРОСЫ</div>';
    if(!rows.length){root.insertAdjacentHTML('beforeend','<div class="session-payment-ledger-empty">Платежей у клиента пока нет.</div>');return;}
    rows.forEach(x=>{const row=document.createElement('div');row.className='session-payment-ledger-row';row.innerHTML=`<span>${fmtDate(x.date)}</span><span class="ok">${x.desc}<span class="request-note">${x.sub}</span></span><strong>${money(x.amount)} ${x.sym}</strong>`;root.appendChild(row);});
  }

  function ensureAllButton(){
    const dlg=document.querySelector('.payment-dialog:not(.all-client-payments-dialog)');if(!dlg)return;
    const footer=dlg.querySelector('.payment-footer');if(!footer||footer.querySelector('#allClientPaymentsBtn'))return;
    const btn=document.createElement('button');btn.type='button';btn.id='allClientPaymentsBtn';btn.className='tk-btn';btn.textContent='Все платежи клиента';
    footer.insertBefore(btn,footer.firstChild);
    btn.addEventListener('click',()=>{renderAllPayments();allDlg.showModal();});
  }

  function refresh(){ensureAllButton();renameRequestHistory();renderCurrentSessionHistory();}
  const mo=new MutationObserver(()=>setTimeout(refresh,0));mo.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('input',e=>{if(e.target.closest?.('.payment-dialog'))setTimeout(refresh,0);},true);
  document.addEventListener('change',e=>{if(e.target.closest?.('.payment-dialog'))setTimeout(refresh,0);},true);
  document.addEventListener('click',e=>{if(e.target.closest?.('.session-editor-payment-state,#paymentAddBtn,#paymentSaveSettings'))setTimeout(refresh,0);},true);
  setInterval(()=>{const dlg=document.querySelector('.payment-dialog:not(.all-client-payments-dialog)');if(dlg?.open)refresh();},500);
  setTimeout(refresh,0);
})();