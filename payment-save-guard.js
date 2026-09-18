'use strict';

(() => {
  const clone=v=>{try{return JSON.parse(JSON.stringify(v??null));}catch(_){return null;}};
  const todayLocal=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);};
  const currentClient=()=>typeof client==='function'?client():null;
  const paymentWriter=()=>window.DiagnostikaPayments?.moduleAware===true?window.DiagnostikaPayments:null;

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

  function legacyPaidCheckbox(dlg){
    return dlg?.querySelector('.session-payment-field input[type="checkbox"]')
      || dlg?.querySelector('.session-payment-paid input[type="checkbox"]')
      || null;
  }

  function legacyAmountInput(dlg){
    const field=dlg?.querySelector('.session-payment-field');
    return field?.querySelector('input[type="number"]')||null;
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
    ensureSessionSnapshot(dlg);
    const c=currentClient(),s=sessionFromDialog(dlg,c);if(!c||!s)return;
    const reqId=dlg.querySelector('.session-edit-grid select')?.value||s.requestId||s.payment?.requestId||'';
    const req=c.requests?.find(r=>r.id===reqId)||null;
    const amount=effectiveSessionPrice(req)||(Number(s.payment?.amount)||0);
    const paid=dlg.dataset.saveGuardPaymentDraft==='1';

    const btn=dlg.querySelector('.session-editor-payment-state');
    if(btn){
      btn.classList.toggle('paid',paid);
      btn.classList.toggle('unpaid',!paid);
      btn.textContent=paid?'✓ Оплачено':'Не оплачено';
      btn.title=paid?`Оплачено ${amount||0} ₽`:`Не оплачено${amount?` · ${amount} ₽`:''}`;
    }

    const checkbox=legacyPaidCheckbox(dlg);
    if(checkbox) checkbox.checked=paid;
    const amountInput=legacyAmountInput(dlg);
    if(amountInput&&amount>0&&!amountInput.matches(':focus')) amountInput.value=String(amount);
  }

  function commitSessionPayment(dlg){
    ensureSessionSnapshot(dlg);
    const c=currentClient(),s=sessionFromDialog(dlg,c);if(!c||!s)return;
    const reqId=dlg.querySelector('.session-edit-grid select')?.value||s.requestId||s.payment?.requestId||'';
    const req=c.requests?.find(r=>r.id===reqId)||null;
    const amountFromField=Math.max(0,Number(legacyAmountInput(dlg)?.value)||0);
    const amount=amountFromField||effectiveSessionPrice(req)||(Number(s.payment?.amount)||0);
    const paid=dlg.dataset.saveGuardPaymentDraft==='1';

    const checkbox=legacyPaidCheckbox(dlg);
    if(checkbox) checkbox.checked=paid;

    if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0,receiptUrl:'',note:''};
    s.payment.paid=paid;
    s.payment.amount=amount;
    s.payment.manualAmount=amountFromField>0;
    s.payment.receiptUrl='';
    if(reqId)s.payment.requestId=reqId;
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
    dlg.dataset.saveGuardPaymentDraft=s.payment?.paid?'1':'0';
    paintSessionPayment(dlg);
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
    paymentWriter()?.replaceRequest?.(
      r.id,
      snap,
      {client:c,source:'payment-save-guard-restore'}
    );
    try{window.DiagnostikaPayments?.refresh?.();}catch(_){}
    try{window.DiagnostikaSessionPayments?.refresh?.();}catch(_){}
  }

  async function askSave(text){
    if(window.AppDialog?.confirm)return window.AppDialog.confirm(text,'Несохранённые изменения','Сохранить','Не сохранять');
    return window.confirm(text);
  }

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
      if(dlg){paintSessionPayment(dlg);commitSessionPayment(dlg);}
      return;
    }

    const sdlg=target instanceof HTMLDialogElement&&target.classList.contains('session-edit-dialog')?target:null;
    if(sdlg&&sdlg.open&&sdlg.dataset.saveGuardSessionDirty==='1'){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const yes=await askSave('Сохранить изменения сессии?');
      if(yes){
        paintSessionPayment(sdlg);commitSessionPayment(sdlg);
        const btn=sdlg.querySelector('.session-edit-actions .primary');
        if(btn){btn.click();return;}
        try{sdlg.close();}catch(_){}
      }else{
        discardSessionDraft(sdlg);try{sdlg.close();}catch(_){}
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

  window.addEventListener('input',e=>{
    const sdlg=e.target?.closest?.('dialog.session-edit-dialog');
    if(sdlg){markSessionDirty(sdlg);return;}
    const pdlg=e.target?.closest?.('dialog.payment-dialog');
    if(pdlg)markPaymentDirty(pdlg);
  },true);

  window.addEventListener('change',e=>{
    const sdlg=e.target?.closest?.('dialog.session-edit-dialog');
    if(sdlg){
      const checkbox=legacyPaidCheckbox(sdlg);
      if(checkbox&&e.target===checkbox){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        ensureSessionSnapshot(sdlg);
        sdlg.dataset.saveGuardPaymentDraft=checkbox.checked?'1':'0';
        markSessionDirty(sdlg);
        paintSessionPayment(sdlg);
        return;
      }
      markSessionDirty(sdlg);
      return;
    }
    const pdlg=e.target?.closest?.('dialog.payment-dialog');
    if(pdlg)markPaymentDirty(pdlg);
  },true);

  function refresh(){
    document.querySelectorAll('dialog.session-edit-dialog').forEach(dlg=>{ensureSessionSnapshot(dlg);paintSessionPayment(dlg);});
    document.querySelectorAll('dialog.payment-dialog').forEach(dlg=>{if(dlg.open)ensurePaymentSnapshot(dlg);});
  }

  const observer=new MutationObserver(()=>setTimeout(refresh,0));
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(refresh,0);
})();

