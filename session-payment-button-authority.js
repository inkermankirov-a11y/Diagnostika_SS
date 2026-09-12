'use strict';

(() => {
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const today=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);};
  const currentClient=()=>typeof client==='function'?client():null;

  const style=document.createElement('style');
  style.textContent=`
    .session-payment-toggle-stable{
      min-height:28px!important;height:28px!important;padding:3px 9px!important;border-radius:8px!important;
      font-size:11px!important;font-weight:800!important;white-space:nowrap!important;cursor:pointer!important;
      animation:none!important;transition:none!important;box-shadow:none!important;
    }
    .session-payment-toggle-stable.unpaid{background:linear-gradient(#ef6a6a,#d94d4d)!important;color:#fff!important;border:1px solid #cf4646!important;animation:none!important}
    .session-payment-toggle-stable.paid{background:linear-gradient(#42ad73,#248d58)!important;color:#fff!important;border:1px solid #248d58!important;animation:none!important}
  `;
  document.head.appendChild(style);

  function paymentOf(s){
    if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0,receiptUrl:'',note:''};
    return s.payment;
  }

  function sessionByNumber(c,n){
    const chronological=(c?.sessions||[])
      .map((s,index)=>({s,index,time:typeof sessionTimeValue==='function'?sessionTimeValue(s,index):(new Date(s.date||s.createdAt||0).getTime()||index)}))
      .sort((a,b)=>a.time-b.time||a.index-b.index);
    return chronological[n-1]?.s||null;
  }

  function sessionFromDialog(dlg,c=currentClient()){
    if(!dlg||!c)return null;
    const id=dlg.dataset.sessionId;
    if(id){
      const found=(c.sessions||[]).find(s=>String(s.id)===String(id));
      if(found)return found;
    }
    try{
      if(typeof selectedSessionId!=='undefined'&&selectedSessionId){
        const found=(c.sessions||[]).find(s=>String(s.id)===String(selectedSessionId));
        if(found)return found;
      }
    }catch(_){}
    const title=dlg.querySelector('.session-edit-title,h1,h2,h3')?.textContent||'';
    const m=title.match(/Сессия\s*№\s*(\d+)/i);
    return m?sessionByNumber(c,Number(m[1])):null;
  }

  function requestForSession(c,s,dlg){
    const id=dlg?.querySelector('.session-edit-grid select')?.value||s?.requestId||s?.payment?.requestId||'';
    return (c?.requests||[]).find(r=>String(r.id)===String(id))||null;
  }

  function effectivePrice(r){
    const p=r?.payment||{};
    const base=Math.max(0,num(p.sessionAmount));
    const discount=Math.min(100,Math.max(0,num(p.sessionDiscount)));
    return Math.max(0,Math.round(base*(1-discount/100)*100)/100);
  }

  function amountFor(dlg,s,r){
    return Math.max(0,
      num(dlg?.querySelector('.session-editor-payment-amount')?.value)||
      num(s?.payment?.amount)||
      effectivePrice(r)
    );
  }

  function paint(btn,s,dlg,r){
    const sp=paymentOf(s);
    const paid=sp.paid===true;
    const amount=amountFor(dlg,s,r);
    btn.classList.toggle('paid',paid);
    btn.classList.toggle('unpaid',!paid);
    btn.textContent=paid?'✓ Оплачено':'Не оплачено';
    btn.title=paid?`Оплачено${amount?` ${amount.toLocaleString('ru-RU')} ₽`:''}. Нажмите, чтобы снять оплату.`:'Нажмите, чтобы отметить оплату.';
    btn.setAttribute('aria-pressed',paid?'true':'false');
    const legacy=dlg?.querySelector('.session-payment-field input[type="checkbox"],.session-payment-paid input[type="checkbox"]');
    if(legacy)legacy.checked=paid;
  }

  function saveState(){
    try{if(typeof save==='function')save();}catch(_){}
  }

  function refreshOutside(){
    try{window.DiagnostikaHomeDashboard?.refresh?.();}catch(_){}
    try{window.DiagnostikaPayments?.refresh?.();}catch(_){}
    try{window.DiagnostikaAllPayments?.render?.();}catch(_){}
    try{window.DiagnostikaCompletePaymentHistory?.refresh?.();}catch(_){}
  }

  function install(dlg){
    if(!dlg?.matches?.('dialog.session-edit-dialog'))return;
    const c=currentClient(),s=sessionFromDialog(dlg,c);
    if(!c||!s)return;

    let btn=dlg.querySelector('.session-payment-toggle-stable');
    if(!btn){
      const old=dlg.querySelector('.session-editor-payment-state');
      if(!old)return;

      // Убираем старый класс намеренно: старые делегированные обработчики больше не видят эту кнопку.
      btn=old.cloneNode(true);
      btn.classList.remove('session-editor-payment-state');
      btn.classList.add('session-payment-toggle-stable');
      btn.type='button';
      old.replaceWith(btn);

      btn.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const clientNow=currentClient();
        const sessionNow=sessionFromDialog(dlg,clientNow);
        if(!clientNow||!sessionNow)return;
        const requestNow=requestForSession(clientNow,sessionNow,dlg);
        const sp=paymentOf(sessionNow);
        const next=sp.paid!==true;
        const amount=amountFor(dlg,sessionNow,requestNow);

        sp.paid=next;
        if(amount>0)sp.amount=amount;
        if(requestNow?.id){
          sessionNow.requestId=requestNow.id;
          sp.requestId=requestNow.id;
        }
        sp.manualAmount=false;

        if(next){
          sp.paidAt=today();
          sp.sessionDate=dlg.querySelector('.session-edit-grid input[type="date"]')?.value||sessionNow.date||today();
          if(requestNow){
            sp.baseAmount=num(requestNow.payment?.sessionAmount)||amount;
            sp.discountSnapshot=Math.min(100,Math.max(0,num(requestNow.payment?.sessionDiscount)));
            sp.priceSnapshot=true;
          }
        }else{
          delete sp.paidAt;
          delete sp.sessionDate;
          delete sp.baseAmount;
          delete sp.discountSnapshot;
          delete sp.priceSnapshot;
        }

        saveState();
        paint(btn,sessionNow,dlg,requestNow);
        refreshOutside();

        // Повторная окраска только из сохранённого объекта, без инверсии состояния.
        setTimeout(()=>paint(btn,sessionNow,dlg,requestNow),50);
        setTimeout(()=>paint(btn,sessionNow,dlg,requestNow),300);
      },true);
    }

    const legacy=dlg.querySelector('.session-payment-field');
    if(legacy)legacy.style.display='none';
    paint(btn,s,dlg,requestForSession(c,s,dlg));
  }

  function refresh(){
    document.querySelectorAll('dialog.session-edit-dialog').forEach(install);
  }

  const observer=new MutationObserver(()=>requestAnimationFrame(refresh));
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{
    if(e.target?.closest?.('dialog.session-edit-dialog'))setTimeout(refresh,0);
  },true);

  setTimeout(refresh,0);
  window.DiagnostikaSessionPaymentButtonAuthority={refresh};
})();