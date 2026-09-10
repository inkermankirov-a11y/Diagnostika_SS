'use strict';

(() => {
  const CURRENCY='₽';
  const uidPay=()=>crypto.randomUUID?crypto.randomUUID():'pay_'+Date.now()+'_'+Math.random().toString(16).slice(2);
  const num=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(num(v));
  function todayLocal(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);}
  function currentClient(){return typeof client==='function'?client():null;}
  function currentRequest(c=currentClient()){
    if(!c)return null;
    return window.DiagnostikaRequests?.current?.(c)||c.requests?.find(r=>r.id===c.currentRequestId)||c.requests?.find(r=>r.id===requestId)||null;
  }
  function requestNumber(c,r){return window.DiagnostikaRequests?.requestNumber?.(c,r)||(c?.requests?.indexOf(r)+1||0);}

  function blankPayment(){return{mode:'',total:0,payments:[]};}
  function paymentOfRequest(c,r){
    if(!r)return blankPayment();
    if(!r.payment||typeof r.payment!=='object'){
      // Однократная безопасная миграция старой оплаты клиента в текущий цикл.
      if(c?.payment&&typeof c.payment==='object'&&!c._legacyPaymentMigratedToRequestId){
        r.payment=JSON.parse(JSON.stringify(c.payment));
        c._legacyPaymentMigratedToRequestId=r.id;
      }else r.payment=blankPayment();
    }
    if(!Array.isArray(r.payment.payments))r.payment.payments=[];
    if(!r.payment.mode)r.payment.mode='';
    return r.payment;
  }
  function sessionPayment(s){if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0,receiptUrl:'',note:''};return s.payment;}
  function sessionsFor(c,r){return (c?.sessions||[]).filter(s=>s.requestId===r?.id);}

  function summary(c,r=currentRequest(c)){
    if(!c||!r)return{status:'none',label:'Не указано',paid:0,total:0};
    const p=paymentOfRequest(c,r);
    if(p.mode==='session'){
      const sessions=sessionsFor(c,r),paidSessions=sessions.filter(s=>sessionPayment(s).paid);
      const paid=paidSessions.reduce((a,s)=>a+num(sessionPayment(s).amount),0);
      const total=sessions.reduce((a,s)=>a+num(sessionPayment(s).amount),0);
      if(!sessions.length)return{status:'none',label:'Не указано',paid,total,count:'0/0'};
      if(!paidSessions.length)return{status:'unpaid',label:'Нет',paid,total,count:`0/${sessions.length}`};
      if(paidSessions.length===sessions.length)return{status:'paid',label:'Оплачено',paid,total,count:`${sessions.length}/${sessions.length}`};
      return{status:'partial',label:'Частично',paid,total,count:`${paidSessions.length}/${sessions.length}`};
    }
    const total=num(p.total),paid=(p.payments||[]).reduce((a,x)=>a+num(x.amount),0);
    if(!p.mode&&!total&&!paid)return{status:'none',label:'Не указано',paid,total};
    if(paid<=0)return{status:'unpaid',label:'Нет',paid,total};
    if(total>0&&paid>=total)return{status:'paid',label:'Оплачено',paid,total};
    return{status:'partial',label:'Частично',paid,total};
  }

  const style=document.createElement('style');style.textContent=`
    .client-payment-box{margin:8px 0 2px;padding:8px 10px;border:1px solid #d9e2ec;border-radius:8px;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;gap:10px}.client-payment-main{min-width:0}.client-payment-title{font-size:11px;font-weight:800;color:#334155;margin-bottom:3px}.client-payment-summary{font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.client-payment-btn{flex:0 0 auto;min-height:32px!important;padding:6px 11px!important}
    .pay-chip{display:inline-flex;align-items:center;justify-content:center;min-width:72px;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:800;border:1px solid transparent}.pay-chip.paid{background:#e9f8ef;color:#247a49;border-color:#bfe7ce}.pay-chip.partial{background:#fff5d9;color:#916a00;border-color:#eedb9b}.pay-chip.unpaid{background:#fdecec;color:#b33a3a;border-color:#f1c3c3}.pay-chip.none{background:#f1f5f9;color:#64748b;border-color:#d8e0e8}
    .payment-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}.payment-dialog::backdrop{background:rgba(15,23,42,.44);backdrop-filter:blur(5px)}.payment-window{width:min(760px,calc(100vw - 24px));max-height:88vh;overflow:auto;background:#f8fafc;border:1px solid #d5dee8;border-radius:14px;box-shadow:0 24px 65px rgba(15,23,42,.28);padding:18px;box-sizing:border-box}.payment-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:5px}.payment-head strong{font-size:19px;color:#26384b}.payment-sub{font-size:12px;color:#64748b;margin:0 0 14px}.payment-x{width:36px;height:36px;border-radius:8px!important;padding:0!important}
    .payment-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:10px}.payment-field{display:grid;gap:5px;font-size:12px;font-weight:700;color:#475569}.payment-field input,.payment-field select{height:38px;border:1px solid #b9c6d4;border-radius:7px;padding:0 9px;background:#fff;box-sizing:border-box;width:100%}.payment-summary-card{margin:12px 0;padding:10px 12px;border:1px solid #dbe4ed;border-radius:9px;background:#fff;display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:13px;color:#526174}.payment-summary-card strong{color:#243447}
    .payment-history-title{font-size:13px;font-weight:800;color:#334155;margin:14px 0 8px}.payment-add{display:grid;grid-template-columns:120px 120px 1fr 1.2fr auto;gap:7px;align-items:end}.payment-add input{height:36px;border:1px solid #b9c6d4;border-radius:7px;padding:0 8px;box-sizing:border-box;width:100%}.payment-add button{height:36px!important}.payment-list{margin-top:10px;display:grid;gap:6px}.payment-row{display:grid;grid-template-columns:92px 110px 1fr 1.1fr auto;gap:8px;align-items:center;padding:8px 9px;border:1px solid #dbe4ed;border-radius:8px;background:#fff;font-size:12px}.payment-row a{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.payment-row .payment-remove{min-width:0!important;padding:6px 8px!important;font-size:11px!important}.payment-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.payment-session-note{margin-top:10px;padding:9px 11px;background:#eef6ff;border:1px solid #d4e5f7;border-radius:8px;color:#45627e;font-size:12px;line-height:1.4}
    .session-payment-field{grid-column:1/-1;padding:10px;border:1px solid #d7e2ec;border-radius:8px;background:#f8fafc;display:grid;grid-template-columns:auto 130px 1fr;gap:9px;align-items:end}.session-payment-field label{display:grid;gap:5px;font-size:12px;font-weight:700;color:#475569}.session-payment-paid{display:flex!important;align-items:center;gap:7px!important;height:36px}.session-payment-field input[type="number"],.session-payment-field input[type="url"]{height:36px;border:1px solid #b9c6d4;border-radius:7px;padding:0 8px;box-sizing:border-box;width:100%}.db-payment-cell{text-align:center;white-space:nowrap}.db-payment-head{width:105px;text-align:center}
    @media(max-width:760px){.payment-grid{grid-template-columns:1fr}.payment-add{grid-template-columns:1fr 1fr}.payment-add .wide{grid-column:1/-1}.payment-add button{grid-column:1/-1}.payment-row{grid-template-columns:1fr 1fr}.payment-row .wide{grid-column:1/-1}.session-payment-field{grid-template-columns:1fr}.client-payment-box{align-items:flex-start}.db-payment-head,.db-payment-cell{display:none}}
  `;document.head.appendChild(style);

  const dlg=document.createElement('dialog');dlg.className='payment-dialog';dlg.innerHTML=`
    <div class="payment-window"><div class="payment-head"><strong>ОПЛАТА ПО ЗАПРОСУ</strong><button type="button" class="payment-x">×</button></div><div id="paymentRequestSub" class="payment-sub"></div>
      <div class="payment-grid"><label class="payment-field">Схема оплаты<select id="paymentMode"><option value="">— Не указано —</option><option value="full">Оплата сразу</option><option value="parts">Оплата частями</option><option value="session">Оплата за каждую сессию</option></select></label><label class="payment-field" id="paymentTotalField">Стоимость цикла работы<input id="paymentTotal" type="number" min="0" step="100" placeholder="0"></label></div>
      <div id="paymentSummary" class="payment-summary-card"></div><div id="paymentSessionHint" class="payment-session-note" hidden>В этом режиме оплата отмечается в каждой сессии, относящейся к текущему запросу: оплачено, сумма и ссылка на чек.</div>
      <div id="paymentHistoryWrap"><div class="payment-history-title">ИСТОРИЯ ПЛАТЕЖЕЙ ЭТОГО ЗАПРОСА</div><div class="payment-add"><input id="paymentDate" type="date"><input id="paymentAmount" type="number" min="0" step="100" placeholder="Сумма"><input id="paymentNote" class="wide" type="text" placeholder="Комментарий"><input id="paymentReceipt" class="wide" type="url" placeholder="Ссылка на чек"><button id="paymentAddBtn" type="button" class="tk-btn">+ Платёж</button></div><div id="paymentList" class="payment-list"></div></div>
      <div class="payment-footer"><button id="paymentClose" type="button" class="tk-btn">Закрыть</button></div></div>`;document.body.appendChild(dlg);
  const q=s=>dlg.querySelector(s);

  function renderPaymentList(c,r){const p=paymentOfRequest(c,r),root=q('#paymentList');root.innerHTML='';if(!p.payments.length){root.innerHTML='<div style="color:#94a3b8;font-size:12px;padding:6px 2px">Платежей по этому запросу пока нет.</div>';return;}[...p.payments].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).forEach(pay=>{const row=document.createElement('div');row.className='payment-row';const date=document.createElement('div');date.textContent=pay.date||'—';const amount=document.createElement('strong');amount.textContent=`${money(pay.amount)} ${CURRENCY}`;const note=document.createElement('div');note.className='wide';note.textContent=pay.note||'—';const receipt=document.createElement('div');receipt.className='wide';if(pay.receiptUrl){const a=document.createElement('a');a.href=pay.receiptUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Открыть чек';receipt.appendChild(a);}else receipt.textContent='—';const del=document.createElement('button');del.type='button';del.className='payment-remove db-delete-btn';del.textContent='Удалить';del.onclick=()=>{p.payments=p.payments.filter(x=>x.id!==pay.id);save();renderDialog();refresh();};row.append(date,amount,note,receipt,del);root.appendChild(row);});}
  function renderSummary(c,r){const s=summary(c,r);q('#paymentSummary').innerHTML=`<span class="pay-chip ${s.status}">${s.label}</span><span><strong>Оплачено:</strong> ${money(s.paid)} ${CURRENCY}</span>${s.total?`<span><strong>Стоимость:</strong> ${money(s.total)} ${CURRENCY}</span><span><strong>Остаток:</strong> ${money(Math.max(0,s.total-s.paid))} ${CURRENCY}</span>`:''}${s.count?`<span><strong>Сессии:</strong> ${s.count}</span>`:''}`;}
  function renderDialog(){const c=currentClient(),r=currentRequest(c);if(!c||!r)return dlg.close();const p=paymentOfRequest(c,r),n=requestNumber(c,r);q('#paymentRequestSub').textContent=`Запрос ${n}: ${r.title||'Без названия'}`;q('#paymentMode').value=p.mode||'';q('#paymentTotal').value=p.total||'';q('#paymentDate').value=todayLocal();q('#paymentAmount').value='';q('#paymentNote').value='';q('#paymentReceipt').value='';const sessionMode=p.mode==='session';q('#paymentTotalField').hidden=sessionMode;q('#paymentHistoryWrap').hidden=sessionMode;q('#paymentSessionHint').hidden=!sessionMode;renderSummary(c,r);renderPaymentList(c,r);}
  function openPayment(){const c=currentClient(),r=currentRequest(c);if(!c||!r){window.AppDialog?.alert?.('Сначала создай или возобнови запрос.','Нет текущего запроса');return;}renderDialog();dlg.showModal();}
  q('.payment-x').onclick=()=>dlg.close();q('#paymentClose').onclick=()=>dlg.close();dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
  q('#paymentMode').onchange=e=>{const c=currentClient(),r=currentRequest(c);if(!c||!r)return;paymentOfRequest(c,r).mode=e.target.value;save();renderDialog();refresh();};
  q('#paymentTotal').oninput=e=>{const c=currentClient(),r=currentRequest(c);if(!c||!r)return;paymentOfRequest(c,r).total=num(e.target.value);save();renderSummary(c,r);refreshPaymentBox();refreshDatabasePaymentColumn();};
  q('#paymentAddBtn').onclick=()=>{const c=currentClient(),r=currentRequest(c);if(!c||!r)return;const p=paymentOfRequest(c,r),amount=num(q('#paymentAmount').value);if(amount<=0){q('#paymentAmount').focus();return;}p.payments.push({id:uidPay(),date:q('#paymentDate').value||todayLocal(),amount,note:q('#paymentNote').value.trim(),receiptUrl:q('#paymentReceipt').value.trim()});save();renderDialog();refresh();};

  function ensurePaymentBox(){const card=document.querySelector('.client-card');if(!card||card.querySelector('#clientPaymentBox'))return;const box=document.createElement('div');box.id='clientPaymentBox';box.className='client-payment-box';box.innerHTML='<div class="client-payment-main"><div class="client-payment-title">ОПЛАТА</div><div class="client-payment-summary">Не указано</div></div><button type="button" class="tk-btn client-payment-btn">Оплата</button>';const work=card.querySelector('.client-work');if(work)work.insertAdjacentElement('beforebegin',box);else card.appendChild(box);box.querySelector('button').onclick=openPayment;}
  function refreshPaymentBox(){ensurePaymentBox();const c=currentClient(),r=currentRequest(c),box=document.querySelector('#clientPaymentBox');if(!box||!c)return;if(!r){box.querySelector('.client-payment-title').textContent='ОПЛАТА';box.querySelector('.client-payment-summary').textContent='Нет текущего запроса';return;}const s=summary(c,r),n=requestNumber(c,r);box.querySelector('.client-payment-title').textContent=`ОПЛАТА · ЗАПРОС ${n}`;let text=s.label;if(s.count)text+=` · ${s.count} сессий`;else if(s.total||s.paid)text+=` · ${money(s.paid)} / ${money(s.total)} ${CURRENCY}`;box.querySelector('.client-payment-summary').textContent=text;}

  function refreshDatabasePaymentColumn(){const table=document.querySelector('#clientDatabaseList table');if(!table)return;const headRow=table.querySelector('thead tr');if(!headRow)return;if(!headRow.querySelector('.db-payment-head')){const th=document.createElement('th');th.className='db-payment-head';th.textContent='Оплата';const actions=headRow.querySelector('.db-col-actions')||headRow.lastElementChild;headRow.insertBefore(th,actions);}[...table.querySelectorAll('tbody tr')].forEach((tr,i)=>{const c=state.clients[i];if(!c)return;let cell=tr.querySelector('.db-payment-cell');if(!cell){cell=document.createElement('td');cell.className='db-payment-cell';const actions=tr.querySelector('.db-col-actions')||tr.lastElementChild;tr.insertBefore(cell,actions);}const r=currentRequest(c),s=summary(c,r);cell.innerHTML='';const chip=document.createElement('span');chip.className=`pay-chip ${s.status}`;chip.textContent=s.label;chip.title=r?`Запрос ${requestNumber(c,r)}: ${r.title||''}`:'Нет текущего запроса';cell.appendChild(chip);});}

  // Оплата за конкретную сессию показывается только если её запрос работает по схеме «за каждую сессию».
  const previousOpenSessionEditor=window.openSessionEditor;
  if(typeof previousOpenSessionEditor==='function')window.openSessionEditor=function(c,s,number){previousOpenSessionEditor(c,s,number);const r=c?.requests?.find(x=>x.id===s.requestId);if(!r||paymentOfRequest(c,r).mode!=='session')return;const dialogs=[...document.querySelectorAll('dialog.session-edit-dialog')],sd=dialogs[dialogs.length-1],grid=sd?.querySelector('.session-edit-grid');if(!sd||!grid||grid.querySelector('.session-payment-field'))return;const p=sessionPayment(s),field=document.createElement('div');field.className='session-payment-field';field.innerHTML='<label class="session-payment-paid"><input type="checkbox" class="sp-paid"> Оплачено</label><label>Сумма<input type="number" class="sp-amount" min="0" step="100"></label><label>Ссылка на чек<input type="url" class="sp-receipt" placeholder="https://..."></label>';field.querySelector('.sp-paid').checked=!!p.paid;field.querySelector('.sp-amount').value=p.amount||'';field.querySelector('.sp-receipt').value=p.receiptUrl||'';grid.appendChild(field);const saveBtn=sd.querySelector('.session-edit-actions .primary');if(saveBtn){const old=saveBtn.onclick;saveBtn.onclick=e=>{p.paid=field.querySelector('.sp-paid').checked;p.amount=num(field.querySelector('.sp-amount').value);p.receiptUrl=field.querySelector('.sp-receipt').value.trim();save();if(typeof old==='function')old.call(saveBtn,e);refresh();};}};

  const oldRenderClient=window.renderClient;if(typeof oldRenderClient==='function')window.renderClient=function(){const v=oldRenderClient.apply(this,arguments);setTimeout(refreshPaymentBox,0);return v;};
  if(typeof window.renderClientDatabaseTable==='function'){const oldDb=window.renderClientDatabaseTable;window.renderClientDatabaseTable=function(){const v=oldDb.apply(this,arguments);setTimeout(refreshDatabasePaymentColumn,0);return v;};}
  function refresh(){refreshPaymentBox();refreshDatabasePaymentColumn();if(dlg.open)renderDialog();}
  window.DiagnostikaPayments={refresh,summary,paymentOfRequest};
  refresh();
})();