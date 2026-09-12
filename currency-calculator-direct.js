'use strict';

(() => {
  const HISTORY_KEY='diagnostika-currency-calculator-history-v2';
  const LANG={
    ru:{title:'Калькулятор',history:'История',clear:'Очистить',empty:'История пока пуста',error:'Ошибка',use:'В сумму конвертера'},
    en:{title:'Calculator',history:'History',clear:'Clear',empty:'History is empty',error:'Error',use:'Use as converter amount'},
    fr:{title:'Calculatrice',history:'Historique',clear:'Effacer',empty:'Historique vide',error:'Erreur',use:'Utiliser comme montant'},
    de:{title:'Rechner',history:'Verlauf',clear:'Löschen',empty:'Verlauf leer',error:'Fehler',use:'Als Betrag verwenden'},
    it:{title:'Calcolatrice',history:'Cronologia',clear:'Cancella',empty:'Cronologia vuota',error:'Errore',use:'Usa come importo'}
  };
  const lang=()=>window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'ru';
  const tr=()=>LANG[lang()]||LANG.ru;
  const fmt=n=>new Intl.NumberFormat(lang()==='ru'?'ru-RU':lang(),{maximumFractionDigits:10}).format(Number(n));
  const loadHistory=()=>{try{const x=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}};
  const saveHistory=h=>localStorage.setItem(HISTORY_KEY,JSON.stringify(h.slice(0,20)));

  const style=document.createElement('style');
  style.textContent=`
    .currency-calculator-direct{margin-top:12px;padding-top:12px;border-top:1px solid #dbe4ed}
    .ccd-title{font-size:14px;font-weight:900;color:#243447;margin-bottom:9px}
    .ccd-display{display:grid;grid-template-columns:1fr 150px;gap:8px;margin-bottom:8px}
    .ccd-input{height:42px;border:1px solid #b9c6d4;border-radius:9px;padding:0 11px;font-size:18px;font-weight:700;text-align:right;box-sizing:border-box;width:100%;background:#fff}
    .ccd-result{height:42px;border:1px solid #c9e1d8;border-radius:9px;background:#eef7f4;display:flex;align-items:center;justify-content:flex-end;padding:0 11px;font-size:18px;font-weight:900;box-sizing:border-box;overflow:hidden}
    .ccd-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
    .ccd-key{height:38px!important;min-width:0!important;padding:0!important;font-size:14px!important;font-weight:800!important}
    .ccd-key.op{background:#e8eef6!important}.ccd-key.eq{background:#2f855a!important;color:#fff!important}.ccd-key.clear{background:#fee2e2!important;color:#991b1b!important}
    .ccd-use{width:100%;margin-top:8px;height:36px!important;font-size:12px!important}
    .ccd-history{margin-top:9px;border-top:1px solid #e5e7eb;padding-top:8px}
    .ccd-history-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:12px;font-weight:800;color:#475569}
    .ccd-history-list{display:grid;gap:4px;max-height:110px;overflow:auto}
    .ccd-history-row{display:flex;justify-content:space-between;gap:10px;padding:6px 8px;border:1px solid #e2e8f0;border-radius:7px;background:#f8fafc;font-size:11px;cursor:pointer}
    .ccd-empty{font-size:11px;color:#94a3b8;padding:4px 1px}
    @media(max-width:560px){.ccd-display{grid-template-columns:1fr}.ccd-grid{grid-template-columns:repeat(4,1fr)}}
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
      <div class="ccd-title">🧮 ${t.title}</div>
      <div class="ccd-display"><input class="ccd-input" inputmode="decimal" autocomplete="off" placeholder="0"><div class="ccd-result">0</div></div>
      <div class="ccd-grid">
        <button type="button" class="tk-btn ccd-key clear" data-k="C">C</button>
        <button type="button" class="tk-btn ccd-key" data-k="⌫">⌫</button>
        <button type="button" class="tk-btn ccd-key op" data-k="(">(</button>
        <button type="button" class="tk-btn ccd-key op" data-k=")">)</button>
        <button type="button" class="tk-btn ccd-key op" data-k="%">%</button>
        <button type="button" class="tk-btn ccd-key" data-k="7">7</button>
        <button type="button" class="tk-btn ccd-key" data-k="8">8</button>
        <button type="button" class="tk-btn ccd-key" data-k="9">9</button>
        <button type="button" class="tk-btn ccd-key op" data-k="÷">÷</button>
        <button type="button" class="tk-btn ccd-key op" data-k="×">×</button>
        <button type="button" class="tk-btn ccd-key" data-k="4">4</button>
        <button type="button" class="tk-btn ccd-key" data-k="5">5</button>
        <button type="button" class="tk-btn ccd-key" data-k="6">6</button>
        <button type="button" class="tk-btn ccd-key op" data-k="−">−</button>
        <button type="button" class="tk-btn ccd-key op" data-k="+">+</button>
        <button type="button" class="tk-btn ccd-key" data-k="1">1</button>
        <button type="button" class="tk-btn ccd-key" data-k="2">2</button>
        <button type="button" class="tk-btn ccd-key" data-k="3">3</button>
        <button type="button" class="tk-btn ccd-key" data-k="0">0</button>
        <button type="button" class="tk-btn ccd-key" data-k=",">,</button>
        <button type="button" class="tk-btn ccd-key eq" data-k="=">=</button>
      </div>
      <button type="button" class="tk-btn ccd-use">${t.use}</button>
      <div class="ccd-history"><div class="ccd-history-head"><span>${t.history}</span><button type="button" class="tk-btn ccd-clear-history">${t.clear}</button></div><div class="ccd-history-list"></div></div>`;
    card.appendChild(box);

    const input=box.querySelector('.ccd-input');
    const result=box.querySelector('.ccd-result');
    const list=box.querySelector('.ccd-history-list');
    let lastValue=null;

    function renderHistory(){
      const h=loadHistory();
      list.innerHTML='';
      if(!h.length){list.innerHTML=`<div class="ccd-empty">${tr().empty}</div>`;return;}
      h.forEach(item=>{
        const row=document.createElement('div');
        row.className='ccd-history-row';
        row.innerHTML=`<span>${item.expr}</span><strong>= ${item.result}</strong>`;
        row.onclick=()=>{input.value=item.expr;result.textContent=item.result;lastValue=Number(item.value);};
        list.appendChild(row);
      });
    }

    function calc(addHistory=true){
      try{
        const value=evaluate(input.value);
        lastValue=value;
        const shown=fmt(value);
        result.textContent=shown;
        if(addHistory){const h=loadHistory();h.unshift({expr:input.value,result:shown,value,ts:Date.now()});saveHistory(h);renderHistory();}
        return value;
      }catch(_){lastValue=null;result.textContent=tr().error;return null;}
    }

    box.querySelectorAll('.ccd-key').forEach(btn=>btn.onclick=()=>{
      const k=btn.dataset.k;
      if(k==='C'){input.value='';result.textContent='0';lastValue=null;input.focus();return;}
      if(k==='⌫'){input.value=input.value.slice(0,-1);input.focus();return;}
      if(k==='='){calc(true);return;}
      input.value+=k;input.focus();
    });
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();calc(true);}});
    box.querySelector('.ccd-clear-history').onclick=()=>{localStorage.removeItem(HISTORY_KEY);renderHistory();};
    box.querySelector('.ccd-use').onclick=()=>{
      const value=lastValue==null?calc(false):lastValue;
      if(value==null)return;
      const amount=overlay.querySelector('#utilCurAmount');
      if(!amount)return;
      amount.value=String(value).replace('.',',');
      amount.dispatchEvent(new Event('input',{bubbles:true}));
      amount.focus();
    };
    renderHistory();
    return true;
  }

  const observer=new MutationObserver(()=>inject());
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  document.addEventListener('click',e=>{if(e.target?.closest?.('#headerCurrencyBtn'))setTimeout(inject,0);},true);
  setTimeout(inject,0);
})();
