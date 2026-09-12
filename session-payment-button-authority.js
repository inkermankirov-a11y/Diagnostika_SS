'use strict';

(() => {
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const today=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);};
  const currentClient=()=>typeof client==='function'?client():null;

  function sessionFromButton(btn,c){
    const id=btn?.dataset?.sessionId||btn?.closest('dialog.session-edit-dialog')?.dataset?.sessionId||'';
    if(id){
      const s=(c?.sessions||[]).find(x=>String(x?.id)===String(id));
      if(s)return s;
    }
    const dlg=btn?.closest('dialog.session-edit-dialog');
    const title=dlg?.querySelector('h1,h2,h3,.session-edit-title')?.textContent||'';
    const m=title.match(/Сессия\s*№\s*(\d+)/i);
    if(m){
      const chronological=(c?.sessions||[])
        .map((s,index)=>({s,index,time:new Date(s.date||s.createdAt||0).getTime()||index}))
        .sort((a,b)=>a.time-b.time||a.index-b.index);
      return chronological[Number(m[1])-1]?.s||null;
    }
    return null;
  }

  function requestForSession(c,s,dlg){
    const selectedId=dlg?.querySelector('.session-edit-grid select')?.value||'';
    const ids=[selectedId,s?.requestId,s?.payment?.requestId].filter(Boolean).map(String);
    for(const id of ids){
      const r=(c?.requests||[]).find(x=>String(x?.id)===id);
      if(r)return r;
    }
    return null;
  }

  function effectivePrice(r){
    const p=r?.payment||{};
    const base=Math.max(0,num(p.sessionAmount));
    const discount=Math.min(100,Math.max(0,num(p.sessionDiscount)));
    return Math.max(0,Math.round(base*(1-discount/100)*100)/100);
  }

  function paint(btn,paid,amount){
    btn.classList.toggle('paid',paid);
    btn.classList.toggle('unpaid',!paid);
    btn.textContent=paid?'✓ Оплачено':'Не оплачено';
    btn.title=paid?`Оплачено ${amount} ₽. Нажми, чтобы снять оплату.`:'Нажми, чтобы отметить оплату.';
  }

  function hideLegacyControl(dlg){
    const legacy=dlg?.querySelector('.session-payment-field');
    if(legacy)legacy.style.display='none';
  }

  function syncOpenDialogs(){
    const c=currentClient();if(!c)return;
    document.querySelectorAll('dialog.session-edit-dialog').forEach(dlg=>{
      const btn=dlg.querySelector('.session-editor-payment-state');
      if(!btn)return;
      const s=sessionFromButton(btn,c);if(!s)return;
      const r=requestForSession(c,s,dlg);
      hideLegacyControl(dlg);
      const sp=s.payment&&typeof s.payment==='object'?s.payment:(s.payment={paid:false,amount:0,receiptUrl:'',note:''});
      const amount=num(sp.amount)||effectivePrice(r);
      paint(btn,!!sp.paid,amount);
      const amountInput=dlg.querySelector('.session-editor-payment-amount');
      if(amountInput&&document.activeElement!==amountInput)amountInput.value=amount||'';
    });
  }

  // Один авторитетный обработчик кнопки оплаты сессии. Не зависит от режима запроса.
  window.addEventListener('click',e=>{
    const btn=e.target?.closest?.('.session-editor-payment-state');
    if(!btn)return;
    const dlg=btn.closest('dialog.session-edit-dialog');
    const c=currentClient();
    if(!dlg||!c)return;
    const s=sessionFromButton(btn,c);if(!s)return;
    const r=requestForSession(c,s,dlg);

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0,receiptUrl:'',note:''};
    const sp=s.payment;
    const next=!sp.paid;
    const amountInput=dlg.querySelector('.session-editor-payment-amount');
    const amount=num(amountInput?.value)||num(sp.amount)||effectivePrice(r);

    sp.paid=next;
    sp.amount=amount;
    if(r?.id){
      sp.requestId=r.id;
      s.requestId=r.id;
    }
    sp.manualAmount=false;

    if(next){
      sp.paidAt=today();
      sp.sessionDate=dlg.querySelector('.session-edit-grid input[type="date"]')?.value||s.date||today();
      if(r){
        sp.baseAmount=num(r.payment?.sessionAmount)||amount;
        sp.discountSnapshot=Math.min(100,Math.max(0,num(r.payment?.sessionDiscount)));
        sp.priceSnapshot=true;
      }
    }else{
      delete sp.paidAt;
      delete sp.sessionDate;
      delete sp.baseAmount;
      delete sp.discountSnapshot;
      delete sp.priceSnapshot;
    }

    if(typeof save==='function')save();
    paint(btn,next,amount);
    hideLegacyControl(dlg);

    try{window.DiagnostikaSessionPaymentUiSync?.refresh?.();}catch(_){}
    try{window.DiagnostikaPayments?.refresh?.();}catch(_){}
    try{window.DiagnostikaPaymentScopeAuthority?.refresh?.();}catch(_){}
    try{window.DiagnostikaAllPayments?.render?.();}catch(_){}
    try{if(typeof renderSessions==='function')renderSessions();}catch(_){}

    setTimeout(syncOpenDialogs,0);
    setTimeout(syncOpenDialogs,120);
    setTimeout(syncOpenDialogs,500);
  },true);

  const observer=new MutationObserver(()=>requestAnimationFrame(syncOpenDialogs));
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(syncOpenDialogs,0);
  window.DiagnostikaSessionPaymentButtonAuthority={refresh:syncOpenDialogs};
})();