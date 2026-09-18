'use strict';

(() => {
  const SYMBOLS={RUB:'₽',USD:'$',EUR:'€',KZT:'₸'};
  const LABELS={RUB:'₽ RUB',USD:'$ USD',EUR:'€ EUR',KZT:'₸ KZT'};
  const uidPay=()=>crypto.randomUUID?crypto.randomUUID():'pay_'+Date.now()+'_'+Math.random().toString(16).slice(2);
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(num(v)).replace(/[\u00A0\u202F]/g,' ');
  const todayLocal=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);};
  const currentClient=()=>typeof client==='function'?client():null;
  const currentRequest=(c=currentClient())=>{
    if(!c)return null;
    return window.DiagnostikaRequests?.current?.(c)||c.requests?.find(r=>r.id===c.currentRequestId)||c.requests?.find(r=>r.id===requestId)||c.requests?.[0]||null;
  };
  const requestNumber=(c,r)=>window.DiagnostikaRequests?.requestNumber?.(c,r)||(c?.requests?.indexOf(r)+1||0);
  const paymentWriter=()=>window.DiagnostikaPayments?.moduleAware===true?window.DiagnostikaPayments:null;
  const updateRequestPayment=(c,r,changes,source)=>paymentWriter()?.updateRequest?.(r?.id,changes,{client:c,source})||null;
  const addRequestPayment=(c,r,data,source)=>paymentWriter()?.addPayment?.(r?.id,data,{client:c,source})||null;
  const updateRequestPaymentRecord=(c,r,id,changes,source)=>paymentWriter()?.updatePayment?.(r?.id,id,changes,{client:c,source})||null;
  const removeRequestPayment=(c,r,id,source)=>paymentWriter()?.removePayment?.(r?.id,id,{client:c,source})||null;
  const blankPayment=()=>({mode:'',total:0,payments:[],currency:'RUB'});
  function paymentOfRequest(c,r){
    if(!r)return blankPayment();
    const writer=paymentWriter();
    const existing=writer?.request?.(r.id,c)||(r.payment&&typeof r.payment==='object'?r.payment:null);
    if(!existing){
      const legacy=c?.payment&&typeof c.payment==='object'&&!c._legacyPaymentMigratedToRequestId
        ? JSON.parse(JSON.stringify(c.payment))
        : blankPayment();
      const created=writer?.replaceRequest?.(
        r.id,
        legacy,
        {client:c,source:'payment-legacy-request-init'}
      );
      if(created){
        if(c?.payment&&typeof c.payment==='object'&&!c._legacyPaymentMigratedToRequestId){
          window.DiagnostikaClients?.update?.(
            c.id,
            {_legacyPaymentMigratedToRequestId:r.id},
            {source:'payment-legacy-request-marker',render:false}
          );
        }
        return created;
      }
      return legacy;
    }
    const normalized={
      ...existing,
      payments:Array.isArray(existing.payments)?existing.payments:[],
      mode:existing.mode||'',
      currency:existing.currency||c?.currency||'RUB'
    };
    const needsNormalization=!Array.isArray(existing.payments)||!existing.mode||!existing.currency;
    if(needsNormalization){
      return writer?.replaceRequest?.(
        r.id,
        normalized,
        {client:c,source:'payment-request-normalize'}
      )||normalized;
    }
    return existing;
  }
  const symbolFor=(c,r)=>SYMBOLS[paymentOfRequest(c,r).currency||c?.currency||'RUB']||'₽';
  function sessionPayment(s){if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0,receiptUrl:'',note:''};return s.payment;}
  const sessionsFor=(c,r)=>(c?.sessions||[]).filter(s=>(s.requestId||s.payment?.requestId)===r?.id);

  function summary(c,r=currentRequest(c)){
    if(!c||!r)return{status:'none',label:'Не указано',paid:0,total:0};
    const p=paymentOfRequest(c,r);
    if(p.mode==='session'){
      const sessions=sessionsFor(c,r),paidSessions=sessions.filter(s=>sessionPayment(s).paid);
      const paid=paidSessions.reduce((a,s)=>a+num(sessionPayment(s).amount),0);
      const total=sessions.reduce((a,s)=>a+num(sessionPayment(s).amount),0);
      if(!sessions.length)return{status:'none',label:'Не указано',paid,total,count:'0/0'};
      if(paidSessions.length===sessions.length)return{status:'paid',label:'Оплачено',paid,total,count:`${sessions.length}/${sessions.length}`};
      return{status:'unpaid',label:'Не оплачено',paid,total,count:`${paidSessions.length}/${sessions.length}`};
    }
    const total=num(p.total),paid=p.payments.reduce((a,x)=>a+num(x.amount),0);
    if(!p.mode&&!total&&!paid)return{status:'none',label:'Не указано',paid,total};
    if(paid<=0)return{status:'unpaid',label:'Нет',paid,total};
    if(total>0&&paid>=total)return{status:'paid',label:'Оплачено',paid,total};
    return{status:'partial',label:'Частично',paid,total};
  }

  const style=document.createElement('style');
  style.textContent=`
    .client-payment-box{margin:8px 0 2px;padding:8px 10px;border:1px solid #d9e2ec;border-radius:8px;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;gap:10px}.client-payment-main{min-width:0}.client-payment-title{font-size:11px;font-weight:800;color:#334155;margin-bottom:3px}.client-payment-summary{font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.client-payment-btn{flex:0 0 auto;min-height:32px!important;padding:6px 11px!important}
    .pay-chip{display:inline-flex;align-items:center;justify-content:center;min-width:72px;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:800;border:1px solid transparent}.pay-chip.paid{background:#e9f8ef;color:#247a49;border-color:#bfe7ce}.pay-chip.partial{background:#fff5d9;color:#916a00;border-color:#eedb9b}.pay-chip.unpaid{background:#fdecec;color:#b33a3a;border-color:#f1c3c3}.pay-chip.none{background:#f1f5f9;color:#64748b;border-color:#d8e0e8}
    .payment-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}.payment-dialog::backdrop{background:rgba(15,23,42,.44);backdrop-filter:blur(5px)}.payment-window{width:min(780px,calc(100vw - 24px));max-height:88vh;overflow:auto;background:#f8fafc;border:1px solid #d5dee8;border-radius:14px;box-shadow:0 24px 65px rgba(15,23,42,.28);padding:18px;box-sizing:border-box}.payment-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:5px}.payment-head strong{font-size:19px;color:#26384b}.payment-sub{font-size:12px;color:#64748b;margin:0 0 14px}.payment-x{width:36px;height:36px;border-radius:8px!important;padding:0!important}
    .payment-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:10px}.payment-field{display:grid;gap:5px;font-size:12px;font-weight:700;color:#475569}.payment-field input,.payment-field select{height:38px;border:1px solid #b9c6d4;border-radius:7px;padding:0 9px;background:#fff;box-sizing:border-box;width:100%}.payment-summary-card{margin:12px 0;padding:10px 12px;border:1px solid #dbe4ed;border-radius:9px;background:#fff;display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:13px;color:#526174}.payment-summary-card strong{color:#243447}
    .payment-history-title{font-size:13px;font-weight:800;color:#334155;margin:14px 0 8px}.payment-add{display:grid;grid-template-columns:120px 120px 1fr 1fr auto;gap:7px;align-items:end}.payment-add input{height:36px;border:1px solid #b9c6d4;border-radius:7px;padding:0 8px;box-sizing:border-box;width:100%}.payment-add button{height:36px!important}.payment-list{margin-top:10px;display:grid;gap:6px}.payment-row{display:grid;grid-template-columns:100px 110px 1fr 1fr auto;gap:8px;align-items:center;padding:8px 9px;border:1px solid #dbe4ed;border-radius:8px;background:#fff;font-size:12px}.payment-row input{height:32px;border:1px solid #cbd5e1;border-radius:6px;padding:0 7px;box-sizing:border-box;width:100%;font-size:12px}.payment-row-actions{display:flex;gap:5px}.payment-row-actions button{min-height:30px!important;padding:5px 8px!important;font-size:11px!important}.payment-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.payment-session-note{margin-top:10px;padding:9px 11px;background:#eef6ff;border:1px solid #d4e5f7;border-radius:8px;color:#45627e;font-size:12px;line-height:1.4}
    .all-payments-list{display:grid;gap:7px;margin-top:12px}.all-payment-row{display:grid;grid-template-columns:105px 120px 1fr 90px;gap:8px;align-items:center;padding:9px;border:1px solid #dbe4ed;border-radius:8px;background:#fff;font-size:12px}.all-payment-meta{color:#64748b;font-size:11px;margin-top:2px}.all-payments-summary{padding:11px 12px;border:1px solid #c9e1d8;border-radius:9px;background:#eef7f4;font-weight:800;color:#176c46;margin-top:10px}
    .session-payment-field{grid-column:1/-1;padding:10px;border:1px solid #d7e2ec;border-radius:8px;background:#f8fafc;display:grid;grid-template-columns:auto 130px 1fr;gap:9px;align-items:end}.session-payment-field label{display:grid;gap:5px;font-size:12px;font-weight:700;color:#475569}.session-payment-paid{display:flex!important;align-items:center;gap:7px!important;height:36px}.session-payment-field input[type="number"],.session-payment-field input[type="url"]{height:36px;border:1px solid #b9c6d4;border-radius:7px;padding:0 8px;box-sizing:border-box;width:100%}.db-payment-cell{text-align:center;white-space:nowrap}.db-payment-head{width:105px;text-align:center}
    @media(max-width:760px){.payment-grid{grid-template-columns:1fr}.payment-add{grid-template-columns:1fr 1fr}.payment-add .wide{grid-column:1/-1}.payment-add button{grid-column:1/-1}.payment-row,.all-payment-row{grid-template-columns:1fr 1fr}.payment-row .wide,.all-payment-row .wide{grid-column:1/-1}.session-payment-field{grid-template-columns:1fr}.client-payment-box{align-items:flex-start}.db-payment-head,.db-payment-cell{display:none}}
  `;
  document.head.appendChild(style);

  const dlg=document.createElement('dialog');
  dlg.className='payment-dialog';
  dlg.innerHTML=`<div class="payment-window">
    <div class="payment-head"><strong>ОПЛАТА ПО ЗАПРОСУ</strong><button type="button" class="payment-x">×</button></div>
    <div id="paymentRequestSub" class="payment-sub"></div>
    <div class="payment-grid">
      <label class="payment-field">Схема оплаты<select id="paymentMode"><option value="">— Не указано —</option><option value="full">Оплата сразу</option><option value="parts">Оплата частями</option><option value="session">Оплата за каждую сессию</option></select></label>
      <label class="payment-field" id="paymentTotalField">Стоимость цикла работы<input id="paymentTotal" type="number" min="0" step="100" placeholder="0"></label>
      <label class="payment-field">Валюта<select id="paymentCurrency"><option value="RUB">₽ RUB</option><option value="USD">$ USD</option><option value="EUR">€ EUR</option><option value="KZT">₸ KZT</option></select></label>
    </div>
    <div id="paymentSummary" class="payment-summary-card"></div>
    <div id="paymentSessionHint" class="payment-session-note" hidden>В этом режиме оплата отмечается только в каждой сессии, относящейся к текущему запросу.</div>
    <div id="paymentHistoryWrap"><div class="payment-history-title">ИСТОРИЯ ПЛАТЕЖЕЙ</div><div class="payment-add"><input id="paymentDate" type="date"><input id="paymentAmount" type="number" min="0" step="1" placeholder="Сумма"><input id="paymentNote" class="wide" type="text" placeholder="Комментарий"><input id="paymentReceipt" class="wide" type="url" placeholder="Ссылка на чек"><button id="paymentAddBtn" type="button" class="tk-btn">+ Платёж</button></div><div id="paymentList" class="payment-list"></div></div>
    <div class="payment-footer"><button id="allClientPaymentsBtn" type="button" class="tk-btn">Все платежи клиента</button><button id="paymentClose" type="button" class="tk-btn">Закрыть</button></div>
  </div>`;
  document.body.appendChild(dlg);
  const q=s=>dlg.querySelector(s);

  const allDlg=document.createElement('dialog');
  allDlg.className='payment-dialog all-client-payments-dialog';
  allDlg.innerHTML=`<div class="payment-window"><div class="payment-head"><strong>ВСЕ ПЛАТЕЖИ КЛИЕНТА</strong><button type="button" class="payment-x">×</button></div><div id="allPaymentsSummary" class="all-payments-summary"></div><div id="allPaymentsList" class="all-payments-list"></div><div class="payment-footer"><button type="button" class="tk-btn all-payments-close">Закрыть</button></div></div>`;
  document.body.appendChild(allDlg);

  function renderSummary(c,r){
    const s=summary(c,r),sym=symbolFor(c,r),root=q('#paymentSummary');
    const html=`<span class="pay-chip ${s.status}">${s.label}</span><span><strong>Оплачено:</strong> ${money(s.paid)} ${sym}</span>${s.total?`<span><strong>Стоимость:</strong> ${money(s.total)} ${sym}</span><span><strong>Остаток:</strong> ${money(Math.max(0,s.total-s.paid))} ${sym}</span>`:''}${s.count?`<span><strong>Сессии:</strong> ${s.count}</span>`:''}`;
    if(root.innerHTML!==html)root.innerHTML=html;
  }

  function renderPaymentList(c,r){
    const p=paymentOfRequest(c,r),root=q('#paymentList'),sym=symbolFor(c,r);
    root.innerHTML='';
    if(!p.payments.length){root.innerHTML='<div style="color:#94a3b8;font-size:12px;padding:6px 2px">Платежей по этому запросу пока нет.</div>';return;}
    [...p.payments].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).forEach(pay=>{
      const row=document.createElement('div');row.className='payment-row';
      row.innerHTML=`<input class="pr-date" type="date"><input class="pr-amount" type="number" min="0" step="1"><input class="pr-note wide" type="text"><input class="pr-receipt wide" type="url" placeholder="Ссылка на чек"><div class="payment-row-actions"><button type="button" class="tk-btn pr-save">Сохранить</button><button type="button" class="db-delete-btn pr-delete">Удалить</button></div>`;
      row.querySelector('.pr-date').value=pay.date||'';
      row.querySelector('.pr-amount').value=num(pay.amount)||'';
      row.querySelector('.pr-note').value=pay.note||'';
      row.querySelector('.pr-receipt').value=pay.receiptUrl||'';
      row.querySelector('.pr-amount').title=`Валюта: ${sym}`;
      row.querySelector('.pr-save').onclick=()=>{
        const amount=num(row.querySelector('.pr-amount').value);if(amount<=0){row.querySelector('.pr-amount').focus();return;}
        const updated=updateRequestPaymentRecord(c,r,pay.id,{
          date:row.querySelector('.pr-date').value||todayLocal(),
          amount,
          note:row.querySelector('.pr-note').value.trim(),
          receiptUrl:row.querySelector('.pr-receipt').value.trim()
        },'payment-dialog-edit');
        if(!updated)return;
        renderSummary(c,r);refreshDatabasePaymentColumn();renderAllPayments();window.DiagnostikaHomeDashboard?.refresh?.();
      };
      row.querySelector('.pr-delete').onclick=()=>{if(!removeRequestPayment(c,r,pay.id,'payment-dialog-delete'))return;renderPaymentList(c,r);renderSummary(c,r);refreshDatabasePaymentColumn();renderAllPayments();window.DiagnostikaHomeDashboard?.refresh?.();};
      root.appendChild(row);
    });
  }

  function renderDialog({resetEntry=false}={}){
    const c=currentClient(),r=currentRequest(c);if(!c||!r){if(dlg.open)dlg.close();return;}
    const p=paymentOfRequest(c,r),n=requestNumber(c,r);
    q('#paymentRequestSub').textContent=`Запрос ${n}: ${r.title||'Без названия'}`;
    q('#paymentMode').value=p.mode||'';
    q('#paymentTotal').value=p.total||'';
    q('#paymentCurrency').value=p.currency||c.currency||'RUB';
    const sessionMode=p.mode==='session';q('#paymentTotalField').hidden=sessionMode;q('#paymentHistoryWrap').hidden=sessionMode;q('#paymentSessionHint').hidden=!sessionMode;
    if(resetEntry){q('#paymentDate').value=todayLocal();q('#paymentAmount').value='';q('#paymentNote').value='';q('#paymentReceipt').value='';}
    renderSummary(c,r);renderPaymentList(c,r);
  }

  function openPayment(){const c=currentClient(),r=currentRequest(c);if(!c||!r){window.AppDialog?.alert?.('Сначала создай или возобнови запрос.','Нет текущего запроса');return;}renderDialog({resetEntry:true});dlg.showModal();}
  q('.payment-x').onclick=()=>dlg.close();q('#paymentClose').onclick=()=>dlg.close();dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
  q('#paymentMode').onchange=e=>{const c=currentClient(),r=currentRequest(c);if(!c||!r)return;if(!updateRequestPayment(c,r,{mode:e.target.value},'payment-dialog-mode'))return;renderDialog();refreshDatabasePaymentColumn();window.DiagnostikaHomeDashboard?.refresh?.();};
  q('#paymentCurrency').onchange=e=>{const c=currentClient(),r=currentRequest(c);if(!c||!r)return;const code=e.target.value;if(!updateRequestPayment(c,r,{currency:code,currencyManual:true},'payment-dialog-currency'))return;window.DiagnostikaClients?.update?.(c.id,{currency:code,currencyManual:true},{source:'payment-dialog-currency-client',render:false});renderSummary(c,r);renderPaymentList(c,r);renderAllPayments();window.DiagnostikaHomeDashboard?.refresh?.();};
  q('#paymentTotal').oninput=e=>{const c=currentClient(),r=currentRequest(c);if(!c||!r)return;if(!updateRequestPayment(c,r,{total:num(e.target.value)},'payment-dialog-total'))return;renderSummary(c,r);refreshDatabasePaymentColumn();window.DiagnostikaHomeDashboard?.refresh?.();};
  q('#paymentAddBtn').onclick=()=>{const c=currentClient(),r=currentRequest(c);if(!c||!r)return;const amount=num(q('#paymentAmount').value);if(amount<=0){q('#paymentAmount').focus();return;}const added=addRequestPayment(c,r,{id:uidPay(),date:q('#paymentDate').value||todayLocal(),amount,note:q('#paymentNote').value.trim(),receiptUrl:q('#paymentReceipt').value.trim()},'payment-dialog-add');if(!added)return;q('#paymentAmount').value='';q('#paymentNote').value='';q('#paymentReceipt').value='';renderPaymentList(c,r);renderSummary(c,r);refreshDatabasePaymentColumn();window.DiagnostikaHomeDashboard?.refresh?.();};

  function allRows(c){
    const rows=[];
    (c?.requests||[]).forEach(r=>{
      const p=paymentOfRequest(c,r),sym=symbolFor(c,r),rn=requestNumber(c,r);
      if(p.mode==='session'){
        sessionsFor(c,r).forEach(s=>{const sp=sessionPayment(s);if(sp.paid)rows.push({date:sp.paidAt||s.date||'',amount:num(sp.amount),sym,title:`Сессия · ${r.title||'Без названия'}`,sub:`Запрос ${rn}`,session:s,request:r});});
      }else p.payments.forEach(pay=>rows.push({date:pay.date||'',amount:num(pay.amount),sym,title:pay.note||`Платёж по запросу ${rn}`,sub:r.title||'Без названия',pay,request:r}));
    });
    return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  }
  function renderAllPayments(){
    if(!allDlg.open&&allDlg.dataset.forceRender!=='1')return;
    const c=currentClient();if(!c)return;
    const rows=allRows(c),root=allDlg.querySelector('#allPaymentsList'),summaryEl=allDlg.querySelector('#allPaymentsSummary');
    root.innerHTML='';const totals={};rows.forEach(x=>totals[x.sym]=(totals[x.sym]||0)+x.amount);summaryEl.textContent=rows.length?`Всего платежей: ${rows.length} · ${Object.entries(totals).map(([s,v])=>`${money(v)} ${s}`).join(' · ')}`:'Платежей пока нет';
    rows.forEach(x=>{const row=document.createElement('div');row.className='all-payment-row';row.innerHTML=`<span>${x.date||'—'}</span><strong>${money(x.amount)} ${x.sym}</strong><div class="wide"><div>${x.title}</div><div class="all-payment-meta">${x.sub}</div></div><button type="button" class="tk-btn ap-edit">Изменить</button>`;row.querySelector('.ap-edit').onclick=()=>{if(x.pay){dlg.showModal?.();dlg.close?.();const req=x.request;requestId=req.id;renderDialog();dlg.showModal();setTimeout(()=>{const target=[...q('#paymentList').querySelectorAll('.payment-row')].find(rw=>num(rw.querySelector('.pr-amount')?.value)===num(x.pay.amount)&&rw.querySelector('.pr-date')?.value===x.pay.date);target?.querySelector('.pr-note')?.focus();},0);}else if(x.session&&typeof openSessionEditor==='function'){allDlg.close();const cnow=currentClient();const chronological=(cnow.sessions||[]).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));openSessionEditor(cnow,x.session,chronological.indexOf(x.session)+1);}};root.appendChild(row);});
  }
  q('#allClientPaymentsBtn').onclick=()=>{allDlg.dataset.forceRender='1';renderAllPayments();delete allDlg.dataset.forceRender;allDlg.showModal();};
  allDlg.querySelector('.payment-x').onclick=()=>allDlg.close();allDlg.querySelector('.all-payments-close').onclick=()=>allDlg.close();allDlg.addEventListener('click',e=>{if(e.target===allDlg)allDlg.close();});

  function refreshDatabasePaymentColumn(){const table=document.querySelector('#clientDatabaseList table');if(!table)return;const headRow=table.querySelector('thead tr');if(!headRow)return;if(!headRow.querySelector('.db-payment-head')){const th=document.createElement('th');th.className='db-payment-head';th.textContent='Оплата';const actions=headRow.querySelector('.db-col-actions')||headRow.lastElementChild;headRow.insertBefore(th,actions);}[...table.querySelectorAll('tbody tr')].forEach((tr,i)=>{const c=state.clients[i];if(!c)return;let cell=tr.querySelector('.db-payment-cell');if(!cell){cell=document.createElement('td');cell.className='db-payment-cell';const actions=tr.querySelector('.db-col-actions')||tr.lastElementChild;tr.insertBefore(cell,actions);}const r=currentRequest(c),s=summary(c,r);cell.innerHTML='';const chip=document.createElement('span');chip.className=`pay-chip ${s.status}`;chip.textContent=s.label;chip.title=r?`Запрос ${requestNumber(c,r)}: ${r.title||''}`:'Нет текущего запроса';cell.appendChild(chip);});}

  const previousOpenSessionEditor=window.openSessionEditor;
  if(typeof previousOpenSessionEditor==='function')window.openSessionEditor=function(c,s,number){previousOpenSessionEditor(c,s,number);const r=c?.requests?.find(x=>x.id===(s.requestId||s.payment?.requestId));if(!r||paymentOfRequest(c,r).mode!=='session')return;const dialogs=[...document.querySelectorAll('dialog.session-edit-dialog')],sd=dialogs[dialogs.length-1],grid=sd?.querySelector('.session-edit-grid');if(!sd||!grid||grid.querySelector('.session-payment-field'))return;const p=sessionPayment(s),field=document.createElement('div');field.className='session-payment-field';field.innerHTML='<label class="session-payment-paid"><input type="checkbox" class="sp-paid"> Оплачено</label><label>Сумма<input type="number" class="sp-amount" min="0" step="1"></label><label>Ссылка на чек<input type="url" class="sp-receipt" placeholder="https://..."></label>';field.querySelector('.sp-paid').checked=!!p.paid;field.querySelector('.sp-amount').value=p.amount||'';field.querySelector('.sp-receipt').value=p.receiptUrl||'';grid.appendChild(field);const saveBtn=sd.querySelector('.session-edit-actions .primary');if(saveBtn){const old=saveBtn.onclick;saveBtn.onclick=e=>{p.paid=field.querySelector('.sp-paid').checked;p.amount=num(field.querySelector('.sp-amount').value);p.receiptUrl=field.querySelector('.sp-receipt').value.trim();p.requestId=r.id;if(p.paid&&!p.paidAt)p.paidAt=todayLocal();if(!p.paid)delete p.paidAt;save();if(typeof old==='function')old.call(saveBtn,e);refresh();window.DiagnostikaHomeDashboard?.refresh?.();};}};

  const oldRenderClient=window.renderClient;if(typeof oldRenderClient==='function')window.renderClient=function(){const v=oldRenderClient.apply(this,arguments);setTimeout(refresh,0);return v;};
  if(typeof window.renderClientDatabaseTable==='function'){const oldDb=window.renderClientDatabaseTable;window.renderClientDatabaseTable=function(){const v=oldDb.apply(this,arguments);setTimeout(refreshDatabasePaymentColumn,0);return v;};}
  function refresh(){refreshDatabasePaymentColumn();if(dlg.open){const c=currentClient(),r=currentRequest(c);if(c&&r){renderSummary(c,r);renderPaymentList(c,r);}}if(allDlg.open)renderAllPayments();}
  window.DiagnostikaPayments={refresh,summary,paymentOfRequest,open:openPayment,symbolFor};
  refresh();
})();