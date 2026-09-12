'use strict';

(() => {
  const style=document.createElement('style');
  style.textContent=`
    .currency-card{padding:18px!important;border:1px solid #d5e0ea!important;border-radius:16px!important;background:linear-gradient(180deg,#fff 0%,#f8fbfd 100%)!important;box-shadow:0 10px 30px rgba(51,65,85,.08)!important}
    .currency-field select{height:50px!important;border:1px solid #c6d2df!important;border-radius:12px!important;padding:0 12px!important;background:#fff!important;font-size:14px!important;font-weight:800!important;color:#26384b!important;box-shadow:0 2px 8px rgba(15,23,42,.04)!important}
    .currency-field input{height:50px!important;border:1px solid #c6d2df!important;border-radius:12px!important;padding:0 14px!important;background:#fff!important;font-size:18px!important;font-weight:800!important;color:#26384b!important;box-shadow:0 2px 8px rgba(15,23,42,.04)!important}
    .currency-swap{height:46px!important;width:46px!important;border-radius:50%!important;font-size:20px!important;box-shadow:0 5px 14px rgba(51,65,85,.14)!important}
    .currency-result{margin-top:16px!important;padding:17px!important;border-radius:14px!important;background:linear-gradient(180deg,#eaf8f2 0%,#dff3ea 100%)!important;border:1px solid #b8ddcc!important;box-shadow:0 0 0 1px rgba(31,109,77,.03),0 8px 24px rgba(31,109,77,.10)!important}
    .currency-result-main{font-size:30px!important;font-weight:900!important;color:#1f6d4d!important;letter-spacing:-.02em}
    .currency-rate{margin-top:6px!important;font-size:13px!important;font-weight:700!important;color:#587066!important}
  `;
  document.head.appendChild(style);

  function nameOf(code){
    try{
      const l=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'ru';
      const locale=l==='ru'?'ru-RU':l;
      const dn=new Intl.DisplayNames([locale],{type:'currency'});
      const name=dn.of(code);
      if(name&&name!==code)return name.charAt(0).toUpperCase()+name.slice(1);
    }catch(_){}
    const fallback={RUB:'Российский рубль',USD:'Доллар США',EUR:'Евро',KZT:'Казахстанский тенге',CNY:'Китайский юань',GBP:'Фунт стерлингов',CHF:'Швейцарский франк',JPY:'Японская иена',TRY:'Турецкая лира'};
    return fallback[code]||code;
  }

  function enhanceSelect(sel){
    if(!sel||sel.dataset.safeCurrencyNames==='1')return;
    sel.dataset.safeCurrencyNames='1';
    [...sel.options].forEach(opt=>{
      const code=opt.value;
      opt.textContent=`${code} — ${nameOf(code)}`;
    });
  }

  function enhance(){
    enhanceSelect(document.querySelector('#utilCurFrom'));
    enhanceSelect(document.querySelector('#utilCurTo'));
  }

  const mo=new MutationObserver(()=>enhance());
  mo.observe(document.body,{childList:true,subtree:true});
  enhance();
})();
