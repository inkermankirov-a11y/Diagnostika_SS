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
    .session-editor-payment{margin:12px 0;padding:12px;border:1px solid #d8e2ec;border-radius:10px;background:#f8fafc;display:grid;grid-template-columns:1fr 170px;gap:10px;align-items:end}
    .session-editor-payment-title{grid-column:1/-1;font-size:12px;font-weight:800;color:#334155}
    .session-editor-payment-state{height:40px!important;border-radius:9px!important;font-weight:800!important}
    .session-editor-payment-state.unpaid{background:linear-gradient(#ef6a6a,#d94d4d)!important;color:#fff!important;animation:sessionPayPulse 1.2s ease-in-out infinite}
    .session-editor-payment-state.paid{background:linear-gradient(#42ad73,#248d58)!important;color:#fff!important}
    .session-editor-payment-amount{display:grid;gap:5px;font-size:12px;font-weight:700;color:#475569}
    .session-editor-payment-amount input{height:40px;border:1px solid #b9c6d4;border-radius:8px;padding:0 10px;background:#fff;box-sizing:border-box;width:100%}
    .session-editor-payment-note{grid-column:1/-1;font-size:11px;color:#64748b}
    .session-pay-status.unpaid{animation:sessionPayPulse 1.2s ease-in-out infinite!important}
    @keyframes sessionPayPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.08)}50%{box-shadow:0 0 0 6px rgba(220,38,38,.18)}}
    @media(max-width:640px){.session-editor-payment{grid-template-columns:1fr}.session-editor-payment-title,.session-editor-payment-note{grid-column:1}}
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
    const card=dlg.querySelector('.session-edit-card');if(!card)return;
    const grid=dlg.querySelector('.session-edit-grid');
    const requestSelect=grid?.querySelector('select');
    const notes=dlg.querySelector('.session-edit-text');
    const actions=dlg.querySelector('.session-edit-actions');
    if(!requestSelect||!notes||!actions)return;

    const c=currentClient(),s=getDialogSession();if(!c||!s)return;
    dlg.dataset.paymentEditorReady='1';

    const box=document.createElement('div');
    box.className='session-editor-payment';
    box.innerHTML=`<div class="session-editor-payment-title">ОПЛАТА СЕССИИ</div><button type="button" class="tk-btn session-editor-payment-state"></button><label class="session-editor-payment-amount">Сумма, ₽<input type="number" min="0" step="100"></label><div class="session-editor-payment-note"></div>`;
    notes.insertAdjacentElement('afterend',box);

    const stateBtn=box.querySelector('.session-editor-payment-state');
    const amount=box.querySelector('input');
    const note=box.querySelector('.session-editor-payment-note');
    let draftPaid=!!sessionPay(s).paid;
    let manuallyChangedAmount=false;

    function request(){return (c.requests||[]).find(r=>r.id===requestSelect.value)||null;}
    function render(){
      const r=request(),p=paymentOf(r),enabled=p?.mode==='session';
      box.hidden=!enabled;
      if(!enabled)return;
      const sp=sessionPay(s),def=effectivePrice(p);
      if(!manuallyChangedAmount){
        const current=Number(sp.amount)||0;
        amount.value=current||def||'';
      }
      stateBtn.classList.toggle('paid',draftPaid);
      stateBtn.classList.toggle('unpaid',!draftPaid);
      stateBtn.textContent=draftPaid?`✓ Оплачено${Number(amount.value)>0?' '+money(amount.value)+' ₽':''}`:'Не оплачено';
      const discount=Number(p.sessionDiscount)||0;
      note.textContent=discount>0?`Цена по запросу: ${money(def)} ₽ после скидки ${discount}%`:`Цена по запросу: ${money(def)} ₽`;
    }

    stateBtn.addEventListener('click',()=>{draftPaid=!draftPaid;render();});
    amount.addEventListener('input',()=>{manuallyChangedAmount=true;render();});
    requestSelect.addEventListener('change',()=>{manuallyChangedAmount=false;const sp=sessionPay(s);draftPaid=!!sp.paid;render();});

    const saveBtn=[...actions.querySelectorAll('button')].find(b=>/сохран/i.test(b.textContent||''))||actions.querySelector('.primary');
    if(saveBtn){
      saveBtn.addEventListener('click',()=>{
        const r=request(),p=paymentOf(r);if(p?.mode!=='session')return;
        const sp=sessionPay(s);
        sp.paid=draftPaid;
        sp.amount=Math.max(0,Number(amount.value)||effectivePrice(p)||0);
        sp.receiptUrl='';
        sp.manualAmount=true;
      },true);
    }
    render();
  }

  function refresh(){document.querySelectorAll('.session-edit-dialog').forEach(enhanceDialog);}
  const observer=new MutationObserver(()=>setTimeout(refresh,0));
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(refresh,0);
})();
