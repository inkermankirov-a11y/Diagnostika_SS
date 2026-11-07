'use strict';

(() => {
  const COUNTRY={
    RUB:'ru',USD:'us',EUR:'eu',KZT:'kz',CNY:'cn',GBP:'gb',CHF:'ch',JPY:'jp',TRY:'tr',AED:'ae',AMD:'am',AUD:'au',AZN:'az',BGN:'bg',BRL:'br',BYN:'by',CAD:'ca',CZK:'cz',DKK:'dk',EGP:'eg',GEL:'ge',HKD:'hk',HUF:'hu',IDR:'id',INR:'in',KRW:'kr',KGS:'kg',MDL:'md',NOK:'no',NZD:'nz',PLN:'pl',QAR:'qa',RON:'ro',RSD:'rs',SEK:'se',SGD:'sg',THB:'th',TJS:'tj',TMT:'tm',UAH:'ua',UZS:'uz',VND:'vn',ZAR:'za'
  };
  const FALLBACK_NAMES={RUB:'Российский рубль',USD:'Доллар США',EUR:'Евро',KZT:'Казахстанский тенге',CNY:'Китайский юань',GBP:'Фунт стерлингов',CHF:'Швейцарский франк',JPY:'Японская иена',TRY:'Турецкая лира'};

  const style=document.createElement('style');
  style.textContent=`
    .currency-card{padding:18px!important;border:1px solid #d5e0ea!important;border-radius:16px!important;background:linear-gradient(180deg,#fff 0%,#f8fbfd 100%)!important;box-shadow:0 10px 30px rgba(51,65,85,.08)!important;overflow:visible!important}
    .currency-row{gap:12px!important;align-items:end!important;overflow:visible!important}
    .currency-field{font-size:12px!important;color:#526174!important;gap:7px!important;position:relative;overflow:visible!important}
    .currency-native-select{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important;overflow:hidden!important}
    .currency-picker{position:relative;z-index:20}
    .currency-picker-button{width:100%;height:50px;border:1px solid #c6d2df;border-radius:12px;background:#fff;display:grid;grid-template-columns:30px auto 1fr 18px;align-items:center;gap:8px;padding:0 11px;box-sizing:border-box;cursor:pointer;box-shadow:0 2px 8px rgba(15,23,42,.04);color:#26384b;text-align:left;font-family:inherit}
    .currency-picker-button:hover{border-color:#9fb0c2;background:#fbfdff}
    .currency-picker-button[aria-expanded="true"]{border-color:#8298ad;box-shadow:0 0 0 3px rgba(98,125,152,.12)}
    .currency-flag-img{width:28px;height:20px;object-fit:cover;border-radius:4px;box-shadow:0 0 0 1px rgba(15,23,42,.12);display:block}
    .currency-flag-fallback{width:28px;height:20px;border-radius:4px;background:#e5e7eb;color:#475569;font-size:9px;font-weight:900;display:grid;place-items:center}
    .currency-picker-code{font-size:14px;font-weight:900;white-space:nowrap}
    .currency-picker-name{font-size:13px;font-weight:700;color:#516174;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    .currency-picker-arrow{font-size:12px;color:#64748b;text-align:right}
    .currency-picker-menu{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:15000;background:#fff;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 16px 36px rgba(15,23,42,.18);padding:5px;max-height:280px;overflow:auto;display:none}
    .currency-picker.open .currency-picker-menu{display:block}
    .currency-option{width:100%;min-height:46px;border:0;background:transparent;border-radius:9px;display:grid;grid-template-columns:30px auto 1fr;align-items:center;gap:8px;padding:6px 8px;cursor:pointer;text-align:left;color:#26384b;font-family:inherit}
    .currency-option:hover,.currency-option.active{background:#eef4f8}
    .currency-option-code{font-size:13px;font-weight:900}.currency-option-name{font-size:12px;font-weight:700;color:#65758a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .currency-field input{height:50px!important;border:1px solid #c6d2df!important;border-radius:12px!important;padding:0 14px!important;background:#fff!important;font-size:18px!important;font-weight:800!important;color:#26384b!important;box-shadow:0 2px 8px rgba(15,23,42,.04)!important}
    .currency-swap{align-self:end!important;margin:0!important;height:46px!important;width:46px!important;border-radius:50%!important;font-size:20px!important;box-shadow:0 5px 14px rgba(51,65,85,.14)!important;z-index:5}
    .currency-amount-wrap{margin-top:14px!important}.currency-result{margin-top:16px!important;padding:16px!important;border-radius:14px!important;background:linear-gradient(180deg,#eef8f4,#e9f5f0)!important;border:1px solid #c9e1d8!important}.currency-result-main{font-size:30px!important;font-weight:900!important;color:#1f6d4d!important;letter-spacing:-.02em}.currency-rate{font-size:13px!important;margin-top:6px!important;color:#65758a!important;font-weight:700}.utility-source{font-size:11px!important;color:#91a0b1!important;margin-top:12px!important}
    @media(max-width:760px){.currency-row{grid-template-columns:1fr!important;gap:10px!important}.currency-swap{margin:0 auto!important;transform:rotate(90deg)}.currency-result-main{font-size:26px!important}.currency-picker-menu{max-height:240px}}
  `;
  document.head.appendChild(style);

  function locale(){const l=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'ru';return l==='ru'?'ru-RU':l;}
  function currencyName(code){try{const dn=new Intl.DisplayNames([locale()],{type:'currency'});const n=dn.of(code);if(n&&n!==code)return n.charAt(0).toUpperCase()+n.slice(1);}catch(_){}return FALLBACK_NAMES[code]||code;}
  function flagNode(code){
    const cc=COUNTRY[code];
    if(!cc){const s=document.createElement('span');s.className='currency-flag-fallback';s.textContent=code.slice(0,2);return s;}
    const img=document.createElement('img');img.className='currency-flag-img';img.alt='';img.src=`https://flagcdn.com/w40/${cc}.png`;img.onerror=()=>{const s=document.createElement('span');s.className='currency-flag-fallback';s.textContent=cc.toUpperCase();img.replaceWith(s);};return img;
  }
  function closeAll(except){document.querySelectorAll('.currency-picker.open').forEach(p=>{if(p!==except){p.classList.remove('open');p.querySelector('.currency-picker-button')?.setAttribute('aria-expanded','false');}});}

  function buildPicker(select){
    if(!select||select.dataset.customCurrency==='1')return;
    select.dataset.customCurrency='1';select.classList.add('currency-native-select');
    const picker=document.createElement('div');picker.className='currency-picker';
    const button=document.createElement('button');button.type='button';button.className='currency-picker-button';button.setAttribute('aria-expanded','false');
    const menu=document.createElement('div');menu.className='currency-picker-menu';
    picker.append(button,menu);select.insertAdjacentElement('afterend',picker);

    function renderButton(){
      const code=select.value||'';button.innerHTML='';button.append(flagNode(code));
      const c=document.createElement('span');c.className='currency-picker-code';c.textContent=code;
      const n=document.createElement('span');n.className='currency-picker-name';n.textContent=currencyName(code);
      const a=document.createElement('span');a.className='currency-picker-arrow';a.textContent='▾';button.append(c,n,a);
    }
    function renderMenu(){
      menu.innerHTML='';[...select.options].forEach(opt=>{
        const code=opt.value;const row=document.createElement('button');row.type='button';row.className='currency-option'+(code===select.value?' active':'');row.dataset.code=code;row.append(flagNode(code));
        const c=document.createElement('span');c.className='currency-option-code';c.textContent=code;
        const n=document.createElement('span');n.className='currency-option-name';n.textContent=currencyName(code);row.append(c,n);
        row.addEventListener('click',e=>{e.stopPropagation();select.value=code;select.dispatchEvent(new Event('change',{bubbles:true}));renderButton();renderMenu();picker.classList.remove('open');button.setAttribute('aria-expanded','false');});menu.appendChild(row);
      });
    }
    button.addEventListener('click',e=>{e.stopPropagation();const opening=!picker.classList.contains('open');closeAll(picker);picker.classList.toggle('open',opening);button.setAttribute('aria-expanded',String(opening));if(opening)renderMenu();});
    select.addEventListener('change',()=>{renderButton();renderMenu();});
    renderButton();renderMenu();
  }

  function enhance(){buildPicker(document.querySelector('#utilCurFrom'));buildPicker(document.querySelector('#utilCurTo'));}
  document.addEventListener('click',()=>closeAll());
  const mo=new MutationObserver(records=>{for(const r of records){for(const n of r.addedNodes){if(n.nodeType===1&&(n.matches?.('#utilCurFrom,#utilCurTo')||n.querySelector?.('#utilCurFrom,#utilCurTo'))){enhance();return;}}}});
  mo.observe(document.body,{childList:true,subtree:true});
  setTimeout(enhance,0);
})();
