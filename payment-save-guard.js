'use strict';

(() => {
  const clone=v=>{try{return JSON.parse(JSON.stringify(v??null));}catch(_){return null;}};
  const todayLocal=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);};
  const currentClient=()=>typeof client==='function'?client():null;

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
    if(!dlg||dlg.__saveGuardSessionSnapshot)return;
    const c=currentClient(),s=sessionFromDialog(dlg,c);if(!c||!s)return;
    dlg.__saveGuardSessionSnapshot={payment:clone(s.payment||null)};
    dlg.dataset.saveGuardPaymentDraft=s.payment?.paid?'1':'0';
    dlg.dataset.saveGuardSessionDirty='0';
  }

  function markSessionDirty(dlg){
    ensureSessionSnapshot(dlg);
    if(dlg)dlg.dataset.saveGuardSessionDirty='1';
  }

  function paintSessionPayment(dlg){
    const btn=dlg?.querySelector('.session-editor-payment-state');if(!btn)return;
    ensureSessionSnapshot(dlg);
    const c=currentClient(),s=sessionFromDialog(dlg,c);if(!c||!s)return;
    const reqId=dlg.querySelector('.session-edit-grid select')?.value||s.requestId||s.payment?.requestId||'';
    const req=c.requests?.find(r=>r.id===reqId)||null;
    const amount=effectiveSessionPrice(req)||(Number(s.payment?.amount)||0);
    const paid=dlg.dataset.saveGuardPaymentDraft==='1';
    btn.classList.toggle('paid',paid);
    btn.classList.toggle('unpaid',!paid);
    btn.textContent=paid?'✓ Оплачено':'Не оплачено';
    btn.title=paid?`Оплачено ${amount||0} ₽`:`Не оплачено${amount?` · ${amount} ₽`:''}`;
  }

  function commitSessionPayment(dlg){
    ensureSessionSnapshot(dlg);
    const c=currentClient(),s=sessionFromDialog(dlg,c);if(!c||!s)return;
    const reqId=dlg.querySelector('.session-edit-grid select')?.value||s.requestId||s.payment?.requestId||'';
    const req=c.requests?.find(r=>r.id===reqId)||null;
    const amount=effectiveSessionPrice(req)||(Number(s.payment?.amount)||0);
    const paid=dlg.dataset.saveGuardPaymentDraft==='1';
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
    dlg.dataset.saveGuardSessionDirty='0';
    dlg.__saveGuardSessionSnapshot={payment:clone(s.payment)};
  }

  function discardSessionDraft(dlg){
    const c=currentClient(),s=sessionFromDialog(dlg,c),snap=dlg?.__saveGuardSessionSnapshot;
    if(!s||!snap)return;
    if(snap.payment===null)delete s.payment;else s.payment=clone(snap.payment);
    if(typeof save==='function')save();
  }

  function ensurePaymentSnapshot(dlg){
    if(!dlg||dlg.__saveGuardPaymentSnapshotSet)return;
    const c=currentClient(),r=requestFromPaymentDialog(dlg,c);if(!r)return;
    dlg.__saveGuardPaymentSnapshotSet=true;
    dlg.__saveGuardPaymentRequestId=r.id;
    dlg.__saveGuardPaymentSnapshot=clone(r.payment||null);
    dlg.dataset.saveGuardPaymentDirty='0';
  }

  function markPaymentDirty(dlg){
    ensurePaymentSnapshot(dlg);
    if(dlg)dlg.dataset.saveGuardPaymentDirty='1';
  }

  function commitPaymentSnapshot(dlg){
    const c=currentClient(),r=requestFromPaymentDialog(dlg,c);if(!r)return;
    dlg.__saveGuardPaymentSnapshotSet=true;
    dlg.__saveGuardPaymentRequestId=r.id;
    dlg.__saveGuardPaymentSnapshot=clone(r.payment||null);
    dlg.dataset.saveGuardPaymentDirty='0';
  }

  function restorePaymentSnapshot(dlg){
    const c=currentClient();if(!c||!dlg?.__saveGuardPaymentRequestId)return;
    const r=c.requests?.find(x=>x.id===dlg.__saveGuardPaymentRequestId);if(!r)return;
    const snap=clone(dlg.__saveGuardPaymentSnapshot);
    if(snap===null)delete r.payment;else r.payment=snap;
    if(typeof save==='function')save();
    try{window.DiagnostikaPayments?.refresh?.();}catch(_){}
    try{window.DiagnostikaSessionPayments?.refresh?.();}catch(_){}
  }

  async function askSave(text){
    if(window.AppDialog?.confirm)return window.AppDialog.confirm(text,'Несохранённые изменения','Сохранить','Не сохранять');
    return window.confirm(text);
  }

  // Capture on WINDOW: this runs before legacy document/dialog handlers.
  window.addEventListener('click',async e=>{
    const target=e.target;

    const payState=target?.closest?.('.session-editor-payment-state');
    if(payState){
      const dlg=payState.closest('dialog.session-edit-dialog');if(!dlg)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      ensureSessionSnapshot(dlg);
      dlg.dataset.saveGuardPaymentDraft=dlg.dataset.saveGuardPaymentDraft==='1'?'0':'1';
      markSessionDirty(dlg);
      paintSessionPayment(dlg);
      return;
    }

    const sessionSave=target?.closest?.('dialog.session-edit-dialog .session-edit-actions .primary');
    if(sessionSave){
      const dlg=sessionSave.closest('dialog.session-edit-dialog');
      if(dlg)commitSessionPayment(dlg);
      return;
    }

    const sdlg=target instanceof HTMLDialogElement&&target.classList.contains('session-edit-dialog')?target:null;
    if(sdlg&&sdlg.open&&sdlg.dataset.saveGuardSessionDirty==='1'){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const yes=await askSave('Сохранить изменения сессии?');
      if(yes){
        const btn=sdlg.querySelector('.session-edit-actions .primary');
        if(btn){btn.click();return;}
        commitSessionPayment(sdlg);
      }else{
        discardSessionDraft(sdlg);
        try{sdlg.close();}catch(_){}
      }
      return;
    }

    const pdlg=target instanceof HTMLDialogElement&&target.classList.contains('payment-dialog')?target:null;
    if(pdlg&&pdlg.open&&pdlg.dataset.saveGuardPaymentDirty==='1'){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const yes=await askSave('Сохранить изменения оплаты?');
      if(yes){
        const btn=pdlg.querySelector('#paymentSaveSettings');
        if(btn)btn.click();
        commitPaymentSnapshot(pdlg);
      }else restorePaymentSnapshot(pdlg);
      try{pdlg.close();}catch(_){}
      return;
    }

    const paymentSave=target?.closest?.('#paymentSaveSettings');
    if(paymentSave){
      const dlg=paymentSave.closest('dialog.payment-dialog');
      if(dlg)setTimeout(()=>commitPaymentSnapshot(dlg),0);
      return;
    }

    const paymentMutation=target?.closest?.('#paymentAddBtn,.payment-remove');
    if(paymentMutation){
      const dlg=paymentMutation.closest('dialog.payment-dialog');
      if(dlg)markPaymentDirty(dlg);
    }
  },true);

  // Capture input/change at WINDOW so the snapshot is taken before legacy auto-save code mutates state.
  window.addEventListener('input',e=>{
    const sdlg=e.target?.closest?.('dialog.session-edit-dialog');
    if(sdlg){markSessionDirty(sdlg);return;}
    const pdlg=e.target?.closest?.('dialog.payment-dialog');
    if(pdlg)markPaymentDirty(pdlg);
  },true);

  window.addEventListener('change',e=>{
    const sdlg=e.target?.closest?.('dialog.session-edit-dialog');
    if(sdlg){markSessionDirty(sdlg);return;}
    const pdlg=e.target?.closest?.('dialog.payment-dialog');
    if(pdlg)markPaymentDirty(pdlg);
  },true);

  function refresh(){
    document.querySelectorAll('dialog.session-edit-dialog').forEach(dlg=>{
      ensureSessionSnapshot(dlg);
      paintSessionPayment(dlg);
    });
    document.querySelectorAll('dialog.payment-dialog').forEach(dlg=>{
      if(dlg.open)ensurePaymentSnapshot(dlg);
    });
  }

  const observer=new MutationObserver(()=>setTimeout(refresh,0));
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(refresh,0);
})();
