'use strict';

(() => {
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const currentClient=()=>typeof client==='function'?client():null;
  const sessionPay=s=>{
    if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0,receiptUrl:'',note:''};
    return s.payment;
  };
  const requestForSession=(c,s)=>{
    const id=s?.requestId||s?.payment?.requestId||'';
    return (c?.requests||[]).find(r=>r.id===id)||null;
  };
  const effectivePrice=r=>{
    const p=r?.payment||{};
    const base=Math.max(0,num(p.sessionAmount));
    const discount=Math.min(100,Math.max(0,num(p.sessionDiscount)));
    return Math.max(0,Math.round(base*(1-discount/100)*100)/100);
  };
  const snapshotPrice=sp=>{
    const base=Math.max(0,num(sp?.baseAmount));
    if(!base)return 0;
    const discount=Math.min(100,Math.max(0,num(sp?.discountSnapshot)));
    return Math.max(0,Math.round(base*(1-discount/100)*100)/100);
  };
  const suspicious=(amount,configured)=>amount>0&&configured>0&&amount<configured/100;

  function repairAllSessionPayments(){
    if(!window.state||!Array.isArray(state.clients))return false;
    let changed=false;
    state.clients.forEach(c=>{
      const requests=Array.isArray(c.requests)?c.requests:[];
      const sessions=Array.isArray(c.sessions)?c.sessions:[];
      requests.forEach(r=>{
        if(r?.payment?.mode!=='session')return;
        const configured=effectivePrice(r);
        sessions.forEach(s=>{
          const linkedId=s?.requestId||s?.payment?.requestId||'';
          if(linkedId!==r.id)return;
          const sp=sessionPay(s);
          const saved=Math.max(0,num(sp.amount));
          if(sp.paid&&(saved<=0||suspicious(saved,configured))){
            const restored=snapshotPrice(sp)||configured;
            if(restored>0&&restored!==saved){
              sp.amount=restored;
              sp.manualAmount=false;
              if(!sp.requestId)sp.requestId=r.id;
              if(!s.requestId)s.requestId=r.id;
              changed=true;
            }
          }
        });
      });
    });
    if(changed&&typeof save==='function')save();
    return changed;
  }

  function sessionFromDialog(dlg,c=currentClient()){
    if(!c||!dlg)return null;
    const id=dlg.dataset.sessionId;
    if(id){const s=(c.sessions||[]).find(x=>x.id===id);if(s)return s;}
    if(typeof selectedSessionId!=='undefined'&&selectedSessionId){
      const s=(c.sessions||[]).find(x=>x.id===selectedSessionId);if(s)return s;
    }
    return null;
  }

  function syncDialog(dlg){
    const c=currentClient(),s=sessionFromDialog(dlg,c);if(!c||!s)return;
    const reqId=dlg.querySelector('.session-edit-grid select')?.value||s.requestId||s.payment?.requestId||'';
    const req=(c.requests||[]).find(r=>r.id===reqId)||requestForSession(c,s);
    if(req?.payment?.mode!=='session')return;
    const sp=sessionPay(s);
    const configured=effectivePrice(req);
    if(sp.paid&&(num(sp.amount)<=0||suspicious(num(sp.amount),configured))){
      const restored=snapshotPrice(sp)||configured;
      if(restored>0){sp.amount=restored;if(typeof save==='function')save();}
    }
    const wrap=dlg.querySelector('.session-editor-payment-amount-wrap');
    const input=dlg.querySelector('.session-editor-payment-amount');
    if(wrap)wrap.hidden=false;
    const shown=Math.max(0,num(sp.amount))||configured;
    if(input&&document.activeElement!==input)input.value=shown?String(shown):'0';
    const legacy=dlg.querySelector('.session-payment-field input[type="number"]');
    if(legacy&&document.activeElement!==legacy&&shown>0)legacy.value=String(shown);
  }

  function refresh(){
    repairAllSessionPayments();
    document.querySelectorAll('dialog.session-edit-dialog').forEach(syncDialog);
    try{window.DiagnostikaPayments?.refresh?.();}catch(_){}
    try{window.DiagnostikaSessionPayments?.refresh?.();}catch(_){}
  }

  // После штатного сохранения редактора сохраняем именно сумму, показанную в сессии,
  // чтобы старый save-guard не заменял историческую сумму текущей ценой запроса.
  document.addEventListener('click',e=>{
    const saveBtn=e.target?.closest?.('dialog.session-edit-dialog .session-edit-actions .primary');
    if(!saveBtn)return;
    const dlg=saveBtn.closest('dialog.session-edit-dialog');
    const c=currentClient(),s=sessionFromDialog(dlg,c);if(!c||!s)return;
    const reqId=dlg.querySelector('.session-edit-grid select')?.value||s.requestId||s.payment?.requestId||'';
    const req=(c.requests||[]).find(r=>r.id===reqId)||null;
    if(req?.payment?.mode!=='session')return;
    const editorAmount=Math.max(0,num(dlg.querySelector('.session-editor-payment-amount')?.value));
    const legacyAmount=Math.max(0,num(dlg.querySelector('.session-payment-field input[type="number"]')?.value));
    const desired=editorAmount||legacyAmount||Math.max(0,num(s.payment?.amount))||effectivePrice(req);
    setTimeout(()=>{
      if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0,receiptUrl:'',note:''};
      if(desired>0)s.payment.amount=desired;
      if(reqId){s.payment.requestId=reqId;s.requestId=reqId;}
      if(typeof save==='function')save();
      refresh();
    },0);
  },true);

  document.addEventListener('change',e=>{
    if(e.target?.matches?.('dialog.session-edit-dialog .session-edit-grid select'))setTimeout(refresh,0);
  },true);

  const observer=new MutationObserver(()=>setTimeout(refresh,0));
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(refresh,0);
  setTimeout(refresh,600);

  window.DiagnostikaSessionPaymentRepair={refresh,repairAll:repairAllSessionPayments};
})();
