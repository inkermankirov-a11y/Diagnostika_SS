'use strict';

(() => {
  const SYMBOLS={RUB:'₽',USD:'$',EUR:'€',KZT:'₸'};
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(num(v)).replace(/[\u00A0\u202F]/g,' ');
  const currentClient=()=>typeof client==='function'?client():null;
  const paymentWriter=()=>window.DiagnostikaPayments?.moduleAware===true?window.DiagnostikaPayments:null;
  const requestNumber=(c,r)=>window.DiagnostikaRequests?.requestNumber?.(c,r)||(c?.requests?.indexOf(r)+1||0);
  const paymentOf=(c,r)=>window.DiagnostikaPayments?.paymentOfRequest?.(c,r)||r?.payment||{};
  const symbolFor=(c,r)=>window.DiagnostikaPayments?.symbolFor?.(c,r)||SYMBOLS[paymentOf(c,r)?.currency||c?.currency||'RUB']||'₽';
  const sessionsFor=(c,r)=>(c?.sessions||[]).filter(s=>String(s?.requestId||s?.payment?.requestId||'')===String(r?.id||''));

  function rowsFor(c){
    const rows=[];
    (c?.requests||[]).forEach(r=>{
      const p=paymentOf(c,r)||{},sym=symbolFor(c,r),rn=requestNumber(c,r);

      // Обычные платежи учитываются ВСЕГДА, независимо от текущего режима запроса.
      (Array.isArray(p.payments)?p.payments:[]).forEach(pay=>{
        rows.push({
          kind:'request',request:r,pay,
          date:pay?.date||'',amount:num(pay?.amount),sym,
          title:pay?.note||`Платёж по запросу ${rn}`,
          sub:`Запрос ${rn} · ${r?.title||'Без названия'}`
        });
      });

      // В режиме оплаты по сессиям дополнительно учитываются все оплаченные сессии.
      if(p.mode==='session'){
        sessionsFor(c,r).forEach(s=>{
          const sp=s?.payment||{};
          if(sp.paid!==true)return;
          rows.push({
            kind:'session',request:r,session:s,
            date:sp.paidAt||s?.date||'',amount:num(sp.amount),sym,
            title:`Сессия · ${r?.title||'Без названия'}`,
            sub:`Запрос ${rn}`
          });
        });
      }
    });
    return rows.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  }

  function ensureEditor(){
    let dlg=document.querySelector('#allPaymentCompleteEditor');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');
    dlg.id='allPaymentCompleteEditor';
    dlg.className='payment-dialog';
    dlg.innerHTML=`<div class="payment-window" style="width:min(500px,calc(100vw - 24px))"><div class="payment-head"><strong>РЕДАКТИРОВАТЬ ПЛАТЁЖ</strong><button type="button" class="payment-x">×</button></div><div class="payment-grid" style="grid-template-columns:1fr"><label class="payment-field">Дата<input id="apcDate" type="date"></label><label class="payment-field">Сумма<input id="apcAmount" type="number" min="0" step="1"></label><label class="payment-field">Комментарий<input id="apcNote" type="text"></label></div><div class="payment-footer"><button type="button" class="tk-btn apc-cancel">Отмена</button><button type="button" class="tk-btn apc-save">Сохранить</button></div></div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('.payment-x').onclick=()=>dlg.close();
    dlg.querySelector('.apc-cancel').onclick=()=>dlg.close();
    dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
    return dlg;
  }

  function renderComplete(){
    const allDlg=document.querySelector('.all-client-payments-dialog');
    if(!allDlg?.open)return;
    const c=currentClient();if(!c)return;
    const rows=rowsFor(c),root=allDlg.querySelector('#allPaymentsList'),summary=allDlg.querySelector('#allPaymentsSummary');
    if(!root||!summary)return;

    const totals={};
    rows.forEach(x=>totals[x.sym]=(totals[x.sym]||0)+num(x.amount));
    summary.textContent=rows.length
      ?`Всего платежей: ${rows.length} · ${Object.entries(totals).map(([sym,val])=>`${money(val)} ${sym}`).join(' · ')}`
      :'Платежей пока нет';

    root.innerHTML='';
    rows.forEach(item=>{
      const row=document.createElement('div');
      row.className='all-payment-row';
      row.innerHTML=`<span>${item.date||'—'}</span><strong>${money(item.amount)} ${item.sym}</strong><div class="wide"><div>${item.title}</div><div class="all-payment-meta">${item.sub}</div></div><button type="button" class="tk-btn apx-edit">Изменить</button>`;
      row.querySelector('.apx-edit').onclick=()=>{
        if(item.kind==='session'){
          try{allDlg.close();}catch(_){}
          if(typeof openSessionEditor==='function'){
            const chronological=(c.sessions||[]).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
            openSessionEditor(c,item.session,chronological.indexOf(item.session)+1);
          }
          return;
        }

        const editor=ensureEditor();
        editor.querySelector('#apcDate').value=item.pay?.date||'';
        editor.querySelector('#apcAmount').value=num(item.pay?.amount)||'';
        editor.querySelector('#apcNote').value=item.pay?.note||'';
        editor.querySelector('.apc-save').onclick=()=>{
          const amount=num(editor.querySelector('#apcAmount').value);
          if(amount<=0){editor.querySelector('#apcAmount').focus();return;}
          const updated=paymentWriter()?.updatePayment?.(
            item.request?.id,
            item.pay?.id,
            {
              date:editor.querySelector('#apcDate').value||item.pay.date||'',
              amount,
              note:editor.querySelector('#apcNote').value.trim()
            },
            {client:c,source:'all-payments-edit'}
          );
          if(!updated)return;
          try{window.DiagnostikaPayments?.refresh?.();}catch(_){}
          editor.close();
          setTimeout(renderComplete,0);
        };
        editor.showModal();
      };
      root.appendChild(row);
    });
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#allClientPaymentsBtn'))setTimeout(renderComplete,0);
  },true);
  document.addEventListener('close',e=>{
    if(e.target?.id==='allPaymentCompleteEditor')setTimeout(renderComplete,0);
  },true);

  // Только история платежей. Логику красного флага этот модуль не вызывает и не изменяет.
  window.DiagnostikaAllPayments={render:renderComplete,rowsFor};
})();
