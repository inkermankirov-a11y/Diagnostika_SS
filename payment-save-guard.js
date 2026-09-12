'use strict';

(() => {
  const todayLocal=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);};
  const currentClient=()=>typeof client==='function'?client():null;
  const escJson=v=>{try{return JSON.stringify(v??null);}catch(_){return 'null';}};
  const clone=v=>{try{return JSON.parse(JSON.stringify(v??null));}catch(_){return null;}};

  function requestFromPaymentDialog(dlg,c=currentClient()){
    if(!c)return null;
    const text=dlg?.querySelector('#paymentRequestSub')?.textContent||'';
    const m=text.match(/Запрос\s+(\d+)/i);
    if(m){const i=Number(m[1])-1;if(c.requests?.[i])return c.requests[i];}
    return window.DiagnostikaRequests?.current?.(c)
      ||c.requests?.find(r=>r.id===c.currentRequestId)
      ||c.requests?.find(r=>r.id===requestId)
      ||null;
  }

  function sessionFromDialog(dlg,c=currentClient()){
    if(!c||!dlg)return null;
    const id=dlg.dataset.sessionId;
    if(id){const s=c.sessions?.find(x=>x.id===id);if(s)return s;}
    if(typeof selectedSessionId!=='undefined'&&selectedSessionId){
      const s=c.sessions?.find(x=>x.id===selectedSessionId);if(s)return s;
    }
    return null;
  }

  function effectiveSessionPrice(req){
    const p=req?.payment||{};
    const base=Math.max(0,Number(p.sessionAmount)||0);
    const discount=Math.min(100,Math.max(0,Number(p.sessionDiscount)||0));
    return Math.max(0,Math.round(base*(1-discount/100)*100)/100);
  }

  function ensureSessionSnapshot(dlg){
    if(!dlg||dlg.dataset.guardSessionReady==='1')return;
    const c=currentClient(),s=sessionFromDialog(dlg,c);
    if(!c||!s)return;
    const grid=dlg.querySelector('.session-edit-grid');
    const date=grid?.querySelector('input[type="date"]');
    const req=grid?.querySelector('select');
    const notes=dlg.querySelector('.session-edit-text');
    dlg.dataset.guardSessionReady='1';
    dlg.dataset.guardSessionDirty='0';
    dlg.dataset.guardPaymentDraft=(s.payment?.paid?'1':'0');
    dlg.__guardSessionSnapshot={
      date:date?.value||s.date||'',
      requestId:req?.value||s.requestId||'',
      notes:notes?.value||s.notes||'',
      payment:clone(s.payment||null)
    };
  }

  function sessionDirty(dlg){return dlg?.dataset.guardSessionDirty==='1';}
  function markSessionDirty(dlg){ensureSessionSnapshot(dlg);if(dlg)dlg.dataset.guardSessionDirty='1';}

  function paintSessionPaymentButton(dlg){
    const btn=dlg?.querySelector('.session-editor-payment-state');
    if(!btn)return;
    ensureSessionSnapshot(dlg);
    const c=currentClient(),s=sessionFromDialog(dlg,c);if(!c||!s)return;
    const reqId=dlg.querySelector('.session-edit-grid select')?.value||s.requestId||s.payment?.requestId||'';
    const req=c.requests?.find(r=>r.id===reqId)||null;
    const amount=effectiveSessionPrice(req)||(Number(s.payment?.amount)||0);
    const paid=dlg.dataset.guardPaymentDraft==='1';
    btn.classList.toggle('paid',paid);btn.classList.toggle('unpaid',!paid);
    btn.textContent=paid?'✓ Оплачено':'Не оплачено';
    btn.title=paid?`Оплачено ${amount||0} ₽`:`Не оплачено${amount?` · ${amount} ₽`:''}`;
  }

  function commitSessionPayment(dlg){
    ensureSessionSnapshot(dlg);
    const c=currentClient(),s=sessionFromDialog(dlg,c);if(!c||!s)return;
    const reqId=dlg.querySelector('.session-edit-grid select')?.value||s.requestId||s.payment?.requestId||'';
    const req=c.requests?.find(r=>r.id===reqId)||null;
    const amount=effectiveSessionPrice(req)||(Number(s.payment?.amount)||0);
    const paid=dlg.dataset.guardPaymentDraft==='1';
    if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0,receiptUrl:'',note:''};
    s.payment.paid=paid;
    s.payment.amount=amount;
    s.payment.manualAmount=false;
    s.payment.receiptUrl='';
    if(reqId){s.payment.requestId=reqId;s.requestId=reqId;}
    if(paid){
      s.payment.paidAt=todayLocal();
      s.payment.sessionDate=dlg.querySelector('.session-edit-grid input[type="date"]')?.value||s.date||todayLocal();
      s.payment.priceSnapshot=true;
      s.payment.baseAmount=Math.max(0,Number(req?.payment?.sessionAmount)||amount);
      s.payment.discountSnapshot=Math.min(100,Math.max(0,Number(req?.payment?.sessionDiscount)||0));
    }else{
      delete s.payment.paidAt;delete s.payment.sessionDate;delete s.payment.priceSnapshot;delete s.payment.baseAmount;delete s.payment.discountSnapshot;
    }
    if(typeof save==='function')save();
    dlg.dataset.guardSessionDirty='0';
    dlg.__guardSessionSnapshot={
      date:dlg.querySelector('.session-edit-grid input[type="date"]')?.value||s.date||'',
      requestId:reqId,
      notes:dlg.querySelector('.session-edit-text')?.value||s.notes||'',
      payment:clone(s.payment)
    };
  }

  function discardSessionPayment(dlg){
    const snap=dlg?.__guardSessionSnapshot,c=currentClient(),s=sessionFromDialog(dlg,c);
    if(!snap||!s)return;
    s.payment=clone(snap.payment);
  }

  function ensurePaymentSnapshot(dlg){
    if(!dlg||dlg.__guardPaymentSnapshot)return;
    const c=currentClient(),r=requestFromPaymentDialog(dlg,c);if(!r)return;
    dlg.__guardPaymentRequestId=r.id;
    dlg.__guardPaymentSnapshot=clone(r.payment||null);
    dlg.dataset.guardPaymentDirty='0';
  }
  function markPaymentDirty(dlg){ensurePaymentSnapshot(dlg);if(dlg)dlg.dataset.guardPaymentDirty='1';}
  function commitPaymentSnapshot(dlg){
    const c=currentClient(),r=requestFromPaymentDialog(dlg,c);if(!r)return;
    dlg.__guardPaymentRequestId=r.id;
    dlg.__guardPaymentSnapshot=clone(r.payment||null);
    dlg.dataset.guardPaymentDirty='0';
  }
  function restorePaymentSnapshot(dlg){
    const c=currentClient();if(!c||!dlg?.__guardPaymentRequestId)return;
    const r=c.requests?.find(x=>x.id===dlg.__guardPaymentRequestId);if(!r)return;
    const snap=clone(dlg.__guardPaymentSnapshot);
    if(snap===null)delete r.payment;else r.payment=snap;
    if(typeof save==='function')save();
    try{window.DiagnostikaPayments?.refresh?.();}catch(_){}
    try{window.DiagnostikaSessionPayments?.refresh?.();}catch(_){}
  }

  // ВАЖНО: этот обработчик загружается ДО session-payment-editor.js,
  // поэтому перехватывает старое мгновенное сохранение кнопки «Оплачено».
  document.addEventListener('click',e=>{
    const payState=e.target?.closest?.('.session-editor-payment-state');
    if(payState){
      const dlg=payState.closest('dialog.session-edit-dialog');if(!dlg)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      ensureSessionSnapshot(dlg);
      dlg.dataset.guardPaymentDraft=dlg.dataset.guardPaymentDraft==='1'?'0':'1';
      markSessionDirty(dlg);
      paintSessionPaymentButton(dlg);
      return;
    }

    const sessionSave=e.target?.closest?.('dialog.session-edit-dialog .session-edit-actions .primary');
    if(sessionSave){
      const dlg=sessionSave.closest('dialog.session-edit-dialog');
      if(dlg){commitSessionPayment(dlg);setTimeout(()=>{try{window.DiagnostikaPayments?.refresh?.();}catch(_){}},0);}
      return;
    }

    const paymentSave=e.target?.closest?.('#paymentSaveSettings');
    if(paymentSave){const dlg=paymentSave.closest('dialog.payment-dialog');if(dlg)setTimeout(()=>commitPaymentSnapshot(dlg),0);return;}

    const paymentMutation=e.target?.closest?.('#paymentAddBtn,.payment-remove');
    if(paymentMutation){const dlg=paymentMutation.closest('dialog.payment-dialog');if(dlg)markPaymentDirty(dlg);}
  },true);

  document.addEventListener('input',e=>{
    const sdlg=e.target?.closest?.('dialog.session-edit-dialog');
    if(sdlg){markSessionDirty(sdlg);return;}
    const pdlg=e.target?.closest?.('dialog.payment-dialog');
    if(pdlg)markPaymentDirty(pdlg);
  },true);
  document.addEventListener('change',e=>{
    const sdlg=e.target?.closest?.('dialog.session-edit-dialog');
    if(sdlg){markSessionDirty(sdlg);return;}
    const pdlg=e.target?.closest?.('dialog.payment-dialog');
    if(pdlg)markPaymentDirty(pdlg);
  },true);

  async function askSave(text){
    if(window.AppDialog?.confirm)return window.AppDialog.confirm(text,'Несохранённые изменения','Сохранить','Не сохранять');
    return window.confirm(text);
  }

  function bindDialog(dlg){
    if(!(dlg instanceof HTMLDialogElement)||dlg.dataset.guardBound==='1')return;
    dlg.dataset.guardBound='1';

    if(dlg.classList.contains('session-edit-dialog')){
      setTimeout(()=>{ensureSessionSnapshot(dlg);paintSessionPaymentButton(dlg);},0);
      dlg.addEventListener('click',async e=>{
        if(e.target!==dlg||!dlg.open||!sessionDirty(dlg))return;
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        const yes=await askSave('Сохранить изменения сессии?');
        if(yes){
          const btn=dlg.querySelector('.session-edit-actions .primary');
          if(btn){btn.click();return;}
          commitSessionPayment(dlg);
        }else discardSessionPayment(dlg);
        try{dlg.close();}catch(_){}
      },true);
      return;
    }

    if(dlg.classList.contains('payment-dialog')){
      dlg.addEventListener('click',async e=>{
        if(e.target!==dlg||!dlg.open)return;
        if(dlg.dataset.guardPaymentDirty!=='1')return;
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        const yes=await askSave('Сохранить изменения оплаты?');
        if(yes){
          const btn=dlg.querySelector('#paymentSaveSettings');
          if(btn)btn.click();
          commitPaymentSnapshot(dlg);
        }else restorePaymentSnapshot(dlg);
        try{dlg.close();}catch(_){}
      },true);
      setTimeout(()=>ensurePaymentSnapshot(dlg),0);
    }
  }

  document.querySelectorAll('dialog').forEach(bindDialog);
  const observer=new MutationObserver(muts=>{
    for(const m of muts)for(const node of m.addedNodes){
      if(!(node instanceof Element))continue;
      if(node.matches?.('dialog'))bindDialog(node);
      node.querySelectorAll?.('dialog').forEach(bindDialog);
    }
    document.querySelectorAll('dialog.session-edit-dialog').forEach(d=>{ensureSessionSnapshot(d);paintSessionPaymentButton(d);});
  });
  observer.observe(document.body,{childList:true,subtree:true});
})();
