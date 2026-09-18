'use strict';

(() => {
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const currentClient=()=>typeof client==='function'?client():null;
  const paymentWriter=()=>window.DiagnostikaPayments?.moduleAware===true?window.DiagnostikaPayments:null;
  const allClients=()=>{
    try{if(typeof state!=='undefined'&&Array.isArray(state.clients))return state.clients;}catch(_){}
    try{return window.DiagnostikaPlatform?.store?.clients?.()||[];}catch(_){return [];}
  };
  const linkSessionRequest=(c,s,requestId,source)=>{
    if(!c||!s||!requestId||String(s.requestId||'')===String(requestId))return true;
    const api=window.DiagnostikaSessions?.moduleAware===true
      ? window.DiagnostikaSessions
      : window.DiagnostikaPlatform?.services?.sessions||null;
    return !!api?.update?.(s.id,{requestId},{client:c,source,render:false});
  };
  const sessionPay=(c,s)=>paymentWriter()?.session?.(s?.id,c)||(s?.payment&&typeof s.payment==='object'?s.payment:{paid:false,amount:0,receiptUrl:'',note:''});
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
    const clients=allClients();
    if(!clients.length)return false;
    let changed=false;
    clients.forEach(c=>{
      const requests=Array.isArray(c.requests)?c.requests:[];
      const sessions=Array.isArray(c.sessions)?c.sessions:[];
      requests.forEach(r=>{
        if(r?.payment?.mode!=='session')return;
        const configured=effectivePrice(r);
        sessions.forEach(s=>{
          const linkedId=s?.requestId||s?.payment?.requestId||'';
          if(linkedId!==r.id)return;
          const sp=sessionPay(c,s);
          const saved=Math.max(0,num(sp.amount));
          if(sp.paid&&(saved<=0||suspicious(saved,configured))){
            const restored=snapshotPrice(sp)||configured;
            if(restored>0&&restored!==saved){
              if(!s.requestId&&!linkSessionRequest(c,s,r.id,'session-payment-repair-link'))return;
              const updated=paymentWriter()?.updateSession?.(
                s.id,
                {amount:restored,manualAmount:false,...(!sp.requestId?{requestId:r.id}:{})},
                {client:c,source:'session-payment-data-repair'}
              );
              if(updated)changed=true;
            }
          }
        });
      });
    });
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
    const sp=sessionPay(c,s);
    const configured=effectivePrice(req);
    if(sp.paid&&(num(sp.amount)<=0||suspicious(num(sp.amount),configured))){
      const restored=snapshotPrice(sp)||configured;
      if(restored>0){
        const updated=paymentWriter()?.updateSession?.(
          s.id,{amount:restored},{client:c,source:'session-payment-dialog-repair'}
        );
        if(!updated)return;
      }
    }
    const wrap=dlg.querySelector('.session-editor-payment-amount-wrap');
    const input=dlg.querySelector('.session-editor-payment-amount');
    if(wrap)wrap.hidden=false;
    const shown=Math.max(0,num(sp.amount))||configured;
    if(input&&document.activeElement!==input)input.value=shown?String(shown):'0';
    const legacy=dlg.querySelector('.session-payment-field input[type="number"]');
    if(legacy&&document.activeElement!==legacy&&shown>0)legacy.value=String(shown);
  }

  function refresh({paymentUi=false}={}){
    const repaired=repairAllSessionPayments();
    document.querySelectorAll('dialog.session-edit-dialog').forEach(syncDialog);
    // Request-payment rows may contain unsaved input drafts. Do not rebuild that UI
    // merely because an unrelated DOM mutation occurred.
    if(repaired||paymentUi){
      try{window.DiagnostikaPayments?.refresh?.();}catch(_){}
    }
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
    const current=sessionPay(c,s);
    const desired=editorAmount||legacyAmount||Math.max(0,num(current?.amount))||effectivePrice(req);
    setTimeout(()=>{
      if(reqId&&!linkSessionRequest(c,s,reqId,'session-payment-save-link'))return;
      const patch={};
      if(desired>0)patch.amount=desired;
      if(reqId)patch.requestId=reqId;
      if(Object.keys(patch).length&&!paymentWriter()?.updateSession?.(
        s.id,patch,{client:c,source:'session-payment-save-repair'}
      ))return;
      refresh({paymentUi:true});
    },0);
  },true);

  document.addEventListener('change',e=>{
    if(e.target?.matches?.('dialog.session-edit-dialog .session-edit-grid select')){
      setTimeout(()=>refresh({paymentUi:true}),0);
    }
  },true);

  const isSessionUiNode=node=>{
    if(node?.nodeType!==1)return false;
    return node.matches?.('dialog.session-edit-dialog,.session-card')
      ||!!node.querySelector?.('dialog.session-edit-dialog,.session-card');
  };
  const observer=new MutationObserver(mutations=>{
    const relevant=mutations.some(m=>
      [...m.addedNodes,...m.removedNodes].some(isSessionUiNode)
    );
    if(relevant)setTimeout(refresh,0);
  });
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>refresh({paymentUi:true}),0);
  setTimeout(()=>refresh({paymentUi:true}),600);

  window.DiagnostikaSessionPaymentRepair={refresh,repairAll:repairAllSessionPayments};
})();
