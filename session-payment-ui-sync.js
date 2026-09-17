'use strict';

(() => {
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const currentClient=()=>typeof client==='function'?client():null;

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
      s.requestId=req.id;
      if(typeof save==='function')save();
    }

    const wrap=dlg.querySelector('.session-editor-payment-amount-wrap');
    const modern=dlg.querySelector('.session-editor-payment-amount');
    if(wrap&&wrap.hidden)wrap.hidden=false;
    if(modern&&document.activeElement!==modern&&modern.value!==String(amount))modern.value=String(amount);

    const legacy=dlg.querySelector('.session-payment-field input[type="number"]');
    if(legacy&&document.activeElement!==legacy&&legacy.value!==String(amount))legacy.value=String(amount);

    const paid=!!s.payment.paid;
    const btn=dlg.querySelector('.session-editor-payment-state');
    if(btn){
      btn.classList.toggle('paid',paid);
      btn.classList.toggle('unpaid',!paid);
      const nextText=paid?'✓ Оплачено':'Не оплачено';
      const nextTitle=paid?`Оплачено ${amount} ₽`:`Не оплачено${amount?` · ${amount} ₽`:''}`;
      if(btn.textContent!==nextText)btn.textContent=nextText;
      if(btn.title!==nextTitle)btn.title=nextTitle;
    }
    const checkbox=dlg.querySelector('.session-payment-field input[type="checkbox"],.session-payment-paid input[type="checkbox"]');
    if(checkbox&&checkbox.checked!==paid)checkbox.checked=paid;
  }

  function syncAll(){
    document.querySelectorAll('dialog.session-edit-dialog').forEach(syncDialog);
  }

  let queued=false;
  const schedule=()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;syncAll();});
  };

  const observer=new MutationObserver(mutations=>{
    const relevant=mutations.some(m=>[...m.addedNodes].some(n=>n?.nodeType===1&&(
      n.matches?.('dialog.session-edit-dialog,.session-editor-payment,.session-payment-field')||
      n.querySelector?.('dialog.session-edit-dialog,.session-editor-payment,.session-payment-field')
    )));
    if(relevant)schedule();
  });
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{
    if(e.target?.closest?.('dialog.session-edit-dialog'))schedule();
  },true);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.session-card,.session-editor-payment-state,.session-payment-toggle-stable'))schedule();
  },true);

  schedule();
  setTimeout(schedule,200);
  setTimeout(schedule,700);
  window.DiagnostikaSessionPaymentUiSync={refresh:syncAll};
})();
