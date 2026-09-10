'use strict';

(() => {
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v)||0);
  const currentClient=()=>typeof client==='function'?client():null;
  const currentRequest=c=>window.DiagnostikaRequests?.current?.(c)||c?.requests?.find(r=>r.id===c?.currentRequestId)||null;
  const requestForSession=(c,s)=>c?.requests?.find(r=>r.id===s?.requestId)||null;
  const paymentOf=r=>{
    if(!r)return null;
    if(!r.payment||typeof r.payment!=='object')r.payment={mode:'',total:0,payments:[]};
    if(!Array.isArray(r.payment.payments))r.payment.payments=[];
    if(!Number.isFinite(Number(r.payment.sessionAmount)))r.payment.sessionAmount=0;
    return r.payment;
  };
  const sessionPay=s=>{
    if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0,receiptUrl:'',note:''};
    return s.payment;
  };
  const priorPaid=p=>(p?.payments||[]).reduce((sum,x)=>sum+(Number(x.amount)||0),0);

  const style=document.createElement('style');
  style.textContent=`
    #paymentReceipt{display:none!important}
    .payment-add:has(#paymentReceipt){grid-template-columns:120px 120px 1fr auto!important}
    .payment-row>div:nth-child(4){display:none!important}
    .payment-row{grid-template-columns:92px 110px 1fr auto!important}
    .session-payment-field label:has(input[type="url"]){display:none!important}
    .session-payment-field{grid-template-columns:auto 150px!important}
    .previous-payment-summary{margin:8px 0 0;padding:8px 10px;border-radius:8px;background:#eef4fb;border:1px solid #d6e2ef;color:#526174;font-size:12px}
    .previous-payment-summary strong{color:#26384b}
    .session-payment-edit-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}
    .session-payment-edit-dialog::backdrop{background:rgba(15,23,42,.44);backdrop-filter:blur(5px)}
    .session-payment-edit-card{width:min(420px,calc(100vw - 24px));background:#f8fafc;border:1px solid #d5dee8;border-radius:14px;box-shadow:0 24px 65px rgba(15,23,42,.28);padding:18px;box-sizing:border-box}
    .session-payment-edit-card h3{margin:0 0 14px;color:#26384b;font-size:18px}
    .session-payment-edit-fields{display:grid;gap:12px}.session-payment-edit-fields label{display:grid;gap:5px;font-size:12px;font-weight:700;color:#475569}
    .session-payment-edit-fields input[type="number"]{height:38px;border:1px solid #b9c6d4;border-radius:7px;padding:0 9px;background:#fff;box-sizing:border-box;width:100%}
    .session-payment-paid-check{display:flex!important;grid-template-columns:none!important;align-items:center;gap:8px!important}
    .session-payment-edit-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
    .session-payment-edit-actions button{min-height:36px!important}
    @media(max-width:640px){.session-payment-field{grid-template-columns:1fr!important}.payment-row{grid-template-columns:1fr 1fr!important}}
  `;
  document.head.appendChild(style);

  function ensurePreviousSummary(){
    const dlg=document.querySelector('.payment-dialog');if(!dlg)return;
    let box=dlg.querySelector('#previousPaymentSummary');
    if(!box){
      box=document.createElement('div');box.id='previousPaymentSummary';box.className='previous-payment-summary';
      const hint=dlg.querySelector('#paymentSessionHint');
      if(hint)hint.insertAdjacentElement('afterend',box);
    }
    const c=currentClient(),r=currentRequest(c),p=paymentOf(r),paid=priorPaid(p);
    box.hidden=!(p?.mode==='session'&&paid>0);
    if(!box.hidden)box.innerHTML=`<strong>Ранее внесено:</strong> ${money(paid)} ₽ <span style="color:#7b8794">до перехода на оплату по сессиям</span>`;
  }

  function hideReceiptUi(){
    document.querySelectorAll('.session-payment-field input[type="url"]').forEach(input=>{const label=input.closest('label');if(label)label.style.display='none';});
    const receipt=document.querySelector('#paymentReceipt');if(receipt)receipt.style.display='none';
  }

  function findSessionFromCard(c,card){
    const title=card.querySelector('.session-card-title')?.textContent||'';
    const m=title.match(/№(\d+)/);if(!m)return null;
    const chronological=(c.sessions||[]).map((s,index)=>({s,index,time:new Date(s.date||s.createdAt||0).getTime()||index})).sort((a,b)=>a.time-b.time||a.index-b.index);
    return chronological[Number(m[1])-1]?.s||null;
  }

  function openSessionPaymentEditor(c,s){
    const r=requestForSession(c,s),p=paymentOf(r);if(!r||p?.mode!=='session')return;
    const sp=sessionPay(s);if(!sp.amount&&p.sessionAmount)sp.amount=Number(p.sessionAmount)||0;
    const dlg=document.createElement('dialog');dlg.className='session-payment-edit-dialog';
    dlg.innerHTML=`<div class="session-payment-edit-card"><h3>Оплата сессии</h3><div class="session-payment-edit-fields"><label class="session-payment-paid-check"><input id="spePaid" type="checkbox"> Оплачено</label><label>Сумма<input id="speAmount" type="number" min="0" step="100"></label></div><div class="session-payment-edit-actions"><button type="button" id="speCancel" class="tk-btn">Отмена</button><button type="button" id="speSave" class="tk-btn">Сохранить</button></div></div>`;
    document.body.appendChild(dlg);
    const paid=dlg.querySelector('#spePaid'),amount=dlg.querySelector('#speAmount');paid.checked=!!sp.paid;amount.value=sp.amount||p.sessionAmount||'';
    const close=()=>{try{dlg.close();}catch(e){}dlg.remove();};
    dlg.querySelector('#speCancel').onclick=close;
    dlg.querySelector('#speSave').onclick=()=>{
      sp.paid=paid.checked;sp.amount=Number(amount.value)||0;sp.receiptUrl='';
      if(typeof save==='function')save();close();if(typeof renderSessions==='function')renderSessions();setTimeout(refresh,0);
    };
    dlg.addEventListener('click',e=>{if(e.target===dlg)close();});
    dlg.showModal();
  }

  function replacePaymentButtons(){
    const c=currentClient();if(!c)return;
    document.querySelectorAll('.session-card').forEach(card=>{
      const old=card.querySelector('.session-pay-status');if(!old||old.dataset.editablePayment==='1')return;
      const s=findSessionFromCard(c,card);if(!s)return;
      const r=requestForSession(c,s),p=paymentOf(r);if(!r||p?.mode!=='session')return;
      const sp=sessionPay(s);if(!sp.amount&&p.sessionAmount)sp.amount=Number(p.sessionAmount)||0;
      const btn=old.cloneNode(true);btn.dataset.editablePayment='1';
      btn.textContent=sp.paid?`✓ Оплачено ${money(sp.amount||p.sessionAmount)} ₽`:'Не оплачено';
      btn.title='Редактировать оплату сессии';
      btn.addEventListener('click',e=>{e.stopPropagation();e.preventDefault();openSessionPaymentEditor(c,s);});
      old.replaceWith(btn);
    });
  }

  function enhanceMainSummary(){
    const c=currentClient(),r=currentRequest(c),p=paymentOf(r),box=document.querySelector('#clientPaymentBox');if(!box||!r||p?.mode!=='session')return;
    const paidBefore=priorPaid(p);if(!paidBefore)return;
    const summary=box.querySelector('.client-payment-summary');if(summary&&!summary.textContent.includes('ранее внесено'))summary.textContent+=` · ранее внесено ${money(paidBefore)} ₽`;
  }

  function refresh(){ensurePreviousSummary();hideReceiptUi();replacePaymentButtons();enhanceMainSummary();}
  const observer=new MutationObserver(()=>setTimeout(refresh,0));observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(refresh,0);
})();
