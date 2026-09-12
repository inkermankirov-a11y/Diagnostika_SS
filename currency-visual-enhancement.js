'use strict';

(() => {
  const FLAGS={
    RUB:'🇷🇺',USD:'🇺🇸',EUR:'🇪🇺',KZT:'🇰🇿',CNY:'🇨🇳',GBP:'🇬🇧',CHF:'🇨🇭',JPY:'🇯🇵',TRY:'🇹🇷',AED:'🇦🇪',AMD:'🇦🇲',AUD:'🇦🇺',AZN:'🇦🇿',BGN:'🇧🇬',BRL:'🇧🇷',BYN:'🇧🇾',CAD:'🇨🇦',CZK:'🇨🇿',DKK:'🇩🇰',EGP:'🇪🇬',GEL:'🇬🇪',HKD:'🇭🇰',HUF:'🇭🇺',IDR:'🇮🇩',INR:'🇮🇳',KRW:'🇰🇷',KGS:'🇰🇬',MDL:'🇲🇩',NOK:'🇳🇴',NZD:'🇳🇿',PLN:'🇵🇱',QAR:'🇶🇦',RON:'🇷🇴',RSD:'🇷🇸',SEK:'🇸🇪',SGD:'🇸🇬',THB:'🇹🇭',TJS:'🇹🇯',TMT:'🇹🇲',UAH:'🇺🇦',UZS:'🇺🇿',VND:'🇻🇳',ZAR:'🇿🇦'
  };

  const FALLBACK_NAMES={
    RUB:'Российский рубль',USD:'Доллар США',EUR:'Евро',KZT:'Казахстанский тенге',CNY:'Китайский юань',GBP:'Фунт стерлингов',CHF:'Швейцарский франк',JPY:'Японская иена',TRY:'Турецкая лира'
  };

  const style=document.createElement('style');
  style.textContent=`
    .currency-card{padding:18px!important;border:1px solid #d5e0ea!important;border-radius:16px!important;background:linear-gradient(180deg,#ffffff 0%,#f8fbfd 100%)!important;box-shadow:0 10px 30px rgba(51,65,85,.08)!important}
    .currency-row{gap:12px!important;align-items:end!important}
    .currency-field{font-size:12px!important;color:#526174!important;gap:7px!important;position:relative}
    .currency-select-wrap{position:relative;display:block}
    .currency-select-flag{position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:22px;line-height:1;z-index:2;pointer-events:none;font-family:'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif}
    .currency-field select{height:50px!important;border:1px solid #c6d2df!important;border-radius:12px!important;padding:0 12px 0 45px!important;background:#fff!important;font-size:14px!important;font-weight:800!important;color:#26384b!important;box-shadow:0 2px 8px rgba(15,23,42,.04)!important}
    .currency-field input{height:50px!important;border:1px solid #c6d2df!important;border-radius:12px!important;padding:0 14px!important;background:#fff!important;font-size:18px!important;font-weight:800!important;color:#26384b!important;box-shadow:0 2px 8px rgba(15,23,42,.04)!important}
    .currency-swap{align-self:end!important;margin:0!important;height:46px!important;width:46px!important;border-radius:50%!important;font-size:20px!important;box-shadow:0 5px 14px rgba(51,65,85,.14)!important}
    .currency-amount-wrap{margin-top:14px!important}
    .currency-result{margin-top:16px!important;padding:16px!important;border-radius:14px!important;background:linear-gradient(180deg,#eef8f4,#e9f5f0)!important;border:1px solid #c9e1d8!important}
    .currency-result-main{font-size:30px!important;font-weight:900!important;color:#1f6d4d!important;letter-spacing:-.02em}
    .currency-rate{font-size:13px!important;margin-top:6px!important;color:#65758a!important;font-weight:700}
    .utility-source{font-size:11px!important;color:#91a0b1!important;margin-top:12px!important}
    @media(max-width:760px){
      .currency-row{grid-template-columns:1fr!important;gap:10px!important}
      .currency-swap{margin:0 auto!important;transform:rotate(90deg)}
      .currency-result-main{font-size:26px!important}
    }
  `;
  document.head.appendChild(style);

  function locale(){
    const l=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'ru';
    return l==='ru'?'ru-RU':l;
  }

  function currencyName(code){
    try{
      const dn=new Intl.DisplayNames([locale()],{type:'currency'});
      const n=dn.of(code);
      if(n&&n!==code)return n.charAt(0).toUpperCase()+n.slice(1);
    }catch(_){}
    return FALLBACK_NAMES[code]||code;
  }

  function flag(code){return FLAGS[code]||'💱';}

  function beautifySelect(select){
    if(!select)return;
    [...select.options].forEach(opt=>{
      const code=opt.value;
      opt.textContent=`${code} — ${currencyName(code)}`;
    });
  }

  function ensureFlag(select){
    if(!select)return;
    let wrap=select.parentElement?.querySelector(':scope > .currency-select-wrap');
    if(!wrap){
      wrap=document.createElement('span');
      wrap.className='currency-select-wrap';
      select.parentNode.insertBefore(wrap,select);
      wrap.appendChild(select);
      const f=document.createElement('span');
      f.className='currency-select-flag';
      wrap.appendChild(f);
    }
    const f=wrap.querySelector('.currency-select-flag');
    if(f)f.textContent=flag(select.value);
  }

  function enhance(){
    const from=document.querySelector('#utilCurFrom');
    const to=document.querySelector('#utilCurTo');
    document.querySelectorAll('.currency-selected-info').forEach(el=>el.remove());
    if(!from||!to)return false;
    [from,to].forEach(sel=>{
      beautifySelect(sel);
      ensureFlag(sel);
      sel.dataset.visualCurrency='1';
      if(!sel.dataset.visualFlagBound){
        sel.dataset.visualFlagBound='1';
        sel.addEventListener('change',()=>ensureFlag(sel));
      }
    });
    return true;
  }

  const mo=new MutationObserver(()=>setTimeout(enhance,0));
  mo.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.matches?.('#utilCurFrom,#utilCurTo'))setTimeout(enhance,0);},true);
  setTimeout(enhance,0);
})();
