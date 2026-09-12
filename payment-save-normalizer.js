'use strict';

(() => {
  const plain=v=>String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.');
  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('#paymentSaveSettings');
    if(!btn)return;
    const dlg=btn.closest('dialog.payment-dialog');
    const input=dlg?.querySelector('#paymentTotal');
    if(input)input.value=plain(input.value);
  },true);
})();
