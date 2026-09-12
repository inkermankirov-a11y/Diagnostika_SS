'use strict';

(() => {
  const HISTORY_KEY='diagnostika-currency-calculator-history-v2';
  const LANG={
    ru:{title:'Калькулятор',error:'Ошибка',use:'В сумму конвертера'},
    en:{title:'Calculator',error:'Error',use:'Use as converter amount'},
    fr:{title:'Calculatrice',error:'Erreur',use:'Utiliser comme montant'},
    de:{title:'Rechner',error:'Fehler',use:'Als Betrag verwenden'},
    it:{title:'Calcolatrice',error:'Errore',use:'Usa come importo'}
  };
  const lang=()=>window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'ru';
  const tr=()=>LANG[lang()]||LANG.ru;
  const fmt=n=>new Intl.NumberFormat(lang()==='ru'?'ru-RU':lang(),{maximumFractionDigits:10}).format(Number(n));
  const loadHistory=()=>{try{const x=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}};
  const saveHistory=h=>localStorage.setItem(HISTORY_KEY,JSON.stringify(h.slice(0,20)));

  const style=document.createElement('style');
  style.textContent=`
    .utility-panel.currency-panel-wide{width:min(780px,calc(100vw - 24px))!important}
    .currency-calculator-direct{margin-top:16px;padding-top:14px;border-top:1px solid #dbe4ed}
    .ccd-title{font-size:13px;font-weight:900;color:#475569;margin:0 0 8px;text-align:center}
    .ccd-shell{width:min(430px,100%);margin:0 auto;padding:18px 17px 17px;border-radius:25px;background:linear-gradient(180deg,#5a5d61 0%,#3d4044 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 9px 22px rgba(15,23,42,.24);box-sizing:border-box}
    .ccd-screen-wrap{position:relative;margin-bottom:12px}
    .ccd-screen{display:block;width:100%;height:72px;box-sizing:border-box;border:2px solid #aeb7c2;border-radius:8px;background:linear-gradient(180deg,#dbe3ec,#c6d0dc);box-shadow:inset 0 2px 6px rgba(15,23,42,.18);padding:7px 12px 5px;color:#111;font-family:'Courier New',monospace;font-size:38px;font-weight:700;line-height:1;text-align:right;outline:none;overflow:hidden}
    .ccd-memory-indicator{position:absolute;left:11px;top:8px;font:700 11px/1 'Segoe UI',Arial,sans-serif;color:#536273;opacity:.85}
    .ccd-memory,.ccd-functions{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin-bottom:8px}
    .ccd-memory button,.ccd-functions button{height:32px!important;min-width:0!important;padding:0 3px!important;border:0!important;border-radius:6px!important;background:linear-gradient(180deg,#777b80,#62666b)!important;color:#fff!important;font-size:11px!important;font-weight:800!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 1px 2px rgba(0,0,0,.2)!important}
    .ccd-memory button:active,.ccd-functions button:active{transform:translateY(1px)!important}
    .ccd-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
    .ccd-key{height:56px!important;min-width:0!important;padding:0!important;border:1px solid #d7dbe0!important;border-radius:8px!important;background:linear-gradient(180deg,#fff,#f2f3f5)!important;color:#0f172a!important;font-size:27px!important;font-weight:900!important;line-height:1!important;box-shadow:0 2px 0 #aeb4bb,0 4px 7px rgba(0,0,0,.2)!important;text-shadow:0 1px 0 #fff!important}
    .ccd-key:active{transform:translateY(2px)!important;box-shadow:0 0 0 #aeb4bb!important}
    .ccd-key.op{font-size:29px!important}
    .ccd-key.eq{background:linear-gradient(180deg,#ffa72e,#f08a00)!important;border-color:#e17d00!important;color:#111!important;box-shadow:0 2px 0 #b96400,0 4px 7px rgba(0,0,0,.2)!important}
    .ccd-use{display:block;width:min(430px,100%);margin:10px auto 0;height:38px!important;font-size:12px!important;font-weight:800!important}
    .ccd-history-note{width:min(430px,100%);margin:5px auto 0;text-align:center;font-size:10px;color:#94a3b8}
    @media(max-width:560px){.ccd-shell{width:100%}.ccd-key{height:50px!important;font-size:23px!important}.ccd-memory button,.ccd-functions button{font-size:10px!important}.currency-panel-wide{width:100%!important}}
  `;
  document.head.appendChild(style);

  function evaluate(raw){
    let s=String(raw||'').replace(/\s/g,'').replace(/,/g,'.').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-');
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

    overlay.querySelector('.utility-panel')?.classList.add('currency-panel-wide');

    const t=tr();
    const box=document.createElement('section');
    box.className='currency-calculator-direct';
    box.innerHTML=`
      <div class="ccd-title">${t.title}</div>
      <div class="ccd-shell">
        <div class="ccd-screen-wrap">
          <span class="ccd-memory-indicator"></span>
          <input class="ccd-screen" inputmode="decimal" autocomplete="off" value="0" aria-label="${t.title}">
        </div>
        <div class="ccd-memory">
          <button type="button" data-action="mc">MC</button>
          <button type="button" data-action="mr">MR</button>
          <button type="button" data-action="mplus">M+</button>
          <button type="button" data-action="mminus">M−</button>
          <button type="button" data-action="clear">C</button>
          <button type="button" data-action="back">⌫</button>
        </div>
        <div class="ccd-functions">
          <button type="button" data-action="sign">±</button>
          <button type="button" data-k="%">%</button>
          <button type="button" data-action="sqrt">√</button>
          <button type="button" data-action="square">x²</button>
          <button type="button" data-action="inverse">1/x</button>
          <button type="button" data-k="(">( )</button>
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
          <button type="button" class="ccd-key eq" data-action="equals">=</button>
        </div>
      </div>
      <button type="button" class="tk-btn ccd-use">${t.use}</button>
      <div class="ccd-history-note">Последние вычисления сохраняются автоматически</div>`;
    card.appendChild(box);

    const screen=box.querySelector('.ccd-screen');
    const memoryIndicator=box.querySelector('.ccd-memory-indicator');
    let lastValue=0;
    let memory=0;
    let justCalculated=false;
    let parenOpen=false;

    const normalizeShown=v=>String(v).replace(/\s/g,'').replace(',', '.');

    function updateMemory(){memoryIndicator.textContent=memory!==0?'M':'';}

    function currentValue(){
      if(justCalculated&&Number.isFinite(lastValue))return lastValue;
      return evaluate(screen.value);
    }

    function setValue(value,calculated=true){
      lastValue=value;
      screen.value=fmt(value);
      justCalculated=calculated;
      screen.focus();
    }

    function calc(addHistory=true){
      try{
        const expr=screen.value;
        const value=evaluate(expr);
        setValue(value,true);
        if(addHistory){
          const h=loadHistory();
          h.unshift({expr,result:screen.value,value,ts:Date.now()});
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
      if(k==='('){
        if(parenOpen){screen.value+=')';parenOpen=false;}else{screen.value+='(';parenOpen=true;}
      }else screen.value+=k;
      justCalculated=false;
      screen.focus();
    }

    function unary(kind){
      try{
        const v=currentValue();
        let out=v;
        if(kind==='sign')out=-v;
        if(kind==='sqrt'){if(v<0)throw Error();out=Math.sqrt(v);}
        if(kind==='square')out=v*v;
        if(kind==='inverse'){if(v===0)throw Error();out=1/v;}
        setValue(out,true);
      }catch(_){screen.value=tr().error;justCalculated=true;}
    }

    box.addEventListener('click',e=>{
      const btn=e.target.closest('button');
      if(!btn)return;
      const action=btn.dataset.action;
      const k=btn.dataset.k;

      if(action==='clear'){screen.value='0';lastValue=0;justCalculated=false;parenOpen=false;screen.focus();return;}
      if(action==='back'){screen.value=screen.value.length>1?screen.value.slice(0,-1):'0';screen.focus();return;}
      if(action==='equals'){calc(true);return;}
      if(action==='mc'){memory=0;updateMemory();screen.focus();return;}
      if(action==='mr'){setValue(memory,true);return;}
      if(action==='mplus'){try{memory+=currentValue();updateMemory();}catch(_){}screen.focus();return;}
      if(action==='mminus'){try{memory-=currentValue();updateMemory();}catch(_){}screen.focus();return;}
      if(['sign','sqrt','square','inverse'].includes(action)){unary(action);return;}
      if(k)append(k);
    });

    screen.addEventListener('focus',()=>screen.select());
    screen.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();calc(true);}
      if(e.key==='Escape'){screen.value='0';lastValue=0;justCalculated=false;parenOpen=false;}
    });

    box.querySelector('.ccd-use').addEventListener('click',()=>{
      let value=lastValue;
      if(!justCalculated){const v=calc(false);if(v==null)return;value=v;}
      const amount=overlay.querySelector('#utilCurAmount');
      if(!amount)return;
      amount.value=normalizeShown(value).replace('.',',');
      amount.dispatchEvent(new Event('input',{bubbles:true}));
      amount.focus();
    });

    updateMemory();
    return true;
  }

  const observer=new MutationObserver(()=>inject());
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  document.addEventListener('click',e=>{if(e.target?.closest?.('#headerCurrencyBtn'))setTimeout(inject,0);},true);
  setTimeout(inject,0);
})();
