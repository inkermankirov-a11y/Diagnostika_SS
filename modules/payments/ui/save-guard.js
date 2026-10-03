'use strict';

(() => {
  const clone=v=>{try{return JSON.parse(JSON.stringify(v??null));}catch(_){return null;}};
  const todayLocal=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);};
  const ui=()=>window.DiagnostikaPaymentUIContext||null;
  const currentClient=()=>ui()?.currentClient?.()||null;
  const paymentWriter=()=>window.DiagnostikaPayments?.moduleAware===true?window.DiagnostikaPayments:null;

  function requestFromPaymentDialog(dlg,c=currentClient()){
    if(!c)return null;
    const id=dlg?.dataset?.requestId;
    return (id?ui()?.requestById?.(c,id):null)||ui()?.currentRequest?.(c)||null;
  }

  function sessionFromDialog(dlg,c=currentClient()){
    if(!c||!dlg)return null;
    const id=dlg.dataset.sessionId;
    return id?ui()?.sessionById?.(c,id)||null:null;
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
    const r=ui()?.requestById?.(c,dlg.__saveGuardPaymentRequestId);if(!r)return;
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
    const pdlg=e.target?.closest?.('dialog.payment-dialog');
    if(pdlg)markPaymentDirty(pdlg);
  },true);

  window.addEventListener('change',e=>{
    const pdlg=e.target?.closest?.('dialog.payment-dialog');
    if(pdlg)markPaymentDirty(pdlg);
  },true);

  function refresh(){
    document.querySelectorAll('dialog.payment-dialog').forEach(dlg=>{if(dlg.open)ensurePaymentSnapshot(dlg);});
  }
  window.addEventListener('diagnostika:payment-dialog-opened',()=>{
    const dlg=document.querySelector('dialog.payment-dialog:has(#paymentMode)');
    if(dlg)ensurePaymentSnapshot(dlg);
  });
  setTimeout(refresh,0);
})();

// Reliable editor for an existing record from "Все платежи клиента".
(() => {
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const ui=()=>window.DiagnostikaPaymentUIContext||null;
  const currentClient=()=>ui()?.currentClient?.()||null;
  const paymentWriter=()=>window.DiagnostikaPayments?.moduleAware===true?window.DiagnostikaPayments:null;
  const sessionPayment=(s,c=currentClient())=>paymentWriter()?.session?.(s?.id,c)||(s?.payment&&typeof s.payment==='object'?s.payment:{paid:false,amount:0});
  const requestNumber=(c,r)=>window.DiagnostikaRequests?.requestNumber?.(c,r)||0;

  function rowsFor(c){
    const rows=[];
    (ui()?.requestList?.(c)||[]).forEach(r=>{
      const p=window.DiagnostikaPayments?.paymentOfRequest?.(c,r)||r.payment||{};
      if(p.mode==='session'){
        (ui()?.sessionsForRequest?.(c,r.id)||[]).forEach(s=>{
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
    dlg.innerHTML=`<div class="payment-window" style="width:min(500px,calc(100vw - 24px))"><div class="payment-head"><strong>РЕДАКТИРОВАТЬ ПЛАТЁЖ</strong><button type="button" class="payment-x">×</button></div><div class="payment-grid" style="grid-template-columns:1fr"><label class="payment-field">Дата<input id="aprDate" type="date" lang="ru-RU"></label><label class="payment-field">Сумма<input id="aprAmount" type="number" min="0" step="1"></label><label class="payment-field">Комментарий<input id="aprNote" type="text"></label></div><div class="payment-footer"><button type="button" class="tk-btn apr-cancel">Отмена</button><button type="button" class="tk-btn apr-save">Сохранить</button></div></div>`;
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
      const chronological=(ui()?.sessionList?.(c)||[]).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
      ui()?.openSessionEditor?.(c,item.session,chronological.indexOf(item.session)+1);
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
      try{ui()?.refreshDashboard?.();}catch(_){}
      editor.close();
      setTimeout(reopenAllPayments,0);
    };

    editor.showModal();
  },true);
})();
