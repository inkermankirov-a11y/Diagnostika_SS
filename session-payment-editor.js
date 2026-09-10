'use strict';

(() => {
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v)||0);
  const currentClient=()=>typeof client==='function'?client():null;
  const paymentOf=r=>{
    if(!r)return null;
    if(!r.payment||typeof r.payment!=='object')r.payment={mode:'',total:0,payments:[]};
    if(!Number.isFinite(Number(r.payment.sessionAmount)))r.payment.sessionAmount=0;
    if(!Number.isFinite(Number(r.payment.sessionDiscount)))r.payment.sessionDiscount=0;
    return r.payment;
  };
  const effectivePrice=p=>{
    const base=Math.max(0,Number(p?.sessionAmount)||0);
    const discount=Math.min(100,Math.max(0,Number(p?.sessionDiscount)||0));
    return Math.max(0,Math.round(base*(1-discount/100)*100)/100);
  };
  const sessionPay=s=>{
    if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0,receiptUrl:'',note:''};
    return s.payment;
  };
  const today=()=>{
    const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);
  };
  const fmtDate=v=>{
    if(!v)return '—';
    const p=String(v).slice(0,10).split('-');
    return p.length===3?`${p[2]}.${p[1]}.${p[0]}`:v;
  };

  const style=document.createElement('style');
  style.textContent=`
    .session-date-payment-wrap{display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0}
    .session-date-payment-wrap>input[type="date"]{width:100%;box-sizing:border-box}
    .session-editor-payment{display:flex;align-items:center;gap:6px;min-height:30px}
    .session-editor-payment-label{font-size:11px;font-weight:800;color:#475569}
    .session-editor-payment-state{min-height:28px!important;height:28px!important;padding:3px 9px!important;border-radius:8px!important;font-size:11px!important;font-weight:800!important;white-space:nowrap}
    .session-editor-payment-state.unpaid{background:linear-gradient(#ef6a6a,#d94d4d)!important;color:#fff!important;animation:sessionPayPulse 1.2s ease-in-out infinite}
    .session-editor-payment-state.paid{background:linear-gradient(#42ad73,#248d58)!important;color:#fff!important;animation:none!important}
    .session-pay-status.unpaid{animation:sessionPayPulse 1.2s ease-in-out infinite!important}
    @keyframes sessionPayPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.08)}50%{box-shadow:0 0 0 5px rgba(220,38,38,.16)}}
    .session-payment-ledger{margin-top:12px;border:1px solid #dbe4ed;border-radius:9px;background:#fff;overflow:hidden}
    .session-payment-ledger-title{padding:9px 11px;font-size:12px;font-weight:800;color:#334155;background:#f1f5f9;border-bottom:1px solid #dbe4ed}
    .session-payment-ledger-row{display:grid;grid-template-columns:95px 1fr 130px;gap:10px;align-items:center;padding:8px 11px;border-top:1px solid #edf1f5;font-size:12px;color:#526174}
    .session-payment-ledger-row:first-of-type{border-top:0}
    .session-payment-ledger-row .ok{color:#197344;font-weight:800}
    .session-payment-ledger-row strong{color:#26384b;text-align:right}
    .session-payment-ledger-empty{padding:10px 11px;color:#94a3b8;font-size:12px}
    @media(max-width:640px){.session-payment-ledger-row{grid-template-columns:82px 1fr}.session-payment-ledger-row strong{grid-column:2;text-align:left}}
  `;
  document.head.appendChild(style);

  function getDialogSession(){
    const c=currentClient();if(!c)return null;
    if(typeof selectedSessionId!=='undefined'&&selectedSessionId){
      const s=(c.sessions||[]).find(x=>x.id===selectedSessionId);if(s)return s;
    }
    return null;
  }

  function refreshGlobalPaymentUi(){
    try{window.DiagnostikaPayments?.refresh?.();}catch(e){}
    try{window.DiagnostikaSessionPayments?.refresh?.();}catch(e){}
  }

  function persistSessionPayment(c,s,r,paid,dateValue){
    const p=paymentOf(r),sp=sessionPay(s);
    sp.paid=!!paid;
    sp.amount=effectivePrice(p);
    sp.receiptUrl='';
    sp.manualAmount=false;
    if(paid){
      if(!sp.paidAt)sp.paidAt=today();
      sp.sessionDate=dateValue||s.date||today();
    }else{
      delete sp.paidAt;
      delete sp.sessionDate;
    }
    if(typeof save==='function')save();
    refreshGlobalPaymentUi();
    setTimeout(()=>{
      try{if(typeof renderSessions==='function')renderSessions();}catch(e){}
      refreshGlobalPaymentUi();
      renderPaymentLedger();
    },0);
  }

  function enhanceDialog(dlg){
    if(!dlg||dlg.dataset.paymentEditorReady==='1')return;
    const grid=dlg.querySelector('.session-edit-grid');
    const requestSelect=grid?.querySelector('select');
    if(!grid||!requestSelect)return;

    const c=currentClient(),s=getDialogSession();if(!c||!s)return;
    dlg.dataset.paymentEditorReady='1';

    const dateInput=grid.querySelector('input[type="date"]');
    const dateWrap=document.createElement('div');
    dateWrap.className='session-date-payment-wrap';
    if(dateInput){
      dateInput.parentNode.insertBefore(dateWrap,dateInput);
      dateWrap.appendChild(dateInput);
    }else grid.prepend(dateWrap);

    const box=document.createElement('div');
    box.className='session-editor-payment';
    box.innerHTML='<span class="session-editor-payment-label">Оплата:</span><button type="button" class="tk-btn session-editor-payment-state"></button>';
    dateWrap.appendChild(box);

    const stateBtn=box.querySelector('.session-editor-payment-state');

    function request(){return (c.requests||[]).find(r=>r.id===requestSelect.value)||null;}
    function render(){
      const r=request(),p=paymentOf(r),enabled=p?.mode==='session';
      box.hidden=!enabled;
      if(!enabled)return;
      const paid=!!sessionPay(s).paid;
      stateBtn.classList.toggle('paid',paid);
      stateBtn.classList.toggle('unpaid',!paid);
      stateBtn.textContent=paid?'✓ Оплачено':'Не оплачено';
      stateBtn.title=paid?`Оплачено ${money(sessionPay(s).amount||effectivePrice(p))} ₽. Нажми, чтобы снять оплату.`:`Стоимость сессии ${money(effectivePrice(p))} ₽. Нажми, чтобы отметить оплату.`;
    }

    stateBtn.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      const r=request(),p=paymentOf(r);if(!r||p?.mode!=='session')return;
      const next=!sessionPay(s).paid;
      persistSessionPayment(c,s,r,next,dateInput?.value||s.date||today());
      render();
    });

    requestSelect.addEventListener('change',render);
    render();
  }

  function renderPaymentLedger(){
    const dlg=document.querySelector('.payment-dialog');if(!dlg)return;
    const mode=dlg.querySelector('#paymentMode')?.value||'';
    let ledger=dlg.querySelector('#sessionPaymentLedger');
    if(mode!=='session'){
      if(ledger)ledger.hidden=true;
      return;
    }
    const c=currentClient();
    const r=(c?.requests||[]).find(x=>x.id===c?.currentRequestId)||window.DiagnostikaRequests?.current?.(c)||null;
    if(!c||!r)return;
    if(!ledger){
      ledger=document.createElement('div');ledger.id='sessionPaymentLedger';ledger.className='session-payment-ledger';
      const hint=dlg.querySelector('#paymentSessionHint');
      (hint||dlg.querySelector('#paymentSummary'))?.insertAdjacentElement('afterend',ledger);
    }
    ledger.hidden=false;
    const sessions=(c.sessions||[]).filter(s=>s.requestId===r.id);
    const chronological=sessions.map((s,index)=>({s,index,time:new Date(s.date||0).getTime()||index})).sort((a,b)=>a.time-b.time||a.index-b.index);
    const paid=chronological.filter(x=>sessionPay(x.s).paid);
    ledger.innerHTML='<div class="session-payment-ledger-title">ВЕДОМОСТЬ ОПЛАТЫ СЕССИЙ</div>';
    if(!paid.length){
      ledger.insertAdjacentHTML('beforeend','<div class="session-payment-ledger-empty">Оплаченных сессий пока нет.</div>');
      return;
    }
    paid.forEach(item=>{
      const sp=sessionPay(item.s),num=chronological.indexOf(item)+1;
      const row=document.createElement('div');row.className='session-payment-ledger-row';
      row.innerHTML=`<span>${fmtDate(sp.paidAt||item.s.date)}</span><span class="ok">✓ Сессия №${num} оплачена</span><strong>${money(sp.amount||effectivePrice(paymentOf(r)))} ₽</strong>`;
      ledger.appendChild(row);
    });
  }

  function refresh(){
    document.querySelectorAll('.session-edit-dialog').forEach(enhanceDialog);
    renderPaymentLedger();
  }
  document.addEventListener('change',e=>{if(e.target?.id==='paymentMode')setTimeout(renderPaymentLedger,0);});
  const observer=new MutationObserver(()=>setTimeout(refresh,0));
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(refresh,0);
})();
