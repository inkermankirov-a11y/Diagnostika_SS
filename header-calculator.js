'use strict';

(() => {
  const HISTORY_KEY='diagnostika-standalone-calculator-history';

  const style=document.createElement('style');
  style.textContent=`
    #headerCalculatorBtn{height:42px;width:94px;min-width:94px;max-width:94px;padding:4px 8px;border:1px solid #3d4f66;border-radius:10px;background:linear-gradient(#5d7188,#405268);color:#fff;display:grid;grid-template-columns:auto 1fr;grid-template-areas:'icon main' 'icon sub';column-gap:6px;row-gap:1px;align-content:center;cursor:pointer;box-shadow:0 3px 9px rgba(30,41,59,.22);box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}
    #headerCalculatorBtn:hover{transform:translateY(-1px);filter:brightness(1.08)}
    #headerCalculatorBtn .calc-head-icon{grid-area:icon;font-size:20px;align-self:center}
    #headerCalculatorBtn .calc-head-main{grid-area:main;font-size:12px;font-weight:800;line-height:1;text-align:left}
    #headerCalculatorBtn .calc-head-sub{grid-area:sub;font-size:10px;font-weight:700;line-height:1;text-align:left;opacity:.9}
    .standalone-calc-overlay{position:fixed;inset:0;z-index:13000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.54);backdrop-filter:blur(6px)}
    .standalone-calc-overlay[hidden]{display:none!important}
    .standalone-calc-panel{width:min(500px,calc(100vw - 24px));max-height:88dvh;overflow:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:16px;box-shadow:0 25px 70px rgba(15,23,42,.35);padding:16px;box-sizing:border-box;color:#243447}
    .standalone-calc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
    .standalone-calc-head h2{margin:0;font-size:22px}
    .standalone-calc-close{width:38px;height:38px;padding:0!important;border-radius:8px!important;font-size:18px!important}
    .standalone-calc-screen{display:grid;gap:8px;margin-bottom:12px}
    .standalone-calc-expression{height:54px;border:1px solid #b9c6d4;border-radius:10px;padding:0 14px;font-size:22px;font-weight:700;text-align:right;box-sizing:border-box;width:100%;background:#fff}
    .standalone-calc-result{min-height:58px;border:1px solid #c9e1d8;border-radius:10px;background:#eef7f4;padding:10px 14px;display:flex;align-items:center;justify-content:flex-end;font-size:28px;font-weight:900;box-sizing:border-box;word-break:break-all}
    .standalone-calc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .standalone-calc-grid button{height:48px!important;min-width:0!important;padding:0!important;border-radius:9px!important;font-size:18px!important;font-weight:800!important}
    .standalone-calc-grid .calc-op{background:linear-gradient(#70849a,#4f6277)!important;color:#fff!important}
    .standalone-calc-grid .calc-eq{background:linear-gradient(#48a873,#278656)!important;color:#fff!important}
    .standalone-calc-grid .calc-clear{background:linear-gradient(#ef7777,#d95353)!important;color:#fff!important}
    .standalone-calc-history{margin-top:16px;padding-top:12px;border-top:1px solid #dbe4ed}
    .standalone-calc-history-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
    .standalone-calc-history-head strong{font-size:15px}
    .standalone-calc-history-clear{height:32px!important;padding:0 10px!important;font-size:12px!important}
    .standalone-calc-history-list{display:grid;gap:6px;max-height:180px;overflow:auto}
    .standalone-calc-history-row{display:grid;grid-template-columns:1fr auto;gap:10px;padding:9px 10px;border:1px solid #e0e7ef;border-radius:8px;background:#fff;font-size:14px;cursor:pointer}
    .standalone-calc-history-row:hover{background:#eef6ff}
    .standalone-calc-history-row strong{white-space:nowrap}
    .standalone-calc-empty{font-size:13px;color:#7b8ba1;padding:5px 0}
    @media(max-width:760px){#headerCalculatorBtn{width:78px;min-width:78px;max-width:78px}.standalone-calc-overlay{place-items:end center;padding:0}.standalone-calc-panel{width:100%;max-height:90dvh;border-radius:18px 18px 0 0}.standalone-calc-grid button{height:52px!important}}
  `;
  document.head.appendChild(style);

  const locale=()=>{
    const l=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'ru';
    return l==='ru'?'ru-RU':l;
  };
  const fmt=n=>new Intl.NumberFormat(locale(),{maximumFractionDigits:10}).format(Number(n));
  const loadHistory=()=>{try{const x=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}};
  const saveHistory=h=>localStorage.setItem(HISTORY_KEY,JSON.stringify(h.slice(0,50)));

  function evaluate(raw){
    let expr=String(raw||'').replace(/,/g,'.').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/\s+/g,'');
    if(!expr||!^[0-9+\-*/().%]+$/.test(expr)) throw new Error('bad');
    expr=expr.replace(/(\d+(?:\.\d+)?)%/g,'($1/100)');
    const value=Function('"use strict";return ('+expr+')')();
    if(typeof value!=='number'||!Number.isFinite(value)) throw new Error('bad');
    return value;
  }

  const overlay=document.createElement('div');
  overlay.className='standalone-calc-overlay';
  overlay.hidden=true;
  overlay.innerHTML=`
    <section class="standalone-calc-panel">
      <div class="standalone-calc-head"><h2>🧮 Калькулятор</h2><button type="button" class="tk-btn standalone-calc-close">×</button></div>
      <div class="standalone-calc-screen">
        <input class="standalone-calc-expression" inputmode="decimal" autocomplete="off" placeholder="0">
        <div class="standalone-calc-result">0</div>
      </div>
      <div class="standalone-calc-grid">
        <button type="button" class="tk-btn calc-clear" data-k="C">C</button><button type="button" class="tk-btn" data-k="(">(</button><button type="button" class="tk-btn" data-k=")">)</button><button type="button" class="tk-btn calc-op" data-k="÷">÷</button>
        <button type="button" class="tk-btn" data-k="7">7</button><button type="button" class="tk-btn" data-k="8">8</button><button type="button" class="tk-btn" data-k="9">9</button><button type="button" class="tk-btn calc-op" data-k="×">×</button>
        <button type="button" class="tk-btn" data-k="4">4</button><button type="button" class="tk-btn" data-k="5">5</button><button type="button" class="tk-btn" data-k="6">6</button><button type="button" class="tk-btn calc-op" data-k="−">−</button>
        <button type="button" class="tk-btn" data-k="1">1</button><button type="button" class="tk-btn" data-k="2">2</button><button type="button" class="tk-btn" data-k="3">3</button><button type="button" class="tk-btn calc-op" data-k="+">+</button>
        <button type="button" class="tk-btn" data-k="0">0</button><button type="button" class="tk-btn" data-k=",">,</button><button type="button" class="tk-btn" data-k="⌫">⌫</button><button type="button" class="tk-btn calc-eq" data-k="=">=</button>
        <button type="button" class="tk-btn" data-k="%">%</button>
      </div>
      <div class="standalone-calc-history">
        <div class="standalone-calc-history-head"><strong>История расчётов</strong><button type="button" class="tk-btn standalone-calc-history-clear">Очистить</button></div>
        <div class="standalone-calc-history-list"></div>
      </div>
    </section>`;
  document.body.appendChild(overlay);

  const input=overlay.querySelector('.standalone-calc-expression');
  const result=overlay.querySelector('.standalone-calc-result');
  const historyList=overlay.querySelector('.standalone-calc-history-list');

  function renderHistory(){
    const h=loadHistory();
    historyList.innerHTML='';
    if(!h.length){historyList.innerHTML='<div class="standalone-calc-empty">История пока пуста</div>';return;}
    h.forEach(item=>{
      const row=document.createElement('div');
      row.className='standalone-calc-history-row';
      row.innerHTML=`<span>${item.expr}</span><strong>= ${item.result}</strong>`;
      row.addEventListener('click',()=>{input.value=item.expr;result.textContent=item.result;});
      historyList.appendChild(row);
    });
  }

  function calculate(){
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

  overlay.querySelectorAll('[data-k]').forEach(btn=>btn.addEventListener('click',()=>{
    const k=btn.dataset.k;
    if(k==='C'){input.value='';result.textContent='0';input.focus();return;}
    if(k==='⌫'){input.value=input.value.slice(0,-1);input.focus();return;}
    if(k==='='){calculate();return;}
    input.value+=k;
    input.focus();
  }));
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();calculate();}});
  overlay.querySelector('.standalone-calc-history-clear').addEventListener('click',()=>{localStorage.removeItem(HISTORY_KEY);renderHistory();});

  function close(){overlay.hidden=true;document.documentElement.style.overflow='';}
  overlay.querySelector('.standalone-calc-close').addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close();});

  function open(){renderHistory();overlay.hidden=false;document.documentElement.style.overflow='hidden';setTimeout(()=>input.focus(),0);}

  function installButton(){
    if(document.getElementById('headerCalculatorBtn')) return true;
    const group=document.getElementById('headerUtilityGroup');
    const weather=document.getElementById('headerWeatherBtn');
    if(!group||!weather) return false;
    const btn=document.createElement('button');
    btn.id='headerCalculatorBtn';
    btn.type='button';
    btn.innerHTML='<span class="calc-head-icon">🧮</span><span class="calc-head-main">Кальк.</span><span class="calc-head-sub">быстрый</span>';
    weather.insertAdjacentElement('afterend',btn);
    btn.addEventListener('click',open);
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{attempts++;if(installButton()||attempts>200)clearInterval(timer);},50);
  installButton();
})();
