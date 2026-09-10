'use strict';

(() => {
  const CURRENCY='₽';

  function uidPay(){return (crypto.randomUUID?crypto.randomUUID():'pay_'+Date.now()+'_'+Math.random().toString(16).slice(2));}
  function num(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:0;}
  function money(v){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(num(v));}
  function todayLocal(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);}
  function currentClient(){return typeof client==='function'?client():null;}

  function paymentOf(c){
    if(!c.payment || typeof c.payment!=='object') c.payment={mode:'',total:0,payments:[]};
    if(!Array.isArray(c.payment.payments)) c.payment.payments=[];
    if(!c.payment.mode) c.payment.mode='';
    return c.payment;
  }

  function sessionPayment(s){
    if(!s.payment || typeof s.payment!=='object') s.payment={paid:false,amount:0,receiptUrl:'',note:''};
    return s.payment;
  }

  function summary(c){
    if(!c) return {status:'none',label:'Не указано',paid:0,total:0};
    const p=paymentOf(c);
    if(p.mode==='session'){
      const sessions=Array.isArray(c.sessions)?c.sessions:[];
      const paidSessions=sessions.filter(s=>sessionPayment(s).paid);
      const paid=paidSessions.reduce((a,s)=>a+num(sessionPayment(s).amount),0);
      const total=sessions.reduce((a,s)=>a+num(sessionPayment(s).amount),0);
      if(!sessions.length) return {status:'none',label:'Не указано',paid,total,count:'0/0'};
      if(!paidSessions.length) return {status:'unpaid',label:'Нет',paid,total,count:`0/${sessions.length}`};
      if(paidSessions.length===sessions.length) return {status:'paid',label:'Оплачено',paid,total,count:`${sessions.length}/${sessions.length}`};
      return {status:'partial',label:'Частично',paid,total,count:`${paidSessions.length}/${sessions.length}`};
    }
    const total=num(p.total);
    const paid=(p.payments||[]).reduce((a,x)=>a+num(x.amount),0);
    if(!p.mode && !total && !paid) return {status:'none',label:'Не указано',paid,total};
    if(paid<=0) return {status:'unpaid',label:'Нет',paid,total};
    if(total>0 && paid>=total) return {status:'paid',label:'Оплачено',paid,total};
    return {status:'partial',label:'Частично',paid,total};
  }

  const style=document.createElement('style');
  style.textContent=`
    .client-payment-box{margin:9px 0 2px;padding:8px 10px;border:1px solid #d9e2ec;border-radius:8px;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;gap:10px}
    .client-payment-main{min-width:0}.client-payment-title{font-size:11px;font-weight:800;color:#334155;margin-bottom:3px}.client-payment-summary{font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .client-payment-btn{flex:0 0 auto;min-height:32px!important;padding:6px 11px!important}
    .pay-chip{display:inline-flex;align-items:center;justify-content:center;min-width:72px;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:800;border:1px solid transparent}
    .pay-chip.paid{background:#e9f8ef;color:#247a49;border-color:#bfe7ce}.pay-chip.partial{background:#fff5d9;color:#916a00;border-color:#eedb9b}.pay-chip.unpaid{background:#fdecec;color:#b33a3a;border-color:#f1c3c3}.pay-chip.none{background:#f1f5f9;color:#64748b;border-color:#d8e0e8}
    .payment-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}.payment-dialog::backdrop{background:rgba(15,23,42,.44);backdrop-filter:blur(5px)}
    .payment-window{width:min(760px,calc(100vw - 24px));max-height:88vh;overflow:auto;background:#f8fafc;border:1px solid #d5dee8;border-radius:14px;box-shadow:0 24px 65px rgba(15,23,42,.28);padding:18px;box-sizing:border-box}
    .payment-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.payment-head strong{font-size:19px;color:#26384b}.payment-x{width:36px;height:36px;border-radius:8px!important;padding:0!important}
    .payment-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:10px}.payment-field{display:grid;gap:5px;font-size:12px;font-weight:700;color:#475569}.payment-field input,.payment-field select{height:38px;border:1px solid #b9c6d4;border-radius:7px;padding:0 9px;background:#fff;box-sizing:border-box;width:100%}
    .payment-summary-card{margin:12px 0;padding:10px 12px;border:1px solid #dbe4ed;border-radius:9px;background:#fff;display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:13px;color:#526174}.payment-summary-card strong{color:#243447}
    .payment-history-title{font-size:13px;font-weight:800;color:#334155;margin:14px 0 8px}.payment-add{display:grid;grid-template-columns:120px 120px 1fr 1.2fr auto;gap:7px;align-items:end}.payment-add input{height:36px;border:1px solid #b9c6d4;border-radius:7px;padding:0 8px;box-sizing:border-box;width:100%}.payment-add button{height:36px!important}
    .payment-list{margin-top:10px;display:grid;gap:6px}.payment-row{display:grid;grid-template-columns:92px 110px 1fr 1.1fr auto;gap:8px;align-items:center;padding:8px 9px;border:1px solid #dbe4ed;border-radius:8px;background:#fff;font-size:12px}.payment-row a{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.payment-row .payment-remove{min-width:0!important;padding:6px 8px!important;font-size:11px!important}
    .payment-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.payment-session-note{margin-top:10px;padding:9px 11px;background:#eef6ff;border:1px solid #d4e5f7;border-radius:8px;color:#45627e;font-size:12px;line-height:1.4}
    .session-payment-field{grid-column:1/-1;padding:10px;border:1px solid #d7e2ec;border-radius:8px;background:#f8fafc;display:grid;grid-template-columns:auto 130px 1fr;gap:9px;align-items:end}.session-payment-field label{display:grid;gap:5px;font-size:12px;font-weight:700;color:#475569}.session-payment-paid{display:flex!important;align-items:center;gap:7px!important;height:36px}.session-payment-field input[type="number"],.session-payment-field input[type="url"]{height:36px;border:1px solid #b9c6d4;border-radius:7px;padding:0 8px;box-sizing:border-box;width:100%}
    .db-payment-cell{text-align:center;white-space:nowrap}.db-payment-head{width:105px;text-align:center}
    @media(max-width:760px){.payment-grid{grid-template-columns:1fr}.payment-add{grid-template-columns:1fr 1fr}.payment-add .wide{grid-column:1/-1}.payment-add button{grid-column:1/-1}.payment-row{grid-template-columns:1fr 1fr}.payment-row .wide{grid-column:1/-1}.session-payment-field{grid-template-columns:1fr}.client-payment-box{align-items:flex-start}.db-payment-head,.db-payment-cell{display:none}}
  `;
  document.head.appendChild(style);

  const dlg=document.createElement('dialog');
  dlg.className='payment-dialog';
  dlg.innerHTML=`
    <div class="payment-window">
      <div class="payment-head"><strong>ОПЛАТА КЛИЕНТА</strong><button type="button" class="payment-x">×</button></div>
      <div class="payment-grid">
        <label class="payment-field">Схема оплаты
          <select id="paymentMode">
            <option value="">— Не указано —</option>
            <option value="full">Оплата сразу</option>
            <option value="parts">Оплата частями</option>
            <option value="session">Оплата за каждую сессию</option>
          </select>
        </label>
        <label class="payment-field" id="paymentTotalField">Стоимость работы / программы
          <input id="paymentTotal" type="number" min="0" step="100" placeholder="0">
        </label>
      </div>
      <div id="paymentSummary" class="payment-summary-card"></div>
      <div id="paymentSessionHint" class="payment-session-note" hidden>Для режима «за каждую сессию» оплата отмечается непосредственно в карточке каждой сессии: оплачено / сумма / ссылка на чек.</div>
      <div id="paymentHistoryWrap">
        <div class="payment-history-title">ИСТОРИЯ ПЛАТЕЖЕЙ</div>
        <div class="payment-add">
          <input id="paymentDate" type="date">
          <input id="paymentAmount" type="number" min="0" step="100" placeholder="Сумма">
          <input id="paymentNote" class="wide" type="text" placeholder="Комментарий">
          <input id="paymentReceipt" class="wide" type="url" placeholder="Ссылка на чек">
          <button id="paymentAddBtn" type="button" class="tk-btn">+ Платёж</button>
        </div>
        <div id="paymentList" class="payment-list"></div>
      </div>
      <div class="payment-footer"><button id="paymentClose" type="button" class="tk-btn">Закрыть</button></div>
    </div>`;
  document.body.appendChild(dlg);

  const q=s=>dlg.querySelector(s);

  function renderPaymentList(c){
    const p=paymentOf(c);
    const root=q('#paymentList');
    root.innerHTML='';
    if(!p.payments.length){root.innerHTML='<div style="color:#94a3b8;font-size:12px;padding:6px 2px">Платежей пока нет.</div>';return;}
    [...p.payments].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).forEach(pay=>{
      const row=document.createElement('div');row.className='payment-row';
      const date=document.createElement('div');date.textContent=pay.date||'—';
      const amount=document.createElement('strong');amount.textContent=`${money(pay.amount)} ${CURRENCY}`;
      const note=document.createElement('div');note.className='wide';note.textContent=pay.note||'—';
      const receipt=document.createElement('div');receipt.className='wide';
      if(pay.receiptUrl){const a=document.createElement('a');a.href=pay.receiptUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Открыть чек';receipt.appendChild(a);}else receipt.textContent='—';
      const del=document.createElement('button');del.type='button';del.className='payment-remove db-delete-btn';del.textContent='Удалить';del.onclick=()=>{p.payments=p.payments.filter(x=>x.id!==pay.id);save();renderAllPaymentUi();};
      row.append(date,amount,note,receipt,del);root.appendChild(row);
    });
  }

  function renderSummary(c){
    const s=summary(c);
    q('#paymentSummary').innerHTML=`<span class="pay-chip ${s.status}">${s.label}</span><span><strong>Оплачено:</strong> ${money(s.paid)} ${CURRENCY}</span>${s.total?`<span><strong>Стоимость:</strong> ${money(s.total)} ${CURRENCY}</span><span><strong>Остаток:</strong> ${money(Math.max(0,s.total-s.paid))} ${CURRENCY}</span>`:''}${s.count?`<span><strong>Сессии:</strong> ${s.count}</span>`:''}`;
  }

  function renderDialog(){
    const c=currentClient();if(!c)return;
    const p=paymentOf(c);
    q('#paymentMode').value=p.mode||'';
    q('#paymentTotal').value=p.total||'';
    q('#paymentDate').value=todayLocal();q('#paymentAmount').value='';q('#paymentNote').value='';q('#paymentReceipt').value='';
    const sessionMode=p.mode==='session';
    q('#paymentTotalField').hidden=sessionMode;
    q('#paymentHistoryWrap').hidden=sessionMode;
    q('#paymentSessionHint').hidden=!sessionMode;
    renderSummary(c);renderPaymentList(c);
  }

  function openPayment(){const c=currentClient();if(!c)return;renderDialog();dlg.showModal();}

  q('.payment-x').onclick=()=>dlg.close();q('#paymentClose').onclick=()=>dlg.close();
  dlg.addEventListener('click',e=>{if(e.target===dlg) dlg.close();});
  q('#paymentMode').onchange=e=>{const c=currentClient();if(!c)return;paymentOf(c).mode=e.target.value;save();renderDialog();refreshPaymentBox();refreshDatabasePaymentColumn();};
  q('#paymentTotal').oninput=e=>{const c=currentClient();if(!c)return;paymentOf(c).total=num(e.target.value);save();renderSummary(c);refreshPaymentBox();refreshDatabasePaymentColumn();};
  q('#paymentAddBtn').onclick=()=>{
    const c=currentClient();if(!c)return;const p=paymentOf(c);const amount=num(q('#paymentAmount').value);if(amount<=0){q('#paymentAmount').focus();return;}
    p.payments.push({id:uidPay(),date:q('#paymentDate').value||todayLocal(),amount,note:q('#paymentNote').value.trim(),receiptUrl:q('#paymentReceipt').value.trim()});
    save();renderDialog();refreshPaymentBox();refreshDatabasePaymentColumn();
  };

  function ensurePaymentBox(){
    const card=document.querySelector('.client-card');if(!card || card.querySelector('#clientPaymentBox')) return;
    const box=document.createElement('div');box.id='clientPaymentBox';box.className='client-payment-box';
    box.innerHTML='<div class="client-payment-main"><div class="client-payment-title">ОПЛАТА</div><div class="client-payment-summary">Не указано</div></div><button type="button" class="tk-btn client-payment-btn">Оплата</button>';
    const work=card.querySelector('.client-work');if(work) work.insertAdjacentElement('beforebegin',box);else card.appendChild(box);
    box.querySelector('button').onclick=openPayment;
  }

  function refreshPaymentBox(){
    ensurePaymentBox();const c=currentClient();const box=document.querySelector('#clientPaymentBox');if(!box||!c)return;const s=summary(c);
    let text=s.label;
    if(s.count) text+=` · ${s.count} сессий`;
    else if(s.total||s.paid) text+=` · ${money(s.paid)} / ${money(s.total)} ${CURRENCY}`;
    box.querySelector('.client-payment-summary').textContent=text;
  }

  function refreshDatabasePaymentColumn(){
    const table=document.querySelector('#clientDatabaseList table');if(!table) return;
    const headRow=table.querySelector('thead tr');if(!headRow) return;
    if(!headRow.querySelector('.db-payment-head')){
      const th=document.createElement('th');th.className='db-payment-head';th.textContent='Оплата';
      const actions=headRow.querySelector('.db-col-actions')||headRow.lastElementChild;headRow.insertBefore(th,actions);
    }
    [...table.querySelectorAll('tbody tr')].forEach((tr,i)=>{
      let td=tr.querySelector('.db-payment-cell');
      if(!td){td=document.createElement('td');td.className='db-payment-cell';const actions=tr.querySelector('.db-col-actions')||tr.lastElementChild;tr.insertBefore(td,actions);}
      const s=summary(state.clients[i]);td.innerHTML=`<span class="pay-chip ${s.status}" title="${s.count?`${s.count} сессий`:s.label}">${s.count||s.label}</span>`;
    });
  }

  if(typeof window.renderClientDatabaseTable==='function' && !window.renderClientDatabaseTable.__paymentPatched){
    const old=window.renderClientDatabaseTable;
    const wrapped=function(){const r=old.apply(this,arguments);refreshDatabasePaymentColumn();return r;};
    wrapped.__paymentPatched=true;window.renderClientDatabaseTable=wrapped;
  }

  if(typeof window.renderClient==='function' && !window.renderClient.__paymentPatched){
    const old=window.renderClient;
    const wrapped=function(){const r=old.apply(this,arguments);setTimeout(refreshPaymentBox,0);return r;};
    wrapped.__paymentPatched=true;window.renderClient=wrapped;
  }

  if(typeof window.openSessionEditor==='function' && !window.openSessionEditor.__paymentPatched){
    const old=window.openSessionEditor;
    const wrapped=function(c,s,number){
      const r=old.apply(this,arguments);
      const dialogs=[...document.querySelectorAll('dialog.session-edit-dialog')];const sd=dialogs[dialogs.length-1];if(!sd)return r;
      const grid=sd.querySelector('.session-edit-grid');if(!grid||grid.querySelector('.session-payment-field'))return r;
      const sp=sessionPayment(s);const field=document.createElement('div');field.className='session-payment-field';
      field.innerHTML=`<label class="session-payment-paid"><input class="session-payment-paid-input" type="checkbox"> Оплачено</label><label>Сумма<input class="session-payment-amount" type="number" min="0" step="100"></label><label>Ссылка на чек<input class="session-payment-receipt" type="url" placeholder="https://..."></label>`;
      field.querySelector('.session-payment-paid-input').checked=!!sp.paid;field.querySelector('.session-payment-amount').value=sp.amount||'';field.querySelector('.session-payment-receipt').value=sp.receiptUrl||'';grid.appendChild(field);
      const saveBtn=sd.querySelector('.session-edit-actions .primary');
      if(saveBtn){const prev=saveBtn.onclick;saveBtn.onclick=e=>{sp.paid=field.querySelector('.session-payment-paid-input').checked;sp.amount=num(field.querySelector('.session-payment-amount').value);sp.receiptUrl=field.querySelector('.session-payment-receipt').value.trim();save();if(typeof prev==='function')prev.call(saveBtn,e);refreshPaymentBox();refreshDatabasePaymentColumn();};}
      return r;
    };
    wrapped.__paymentPatched=true;window.openSessionEditor=wrapped;
  }

  ensurePaymentBox();refreshPaymentBox();
})();
