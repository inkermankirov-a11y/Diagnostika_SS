'use strict';

(() => {
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v)||0);
  const currentClient=()=>typeof client==='function'?client():null;
  const paymentOf=r=>{
    if(!r)return null;
    if(!r.payment||typeof r.payment!=='object')r.payment={mode:'',total:0,payments:[]};
    if(!Number.isFinite(Number(r.payment.sessionAmount)))r.payment.sessionAmount=0;
    if(!Number.isFinite(Number(r.payment.sessionDiscount)))r.payment.sessionDiscount=0;
    return r.payment;
  };
  const effectivePrice=p=>{
    const base=Math.max(0,Number(p?.sessionAmount)||0);
    const discount=Math.min(100,Math.max(0,Number(p?.sessionDiscount)||0));
    return Math.max(0,Math.round(base*(1-discount/100)*100)/100);
  };
  const sessionPay=s=>{
    if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0,receiptUrl:'',note:''};
    return s.payment;
  };

  const style=document.createElement('style');
  style.textContent=`
    .session-editor-payment{display:flex;align-items:center;gap:8px;margin-top:7px}
    .session-editor-payment-label{font-size:11px;font-weight:800;color:#475569}
    .session-editor-payment-state{min-height:30px!important;height:30px!important;padding:4px 10px!important;border-radius:8px!important;font-size:11px!important;font-weight:800!important;white-space:nowrap}
    .session-editor-payment-state.unpaid{background:linear-gradient(#ef6a6a,#d94d4d)!important;color:#fff!important;animation:sessionPayPulse 1.2s ease-in-out infinite}
    .session-editor-payment-state.paid{background:linear-gradient(#42ad73,#248d58)!important;color:#fff!important}
    .session-pay-status.unpaid{animation:sessionPayPulse 1.2s ease-in-out infinite!important}
    @keyframes sessionPayPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.08)}50%{box-shadow:0 0 0 5px rgba(220,38,38,.16)}}
  `;
  document.head.appendChild(style);

  function getDialogSession(){
    const c=currentClient();if(!c)return null;
    if(typeof selectedSessionId!=='undefined'&&selectedSessionId){
      const s=(c.sessions||[]).find(x=>x.id===selectedSessionId);if(s)return s;
    }
    return null;
  }

  function enhanceDialog(dlg){
    if(!dlg||dlg.dataset.paymentEditorReady==='1')return;
    const grid=dlg.querySelector('.session-edit-grid');
    const requestSelect=grid?.querySelector('select');
    const actions=dlg.querySelector('.session-edit-actions');
    if(!grid||!requestSelect||!actions)return;

    const c=currentClient(),s=getDialogSession();if(!c||!s)return;
    dlg.dataset.paymentEditorReady='1';

    const dateInput=grid.querySelector('input[type="date"]');
    const dateWrap=document.createElement('div');
    dateWrap.className='session-date-payment-wrap';
    if(dateInput){
      dateInput.parentNode.insertBefore(dateWrap,dateInput);
      dateWrap.appendChild(dateInput);
    }

    const box=document.createElement('div');
    box.className='session-editor-payment';
    box.innerHTML=`<span class="session-editor-payment-label">Оплата:</span><button type="button" class="tk-btn session-editor-payment-state"></button>`;
    dateWrap.appendChild(box);

    const stateBtn=box.querySelector('.session-editor-payment-state');
    let draftPaid=!!sessionPay(s).paid;

    function request(){return (c.requests||[]).find(r=>r.id===requestSelect.value)||null;}
    function render(){
      const r=request(),p=paymentOf(r),enabled=p?.mode==='session';
      box.hidden=!enabled;
      if(!enabled)return;
      stateBtn.classList.toggle('paid',draftPaid);
      stateBtn.classList.toggle('unpaid',!draftPaid);
      stateBtn.textContent=draftPaid?'✓ Оплачено':'Не оплачено';
    }

    stateBtn.addEventListener('click',()=>{draftPaid=!draftPaid;render();});
    requestSelect.addEventListener('change',()=>{draftPaid=!!sessionPay(s).paid;render();});

    const saveBtn=[...actions.querySelectorAll('button')].find(b=>/сохран/i.test(b.textContent||''))||actions.querySelector('.primary');
    if(saveBtn){
      saveBtn.addEventListener('click',()=>{
        const r=request(),p=paymentOf(r);if(p?.mode!=='session')return;
        const sp=sessionPay(s);
        sp.paid=draftPaid;
        sp.amount=effectivePrice(p);
        sp.receiptUrl='';
        sp.manualAmount=false;
      },true);
    }
    render();
  }

  function refresh(){document.querySelectorAll('.session-edit-dialog').forEach(enhanceDialog);}
  const observer=new MutationObserver(()=>setTimeout(refresh,0));
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(refresh,0);
})();
