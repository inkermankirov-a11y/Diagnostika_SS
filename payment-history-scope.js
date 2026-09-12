'use strict';

(() => {
  const currentClient=()=>typeof client==='function'?client():null;
  const fmtDate=v=>{if(!v)return '—';const p=String(v).slice(0,10).split('-');return p.length===3?`${p[2]}.${p[1]}.${p[0]}`:String(v);};
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v)||0).replace(/[\u00A0\u202F]/g,' ');
  const symbolMap={RUB:'₽',USD:'$',EUR:'€',KZT:'₸'};
  const paymentOf=r=>{if(!r.payment||typeof r.payment!=='object')r.payment={mode:'',total:0,payments:[]};if(!Array.isArray(r.payment.payments))r.payment.payments=[];return r.payment;};
  const sessionPay=s=>{if(!s.payment||typeof s.payment!=='object')s.payment={paid:false,amount:0};return s.payment;};
  const requestNumber=(c,r)=>{const i=(c?.requests||[]).findIndex(x=>x.id===r?.id);return i>=0?i+1:'—';};
  const requestById=(c,id)=>(c?.requests||[]).find(r=>r.id===id)||null;
  const currencySymbol=(c,r)=>symbolMap[paymentOf(r||{}).currency||c?.currency||'RUB']||'₽';
  function requestFromDialog(c,dlg){
    const text=dlg?.querySelector('#paymentRequestSub')?.textContent||'';
    const m=text.match(/Запрос\s+(\d+)/i);
    if(m&&c?.requests?.[Number(m[1])-1])return c.requests[Number(m[1])-1];
    return window.DiagnostikaRequests?.current?.(c)||c?.requests?.find(r=>r.id===c?.currentRequestId)||null;
  }
  function globalSessionNumber(c,target){
    const arr=(c?.sessions||[]).map((s,i)=>({s,i,t:new Date(s.date||s.createdAt||0).getTime()||i})).sort((a,b)=>a.t-b.t||a.i-b.i);
    const i=arr.findIndex(x=>x.s===target||x.s.id===target?.id);return i>=0?i+1:'—';
  }
  function linkedSession(c,pay){return pay?.sessionId?(c?.sessions||[]).find(s=>s.id===pay.sessionId)||null:null;}
  function syncLinkedInstallment(c,r,pay){
    if(!c||!r||!pay?.sessionId)return;
    const s=linkedSession(c,pay);if(!s)return;
    const sp=sessionPay(s),amount=Math.max(0,Number(pay.amount)||0);
    s.requestId=r.id;sp.requestId=r.id;sp.amount=amount;sp.manualAmount=true;sp.paid=amount>0;
    sp.paidAt=pay.date||sp.paidAt||s.date||'';sp.sessionDate=s.date||sp.sessionDate||pay.date||'';
    if(amount<=0){delete sp.paidAt;delete sp.sessionDate;}
  }

  const style=document.createElement('style');
  style.textContent=`
    .all-client-payments-summary{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 14px;background:#eef7f4;border:1px solid #c9e1d8;border-radius:10px;margin:10px 0;color:#334155}
    .all-client-payments-summary .label{font-size:12px;font-weight:700}.all-client-payments-summary .value{font-size:18px;font-weight:900;color:#176c46;text-align:right}
    .all-client-payments-dialog .session-payment-ledger-row{grid-template-columns:95px 1fr 120px 92px}.all-payment-edit{min-height:30px!important;padding:5px 9px!important;font-size:11px!important}
    .payment-edit-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}.payment-edit-dialog::backdrop{background:rgba(15,23,42,.44);backdrop-filter:blur(5px)}
    .payment-edit-card{width:min(470px,calc(100vw - 24px));background:#f8fafc;border:1px solid #d5dee8;border-radius:14px;box-shadow:0 24px 65px rgba(15,23,42,.28);padding:18px;box-sizing:border-box}
    .payment-edit-card h3{margin:0 0 14px;color:#26384b}.payment-edit-fields{display:grid;gap:11px}.payment-edit-fields label{display:grid;gap:5px;font-size:12px;font-weight:700;color:#475569}.payment-edit-fields input{height:38px;border:1px solid #b9c6d4;border-radius:7px;padding:0 9px;background:#fff;box-sizing:border-box;width:100%}
    .payment-edit-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.payment-edit-delete{margin-right:auto!important;background:#fee2e2!important;color:#991b1b!important;border-color:#fecaca!important}
    @media(max-width:640px){.all-client-payments-summary{align-items:flex-start;flex-direction:column;gap:5px}.all-client-payments-summary .value{text-align:left}.all-client-payments-dialog .session-payment-ledger-row{grid-template-columns:88px 1fr}.all-client-payments-dialog .session-payment-ledger-row strong,.all-client-payments-dialog .session-payment-ledger-row .all-payment-edit{grid-column:2;text-align:left}}
  `;
  document.head.appendChild(style);

  function renderCurrentSessionHistory(){
    const dlg=document.querySelector('.payment-dialog:not(.all-client-payments-dialog)');if(!dlg?.open)return;
    const mode=dlg.querySelector('#paymentMode')?.value||'';const ledger=dlg.querySelector('#sessionPaymentLedger');
    if(mode!=='session'){if(ledger)ledger.hidden=true;return;}
    const c=currentClient(),r=requestFromDialog(c,dlg);if(!c||!r||!ledger)return;
    ledger.hidden=false;ledger.innerHTML='<div class="session-payment-ledger-title">ИСТОРИЯ ПЛАТЕЖЕЙ</div>';
    const paid=(c.sessions||[]).filter(s=>sessionPay(s).paid&&(sessionPay(s).requestId===r.id||s.requestId===r.id));
    if(!paid.length){ledger.insertAdjacentHTML('beforeend','<div class="session-payment-ledger-empty">По этому запросу оплаченных сессий пока нет.</div>');return;}
    paid.sort((a,b)=>String(sessionPay(a).paidAt||a.date||'').localeCompare(String(sessionPay(b).paidAt||b.date||''))).forEach(s=>{
      const sp=sessionPay(s),amount=Number(sp.amount)||0,sym=currencySymbol(c,r),num=globalSessionNumber(c,s),row=document.createElement('div');row.className='session-payment-ledger-row';
      row.innerHTML=`<span>${fmtDate(sp.paidAt||s.date)}</span><span class="ok">✓ Сессия №${num} от ${fmtDate(sp.sessionDate||s.date)}</span><strong>${money(amount)} ${sym}</strong>`;ledger.appendChild(row);
    });
  }
  function renameRequestHistory(){const dlg=document.querySelector('.payment-dialog:not(.all-client-payments-dialog)');if(!dlg?.open)return;const title=dlg.querySelector('.payment-history-title');if(title)title.textContent='ИСТОРИЯ ПЛАТЕЖЕЙ';}

  const allDlg=document.createElement('dialog');allDlg.className='payment-dialog all-client-payments-dialog';
  allDlg.innerHTML='<div class="payment-window"><div class="payment-head"><strong>ВСЕ ПЛАТЕЖИ КЛИЕНТА</strong><button type="button" class="payment-x">×</button></div><div id="allClientPaymentsList" class="session-payment-ledger"></div><div class="payment-footer"><button type="button" class="tk-btn all-payments-close">Закрыть</button></div></div>';
  document.body.appendChild(allDlg);allDlg.querySelector('.payment-x').onclick=()=>allDlg.close();allDlg.querySelector('.all-payments-close').onclick=()=>allDlg.close();allDlg.addEventListener('click',e=>{if(e.target===allDlg)allDlg.close();});

  function openEditor(item){
    const c=currentClient();if(!c||!item)return;
    const dlg=document.createElement('dialog');dlg.className='payment-edit-dialog';
    dlg.innerHTML=`<div class="payment-edit-card"><h3>Редактировать платёж</h3><div class="payment-edit-fields"><label>Дата<input class="pe-date" type="date"></label><label>Сумма<input class="pe-amount" type="number" min="0" step="100"></label><label>Комментарий<input class="pe-note" type="text"></label></div><div class="payment-edit-actions"><button type="button" class="tk-btn payment-edit-delete">Удалить</button><button type="button" class="tk-btn pe-cancel">Отмена</button><button type="button" class="tk-btn pe-save">Сохранить</button></div></div>`;
    document.body.appendChild(dlg);const date=dlg.querySelector('.pe-date'),amount=dlg.querySelector('.pe-amount'),note=dlg.querySelector('.pe-note');date.value=String(item.date||'').slice(0,10);amount.value=Number(item.amount)||0;note.value=item.note||'';
    const close=()=>{try{dlg.close();}catch(_){}dlg.remove();};dlg.querySelector('.pe-cancel').onclick=close;dlg.addEventListener('click',e=>{if(e.target===dlg)close();});
    dlg.querySelector('.pe-save').onclick=()=>{
      const value=Math.max(0,Number(amount.value)||0),d=date.value||item.date||'',n=note.value.trim();
      if(item.kind==='request'){
        item.pay.date=d;item.pay.amount=value;item.pay.note=n;syncLinkedInstallment(c,item.request,item.pay);
      }else{
        const sp=sessionPay(item.session);sp.paid=value>0;sp.amount=value;sp.manualAmount=true;sp.paidAt=d||sp.paidAt||item.session.date||'';if(n)sp.note=n;if(value<=0){delete sp.paidAt;delete sp.sessionDate;}
      }
      if(typeof save==='function')save();close();renderAllPayments();try{window.DiagnostikaPayments?.refresh?.();}catch(_){}try{window.DiagnostikaSessionPayments?.refresh?.();}catch(_){};
    };
    dlg.querySelector('.payment-edit-delete').onclick=()=>{
      if(item.kind==='request'){
        item.request.payment.payments=item.request.payment.payments.filter(x=>x!==item.pay);
        if(item.pay.sessionId){const s=linkedSession(c,item.pay);if(s){const sp=sessionPay(s);sp.paid=false;sp.amount=0;sp.manualAmount=false;delete sp.paidAt;delete sp.sessionDate;}}
      }else{const sp=sessionPay(item.session);sp.paid=false;sp.amount=0;sp.manualAmount=false;delete sp.paidAt;delete sp.sessionDate;}
      if(typeof save==='function')save();close();renderAllPayments();try{window.DiagnostikaPayments?.refresh?.();}catch(_){}try{window.DiagnostikaSessionPayments?.refresh?.();}catch(_){};
    };
    dlg.showModal();
  }

  function renderAllPayments(){
    const c=currentClient(),root=allDlg.querySelector('#allClientPaymentsList');if(!c)return;const rows=[],linkedSessionIds=new Set();
    (c.requests||[]).forEach(r=>{const p=paymentOf(r),rn=requestNumber(c,r),sym=currencySymbol(c,r);(p.payments||[]).forEach(pay=>{if(pay.sessionId)linkedSessionIds.add(pay.sessionId);const s=linkedSession(c,pay),sn=s?globalSessionNumber(c,s):null;rows.push({kind:'request',request:r,pay,date:pay.date||'',sort:pay.date||'',desc:s?`Сессия №${sn} от ${fmtDate(s.date)}`:`Запрос ${rn}: ${r.title||'Без названия'}`,sub:s?`Запрос ${rn}: ${r.title||'Без названия'}`:(pay.note||'Платёж по запросу'),note:pay.note||'',amount:Number(pay.amount)||0,sym});});});
    (c.sessions||[]).forEach(s=>{const sp=sessionPay(s);if(!sp.paid||linkedSessionIds.has(s.id))return;const r=requestById(c,sp.requestId||s.requestId),rn=r?requestNumber(c,r):'—',sym=currencySymbol(c,r),sn=globalSessionNumber(c,s);rows.push({kind:'session',session:s,date:sp.paidAt||s.date||'',sort:sp.paidAt||s.date||'',desc:`Сессия №${sn} от ${fmtDate(sp.sessionDate||s.date)}`,sub:r?`Запрос ${rn}: ${r.title||'Без названия'}`:'Запрос не указан',note:sp.note||'',amount:Number(sp.amount)||0,sym});});
    rows.sort((a,b)=>String(b.sort).localeCompare(String(a.sort)));root.innerHTML='<div class="session-payment-ledger-title">ИСТОРИЯ ПЛАТЕЖЕЙ — ВСЕ ЗАПРОСЫ</div>';
    if(!rows.length){root.insertAdjacentHTML('beforeend','<div class="session-payment-ledger-empty">Платежей у клиента пока нет.</div>');return;}
    const totals={};rows.forEach(x=>{totals[x.sym]=(totals[x.sym]||0)+Number(x.amount||0);});const totalText=Object.entries(totals).map(([sym,sum])=>`${money(sum)} ${sym}`).join(' · ');
    root.insertAdjacentHTML('beforeend',`<div class="all-client-payments-summary"><span class="label">Всего платежей: ${rows.length}</span><span class="value">Общая сумма: ${totalText}</span></div>`);
    rows.forEach(x=>{const row=document.createElement('div');row.className='session-payment-ledger-row';row.innerHTML=`<span>${fmtDate(x.date)}</span><span class="ok">${x.desc}<span class="request-note">${x.sub}</span></span><strong>${money(x.amount)} ${x.sym}</strong><button type="button" class="tk-btn all-payment-edit">Изменить</button>`;row.querySelector('.all-payment-edit').onclick=()=>openEditor(x);root.appendChild(row);});
  }

  function ensureAllButton(){const dlg=document.querySelector('.payment-dialog:not(.all-client-payments-dialog)');if(!dlg)return;const footer=dlg.querySelector('.payment-footer');if(!footer||footer.querySelector('#allClientPaymentsBtn'))return;const btn=document.createElement('button');btn.type='button';btn.id='allClientPaymentsBtn';btn.className='tk-btn';btn.textContent='Все платежи клиента';footer.insertBefore(btn,footer.firstChild);btn.addEventListener('click',()=>{renderAllPayments();allDlg.showModal();});}
  function refresh(){ensureAllButton();renameRequestHistory();renderCurrentSessionHistory();if(allDlg.open)renderAllPayments();}
  const mo=new MutationObserver(()=>setTimeout(refresh,0));mo.observe(document.body,{childList:true,subtree:true});document.addEventListener('input',e=>{if(e.target.closest?.('.payment-dialog'))setTimeout(refresh,0);},true);document.addEventListener('change',e=>{if(e.target.closest?.('.payment-dialog'))setTimeout(refresh,0);},true);document.addEventListener('click',e=>{if(e.target.closest?.('.session-editor-payment-state,#paymentAddBtn,#paymentSaveSettings'))setTimeout(refresh,0);},true);setInterval(()=>{const dlg=document.querySelector('.payment-dialog:not(.all-client-payments-dialog)');if(dlg?.open)refresh();},500);setTimeout(refresh,0);
})();