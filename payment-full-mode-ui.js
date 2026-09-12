'use strict';
(() => {
  const n=v=>Number(String(v||'').replace(/\s/g,'').replace(',','.'))||0;
  const fmt=v=>String(v||'').replace(/\s/g,'').replace(/\B(?=(\d{3})+(?!\d))/g,' ');
  const sync=()=>{
    const d=document.querySelector('dialog.payment-dialog:not(.all-client-payments-dialog)');
    if(!d)return;
    const mode=d.querySelector('#paymentMode')?.value;
    const input=d.querySelector('#paymentTotal');
    const box=d.querySelector('#paymentSummary');
    if(!input||!box||mode!=='full')return;
    try{input.type='text';}catch(_){}
    input.inputMode='decimal';
    if(document.activeElement!==input) input.value=fmt(input.value);
    const total=n(input.value);
    if(total<=0){box.hidden=true;box.style.display='none';return;}
    box.hidden=false;box.style.display='';
    const paidEl=[...box.querySelectorAll('span')].find(x=>x.textContent.includes('Оплачено:'));
    const paid=n((paidEl?.textContent.match(/Оплачено:\s*([\d\s.,]+)/)||[])[1]);
    const chip=box.querySelector('.pay-chip');
    if(chip){
      const done=paid>=total;
      chip.textContent=done?'Оплачено':'Не оплачено';
      chip.className='pay-chip '+(done?'paid':'unpaid');
    }
  };
  document.addEventListener('input',e=>{
    if(!e.target.matches?.('#paymentTotal'))return;
    const raw=e.target.value.replace(/\s/g,'');
    e.target.value=fmt(raw);
    setTimeout(()=>{sync();window.DiagnostikaClientPaymentFlags?.refresh?.();},0);
  });
  document.addEventListener('change',e=>{if(e.target.closest?.('.payment-dialog'))setTimeout(()=>{sync();window.DiagnostikaClientPaymentFlags?.refresh?.();},0);});
  document.addEventListener('click',e=>{if(e.target.closest?.('.payment-dialog,.client-payment-btn,.hd-payment-btn'))setTimeout(()=>{sync();window.DiagnostikaClientPaymentFlags?.refresh?.();},0);},true);
  new MutationObserver(()=>requestAnimationFrame(sync)).observe(document.body,{childList:true,subtree:true});
  setTimeout(sync,0);
})();
