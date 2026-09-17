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

  const style=document.createElement('style');
  style.textContent=`
    .session-pay-status{margin-left:auto;display:inline-flex;align-items:center;gap:6px;border:0;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;box-shadow:0 2px 6px rgba(15,23,42,.14);transition:filter .12s ease}
    .session-pay-status:hover{filter:brightness(1.03)}
    .session-pay-status.paid{background:#dff5e8;color:#197344;border:1px solid #9fd5b5}
    .session-pay-status.unpaid{background:#fde8e8;color:#b42323;border:1px solid #efb1b1;animation:none!important}
    .session-editor-payment-state.unpaid{animation:none!important;box-shadow:none!important}
    .session-price-field{display:grid;gap:5px;font-size:12px;font-weight:700;color:#475569;margin-top:10px}
    .session-price-field input{height:38px;border:1px solid #b9c6d4;border-radius:7px;padding:0 9px;background:#fff;box-sizing:border-box;width:100%}
    #clientPaymentBox.payment-attention{border-color:#e05252!important;background:#fff1f1!important;animation:none!important;box-shadow:0 0 0 1px rgba(220,38,38,.08)!important}
    #clientPaymentBox.payment-attention .client-payment-title,#clientPaymentBox.payment-attention .client-payment-summary{color:#b42323!important;font-weight:800}
    @media(max-width:640px){.session-pay-status{margin-left:0}.session-card-meta{flex-wrap:wrap}}
  `;
  document.head.appendChild(style);

  function ensureSessionPriceField(){
    const dlg=document.querySelector('.payment-dialog');
    if(!dlg||dlg.querySelector('#sessionPriceField'))return;
    const total=dlg.querySelector('#paymentTotalField');
    if(!total)return;
    const field=document.createElement('label');
    field.id='sessionPriceField';
    field.className='session-price-field';
    field.innerHTML='Стоимость одной сессии<input id="sessionPrice" type="number" min="0" step="100" placeholder="10000">';
    total.insertAdjacentElement('afterend',field);
    const input=field.querySelector('#sessionPrice');
    input.addEventListener('input',()=>{
      const c=currentClient(),r=currentRequest(c);if(!r)return;
      paymentOf(r).sessionAmount=Number(input.value)||0;
      if(typeof save==='function')save();
      refreshAll();
    });
  }

  function syncSessionPriceField(){
    ensureSessionPriceField();
    const dlg=document.querySelector('.payment-dialog'),field=dlg?.querySelector('#sessionPriceField'),input=dlg?.querySelector('#sessionPrice');
    if(!field||!input)return;
    const c=currentClient(),r=currentRequest(c),p=paymentOf(r);
    const isSession=p?.mode==='session';
    if(field.hidden===isSession)field.hidden=!isSession;
    if(isSession&&document.activeElement!==input){
      const next=String(p.sessionAmount||'');
      if(input.value!==next)input.value=next;
    }
  }

  function decorateCards(){
    const c=currentClient();if(!c)return;
    document.querySelectorAll('.session-card').forEach(card=>{
      const title=card.querySelector('.session-card-title')?.textContent||'';
      const m=title.match(/№(\d+)/);
      const existing=card.querySelector('.session-pay-status');
      if(!m){existing?.remove();return;}
      const chronological=(c.sessions||[]).map((s,index)=>({s,index,time:new Date(s.date||s.createdAt||0).getTime()||index})).sort((a,b)=>a.time-b.time||a.index-b.index);
      const s=chronological[Number(m[1])-1]?.s;
      if(!s){existing?.remove();return;}
      const r=requestForSession(c,s),p=paymentOf(r);
      if(!r||p?.mode!=='session'){existing?.remove();return;}
      const sp=sessionPay(s);
      if(!sp.amount&&p.sessionAmount)sp.amount=Number(p.sessionAmount)||0;

      let btn=existing;
      if(!btn){
        btn=document.createElement('button');
        btn.type='button';
        const meta=card.querySelector('.session-card-meta')||card.querySelector('.session-card-head');
        meta?.appendChild(btn);
      }
      if(!btn||!btn.isConnected)return;

      const cls='session-pay-status '+(sp.paid?'paid':'unpaid');
      if(btn.className!==cls)btn.className=cls;
      const text=sp.paid?`✓ Оплачено ${money(sp.amount||p.sessionAmount)} ₽`:'Не оплачено';
      if(btn.textContent!==text)btn.textContent=text;
      const tip=sp.paid?'Нажми, чтобы отменить отметку оплаты':'Нажми, чтобы отметить оплату';
      if(btn.title!==tip)btn.title=tip;
      btn.onclick=async e=>{
        e.stopPropagation();e.preventDefault();
        if(sp.paid){
          const ok=window.AppDialog?.confirm?await window.AppDialog.confirm('Снять отметку об оплате этой сессии?','Оплата сессии','Да','Нет'):confirm('Снять отметку об оплате этой сессии?');
          if(!ok)return;
          sp.paid=false;
        }else{
          sp.paid=true;
          if(!sp.amount)sp.amount=Number(p.sessionAmount)||0;
        }
        if(typeof save==='function')save();
        if(typeof renderSessions==='function')renderSessions();
        scheduleRefresh();
      };
    });
  }

  function refreshMainPaymentAlert(){
    const c=currentClient(),r=currentRequest(c),box=document.querySelector('#clientPaymentBox');
    if(!box)return;
    let unpaid=[];
    if(r){
      const p=paymentOf(r);
      if(p?.mode==='session'){
        const sessions=(c.sessions||[]).filter(s=>s.requestId===r.id);
        unpaid=sessions.filter(s=>!sessionPay(s).paid);
      }
    }
    const shouldAttention=unpaid.length>0;
    if(box.classList.contains('payment-attention')!==shouldAttention)box.classList.toggle('payment-attention',shouldAttention);
    if(shouldAttention){
      const summary=box.querySelector('.client-payment-summary');
      const text=`Не оплачено · ${unpaid.length} ${unpaid.length===1?'сессия':'сессии'}`;
      if(summary&&summary.textContent!==text)summary.textContent=text;
    }
  }

  function refreshAll(){syncSessionPriceField();decorateCards();refreshMainPaymentAlert();}

  let refreshTimer=0;
  function scheduleRefresh(){
    if(refreshTimer)return;
    refreshTimer=setTimeout(()=>{refreshTimer=0;refreshAll();},0);
  }

  const oldRenderSessions=window.renderSessions;
  if(typeof oldRenderSessions==='function')window.renderSessions=function(){const v=oldRenderSessions.apply(this,arguments);scheduleRefresh();return v;};
  const oldRenderClient=window.renderClient;
  if(typeof oldRenderClient==='function')window.renderClient=function(){const v=oldRenderClient.apply(this,arguments);scheduleRefresh();return v;};

  const observer=new MutationObserver(mutations=>{
    const relevant=mutations.some(m=>Array.from(m.addedNodes||[]).some(node=>{
      if(!(node instanceof Element))return false;
      return node.matches?.('.session-card,.payment-dialog')||node.querySelector?.('.session-card,.payment-dialog');
    }));
    if(relevant)scheduleRefresh();
  });
  observer.observe(document.body,{childList:true,subtree:true});
  scheduleRefresh();

  window.DiagnostikaSessionPayments={refresh:refreshAll};
})();
