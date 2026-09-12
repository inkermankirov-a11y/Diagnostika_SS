'use strict';

(() => {
  const HISTORY_KEY='diagnostika-currency-calculator-history-v2';
  const LANG={
    ru:{title:'Калькулятор',error:'Ошибка',use:'В сумму конвертера',clear:'Очистить'},
    en:{title:'Calculator',error:'Error',use:'Use as converter amount',clear:'Clear'},
    fr:{title:'Calculatrice',error:'Erreur',use:'Utiliser comme montant',clear:'Effacer'},
    de:{title:'Rechner',error:'Fehler',use:'Als Betrag verwenden',clear:'Löschen'},
    it:{title:'Calcolatrice',error:'Errore',use:'Usa come importo',clear:'Cancella'}
  };
  const lang=()=>window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'ru';
  const tr=()=>LANG[lang()]||LANG.ru;
  const fmt=n=>new Intl.NumberFormat(lang()==='ru'?'ru-RU':lang(),{maximumFractionDigits:10}).format(Number(n));
  const loadHistory=()=>{try{const x=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}};
  const saveHistory=h=>localStorage.setItem(HISTORY_KEY,JSON.stringify(h.slice(0,20)));

  const style=document.createElement('style');
  style.textContent=`
    .currency-calculator-direct{margin-top:16px;padding-top:14px;border-top:1px solid #dbe4ed}
    .ccd-title{font-size:13px;font-weight:900;color:#475569;margin:0 0 8px}
    .ccd-shell{width:min(292px,100%);margin:0 auto;padding:16px 15px 15px;border-radius:24px;background:linear-gradient(180deg,#595b5e 0%,#3f4144 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 8px 18px rgba(15,23,42,.22)}
    .ccd-screen{display:block;width:100%;height:64px;box-sizing:border-box;border:2px solid #aeb7c2;border-radius:7px;background:linear-gradient(180deg,#d8e0e9,#c7d0dc);box-shadow:inset 0 2px 5px rgba(15,23,42,.16);padding:5px 10px;color:#111;font-family:'Courier New',monospace;font-size:34px;font-weight:700;line-height:1;text-align:right;outline:none;overflow:hidden}
    .ccd-screen:focus{border-color:#8d99a6}
    .ccd-mini{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:12px 0 8px}
    .ccd-mini button{height:27px!important;min-width:0!important;padding:0!important;border:0!important;border-radius:6px!important;background:#74777b!important;color:#fff!important;font-size:11px!important;font-weight:800!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.15)!important}
    .ccd-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
    .ccd-key{height:50px!important;min-width:0!important;padding:0!important;border:1px solid #d7dbe0!important;border-radius:7px!important;background:linear-gradient(180deg,#fff,#f3f4f6)!important;color:#0f172a!important;font-size:25px!important;font-weight:900!important;line-height:1!important;box-shadow:0 2px 0 #aeb4bb,0 3px 6px rgba(0,0,0,.18)!important;text-shadow:0 1px 0 #fff!important}
    .ccd-key:active{transform:translateY(2px)!important;box-shadow:0 0 0 #aeb4bb!important}
    .ccd-key.op{font-size:27px!important}
    .ccd-key.eq{background:linear-gradient(180deg,#ff9f20,#f28a00)!important;border-color:#e27e00!important;color:#111!important;box-shadow:0 2px 0 #b96400,0 3px 6px rgba(0,0,0,.18)!important}
    .ccd-use{display:block;width:min(292px,100%);margin:9px auto 0;height:36px!important;font-size:12px!important;font-weight:800!important}
    .ccd-history-note{width:min(292px,100%);margin:5px auto 0;text-align:center;font-size:10px;color:#94a3b8}
    @media(max-width:560px){.ccd-shell{width:100%;box-sizing:border-box}.ccd-key{height:48px!important}}
  `;
  document.head.appendChild(style);

  function evaluate(raw){
    let s=String(raw||'').replace(/,/g,'.').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/\s+/g,'');
    if(!s||!new RegExp('^[0-9+\\-*/().%]+$').test(s))throw Error('bad');
    s=s.replace(/(\d+(?:\.\d+)?)%/g,'($1/100)');
    const v=Function('"use strict";return ('+s+')')();
    if(typeof v!=='number'||!Number.isFinite(v))throw Error('bad');
    return v;
  }

  function inject(){
    const overlay=document.querySelector('.utility-overlay:not([hidden])');
    const card=overlay?.querySelector('.currency-card');
    if(!card)return false;
    if(card.querySelector('.currency-calculator-direct'))return true;

    const t=tr();
    const box=document.createElement('section');
    box.className='currency-calculator-direct';
    box.innerHTML=`
      <div class="ccd-title">${t.title}</div>
      <div class="ccd-shell">
        <input class="ccd-screen" inputmode="decimal" autocomplete="off" value="0" aria-label="${t.title}">
        <div class="ccd-mini">
          <button type="button" data-k="C">C</button>
          <button type="button" data-k="⌫">⌫</button>
          <button type="button" data-k="%">%</button>
          <button type="button" data-k="(">(</button>
          <button type="button" data-k=")">)</button>
        </div>
        <div class="ccd-grid">
          <button type="button" class="ccd-key" data-k="7">7</button>
          <button type="button" class="ccd-key" data-k="8">8</button>
          <button type="button" class="ccd-key" data-k="9">9</button>
          <button type="button" class="ccd-key op" data-k="÷">÷</button>
          <button type="button" class="ccd-key" data-k="4">4</button>
          <button type="button" class="ccd-key" data-k="5">5</button>
          <button type="button" class="ccd-key" data-k="6">6</button>
          <button type="button" class="ccd-key op" data-k="×">×</button>
          <button type="button" class="ccd-key" data-k="1">1</button>
          <button type="button" class="ccd-key" data-k="2">2</button>
          <button type="button" class="ccd-key" data-k="3">3</button>
          <button type="button" class="ccd-key op" data-k="−">−</button>
          <button type="button" class="ccd-key" data-k="0">0</button>
          <button type="button" class="ccd-key" data-k=",">,</button>
          <button type="button" class="ccd-key op" data-k="+">+</button>
          <button type="button" class="ccd-key eq" data-k="=">=</button>
        </div>
      </div>
      <button type="button" class="tk-btn ccd-use">${t.use}</button>
      <div class="ccd-history-note">Последние вычисления сохраняются автоматически</div>`;
    card.appendChild(box);

    const screen=box.querySelector('.ccd-screen');
    let lastValue=0;
    let justCalculated=false;

    function show(value){
      screen.value=String(value).replace('.',',');
    }

    function calc(addHistory=true){
      try{
        const expr=screen.value;
        const value=evaluate(expr);
        lastValue=value;
        const shown=fmt(value);
        screen.value=shown;
        justCalculated=true;
        if(addHistory){
          const h=loadHistory();
          h.unshift({expr,result:shown,value,ts:Date.now()});
          saveHistory(h);
        }
        return value;
      }catch(_){screen.value=tr().error;justCalculated=true;return null;}
    }

    function append(k){
      if(screen.value===tr().error){screen.value='';justCalculated=false;}
      const isNumber=/^[0-9]$/.test(k)||k===',';
      if(justCalculated&&isNumber){screen.value='';justCalculated=false;}
      if(screen.value==='0'&&/^[0-9]$/.test(k))screen.value='';
      screen.value+=k;
      justCalculated=false;
      screen.focus();
    }

    box.querySelectorAll('[data-k]').forEach(btn=>btn.addEventListener('click',()=>{
      const k=btn.dataset.k;
      if(k==='C'){screen.value='0';lastValue=0;justCalculated=false;screen.focus();return;}
      if(k==='⌫'){screen.value=screen.value.length>1?screen.value.slice(0,-1):'0';screen.focus();return;}
      if(k==='='){calc(true);screen.focus();return;}
      append(k);
    }));

    screen.addEventListener('focus',()=>screen.select());
    screen.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();calc(true);}
      if(e.key==='Escape'){screen.value='0';lastValue=0;justCalculated=false;}
    });

    box.querySelector('.ccd-use').addEventListener('click',()=>{
      let value=lastValue;
      if(!justCalculated){const v=calc(false);if(v==null)return;value=v;}
      const amount=overlay.querySelector('#utilCurAmount');
      if(!amount)return;
      amount.value=String(value).replace('.',',');
      amount.dispatchEvent(new Event('input',{bubbles:true}));
      amount.focus();
    });

    return true;
  }

  const observer=new MutationObserver(()=>inject());
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  document.addEventListener('click',e=>{if(e.target?.closest?.('#headerCurrencyBtn'))setTimeout(inject,0);},true);
  setTimeout(inject,0);
})();
