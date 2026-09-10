'use strict';

(() => {
  const HISTORY_KEY='diagnostika-standalone-calculator-history';
  if(document.getElementById('standaloneCalculatorOverlay')) return;

  const style=document.createElement('style');
  style.textContent=`
    #headerCalculatorBtn{height:42px;min-width:112px;padding:0 12px;border:1px solid #3d4f66;border-radius:10px;background:linear-gradient(#5d7188,#405268);color:#fff;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;box-shadow:0 3px 9px rgba(30,41,59,.22);box-sizing:border-box;font:800 13px 'Segoe UI',Arial,sans-serif;flex:0 0 auto}
    #headerCalculatorBtn:hover{transform:translateY(-1px);filter:brightness(1.08)}
    #headerCalculatorBtn .calc-head-icon{font-size:19px;line-height:1}
    .standalone-calc-overlay{position:fixed;inset:0;z-index:13000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.54);backdrop-filter:blur(6px)}
    .standalone-calc-overlay[hidden]{display:none!important}
    .standalone-calc-panel{width:min(520px,calc(100vw - 24px));max-height:88dvh;overflow:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:16px;box-shadow:0 25px 70px rgba(15,23,42,.35);padding:18px;box-sizing:border-box;color:#243447}
    .standalone-calc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
    .standalone-calc-head h2{margin:0;font-size:23px}
    .standalone-calc-close{width:40px;height:40px;padding:0!important;border-radius:9px!important;font-size:20px!important}
    .standalone-calc-screen{display:grid;gap:9px;margin-bottom:13px}
    .standalone-calc-expression{height:58px;border:1px solid #b9c6d4;border-radius:10px;padding:0 14px;font-size:24px;font-weight:700;text-align:right;box-sizing:border-box;width:100%;background:#fff}
    .standalone-calc-result{min-height:62px;border:1px solid #c9e1d8;border-radius:10px;background:#eef7f4;padding:10px 14px;display:flex;align-items:center;justify-content:flex-end;font-size:30px;font-weight:900;box-sizing:border-box;word-break:break-all}
    .standalone-calc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
    .standalone-calc-grid button{height:52px!important;min-width:0!important;padding:0!important;border-radius:9px!important;font-size:19px!important;font-weight:800!important}
    .standalone-calc-grid .calc-op{background:linear-gradient(#70849a,#4f6277)!important;color:#fff!important}
    .standalone-calc-grid .calc-eq{background:linear-gradient(#48a873,#278656)!important;color:#fff!important}
    .standalone-calc-grid .calc-clear{background:linear-gradient(#ef7777,#d95353)!important;color:#fff!important}
    .standalone-calc-history{margin-top:17px;padding-top:13px;border-top:1px solid #dbe4ed}
    .standalone-calc-history-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
    .standalone-calc-history-head strong{font-size:16px}
    .standalone-calc-history-clear{height:34px!important;padding:0 11px!important;font-size:13px!important}
    .standalone-calc-history-list{display:grid;gap:6px;max-height:180px;overflow:auto}
    .standalone-calc-history-row{display:grid;grid-template-columns:1fr auto;gap:10px;padding:9px 10px;border:1px solid #e0e7ef;border-radius:8px;background:#fff;font-size:14px;cursor:pointer}
    .standalone-calc-history-row:hover{background:#eef6ff}
    .standalone-calc-empty{font-size:14px;color:#7b8ba1;padding:5px 0}
    @media(max-width:760px){#headerCalculatorBtn{min-width:46px;width:46px;padding:0}#headerCalculatorBtn .calc-head-label{display:none}.standalone-calc-overlay{place-items:end center;padding:0}.standalone-calc-panel{width:100%;max-height:90dvh;border-radius:18px 18px 0 0}.standalone-calc-grid button{height:54px!important}}
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
  overlay.id='standaloneCalculatorOverlay';
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
      row.onclick=()=>{input.value=item.expr;result.textContent=item.result;};
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

  overlay.querySelectorAll('[data-k]').forEach(btn=>btn.onclick=()=>{
    const k=btn.dataset.k;
    if(k==='C'){input.value='';result.textContent='0';input.focus();return;}
    if(k==='⌫'){input.value=input.value.slice(0,-1);input.focus();return;}
    if(k==='='){calculate();return;}
    input.value+=k;
    input.focus();
  });
  input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();calculate();}};
  overlay.querySelector('.standalone-calc-history-clear').onclick=()=>{localStorage.removeItem(HISTORY_KEY);renderHistory();};

  function closeCalc(){overlay.hidden=true;document.documentElement.style.overflow='';}
  function openCalc(){renderHistory();overlay.hidden=false;document.documentElement.style.overflow='hidden';setTimeout(()=>input.focus(),0);}
  overlay.querySelector('.standalone-calc-close').onclick=closeCalc;
  overlay.onclick=e=>{if(e.target===overlay)closeCalc();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)closeCalc();});

  function installButton(){
    if(document.getElementById('headerCalculatorBtn')) return true;
    const btn=document.createElement('button');
    btn.id='headerCalculatorBtn';
    btn.type='button';
    btn.innerHTML='<span class="calc-head-icon">🧮</span><span class="calc-head-label">Калькулятор</span>';
    btn.onclick=openCalc;

    const weather=document.getElementById('headerWeatherBtn');
    if(weather?.parentNode){weather.insertAdjacentElement('afterend',btn);return true;}

    const settings=document.querySelector('.settings-wrap');
    if(settings?.parentNode){settings.parentNode.insertBefore(btn,settings);return true;}

    const headerButtons=document.querySelector('.header-buttons');
    if(headerButtons){headerButtons.appendChild(btn);return true;}
    return false;
  }

  installButton();
  const observer=new MutationObserver(()=>installButton());
  observer.observe(document.body,{childList:true,subtree:true});
  let tries=0;
  const timer=setInterval(()=>{tries++;if(installButton()||tries>120)clearInterval(timer);},100);
})();
