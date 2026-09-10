'use strict';

(() => {
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v)||0);
  const currentClient=()=>typeof client==='function'?client():null;
  const paymentOf=r=>{
    if(!r)return null;
    if(!r.payment||typeof r.payment!=='object')r.payment={mode:'',total:0,payments:[]};
    if(!Array.isArray(r.payment.payments))r.payment.payments=[];
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
  const today=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);};
  const fmtDate=v=>{if(!v)return '—';const p=String(v).slice(0,10).split('-');return p.length===3?`${p[2]}.${p[1]}.${p[0]}`:v;};
  const globalSessionNumber=(c,target)=>{
    const chronological=(c?.sessions||[]).map((s,index)=>({s,index,time:typeof sessionTimeValue==='function'?sessionTimeValue(s,index):(new Date(s.date||s.createdAt||0).getTime()||index)})).sort((a,b)=>a.time-b.time||a.index-b.index);
    const idx=chronological.findIndex(x=>x.s===target||x.s.id===target?.id);
    return idx>=0?idx+1:'—';
  };
  const requestNumber=(c,r)=>{const i=(c?.requests||[]).findIndex(x=>x.id===r?.id);return i>=0?i+1:'—';};

  function activeRequest(c){return window.DiagnostikaRequests?.current?.(c)||(c?.requests||[]).find(r=>r.id===c?.currentRequestId)||null;}
  function requestById(c,id){return (c?.requests||[]).find(r=>r.id===id)||null;}
  function linkedRequest(c,s,preferredId){return requestById(c,preferredId)||requestById(c,sessionPay(s).requestId)||requestById(c,s?.requestId)||null;}
  function fallbackPriceRequest(c){
    const active=activeRequest(c);
    if(active&&effectivePrice(paymentOf(active))>=100)return active;
    return (c?.requests||[]).find(r=>effectivePrice(paymentOf(r))>=100)||(c?.requests||[]).find(r=>effectivePrice(paymentOf(r))>0)||null;
  }
  function configuredPriceForSession(c,s,preferredId){
    const own=linkedRequest(c,s,preferredId);
    const ownPrice=effectivePrice(paymentOf(own));
    if(ownPrice>=100)return ownPrice;
    const fallback=fallbackPriceRequest(c);
    const fallbackPrice=effectivePrice(paymentOf(fallback));
    if(fallbackPrice>=100)return fallbackPrice;
    return ownPrice>0?ownPrice:fallbackPrice;
  }
  function isClearlyBrokenLegacyAmount(saved,configured){
    return saved>0&&configured>0&&saved<configured/100;
  }
  function priceForSession(c,s,preferredId){
    const sp=sessionPay(s);
    const configured=configuredPriceForSession(c,s,preferredId);
    const saved=Number(sp.amount)||0;
    if(sp.manualAmount&&saved>0)return saved;
    if(sp.paid&&saved>0&&!isClearlyBrokenLegacyAmount(saved,configured))return saved;
    if(configured>0)return configured;
    return saved;
  }

  const style=document.createElement('style');
  style.textContent=`
    .session-date-payment-wrap{display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0}
    .session-date-payment-wrap>input[type="date"]{width:100%;box-sizing:border-box}
    .session-editor-payment{display:flex;align-items:center;gap:6px;min-height:30px;position:relative;z-index:3}
    .session-editor-payment-label{font-size:11px;font-weight:800;color:#475569}
    .session-editor-payment-state{min-height:28px!important;height:28px!important;padding:3px 9px!important;border-radius:8px!important;font-size:11px!important;font-weight:800!important;white-space:nowrap;pointer-events:auto!important;cursor:pointer!important;position:relative;z-index:4}
    .session-editor-payment-state.unpaid{background:linear-gradient(#ef6a6a,#d94d4d)!important;color:#fff!important;animation:sessionPayPulse 1.2s ease-in-out infinite}
    .session-editor-payment-state.paid{background:linear-gradient(#42ad73,#248d58)!important;color:#fff!important;animation:none!important}
    .session-pay-status.unpaid{animation:sessionPayPulse 1.2s ease-in-out infinite!important}
    @keyframes sessionPayPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.08)}50%{box-shadow:0 0 0 5px rgba(220,38,38,.16)}}
    .session-payment-ledger{margin-top:12px;border:1px solid #dbe4ed;border-radius:9px;background:#fff;overflow:hidden}
    .session-payment-ledger-title{padding:9px 11px;font-size:12px;font-weight:800;color:#334155;background:#f1f5f9;border-bottom:1px solid #dbe4ed}
    .session-payment-ledger-row{display:grid;grid-template-columns:95px 1fr 125px;gap:10px;align-items:center;padding:8px 11px;border-top:1px solid #edf1f5;font-size:12px;color:#526174}
    .session-payment-ledger-row:first-of-type{border-top:0}
    .session-payment-ledger-row .ok{color:#197344;font-weight:800}
    .session-payment-ledger-row .request-note{display:block;margin-top:2px;color:#64748b;font-size:11px;font-weight:600}
    .session-payment-ledger-row strong{color:#26384b;text-align:right}
    .session-payment-ledger-empty{padding:10px 11px;color:#94a3b8;font-size:12px}
    @media(max-width:640px){.session-payment-ledger-row{grid-template-columns:88px 1fr}.session-payment-ledger-row strong{grid-column:2;text-align:left}}
  `;
  document.head.appendChild(style);

  function refreshGlobalPaymentUi(){try{window.DiagnostikaPayments?.refresh?.();}catch(e){}try{window.DiagnostikaSessionPayments?.refresh?.();}catch(e){}}
  function applyButtonState(btn,c,s,preferredId){
    const sp=sessionPay(s),paid=!!sp.paid,amount=priceForSession(c,s,preferredId);
    btn.classList.toggle('paid',paid);btn.classList.toggle('unpaid',!paid);
    btn.textContent=paid?'✓ Оплачено':'Не оплачено';
    btn.title=paid?`Оплачено ${money(amount)} ₽. Нажми, чтобы снять оплату.`:`Стоимость сессии ${money(amount)} ₽. Нажми, чтобы отметить оплату.`;
  }
  function persistSessionPayment(c,s,preferredId,paid,dateValue){
    const sp=sessionPay(s),linked=linkedRequest(c,s,preferredId),linkedPayment=paymentOf(linked),amount=configuredPriceForSession(c,s,preferredId)||priceForSession(c,s,preferredId);
    sp.paid=!!paid;sp.amount=amount;sp.receiptUrl='';sp.manualAmount=false;
    if(linked?.id)sp.requestId=linked.id;
    if(paid){
      sp.paidAt=today();
      sp.sessionDate=dateValue||s.date||today();
      sp.priceSnapshot=true;
      sp.baseAmount=Number(linkedPayment?.sessionAmount)||amount;
      sp.discountSnapshot=Math.min(100,Math.max(0,Number(linkedPayment?.sessionDiscount)||0));
    }else{
      delete sp.paidAt;delete sp.sessionDate;delete sp.priceSnapshot;delete sp.baseAmount;delete sp.discountSnapshot;
    }
    if(typeof save==='function')save();
  }
  function getDialogSession(c,dlg){
    const id=dlg?.dataset.sessionId;if(id){const found=(c.sessions||[]).find(s=>s.id===id);if(found)return found;}
    if(typeof selectedSessionId!=='undefined'&&selectedSessionId){const found=(c.sessions||[]).find(s=>s.id===selectedSessionId);if(found)return found;}
    return null;
  }
  function enhanceDialog(dlg){
    if(!dlg||dlg.dataset.paymentEditorReady==='1')return;
    const grid=dlg.querySelector('.session-edit-grid'),requestSelect=grid?.querySelector('select');if(!grid)return;
    const c=currentClient(),s=getDialogSession(c,dlg);if(!c||!s)return;
    dlg.dataset.paymentEditorReady='1';dlg.dataset.sessionId=s.id;
    const dateInput=grid.querySelector('input[type="date"]');
    const dateWrap=document.createElement('div');dateWrap.className='session-date-payment-wrap';
    if(dateInput){dateInput.parentNode.insertBefore(dateWrap,dateInput);dateWrap.appendChild(dateInput);}else grid.prepend(dateWrap);
    const box=document.createElement('div');box.className='session-editor-payment';box.innerHTML='<span class="session-editor-payment-label">Оплата:</span><button type="button" class="tk-btn session-editor-payment-state"></button>';dateWrap.appendChild(box);
    const btn=box.querySelector('.session-editor-payment-state');btn.dataset.sessionId=s.id;
    function render(){const preferredId=requestSelect?.value||s.requestId||sessionPay(s).requestId||'';btn.dataset.requestId=preferredId;box.hidden=false;applyButtonState(btn,c,s,preferredId);}
    requestSelect?.addEventListener('change',render);render();
  }
  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('.session-editor-payment-state');if(!btn)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const dlg=btn.closest('dialog.session-edit-dialog'),c=currentClient();if(!dlg||!c)return;
    const s=(c.sessions||[]).find(x=>x.id===btn.dataset.sessionId)||getDialogSession(c,dlg);if(!s)return;
    const requestSelect=dlg.querySelector('.session-edit-grid select');const preferredId=requestSelect?.value||s.requestId||sessionPay(s).requestId||'';if(preferredId)s.requestId=preferredId;
    const dateInput=dlg.querySelector('.session-edit-grid input[type="date"]'),next=!sessionPay(s).paid;
    persistSessionPayment(c,s,preferredId,next,dateInput?.value||s.date||today());applyButtonState(btn,c,s,preferredId);refreshGlobalPaymentUi();renderPaymentLedger();
    setTimeout(()=>{try{if(typeof renderSessions==='function')renderSessions();}catch(err){}refreshGlobalPaymentUi();renderPaymentLedger();},0);
  },true);
  function renderPaymentLedger(){
    const dlg=document.querySelector('.payment-dialog');if(!dlg)return;
    const mode=dlg.querySelector('#paymentMode')?.value||'';let ledger=dlg.querySelector('#sessionPaymentLedger');
    if(mode!=='session'){if(ledger)ledger.hidden=true;return;}
    const c=currentClient();if(!c)return;
    if(!ledger){ledger=document.createElement('div');ledger.id='sessionPaymentLedger';ledger.className='session-payment-ledger';const hint=dlg.querySelector('#paymentSessionHint');(hint||dlg.querySelector('#paymentSummary'))?.insertAdjacentElement('afterend',ledger);}
    ledger.hidden=false;
    const paid=(c.sessions||[]).filter(s=>sessionPay(s).paid).sort((a,b)=>String(sessionPay(a).paidAt||a.date||'').localeCompare(String(sessionPay(b).paidAt||b.date||'')));
    ledger.innerHTML='<div class="session-payment-ledger-title">ВЕДОМОСТЬ ОПЛАТЫ СЕССИЙ — ВСЕ ЗАПРОСЫ</div>';
    if(!paid.length){ledger.insertAdjacentHTML('beforeend','<div class="session-payment-ledger-empty">Оплаченных сессий пока нет.</div>');return;}
    let repaired=false;
    paid.forEach(s=>{
      const sp=sessionPay(s),req=linkedRequest(c,s,sp.requestId||s.requestId);
      const configured=configuredPriceForSession(c,s,req?.id||'');
      let amount=Number(sp.amount)||0;
      if(amount<=0||isClearlyBrokenLegacyAmount(amount,configured)){
        if(configured>0){sp.amount=configured;amount=configured;repaired=true;}
      }
      if(amount<=0)amount=priceForSession(c,s,req?.id||'');
      const number=globalSessionNumber(c,s),paymentDate=sp.paidAt||today(),sessionDate=sp.sessionDate||s.date||'—';
      const reqLabel=req?`Запрос ${requestNumber(c,req)}: ${req.title||'Без названия'}`:'Запрос не указан';
      const row=document.createElement('div');row.className='session-payment-ledger-row';row.innerHTML=`<span>${fmtDate(paymentDate)}</span><span class="ok">✓ Сессия №${number} от ${fmtDate(sessionDate)}<span class="request-note">${reqLabel}</span></span><strong>${money(amount)} ₽</strong>`;ledger.appendChild(row);
    });
    if(repaired&&typeof save==='function')save();
  }
  function refresh(){document.querySelectorAll('.session-edit-dialog').forEach(enhanceDialog);renderPaymentLedger();}
  document.addEventListener('input',e=>{if(e.target?.id==='sessionBasePrice'||e.target?.id==='sessionDiscount')setTimeout(renderPaymentLedger,0);});
  document.addEventListener('change',e=>{if(e.target?.id==='paymentMode'||e.target?.id==='sessionBasePrice'||e.target?.id==='sessionDiscount')setTimeout(renderPaymentLedger,0);});
  const observer=new MutationObserver(()=>setTimeout(refresh,0));observer.observe(document.body,{childList:true,subtree:true});setTimeout(refresh,0);
})();
