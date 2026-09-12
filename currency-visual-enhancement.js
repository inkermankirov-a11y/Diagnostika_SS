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
    .currency-row{gap:12px!important;align-items:stretch!important}
    .currency-field{font-size:12px!important;color:#526174!important;gap:7px!important}
    .currency-field select{height:50px!important;border:1px solid #c6d2df!important;border-radius:12px!important;padding:0 12px!important;background:#fff!important;font-size:14px!important;font-weight:800!important;color:#26384b!important;box-shadow:0 2px 8px rgba(15,23,42,.04)!important}
    .currency-field input{height:50px!important;border:1px solid #c6d2df!important;border-radius:12px!important;padding:0 14px!important;background:#fff!important;font-size:18px!important;font-weight:800!important;color:#26384b!important;box-shadow:0 2px 8px rgba(15,23,42,.04)!important}
    .currency-selected-info{display:grid;grid-template-columns:auto 1fr;grid-template-areas:'flag code' 'flag name';column-gap:10px;align-items:center;margin-top:7px;padding:11px 12px;border:1px solid #dde5ed;border-radius:12px;background:#f8fafc;min-height:58px;box-sizing:border-box}
    .currency-selected-flag{grid-area:flag;font-size:28px;line-height:1;filter:saturate(.95)}
    .currency-selected-code{grid-area:code;font-size:15px;font-weight:900;color:#26384b;line-height:1.1}
    .currency-selected-name{grid-area:name;margin-top:3px;font-size:12px;font-weight:700;color:#7a8a9d;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .currency-swap{align-self:center!important;margin-top:22px!important;height:46px!important;width:46px!important;border-radius:50%!important;font-size:20px!important;box-shadow:0 5px 14px rgba(51,65,85,.14)!important}
    .currency-amount-wrap{margin-top:14px!important}
    .currency-result{margin-top:16px!important;padding:16px!important;border-radius:14px!important;background:linear-gradient(180deg,#eef8f4,#e9f5f0)!important;border:1px solid #c9e1d8!important}
    .currency-result-main{font-size:30px!important;font-weight:900!important;color:#1f6d4d!important;letter-spacing:-.02em}
    .currency-rate{font-size:13px!important;margin-top:6px!important;color:#65758a!important;font-weight:700}
    .utility-source{font-size:11px!important;color:#91a0b1!important;margin-top:12px!important}
    @media(max-width:760px){
      .currency-row{grid-template-columns:1fr!important;gap:10px!important}
      .currency-swap{margin:0 auto!important;transform:rotate(90deg)}
      .currency-selected-info{min-height:54px}
      .currency-selected-flag{font-size:25px}
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
      opt.textContent=`${flag(code)}  ${code} — ${currencyName(code)}`;
    });
  }

  function ensureInfo(select){
    if(!select)return null;
    let box=select.parentElement?.querySelector(':scope > .currency-selected-info');
    if(!box){
      box=document.createElement('div');
      box.className='currency-selected-info';
      box.innerHTML='<span class="currency-selected-flag"></span><span class="currency-selected-code"></span><span class="currency-selected-name"></span>';
      select.insertAdjacentElement('afterend',box);
    }
    return box;
  }

  function updateInfo(select){
    const box=ensureInfo(select);if(!box)return;
    const code=select.value||'';
    box.querySelector('.currency-selected-flag').textContent=flag(code);
    box.querySelector('.currency-selected-code').textContent=code;
    box.querySelector('.currency-selected-name').textContent=currencyName(code);
  }

  function enhance(){
    const from=document.querySelector('#utilCurFrom');
    const to=document.querySelector('#utilCurTo');
    if(!from||!to)return false;
    if(from.dataset.visualCurrency==='1'&&to.dataset.visualCurrency==='1'){
      updateInfo(from);updateInfo(to);return true;
    }
    [from,to].forEach(sel=>{
      beautifySelect(sel);
      updateInfo(sel);
      sel.dataset.visualCurrency='1';
      sel.addEventListener('change',()=>updateInfo(sel));
    });
    const swap=document.querySelector('.currency-swap');
    if(swap&&!swap.dataset.visualCurrency){
      swap.dataset.visualCurrency='1';
      swap.addEventListener('click',()=>setTimeout(()=>{updateInfo(from);updateInfo(to);},0));
    }
    return true;
  }

  const mo=new MutationObserver(()=>setTimeout(enhance,0));
  mo.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.matches?.('#utilCurFrom,#utilCurTo'))setTimeout(enhance,0);},true);
  setTimeout(enhance,0);
})();
