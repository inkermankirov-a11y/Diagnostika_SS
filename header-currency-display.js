'use strict';

(() => {
  function apply(){
    const btn=document.getElementById('headerCurrencyBtn');
    if(!btn)return false;
    const icon=btn.querySelector('.hu-icon');
    const main=btn.querySelector('.hu-main');
    const sub=btn.querySelector('.hu-sub');
    if(icon) icon.textContent='$';
    if(main){
      const clean=main.textContent.replace(/\s*₽\s*$/,'').trim();
      if(clean!==main.textContent) main.textContent=clean;
    }
    if(sub && !sub.textContent.trim()) sub.textContent='USD';
    btn.classList.add('currency-compact-display');
    return true;
  }

  const style=document.createElement('style');
  style.textContent=`
    #headerCurrencyBtn.currency-compact-display{grid-template-columns:28px 1fr!important;grid-template-rows:16px 18px!important;grid-template-areas:'icon code' 'icon rate'!important;column-gap:7px!important;row-gap:2px!important;align-items:center!important;padding:4px 8px!important}
    #headerCurrencyBtn.currency-compact-display .hu-icon{grid-area:icon!important;font-size:24px!important;font-weight:900!important;line-height:1!important;text-align:center!important;padding-right:6px!important;border-right:1px solid rgba(255,255,255,.28)!important}
    #headerCurrencyBtn.currency-compact-display .hu-sub{grid-area:code!important;margin:0!important;max-width:none!important;overflow:visible!important;text-overflow:clip!important;text-align:left!important;justify-self:start!important;font-size:10px!important;font-weight:800!important;letter-spacing:.7px!important;line-height:1!important;align-self:end!important;color:#dbeafe!important}
    #headerCurrencyBtn.currency-compact-display .hu-main{grid-area:rate!important;text-align:left!important;justify-self:start!important;font-size:13px!important;font-weight:900!important;line-height:1!important;align-self:start!important;overflow:visible!important;text-overflow:clip!important;color:#fff!important}
    .currency-calculator-inline{margin-top:12px;padding:14px;border:1px solid #d8e3ec;border-radius:12px;background:#fff}
    .currency-calculator-inline h3{margin:0 0 10px;font-size:15px;color:#243447}
    .cci-display{display:grid;grid-template-columns:1fr 120px;gap:8px;margin-bottom:9px}
    .cci-input{height:44px;border:1px solid #b9c6d4;border-radius:9px;padding:0 12px;font-size:18px;font-weight:700;text-align:right;box-sizing:border-box;width:100%}
    .cci-result{height:44px;border:1px solid #c9e1d8;border-radius:9px;background:#eef7f4;display:flex;align-items:center;justify-content:flex-end;padding:0 12px;font-size:18px;font-weight:900;box-sizing:border-box}
    .cci-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
    .cci-key{height:40px!important;min-width:0!important;padding:0!important;font-weight:800!important}
    .cci-history{margin-top:12px;border-top:1px solid #dbe4ed;padding-top:10px}
    .cci-history-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:7px;font-size:12px;font-weight:800}
    .cci-history-list{display:grid;gap:5px;max-height:130px;overflow:auto}
    .cci-history-row{display:flex;justify-content:space-between;gap:10px;padding:7px 9px;border:1px solid #e0e7ef;border-radius:8px;background:#f8fafc;font-size:12px;cursor:pointer}
    .cci-clear{height:28px!important;padding:0 8px!important;font-size:11px!important}
    @media(max-width:560px){.cci-display{grid-template-columns:1fr}.cci-result{justify-content:flex-end}}
  `;
  document.head.appendChild(style);

  function ensureCalculator(){
    if(window.__diagnostikaCurrencyCalculatorLoaded) return;
    if(document.querySelector('script[data-currency-calculator-history]')) return;
    const s=document.createElement('script');
    s.src='currency-calculator-history.js?v=20260911-2';
    s.dataset.currencyCalculatorHistory='1';
    s.onload=()=>{window.__diagnostikaCurrencyCalculatorLoaded=true;};
    s.onerror=()=>{s.remove();};
    document.body.appendChild(s);
  }

  const HISTORY_KEY='diagnostika-currency-calculator-history';
  const loadHistory=()=>{try{const x=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}};
  const saveHistory=h=>localStorage.setItem(HISTORY_KEY,JSON.stringify(h.slice(0,30)));
  const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:10}).format(Number(n));
  function evalExpr(raw){
    let s=String(raw||'').replace(/,/g,'.').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/\s+/g,'');
    if(!s||!^[0-9+\-*/().%]+$/.test(s))throw Error();
    s=s.replace(/(\d+(?:\.\d+)?)%/g,'($1/100)');
    const v=Function('"use strict";return ('+s+')')();
    if(!Number.isFinite(v))throw Error();
    return v;
  }

  function injectInlineCalculator(){
    const card=document.querySelector('.utility-overlay:not([hidden]) .currency-card');
    if(!card || card.querySelector('.currency-calculator,.currency-calculator-inline')) return !!card;
    const box=document.createElement('section');
    box.className='currency-calculator-inline';
    box.innerHTML=`<h3>🧮 Калькулятор</h3>
      <div class="cci-display"><input class="cci-input" inputmode="decimal" placeholder="0"><div class="cci-result">0</div></div>
      <div class="cci-grid">
        <button type="button" class="tk-btn cci-key" data-k="C">C</button><button type="button" class="tk-btn cci-key" data-k="⌫">⌫</button><button type="button" class="tk-btn cci-key" data-k="%">%</button><button type="button" class="tk-btn cci-key" data-k="÷">÷</button>
        <button type="button" class="tk-btn cci-key" data-k="7">7</button><button type="button" class="tk-btn cci-key" data-k="8">8</button><button type="button" class="tk-btn cci-key" data-k="9">9</button><button type="button" class="tk-btn cci-key" data-k="×">×</button>
        <button type="button" class="tk-btn cci-key" data-k="4">4</button><button type="button" class="tk-btn cci-key" data-k="5">5</button><button type="button" class="tk-btn cci-key" data-k="6">6</button><button type="button" class="tk-btn cci-key" data-k="−">−</button>
        <button type="button" class="tk-btn cci-key" data-k="1">1</button><button type="button" class="tk-btn cci-key" data-k="2">2</button><button type="button" class="tk-btn cci-key" data-k="3">3</button><button type="button" class="tk-btn cci-key" data-k="+">+</button>
        <button type="button" class="tk-btn cci-key" data-k="(">(</button><button type="button" class="tk-btn cci-key" data-k="0">0</button><button type="button" class="tk-btn cci-key" data-k=",">,</button><button type="button" class="tk-btn cci-key" data-k="=">=</button>
      </div>
      <div class="cci-history"><div class="cci-history-head"><span>История</span><button type="button" class="tk-btn cci-clear">Очистить</button></div><div class="cci-history-list"></div></div>`;
    card.appendChild(box);
    const input=box.querySelector('.cci-input'),res=box.querySelector('.cci-result'),list=box.querySelector('.cci-history-list');
    const renderHistory=()=>{
      const h=loadHistory();
      list.innerHTML=h.length?'':'<div style="font-size:11px;color:#94a3b8">История пока пуста</div>';
      h.forEach(item=>{const row=document.createElement('div');row.className='cci-history-row';row.innerHTML=`<span>${item.expr}</span><strong>= ${item.result}</strong>`;row.onclick=()=>{input.value=item.expr;res.textContent=item.result;};list.appendChild(row);});
    };
    const calculate=()=>{try{const v=evalExpr(input.value),shown=fmt(v);res.textContent=shown;const h=loadHistory();h.unshift({expr:input.value,result:shown,ts:Date.now()});saveHistory(h);renderHistory();}catch(_){res.textContent='Ошибка';}};
    box.querySelectorAll('.cci-key').forEach(b=>b.onclick=()=>{const k=b.dataset.k;if(k==='C'){input.value='';res.textContent='0';return;}if(k==='⌫'){input.value=input.value.slice(0,-1);return;}if(k==='='){calculate();return;}input.value+=k;input.focus();});
    input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();calculate();}};
    box.querySelector('.cci-clear').onclick=()=>{localStorage.removeItem(HISTORY_KEY);renderHistory();};
    renderHistory();
    return true;
  }

  function scheduleInject(){let n=0;const timer=setInterval(()=>{n++;if(injectInlineCalculator()||n>20)clearInterval(timer);},50);}
  document.addEventListener('click',e=>{if(e.target.closest('#headerCurrencyBtn'))setTimeout(scheduleInject,0);});

  let observer=null;
  function start(){
    ensureCalculator();
    if(!apply()){setTimeout(start,100);return;}
    const btn=document.getElementById('headerCurrencyBtn');
    observer=new MutationObserver(()=>{
      const main=btn?.querySelector('.hu-main');
      if(!main)return;
      const clean=main.textContent.replace(/\s*₽\s*$/,'').trim();
      if(clean!==main.textContent) main.textContent=clean;
      const icon=btn.querySelector('.hu-icon');
      if(icon&&icon.textContent!=='$')icon.textContent='$';
    });
    observer.observe(btn,{subtree:true,childList:true,characterData:true});
  }
  start();
})();