// Reliable editor for an existing record from "Все платежи клиента".
(() => {
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const currentClient=()=>typeof client==='function'?client():null;
  const paymentWriter=()=>window.DiagnostikaPayments?.moduleAware===true?window.DiagnostikaPayments:null;
  const sessionPayment=s=>{if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0};return s.payment;};
  const requestNumber=(c,r)=>window.DiagnostikaRequests?.requestNumber?.(c,r)||(c?.requests?.indexOf(r)+1||0);

  function rowsFor(c){
    const rows=[];
    (c?.requests||[]).forEach(r=>{
      const p=window.DiagnostikaPayments?.paymentOfRequest?.(c,r)||r.payment||{};
      if(p.mode==='session'){
        (c.sessions||[]).filter(s=>(s.requestId||s.payment?.requestId)===r.id).forEach(s=>{
          const sp=sessionPayment(s);if(sp.paid)rows.push({kind:'session',request:r,session:s,date:sp.paidAt||s.date||'',amount:num(sp.amount)});
        });
      }else{
        (p.payments||[]).forEach(pay=>rows.push({kind:'request',request:r,pay,date:pay.date||'',amount:num(pay.amount)}));
      }
    });
    return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  }

  function ensureEditor(){
    let dlg=document.querySelector('#allPaymentRecordEditor');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');dlg.id='allPaymentRecordEditor';dlg.className='payment-dialog';
    dlg.innerHTML=`<div class="payment-window" style="width:min(500px,calc(100vw - 24px))"><div class="payment-head"><strong>РЕДАКТИРОВАТЬ ПЛАТЁЖ</strong><button type="button" class="payment-x">×</button></div><div class="payment-grid" style="grid-template-columns:1fr"><label class="payment-field">Дата<input id="aprDate" type="date"></label><label class="payment-field">Сумма<input id="aprAmount" type="number" min="0" step="1"></label><label class="payment-field">Комментарий<input id="aprNote" type="text"></label></div><div class="payment-footer"><button type="button" class="tk-btn apr-cancel">Отмена</button><button type="button" class="tk-btn apr-save">Сохранить</button></div></div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('.payment-x').onclick=()=>dlg.close();
    dlg.querySelector('.apr-cancel').onclick=()=>dlg.close();
    dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
    return dlg;
  }

  function reopenAllPayments(){
    const allDlg=document.querySelector('.all-client-payments-dialog');
    const btn=document.querySelector('#allClientPaymentsBtn');
    try{window.DiagnostikaPayments?.refresh?.();}catch(_){}
    if(allDlg&&!allDlg.open){
      btn?.click();
    }
  }

  window.addEventListener('click',e=>{
    const edit=e.target?.closest?.('.all-client-payments-dialog .ap-edit');
    if(!edit)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();

    const allDlg=edit.closest('.all-client-payments-dialog');
    const rows=[...allDlg.querySelectorAll('.all-payment-row')];
    const index=rows.indexOf(edit.closest('.all-payment-row'));
    const c=currentClient();const item=rowsFor(c)[index];
    if(!item)return;

    if(item.kind==='session'){
      try{allDlg.close();}catch(_){}
      if(typeof openSessionEditor==='function'){
        const chronological=(c.sessions||[]).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
        openSessionEditor(c,item.session,chronological.indexOf(item.session)+1);
      }
      return;
    }

    const editor=ensureEditor();
    const date=editor.querySelector('#aprDate');
    const amount=editor.querySelector('#aprAmount');
    const note=editor.querySelector('#aprNote');
    date.value=item.pay.date||'';amount.value=num(item.pay.amount)||'';note.value=item.pay.note||'';
    try{allDlg.close();}catch(_){}

    editor.querySelector('.apr-save').onclick=()=>{
      const value=num(amount.value);if(value<=0){amount.focus();return;}
      const updated=paymentWriter()?.updatePayment?.(
        item.request?.id,
        item.pay?.id,
        {
          date:date.value||item.pay.date||'',
          amount:value,
          note:note.value.trim()
        },
        {client:c,source:'payment-save-guard-history-edit'}
      );
      if(!updated)return;
      try{window.DiagnostikaPayments?.refresh?.();}catch(_){}
      try{window.DiagnostikaHomeDashboard?.refresh?.();}catch(_){}
      editor.close();
      setTimeout(reopenAllPayments,0);
    };

    editor.showModal();
  },true);
})();
