'use strict';

(() => {
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const currentClient=()=>typeof client==='function'?client():null;
  const linkSessionRequest=(c,s,requestId,source)=>{
    if(!c||!s||!requestId||String(s.requestId||'')===String(requestId))return true;
    const api=window.DiagnostikaSessions?.moduleAware===true
      ? window.DiagnostikaSessions
      : window.DiagnostikaPlatform?.services?.sessions||null;
    return !!api?.update?.(s.id,{requestId},{client:c,source,render:false});
  };

  function effectivePrice(req){
    const p=req?.payment||{};
    const base=Math.max(0,num(p.sessionAmount));
    const discount=Math.min(100,Math.max(0,num(p.sessionDiscount)));
    return Math.max(0,Math.round(base*(1-discount/100)*100)/100);
  }

  function sessionByNumber(c,n){
    if(!c||!n)return null;
    const chronological=(c.sessions||[])
      .map((s,index)=>({s,index,time:typeof sessionTimeValue==='function'?sessionTimeValue(s,index):(new Date(s.date||s.createdAt||0).getTime()||index)}))
      .sort((a,b)=>a.time-b.time||a.index-b.index);
    return chronological[n-1]?.s||null;
  }

  function sessionFromDialog(dlg,c=currentClient()){
    if(!dlg||!c)return null;
    const id=dlg.dataset.sessionId;
    if(id){
      const s=(c.sessions||[]).find(x=>x.id===id);
      if(s)return s;
    }
    const title=dlg.querySelector('h1,h2,h3,.session-edit-title')?.textContent||'';
    const m=title.match(/Сессия\s*№\s*(\d+)/i);
    if(m){
      const s=sessionByNumber(c,Number(m[1]));
      if(s)return s;
    }
    if(typeof selectedSessionId!=='undefined'&&selectedSessionId){
      return (c.sessions||[]).find(x=>x.id===selectedSessionId)||null;
    }
    return null;
  }

  function requestForDialog(c,s,dlg){
    const id=dlg.querySelector('.session-edit-grid select')?.value||s?.requestId||s?.payment?.requestId||'';
    return (c?.requests||[]).find(r=>r.id===id)||null;
  }

  function snapshotPrice(sp){
    const base=Math.max(0,num(sp?.baseAmount));
    if(!base)return 0;
    const discount=Math.min(100,Math.max(0,num(sp?.discountSnapshot)));
    return Math.max(0,Math.round(base*(1-discount/100)*100)/100);
  }

  function canonicalAmount(s,req){
    const sp=s?.payment||{};
    const saved=Math.max(0,num(sp.amount));
    if(saved>0)return saved;
    if(sp.paid){
      const snap=snapshotPrice(sp);
      if(snap>0)return snap;
      const configured=effectivePrice(req);
      if(configured>0)return configured;
    }
    return 0;
  }

  function syncDialog(dlg){
    const c=currentClient();
    const s=sessionFromDialog(dlg,c);
    if(!c||!s)return;
    const req=requestForDialog(c,s,dlg);
    if(req?.payment?.mode!=='session')return;

    if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0,receiptUrl:'',note:''};
    const amount=canonicalAmount(s,req);

    if(s.payment.paid&&num(s.payment.amount)<=0&&amount>0){
      s.payment.amount=amount;
      s.payment.requestId=req.id;
      linkSessionRequest(c,s,req.id,'session-payment-ui-sync-link');
      if(typeof save==='function')save();
    }

    const wrap=dlg.querySelector('.session-editor-payment-amount-wrap');
    const modern=dlg.querySelector('.session-editor-payment-amount');
    if(wrap&&wrap.hidden)wrap.hidden=false;
    if(modern&&document.activeElement!==modern){const next=String(amount);if(modern.value!==next)modern.value=next;}

    const legacy=dlg.querySelector('.session-payment-field input[type="number"]');
    if(legacy&&document.activeElement!==legacy){const next=String(amount);if(legacy.value!==next)legacy.value=next;}

    const paid=!!s.payment.paid;
    const btn=dlg.querySelector('.session-editor-payment-state');
    if(btn){
      if(btn.classList.contains('paid')!==paid)btn.classList.toggle('paid',paid);
      if(btn.classList.contains('unpaid')===paid)btn.classList.toggle('unpaid',!paid);
      const text=paid?'✓ Оплачено':'Не оплачено';if(btn.textContent!==text)btn.textContent=text;
      const title=paid?`Оплачено ${amount} ₽`:`Не оплачено${amount?` · ${amount} ₽`:''}`;if(btn.title!==title)btn.title=title;
    }
    const checkbox=dlg.querySelector('.session-payment-field input[type="checkbox"],.session-payment-paid input[type="checkbox"]');
    if(checkbox&&checkbox.checked!==paid)checkbox.checked=paid;
  }

  function syncAll(){document.querySelectorAll('dialog.session-edit-dialog').forEach(syncDialog);}

  const observer=new MutationObserver(mutations=>{
    const addedDialog=mutations.some(m=>Array.from(m.addedNodes||[]).some(node=>{
      if(!(node instanceof Element))return false;
      return node.matches?.('dialog.session-edit-dialog')||node.querySelector?.('dialog.session-edit-dialog');
    }));
    if(addedDialog)setTimeout(syncAll,0);
  });
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.closest?.('dialog.session-edit-dialog'))setTimeout(syncAll,0);},true);
  document.addEventListener('click',e=>{if(e.target?.closest?.('.session-card,.session-editor-payment-state'))setTimeout(syncAll,0);},true);

  setTimeout(syncAll,0);
  window.DiagnostikaSessionPaymentUiSync={refresh:syncAll};
})();
