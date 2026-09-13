'use strict';

(() => {
  if(window.__diagnostikaAiProcessingIndicatorReady) return;
  window.__diagnostikaAiProcessingIndicatorReady=true;

  const style=document.createElement('style');
  style.textContent=`
    .ai-processing-overlay{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.46);backdrop-filter:blur(5px)}
    .ai-processing-overlay.show{display:flex}
    .ai-processing-card{width:min(440px,calc(100vw - 32px));background:#fff;border:1px solid #d9e2ec;border-radius:16px;box-shadow:0 28px 80px rgba(15,23,42,.36);padding:22px;box-sizing:border-box;text-align:center;color:#25364a}
    .ai-processing-spinner{width:54px;height:54px;margin:0 auto 14px;border-radius:50%;border:5px solid #dfe9f6;border-top-color:#2f7fe9;animation:aiProcessingSpin .85s linear infinite}
    .ai-processing-title{font-size:18px;font-weight:900;margin-bottom:7px}
    .ai-processing-status{font-size:13px;line-height:1.45;color:#60758f;min-height:38px;display:flex;align-items:center;justify-content:center}
    .ai-processing-track{height:7px;background:#edf2f7;border-radius:999px;overflow:hidden;margin-top:14px}
    .ai-processing-bar{height:100%;width:34%;border-radius:999px;background:linear-gradient(90deg,#4b90f5,#2c6ed7,#4b90f5);animation:aiProcessingBar 1.5s ease-in-out infinite}
    .ai-processing-note{font-size:11px;color:#8a99ab;margin-top:9px}
    @keyframes aiProcessingSpin{to{transform:rotate(360deg)}}
    @keyframes aiProcessingBar{0%{transform:translateX(-110%)}50%{transform:translateX(105%)}100%{transform:translateX(300%)}}
    @media (prefers-reduced-motion:reduce){.ai-processing-spinner,.ai-processing-bar{animation-duration:2.4s}}
  `;
  document.head.appendChild(style);

  const overlay=document.createElement('div');
  overlay.className='ai-processing-overlay';
  overlay.setAttribute('aria-live','polite');
  overlay.setAttribute('aria-busy','true');
  overlay.innerHTML=`
    <div class="ai-processing-card" role="status">
      <div class="ai-processing-spinner"></div>
      <div class="ai-processing-title">ИИ обрабатывает консультацию</div>
      <div class="ai-processing-status">Отправляю данные в ИИ…</div>
      <div class="ai-processing-track"><div class="ai-processing-bar"></div></div>
      <div class="ai-processing-note">Обычно это занимает несколько секунд.</div>
    </div>`;
  document.body.appendChild(overlay);

  const statusEl=overlay.querySelector('.ai-processing-status');
  const stages=[
    'Отправляю данные в ИИ…',
    'Анализирую слова клиента и отделяю препятствие от результата…',
    'Формирую развёрнутый и короткий запросы…',
    'Выделяю ситуации для Диагностики…',
    'Проверяю обоснование и уточняющие вопросы…'
  ];
  let timer=null;
  let stageIndex=0;

  function show(){
    stageIndex=0;
    statusEl.textContent=stages[0];
    overlay.classList.add('show');
    clearInterval(timer);
    timer=setInterval(()=>{
      stageIndex=Math.min(stageIndex+1,stages.length-1);
      statusEl.textContent=stages[stageIndex];
      if(stageIndex===stages.length-1) clearInterval(timer);
    },2200);
  }

  function hide(){
    clearInterval(timer);
    timer=null;
    overlay.classList.remove('show');
  }

  function wrapGenerator(){
    const api=window.DiagnostikaRequestAI;
    if(!api||typeof api.generate!=='function'||api.generate.__processingWrapped) return false;
    const original=api.generate.bind(api);
    const wrapped=async function(){
      show();
      try{return await original(...arguments);}
      finally{hide();}
    };
    wrapped.__processingWrapped=true;
    api.generate=wrapped;
    return true;
  }

  if(!wrapGenerator()){
    const timerId=setInterval(()=>{
      if(wrapGenerator()) clearInterval(timerId);
    },250);
    setTimeout(()=>clearInterval(timerId),10000);
  }

  window.DiagnostikaAiProcessingIndicator={show,hide};
})();
