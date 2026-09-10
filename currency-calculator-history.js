'use strict';

(() => {
  const KEY='diagnostika-currency-calculator-history';
  const LANG={
    ru:{title:'Калькулятор',history:'История',clear:'Очистить историю',empty:'История пока пуста',error:'Ошибка',useResult:'Вставить результат конвертации'},
    en:{title:'Calculator',history:'History',clear:'Clear history',empty:'History is empty',error:'Error',useResult:'Use conversion result'},
    fr:{title:'Calculatrice',history:'Historique',clear:"Effacer l’historique",empty:"L’historique est vide",error:'Erreur',useResult:'Utiliser le résultat converti'},
    de:{title:'Rechner',history:'Verlauf',clear:'Verlauf löschen',empty:'Noch kein Verlauf',error:'Fehler',useResult:'Umrechnungsergebnis verwenden'},
    it:{title:'Calcolatrice',history:'Cronologia',clear:'Cancella cronologia',empty:'Cronologia vuota',error:'Errore',useResult:'Usa il risultato convertito'}
  };
  const lang=()=>window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'en';
  const tr=()=>LANG[lang()]||LANG.en;
  const fmt=n=>new Intl.NumberFormat(lang()==='ru'?'ru-RU':lang(),{maximumFractionDigits:10}).format(Number(n));
  const loadHistory=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}};
  const saveHistory=x=>localStorage.setItem(KEY,JSON.stringify(x.slice(0,30)));

  const style=document.createElement('style');
  style.textContent=`
    .currency-calculator{margin-top:12px;padding:14px;border:1px solid #d8e3ec;border-radius:12px;background:#fff}
    .currency-calc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
    .currency-calc-head strong{font-size:14px;color:#243447}
    .currency-calc-display{display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:9px}
    .currency-calc-input{height:44px;border:1px solid #b9c6d4;border-radius:9px;padding:0 12px;font-size:18px;font-weight:700;text-align:right;box-sizing:border-box;width:100%;background:#fff}
    .currency-calc-result{min-width:120px;min-height:44px;display:flex;align-items:center;justify-content:flex-end;padding:0 12px;border-radius:9px;background:#eef7f4;border:1px solid #c9e1d8;font-size:18px;font-weight:900;box-sizing:border-box}
    .currency-calc-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}
    .currency-calc-key{height:40px!important;min-width:0!important;padding:0!important;border-radius:8px!important;font-size:15px!important;font-weight:800!important}
    .currency-calc-key.op{background:linear-gradient(#70849a,#4f6277)!important;color:#fff!important}
    .currency-calc-key.eq{background:linear-gradient(#48a873,#278656)!important;color:#fff!important}
    .currency-calc-key.danger{background:linear-gradient(#ef7777,#d95353)!important;color:#fff!important}
    .currency-calc-use{margin-top:8px;width:100%;height:36px!important;font-size:12px!important}
    .currency-calc-history{margin-top:12px;border-top:1px solid #dbe4ed;padding-top:10px}
    .currency-calc-history-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}
    .currency-calc-history-head strong{font-size:12px;color:#334155}.currency-calc-clear{height:30px!important;padding:0 9px!important;font-size:11px!important}
    .currency-calc-history-list{display:grid;gap:5px;max-height:160px;overflow:auto}
    .currency-calc-history-row{display:grid;grid-template-columns:1fr auto;gap:10px;padding:7px 9px;border:1px solid #e0e7ef;border-radius:8px;background:#f8fafc;cursor:pointer;font-size:12px}
    .currency-calc-history-row:hover{background:#eef6ff}.currency-calc-history-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.currency-calc-history-row strong{white-space:nowrap}.currency-calc-empty{font-size:11px;color:#94a3b8;padding:5px 1px}
    @media(max-width:560px){.currency-calc-display{grid-template-columns:1fr}.currency-calc-result{justify-content:flex-end}.currency-calc-grid{grid-template-columns:repeat(4,1fr)}}
  `;
  document.head.appendChild(style);

  function evaluate(raw){
    let expr=String(raw||'').replace(/,/g,'.').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/\s+/g,'');
    if(!expr||!^[0-9+\-*/().%]+$/.test(expr))throw Error('bad');
    expr=expr.replace(/(\d+(?:\.\d+)?)%/g,'($1/100)');
    const value=Function('"use strict";return ('+expr+')')();
    if(typeof value!=='number'||!Number.isFinite(value))throw Error('bad');
    return value;
  }

  function inject(){
    const card=document.querySelector('.utility-overlay:not([hidden]) .currency-card');
    if(!card||card.querySelector('.currency-calculator'))return;
    const t=tr();
    const box=document.createElement('section');
    box.className='currency-calculator';
    box.innerHTML=`
      <div class="currency-calc-head"><strong>🧮 ${t.title}</strong></div>
      <div class="currency-calc-display">
        <input class="currency-calc-input" inputmode="decimal" autocomplete="off" placeholder="0">
        <div class="currency-calc-result">0</div>
      </div>
      <div class="currency-calc-grid">
        <button type="button" class="tk-btn currency-calc-key danger" data-k="C">C</button>
        <button type="button" class="tk-btn currency-calc-key" data-k="(">(</button>
        <button type="button" class="tk-btn currency-calc-key" data-k=")">)</button>
        <button type="button" class="tk-btn currency-calc-key op" data-k="%">%</button>
        <button type="button" class="tk-btn currency-calc-key op" data-k="÷">÷</button>
        <button type="button" class="tk-btn currency-calc-key" data-k="7">7</button>
        <button type="button" class="tk-btn currency-calc-key" data-k="8">8</button>
        <button type="button" class="tk-btn currency-calc-key" data-k="9">9</button>
        <button type="button" class="tk-btn currency-calc-key op" data-k="×">×</button>
        <button type="button" class="tk-btn currency-calc-key" data-k="⌫">⌫</button>
        <button type="button" class="tk-btn currency-calc-key" data-k="4">4</button>
        <button type="button" class="tk-btn currency-calc-key" data-k="5">5</button>
        <button type="button" class="tk-btn currency-calc-key" data-k="6">6</button>
        <button type="button" class="tk-btn currency-calc-key op" data-k="−">−</button>
        <button type="button" class="tk-btn currency-calc-key" data-k=".">,</button>
        <button type="button" class="tk-btn currency-calc-key" data-k="1">1</button>
        <button type="button" class="tk-btn currency-calc-key" data-k="2">2</button>
        <button type="button" class="tk-btn currency-calc-key" data-k="3">3</button>
        <button type="button" class="tk-btn currency-calc-key op" data-k="+">+</button>
        <button type="button" class="tk-btn currency-calc-key eq" data-k="=">=</button>
        <button type="button" class="tk-btn currency-calc-key" data-k="0">0</button>
        <button type="button" class="tk-btn currency-calc-key" data-k="00">00</button>
      </div>
      <button type="button" class="tk-btn currency-calc-use">${t.useResult}</button>
      <div class="currency-calc-history">
        <div class="currency-calc-history-head"><strong>${t.history}</strong><button type="button" class="tk-btn currency-calc-clear">${t.clear}</button></div>
        <div class="currency-calc-history-list"></div>
      </div>`;
    card.appendChild(box);

    const input=box.querySelector('.currency-calc-input'),result=box.querySelector('.currency-calc-result'),list=box.querySelector('.currency-calc-history-list');
    function renderHistory(){
      const h=loadHistory();list.innerHTML='';
      if(!h.length){list.innerHTML=`<div class="currency-calc-empty">${tr().empty}</div>`;return;}
      h.forEach(item=>{const row=document.createElement('div');row.className='currency-calc-history-row';row.innerHTML=`<span>${item.expr}</span><strong>= ${item.result}</strong>`;row.onclick=()=>{input.value=item.expr;result.textContent=item.result;};list.appendChild(row);});
    }
    function calc(add=true){
      try{
        const value=evaluate(input.value),shown=fmt(value);result.textContent=shown;
        if(add){const h=loadHistory();h.unshift({expr:input.value,result:shown,ts:Date.now()});saveHistory(h);renderHistory();}
      }catch(_){result.textContent=tr().error;}
    }
    box.querySelectorAll('.currency-calc-key').forEach(btn=>btn.onclick=()=>{
      const k=btn.dataset.k;
      if(k==='C'){input.value='';result.textContent='0';input.focus();return;}
      if(k==='⌫'){input.value=input.value.slice(0,-1);input.focus();return;}
      if(k==='='){calc(true);return;}
      input.value+=k==='.'?',':k;input.focus();
    });
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();calc(true);}});
    box.querySelector('.currency-calc-clear').onclick=()=>{localStorage.removeItem(KEY);renderHistory();};
    box.querySelector('.currency-calc-use').onclick=()=>{
      const conversion=document.querySelector('.utility-overlay:not([hidden]) .currency-result-main');
      if(!conversion)return;
      const m=conversion.textContent.replace(/\s/g,'').replace(',','.').match(/-?\d+(?:\.\d+)?/);
      if(m){input.value=m[0].replace('.',',');result.textContent=fmt(Number(m[0]));input.focus();}
    };
    renderHistory();
  }

  const observer=new MutationObserver(()=>inject());
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  setInterval(inject,700);
  inject();
})();
