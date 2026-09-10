'use strict';

(() => {
  const HISTORY_KEY='diagnostika-currency-calculator-history';

  const style=document.createElement('style');
  style.textContent=`
    .utility-overlay .currency-field{font-size:14px!important;font-weight:800!important;color:#42556d!important;gap:7px!important}
    .utility-overlay .currency-field select,
    .utility-overlay .currency-field input{height:48px!important;font-size:16px!important;font-weight:700!important;padding:0 12px!important}
    .utility-overlay .currency-amount-wrap{margin-top:14px!important}
    .utility-overlay .currency-result{margin-top:14px!important;padding:18px!important}
    .utility-overlay .currency-result-main{font-size:30px!important;line-height:1.1!important;font-weight:900!important}
    .utility-overlay .currency-rate{margin-top:8px!important;font-size:15px!important;line-height:1.35!important;color:#51657d!important;font-weight:600!important}
    .utility-overlay .utility-source{margin-top:14px!important;font-size:13px!important;line-height:1.35!important;color:#64748b!important;font-weight:700!important}

    .currency-calc-fixed{margin-top:14px;padding:16px;border:1px solid #d8e3ec;border-radius:12px;background:#fff}
    .currency-calc-fixed h3{margin:0 0 12px;font-size:18px;color:#243447}
    .currency-calc-screen{display:grid;grid-template-columns:1fr 150px;gap:10px;margin-bottom:10px}
    .currency-calc-input-fixed{height:50px;border:1px solid #b9c6d4;border-radius:9px;padding:0 12px;font-size:20px;font-weight:700;text-align:right;width:100%;box-sizing:border-box}
    .currency-calc-result-fixed{height:50px;border:1px solid #c9e1d8;border-radius:9px;background:#eef7f4;padding:0 12px;display:flex;align-items:center;justify-content:flex-end;font-size:20px;font-weight:900;box-sizing:border-box}
    .currency-calc-buttons-fixed{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
    .currency-calc-buttons-fixed button{height:42px!important;min-width:0!important;padding:0!important;font-size:16px!important;font-weight:800!important}
    .currency-calc-history-fixed{margin-top:14px;padding-top:12px;border-top:1px solid #dbe4ed}
    .currency-calc-history-head-fixed{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
    .currency-calc-history-head-fixed strong{font-size:14px}
    .currency-calc-history-list-fixed{display:grid;gap:6px;max-height:150px;overflow:auto}
    .currency-calc-history-row-fixed{display:grid;grid-template-columns:1fr auto;gap:10px;padding:8px 10px;border:1px solid #e0e7ef;border-radius:8px;background:#f8fafc;font-size:13px;cursor:pointer}
    .currency-calc-history-row-fixed:hover{background:#eef6ff}
    .currency-calc-empty-fixed{font-size:13px;color:#7b8ba1;padding:4px 0}
    @media(max-width:560px){
      .currency-calc-screen{grid-template-columns:1fr}
      .currency-calc-buttons-fixed{grid-template-columns:repeat(4,1fr)}
      .utility-overlay .currency-result-main{font-size:26px!important}
    }
  `;
  document.head.appendChild(style);

  const locale=()=>{
    const l=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'ru';
    return l==='ru'?'ru-RU':l;
  };
  const fmt=n=>new Intl.NumberFormat(locale(),{maximumFractionDigits:10}).format(Number(n));
  const loadHistory=()=>{try{const x=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}};
  const saveHistory=x=>localStorage.setItem(HISTORY_KEY,JSON.stringify(x.slice(0,30)));

  function evaluate(raw){
    let expr=String(raw||'').replace(/,/g,'.').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/\s+/g,'');
    if(!expr||!^[0-9+\-*/().%]+$/.test(expr)) throw new Error('bad');
    expr=expr.replace(/(\d+(?:\.\d+)?)%/g,'($1/100)');
    const value=Function('"use strict";return ('+expr+')')();
    if(typeof value!=='number'||!Number.isFinite(value)) throw new Error('bad');
    return value;
  }

  function injectCalculator(){
    const overlay=document.querySelector('.utility-overlay:not([hidden])');
    if(!overlay) return;
    const card=overlay.querySelector('.currency-card');
    if(!card) return;
    if(overlay.querySelector('.currency-calc-fixed')) return;

    // Remove older calculator implementation if it happened to load too.
    overlay.querySelectorAll('.currency-calculator').forEach(el=>el.remove());

    const box=document.createElement('section');
    box.className='currency-calc-fixed';
    box.innerHTML=`
      <h3>🧮 Калькулятор</h3>
      <div class="currency-calc-screen">
        <input class="currency-calc-input-fixed" inputmode="decimal" autocomplete="off" placeholder="0">
        <div class="currency-calc-result-fixed">0</div>
      </div>
      <div class="currency-calc-buttons-fixed">
        <button type="button" class="tk-btn" data-k="C">C</button>
        <button type="button" class="tk-btn" data-k="(">(</button>
        <button type="button" class="tk-btn" data-k=")">)</button>
        <button type="button" class="tk-btn" data-k="%">%</button>
        <button type="button" class="tk-btn" data-k="÷">÷</button>
        <button type="button" class="tk-btn" data-k="7">7</button>
        <button type="button" class="tk-btn" data-k="8">8</button>
        <button type="button" class="tk-btn" data-k="9">9</button>
        <button type="button" class="tk-btn" data-k="×">×</button>
        <button type="button" class="tk-btn" data-k="⌫">⌫</button>
        <button type="button" class="tk-btn" data-k="4">4</button>
        <button type="button" class="tk-btn" data-k="5">5</button>
        <button type="button" class="tk-btn" data-k="6">6</button>
        <button type="button" class="tk-btn" data-k="−">−</button>
        <button type="button" class="tk-btn" data-k=",">,</button>
        <button type="button" class="tk-btn" data-k="1">1</button>
        <button type="button" class="tk-btn" data-k="2">2</button>
        <button type="button" class="tk-btn" data-k="3">3</button>
        <button type="button" class="tk-btn" data-k="+">+</button>
        <button type="button" class="tk-btn" data-k="=">=</button>
        <button type="button" class="tk-btn" data-k="0">0</button>
        <button type="button" class="tk-btn" data-k="00">00</button>
      </div>
      <div class="currency-calc-history-fixed">
        <div class="currency-calc-history-head-fixed"><strong>История расчётов</strong><button type="button" class="tk-btn currency-calc-clear-fixed">Очистить</button></div>
        <div class="currency-calc-history-list-fixed"></div>
      </div>`;

    const source=overlay.querySelector('.utility-source');
    if(source) source.insertAdjacentElement('beforebegin',box); else card.insertAdjacentElement('afterend',box);

    const input=box.querySelector('.currency-calc-input-fixed');
    const result=box.querySelector('.currency-calc-result-fixed');
    const list=box.querySelector('.currency-calc-history-list-fixed');

    function renderHistory(){
      const h=loadHistory();
      list.innerHTML='';
      if(!h.length){list.innerHTML='<div class="currency-calc-empty-fixed">История пока пуста</div>';return;}
      h.forEach(item=>{
        const row=document.createElement('div');
        row.className='currency-calc-history-row-fixed';
        row.innerHTML=`<span>${item.expr}</span><strong>= ${item.result}</strong>`;
        row.addEventListener('click',()=>{input.value=item.expr;result.textContent=item.result;});
        list.appendChild(row);
      });
    }

    function calc(){
      try{
        const value=evaluate(input.value);
        const shown=fmt(value);
        result.textContent=shown;
        const h=loadHistory();
        h.unshift({expr:input.value,result:shown,ts:Date.now()});
        saveHistory(h);
        renderHistory();
      }catch(_){result.textContent='Ошибка';}
    }

    box.querySelectorAll('[data-k]').forEach(btn=>btn.addEventListener('click',()=>{
      const k=btn.dataset.k;
      if(k==='C'){input.value='';result.textContent='0';return;}
      if(k==='⌫'){input.value=input.value.slice(0,-1);return;}
      if(k==='='){calc();return;}
      input.value+=k;
      input.focus();
    }));
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();calc();}});
    box.querySelector('.currency-calc-clear-fixed').addEventListener('click',()=>{localStorage.removeItem(HISTORY_KEY);renderHistory();});
    renderHistory();
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('#headerCurrencyBtn')){
      setTimeout(injectCalculator,0);
      setTimeout(injectCalculator,80);
      setTimeout(injectCalculator,250);
    }
  },true);

  const observer=new MutationObserver(()=>injectCalculator());
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
})();
