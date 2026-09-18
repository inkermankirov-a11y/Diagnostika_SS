'use strict';

(() => {
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const today=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);};
  const currentClient=()=>typeof client==='function'?client():null;
  const paymentWriter=()=>window.DiagnostikaPayments?.moduleAware===true?window.DiagnostikaPayments:null;
  const linkSessionRequest=(c,s,requestId,source)=>{
    if(!c||!s||!requestId||String(s.requestId||'')===String(requestId))return true;
    const api=window.DiagnostikaSessions?.moduleAware===true
      ? window.DiagnostikaSessions
      : window.DiagnostikaPlatform?.services?.sessions||null;
    return !!api?.update?.(s.id,{requestId},{client:c,source,render:false});
  };

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

  function paymentOf(c,s){
    return paymentWriter()?.session?.(s?.id,c)||(s?.payment&&typeof s.payment==='object'?s.payment:{paid:false,amount:0,receiptUrl:'',note:''});
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
    if(id){const found=(c.sessions||[]).find(s=>String(s.id)===String(id));if(found)return found;}
    try{if(typeof selectedSessionId!=='undefined'&&selectedSessionId){const found=(c.sessions||[]).find(s=>String(s.id)===String(selectedSessionId));if(found)return found;}}catch(_){}
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

  function amountFor(dlg,c,s,r){
    return Math.max(0,num(dlg?.querySelector('.session-editor-payment-amount')?.value)||num(paymentOf(c,s)?.amount)||effectivePrice(r));
  }

  function paint(btn,c,s,dlg,r){
    const sp=paymentOf(c,s),paid=sp.paid===true,amount=amountFor(dlg,c,s,r);
    if(btn.classList.contains('paid')!==paid)btn.classList.toggle('paid',paid);
    if(btn.classList.contains('unpaid')===paid)btn.classList.toggle('unpaid',!paid);
    const text=paid?'✓ Оплачено':'Не оплачено';if(btn.textContent!==text)btn.textContent=text;
    const title=paid?`Оплачено${amount?` ${amount.toLocaleString('ru-RU')} ₽`:''}. Нажмите, чтобы снять оплату.`:'Нажмите, чтобы отметить оплату.';if(btn.title!==title)btn.title=title;
    const aria=paid?'true':'false';if(btn.getAttribute('aria-pressed')!==aria)btn.setAttribute('aria-pressed',aria);
    const legacy=dlg?.querySelector('.session-payment-field input[type="checkbox"],.session-payment-paid input[type="checkbox"]');
    if(legacy&&legacy.checked!==paid)legacy.checked=paid;
  }

  function refreshOutside(){
    try{window.DiagnostikaHomeDashboard?.refresh?.();}catch(_){}
    try{window.DiagnostikaPayments?.refresh?.();}catch(_){}
    try{window.DiagnostikaAllPayments?.render?.();}catch(_){}
    try{window.DiagnostikaCompletePaymentHistory?.refresh?.();}catch(_){}
    try{window.DiagnostikaClientPaymentFlags?.refresh?.();}catch(_){}
  }

  function install(dlg){
    if(!dlg?.matches?.('dialog.session-edit-dialog'))return;
    const c=currentClient(),s=sessionFromDialog(dlg,c);if(!c||!s)return;
    let btn=dlg.querySelector('.session-payment-toggle-stable');
    if(!btn){
      const old=dlg.querySelector('.session-editor-payment-state');
      if(!old){
        const retry=Math.max(0,Number(dlg.dataset.paymentAuthorityRetry)||0);
        if(retry<12){
          dlg.dataset.paymentAuthorityRetry=String(retry+1);
          setTimeout(()=>install(dlg),25);
        }
        return;
      }
      delete dlg.dataset.paymentAuthorityRetry;
      btn=old.cloneNode(true);btn.classList.remove('session-editor-payment-state');btn.classList.add('session-payment-toggle-stable');btn.type='button';old.replaceWith(btn);
      btn.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        const clientNow=currentClient(),sessionNow=sessionFromDialog(dlg,clientNow);if(!clientNow||!sessionNow)return;
        const requestNow=requestForSession(clientNow,sessionNow,dlg),sp=paymentOf(clientNow,sessionNow),nextPaid=sp.paid!==true,amount=amountFor(dlg,clientNow,sessionNow,requestNow);
        if(requestNow?.id&&!linkSessionRequest(clientNow,sessionNow,requestNow.id,'session-payment-authority-link'))return;
        const next={...sp,paid:nextPaid,manualAmount:false};
        if(amount>0)next.amount=amount;
        if(requestNow?.id)next.requestId=requestNow.id;
        if(nextPaid){
          next.paidAt=today();next.sessionDate=dlg.querySelector('.session-edit-grid input[type="date"]')?.value||sessionNow.date||today();
          if(requestNow){next.baseAmount=num(requestNow.payment?.sessionAmount)||amount;next.discountSnapshot=Math.min(100,Math.max(0,num(requestNow.payment?.sessionDiscount)));next.priceSnapshot=true;}
        }else{delete next.paidAt;delete next.sessionDate;delete next.baseAmount;delete next.discountSnapshot;delete next.priceSnapshot;}
        const updated=paymentWriter()?.replaceSession?.(
          sessionNow.id,next,{client:clientNow,source:'session-payment-authority-toggle'}
        );
        if(!updated)return;
        dlg.dataset.saveGuardPaymentDraft=nextPaid?'1':'0';dlg.dataset.saveGuardSessionDirty='1';
        paint(btn,clientNow,sessionNow,dlg,requestNow);refreshOutside();
      },true);
    }
    const legacy=dlg.querySelector('.session-payment-field');if(legacy&&legacy.style.display!=='none')legacy.style.display='none';
    const paid=paymentOf(c,s).paid===true,draft=paid?'1':'0';if(dlg.dataset.saveGuardPaymentDraft!==draft)dlg.dataset.saveGuardPaymentDraft=draft;
    paint(btn,c,s,dlg,requestForSession(c,s,dlg));
  }

  function refresh(){document.querySelectorAll('dialog.session-edit-dialog').forEach(install);}

  const observer=new MutationObserver(mutations=>{
    const addedDialog=mutations.some(m=>Array.from(m.addedNodes||[]).some(node=>{
      if(!(node instanceof Element))return false;
      return node.matches?.('dialog.session-edit-dialog')||node.querySelector?.('dialog.session-edit-dialog');
    }));
    if(addedDialog)setTimeout(refresh,0);
  });
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.closest?.('dialog.session-edit-dialog'))setTimeout(refresh,0);},true);

  setTimeout(refresh,0);
  window.DiagnostikaSessionPaymentButtonAuthority={refresh};
})();