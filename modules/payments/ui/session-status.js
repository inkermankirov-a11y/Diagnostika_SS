'use strict';

(() => {
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v)||0);
  const ui=()=>window.DiagnostikaPaymentUIContext||null;
  const currentClient=()=>ui()?.currentClient?.()||null;
  const currentRequest=c=>ui()?.currentRequest?.(c)||null;
  const requestForSession=(c,s)=>ui()?.requestById?.(c,s?.requestId||s?.payment?.requestId)||null;
  const paymentWriter=()=>window.DiagnostikaPayments?.moduleAware===true?window.DiagnostikaPayments:null;
  const paymentOf=(c,r)=>paymentWriter()?.request?.(r?.id,c)||(r?.payment&&typeof r.payment==='object'?r.payment:{mode:'',total:0,payments:[],sessionAmount:0});
  const sessionPay=(c,s)=>paymentWriter()?.session?.(s?.id,c)||(s?.payment&&typeof s.payment==='object'?s.payment:{paid:false,amount:0,receiptUrl:'',note:''});

  const style=document.createElement('style');
  style.textContent=`
    .session-pay-status{margin-left:auto;display:inline-flex;align-items:center;gap:6px;border:0;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;box-shadow:0 2px 6px rgba(15,23,42,.14);transition:filter .12s ease}
    .session-pay-status:hover{filter:brightness(1.03)}
    .session-pay-status.paid{background:#dff5e8;color:#197344;border:1px solid #9fd5b5}
    .session-pay-status.unpaid{background:#fde8e8;color:#b42323;border:1px solid #efb1b1;animation:none!important}
    .session-editor-payment-state.unpaid{animation:none!important;box-shadow:none!important}
    #clientPaymentBox.payment-attention{border-color:#e05252!important;background:#fff1f1!important;animation:none!important;box-shadow:0 0 0 1px rgba(220,38,38,.08)!important}
    #clientPaymentBox.payment-attention .client-payment-title,#clientPaymentBox.payment-attention .client-payment-summary{color:#b42323!important;font-weight:800}
    @media(max-width:640px){.session-pay-status{margin-left:0}.session-card-meta{flex-wrap:wrap}}
  `;
  document.head.appendChild(style);

  function decorateCards(){
    const c=currentClient();if(!c)return;
    document.querySelectorAll('.session-card').forEach(card=>{
      const title=card.querySelector('.session-card-title')?.textContent||'';
      const m=title.match(/№(\d+)/);
      const existing=card.querySelector('.session-pay-status');
      if(!m){existing?.remove();return;}
      const chronological=(ui()?.sessionList?.(c)||[]).map((s,index)=>({s,index,time:new Date(s.date||s.createdAt||0).getTime()||index})).sort((a,b)=>a.time-b.time||a.index-b.index);
      const s=chronological[Number(m[1])-1]?.s;
      if(!s){existing?.remove();return;}
      if(s?.planned===true||String(s?.status||'')==='planned'){existing?.remove();return;}
      const r=requestForSession(c,s),p=paymentOf(c,r);
      if(!r||p?.mode!=='session'){existing?.remove();return;}
      const sp=sessionPay(c,s);
      const shownAmount=Number(sp.amount)||Number(p.sessionAmount)||0;

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
      const text=sp.paid?`✓ Оплачено ${money(shownAmount)} ₽`:'Не оплачено';
      if(btn.textContent!==text)btn.textContent=text;
      const tip=sp.paid?'Нажми, чтобы отменить отметку оплаты':'Нажми, чтобы отметить оплату';
      if(btn.title!==tip)btn.title=tip;
      btn.onclick=async e=>{
        e.stopPropagation();e.preventDefault();
        let nextPaid=!sp.paid;
        if(sp.paid){
          const ok=window.AppDialog?.confirm?await window.AppDialog.confirm('Снять отметку об оплате этой сессии?','Оплата сессии','Да','Нет'):confirm('Снять отметку об оплате этой сессии?');
          if(!ok)return;
          nextPaid=false;
        }
        const updated=paymentWriter()?.updateSession?.(
          s.id,
          {paid:nextPaid,amount:nextPaid?shownAmount:(Number(sp.amount)||0)},
          {client:c,source:'session-payment-status-toggle'}
        );
        if(!updated)return;
        ui()?.refreshSessions?.();
        scheduleRefresh();
      };
    });
  }

  function refreshMainPaymentAlert(){
    const c=currentClient(),r=currentRequest(c),box=document.querySelector('#clientPaymentBox');
    if(!box)return;
    let unpaid=[];
    if(r){
      const p=paymentOf(c,r);
      if(p?.mode==='session'){
        const sessions=ui()?.sessionsForRequest?.(c,r.id)||[];
        unpaid=sessions.filter(s=>!(s?.planned===true||String(s?.status||'')==='planned')&&!sessionPay(c,s).paid);
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

  function refreshAll(){decorateCards();refreshMainPaymentAlert();}

  let refreshTimer=0;
  function scheduleRefresh(){
    if(refreshTimer)return;
    refreshTimer=setTimeout(()=>{refreshTimer=0;refreshAll();},0);
  }

  document.addEventListener('diagnostika:dashboard-sessions-rendered',scheduleRefresh);
  window.addEventListener('diagnostika:payment-dialog-opened',scheduleRefresh);
  document.addEventListener('diagnostika:session-editor-opened',scheduleRefresh);
  const events=window.DiagnostikaPlatform?.events;
  for(const type of ['client:selected','client:updated','request:selected','request:updated','payment:updated','payment:added','payment:deleted','session-payment:updated','session:created','session:updated','session:deleted'])events?.on?.(type,scheduleRefresh);
  scheduleRefresh();

  window.DiagnostikaSessionPayments=Object.freeze({refresh:refreshAll});
})();
