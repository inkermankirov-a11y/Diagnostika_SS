'use strict';

(() => {
  const HISTORY_KEY='diagnostika-currency-calculator-history';
  const LANG={
    ru:{calculator:'Калькулятор',history:'История',clear:'Очистить',empty:'История пока пуста',error:'Ошибка',use:'В сумму конвертера'},
    en:{calculator:'Calculator',history:'History',clear:'Clear',empty:'History is empty',error:'Error',use:'Use as converter amount'},
    fr:{calculator:'Calculatrice',history:'Historique',clear:'Effacer',empty:'Historique vide',error:'Erreur',use:'Utiliser comme montant'},
    de:{calculator:'Rechner',history:'Verlauf',clear:'Löschen',empty:'Verlauf leer',error:'Fehler',use:'Als Betrag verwenden'},
    it:{calculator:'Calcolatrice',history:'Cronologia',clear:'Cancella',empty:'Cronologia vuota',error:'Errore',use:'Usa come importo'}
  };
  const lang=()=>window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'ru';
  const tr=()=>LANG[lang()]||LANG.ru;

  function applyHeader(){
    const btn=document.getElementById('headerCurrencyBtn');
    if(!btn)return false;
    const icon=btn.querySelector('.hu-icon');
    const main=btn.querySelector('.hu-main');
    const sub=btn.querySelector('.hu-sub');
    if(icon)icon.textContent='$';
    if(main){
      const clean=main.textContent.replace(/\s*₽\s*$/,'').trim();
      if(clean!==main.textContent)main.textContent=clean;
    }
    if(sub&&!sub.textContent.trim())sub.textContent='USD';
    btn.classList.add('currency-compact-display');
    return true;
  }

  const style=document.createElement('style');
  style.textContent=`
    #headerCurrencyBtn.currency-compact-display{grid-template-columns:28px 1fr!important;grid-template-rows:16px 18px!important;grid-template-areas:'icon code' 'icon rate'!important;column-gap:7px!important;row-gap:2px!important;align-items:center!important;padding:4px 8px!important}
    #headerCurrencyBtn.currency-compact-display .hu-icon{grid-area:icon!important;font-size:24px!important;font-weight:900!important;line-height:1!important;text-align:center!important;padding-right:6px!important;border-right:1px solid rgba(255,255,255,.28)!important}
    #headerCurrencyBtn.currency-compact-display .hu-sub{grid-area:code!important;margin:0!important;max-width:none!important;overflow:visible!important;text-overflow:clip!important;text-align:left!important;justify-self:start!important;font-size:10px!important;font-weight:800!important;letter-spacing:.7px!important;line-height:1!important;align-self:end!important;color:#dbeafe!important}
    #headerCurrencyBtn.currency-compact-display .hu-main{grid-area:rate!important;text-align:left!important;justify-self:start!important;font-size:13px!important;font-weight:900!important;line-height:1!important;align-self:start!important;overflow:visible!important;text-overflow:clip!important;color:#fff!important}
    .currency-calculator-inline{margin-top:14px;padding-top:14px;border-top:1px solid #dbe4ed}
    .cci-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}.cci-head strong{font-size:14px;color:#243447}
    .cci-display{display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:8px;margin-bottom:9px}
    .cci-input{height:44px;border:1px solid #b9c6d4;border-radius:9px;padding:0 12px;font-size:18px;font-weight:700;text-align:right;box-sizing:border-box;width:100%;background:#fff}
    .cci-result{min-width:0;height:44px;border:1px solid #c9e1d8;border-radius:9px;background:#eef7f4;display:flex;align-items:center;justify-content:flex-end;padding:0 12px;font-size:18px;font-weight:900;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .cci-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}
    .cci-key{height:40px!important;min-width:0!important;padding:0!important;border-radius:8px!important;font-size:15px!important;font-weight:800!important}
    .cci-key.op{background:linear-gradient(#70849a,#4f6277)!important;color:#fff!important}.cci-key.eq{background:linear-gradient(#48a873,#278656)!important;color:#fff!important}.cci-key.danger{background:linear-gradient(#ef7777,#d95353)!important;color:#fff!important}
    .cci-use{width:100%;height:36px!important;margin-top:8px;font-size:12px!important}
    .cci-history{margin-top:11px}.cci-history-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;font-weight:800;color:#334155}
    .cci-history-list{display:grid;gap:5px;max-height:120px;overflow:auto}.cci-history-row{display:flex;justify-content:space-between;gap:10px;padding:7px 9px;border:1px solid #e0e7ef;border-radius:8px;background:#f8fafc;font-size:12px;cursor:pointer}.cci-history-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cci-history-row strong{white-space:nowrap}.cci-empty{font-size:11px;color:#94a3b8;padding:4px 1px}.cci-clear{height:28px!important;padding:0 8px!important;font-size:11px!important}
    @media(max-width:560px){.cci-display{grid-template-columns:1fr}.cci-result{justify-content:flex-end}.cci-grid{grid-template-columns:repeat(4,1fr)}}
  `;
  document.head.appendChild(style);

  const loadHistory=()=>{try{const x=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}};
  const saveHistory=h=>localStorage.setItem(HISTORY_KEY,JSON.stringify(h.slice(0,30)));
  const fmt=n=>new Intl.NumberFormat(lang()==='ru'?'ru-RU':lang(),{maximumFractionDigits:10}).format(Number(n));

  function evalExpr(raw){
    let s=String(raw||'').replace(/,/g,'.').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/\s+/g,'');
    if(!s||!^[0-9+\-*/().%]+$/.test(s))throw Error('bad expression');
    s=s.replace(/(\d+(?:\.\d+)?)%/g,'($1/100)');
    const v=Function('"use strict";return ('+s+')')();
    if(typeof v!=='number'||!Number.isFinite(v))throw Error('bad result');
    return v;
  }

  function injectCalculator(){
    const card=document.querySelector('.utility-overlay:not([hidden]) .currency-card');
    if(!card)return false;
    if(card.querySelector('.currency-calculator-inline,.currency-calculator-direct'))return true;

    const t=tr();
    const box=document.createElement('section');
    box.className='currency-calculator-inline';
    box.innerHTML=`
      <div class="cci-head"><strong>🧮 ${t.calculator}</strong></div>
      <div class="cci-display"><input class="cci-input" inputmode="decimal" autocomplete="off" placeholder="0"><div class="cci-result">0</div></div>
      <div class="cci-grid">
        <button type="button" class="tk-btn cci-key danger" data-k="C">C</button>
        <button type="button" class="tk-btn cci-key" data-k="(">(</button>
        <button type="button" class="tk-btn cci-key" data-k=")">)</button>
        <button type="button" class="tk-btn cci-key op" data-k="%">%</button>
        <button type="button" class="tk-btn cci-key op" data-k="÷">÷</button>
        <button type="button" class="tk-btn cci-key" data-k="7">7</button>
        <button type="button" class="tk-btn cci-key" data-k="8">8</button>
        <button type="button" class="tk-btn cci-key" data-k="9">9</button>
        <button type="button" class="tk-btn cci-key op" data-k="×">×</button>
        <button type="button" class="tk-btn cci-key" data-k="⌫">⌫</button>
        <button type="button" class="tk-btn cci-key" data-k="4">4</button>
        <button type="button" class="tk-btn cci-key" data-k="5">5</button>
        <button type="button" class="tk-btn cci-key" data-k="6">6</button>
        <button type="button" class="tk-btn cci-key op" data-k="−">−</button>
        <button type="button" class="tk-btn cci-key" data-k=",">,</button>
        <button type="button" class="tk-btn cci-key" data-k="1">1</button>
        <button type="button" class="tk-btn cci-key" data-k="2">2</button>
        <button type="button" class="tk-btn cci-key" data-k="3">3</button>
        <button type="button" class="tk-btn cci-key op" data-k="+">+</button>
        <button type="button" class="tk-btn cci-key eq" data-k="=">=</button>
        <button type="button" class="tk-btn cci-key" data-k="0">0</button>
        <button type="button" class="tk-btn cci-key" data-k="00">00</button>
      </div>
      <button type="button" class="tk-btn cci-use">${t.use}</button>
      <div class="cci-history"><div class="cci-history-head"><span>${t.history}</span><button type="button" class="tk-btn cci-clear">${t.clear}</button></div><div class="cci-history-list"></div></div>`;

    card.appendChild(box);
    const input=box.querySelector('.cci-input');
    const result=box.querySelector('.cci-result');
    const list=box.querySelector('.cci-history-list');
    let lastValue=null;

    function renderHistory(){
      const h=loadHistory();
      list.innerHTML='';
      if(!h.length){list.innerHTML=`<div class="cci-empty">${tr().empty}</div>`;return;}
      h.forEach(item=>{
        const row=document.createElement('div');
        row.className='cci-history-row';
        row.innerHTML=`<span>${item.expr}</span><strong>= ${item.result}</strong>`;
        row.addEventListener('click',()=>{input.value=item.expr;result.textContent=item.result;try{lastValue=evalExpr(item.expr);}catch(_){lastValue=null;}input.focus();});
        list.appendChild(row);
      });
    }

    function calculate(addHistory=true){
      try{
        const value=evalExpr(input.value);
        const shown=fmt(value);
        lastValue=value;
        result.textContent=shown;
        if(addHistory){
          const h=loadHistory();
          h.unshift({expr:input.value,result:shown,ts:Date.now()});
          saveHistory(h);
          renderHistory();
        }
        return value;
      }catch(_){lastValue=null;result.textContent=tr().error;return null;}
    }

    box.querySelectorAll('.cci-key').forEach(btn=>btn.addEventListener('click',()=>{
      const k=btn.dataset.k;
      if(k==='C'){input.value='';lastValue=null;result.textContent='0';input.focus();return;}
      if(k==='⌫'){input.value=input.value.slice(0,-1);input.focus();return;}
      if(k==='='){calculate(true);input.focus();return;}
      input.value+=k;
      input.focus();
    }));

    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();calculate(true);}});
    box.querySelector('.cci-clear').addEventListener('click',()=>{localStorage.removeItem(HISTORY_KEY);renderHistory();});
    box.querySelector('.cci-use').addEventListener('click',()=>{
      const value=lastValue??calculate(false);
      if(value===null)return;
      const amount=card.querySelector('#utilCurAmount');
      if(!amount)return;
      amount.value=String(value).replace('.',',');
      amount.dispatchEvent(new Event('input',{bubbles:true}));
      amount.focus();
    });

    renderHistory();
    return true;
  }

  function scheduleInject(){
    requestAnimationFrame(()=>injectCalculator());
    setTimeout(injectCalculator,30);
    setTimeout(injectCalculator,120);
  }

  document.addEventListener('click',e=>{if(e.target?.closest?.('#headerCurrencyBtn'))scheduleInject();},true);
  const observer=new MutationObserver(muts=>{
    if(muts.some(m=>[...m.addedNodes].some(n=>n?.nodeType===1&&(n.matches?.('.currency-card,.utility-panel')||n.querySelector?.('.currency-card')))))scheduleInject();
  });
  observer.observe(document.body,{childList:true,subtree:true});

  function start(){
    if(!applyHeader()){setTimeout(start,100);return;}
    const btn=document.getElementById('headerCurrencyBtn');
    const mo=new MutationObserver(()=>applyHeader());
    mo.observe(btn,{subtree:true,childList:true,characterData:true});
  }
  start();

  if(!document.querySelector('script[data-currency-calculator-direct]')){
    const s=document.createElement('script');
    s.src='currency-calculator-direct.js?v=20260913-90';
    s.setAttribute('data-currency-calculator-direct','1');
    document.body.appendChild(s);
  }
})();