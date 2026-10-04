'use strict';

(() => {
  const shell=()=>window.DiagnostikaPlatform?.shell||null;
  const currentClient=()=>window.DiagnostikaClients?.current?.()||null;
  const card = document.getElementById('diagnosisClientHeader');
  const diagnosticsLeft = document.querySelector('#diagnosticsLeft');
  if (!card) return;

  const compact = document.createElement('div');
  compact.id = 'diagnosisCompactClient';
  compact.className = 'diagnosis-compact-client';
  compact.innerHTML = `
    <button type="button" class="diagnosis-compact-back">← Назад к клиенту</button>
    <div class="diagnosis-compact-name"></div>
    <button type="button" class="diagnosis-hypothesis-btn"><span>Гипотеза</span></button>
  `;
  card.prepend(compact);

  const style = document.createElement('style');
  style.textContent = `
    .diagnosis-compact-client{
      --diagnosis-glass-top:rgba(53,68,91,.86);
      --diagnosis-glass-bottom:rgba(17,27,43,.94);
      display:flex;
      align-items:center;
      gap:12px;
      width:100%;
      padding:4px 2px 8px
    }

    .diagnosis-compact-back{
      min-height:38px;
      border:1px solid #2459c7!important;
      border-radius:9px!important;
      background:
        radial-gradient(115% 180% at 5% 120%,rgba(56,189,248,.46) 0%,rgba(56,189,248,.10) 42%,rgba(56,189,248,0) 70%),
        linear-gradient(180deg,#4f86ff 0%,#2457d6 100%)!important;
      color:#fff!important;
      font-weight:800;
      padding:8px 13px;
      cursor:pointer;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.36),
        0 5px 12px rgba(36,87,214,.25),
        0 0 12px rgba(56,189,248,.16)!important;
      text-shadow:0 1px 1px rgba(0,0,0,.25);
      white-space:nowrap
    }
    .diagnosis-compact-back:hover{
      border-color:#4d7ff0!important;
      background:
        radial-gradient(115% 180% at 5% 120%,rgba(83,205,255,.56) 0%,rgba(83,205,255,.14) 42%,rgba(83,205,255,0) 70%),
        linear-gradient(180deg,#5d91ff 0%,#2f63e4 100%)!important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.44),
        0 6px 14px rgba(36,87,214,.30),
        0 0 16px rgba(56,189,248,.24)!important
    }

    .diagnosis-compact-name{
      font-size:16px;
      font-weight:800;
      color:#203047;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      min-width:0
    }

    .diagnosis-hypothesis-btn{
      --lg-accent-rgb:74,224,181;
      --lg-accent2-rgb:49,190,211;
      flex:0 0 94px;
      width:94px!important;
      min-width:94px!important;
      max-width:94px!important;
      height:44px!important;
      min-height:44px!important;
      margin-left:auto;
      padding:4px 8px!important;
      border:1px solid rgba(var(--lg-accent-rgb),.60)!important;
      border-radius:15px!important;
      color:#f8fbff!important;
      background:
        radial-gradient(110% 190% at 4% 115%,rgba(var(--lg-accent-rgb),.56) 0%,rgba(var(--lg-accent-rgb),.18) 34%,rgba(var(--lg-accent-rgb),0) 67%),
        radial-gradient(92% 170% at 96% -48%,rgba(var(--lg-accent2-rgb),.46) 0%,rgba(var(--lg-accent2-rgb),.12) 38%,rgba(var(--lg-accent2-rgb),0) 70%),
        radial-gradient(120% 150% at 50% -90%,rgba(255,255,255,.54) 0%,rgba(255,255,255,.10) 48%,rgba(255,255,255,0) 67%),
        linear-gradient(180deg,var(--diagnosis-glass-top),var(--diagnosis-glass-bottom))!important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.58),
        inset 0 -1px 0 rgba(var(--lg-accent-rgb),.36),
        inset 1px 0 0 rgba(255,255,255,.08),
        0 6px 14px rgba(15,23,42,.25),
        0 0 14px rgba(var(--lg-accent-rgb),.22)!important;
      backdrop-filter:blur(18px) saturate(1.34);
      -webkit-backdrop-filter:blur(18px) saturate(1.34);
      text-shadow:0 1px 1px rgba(0,0,0,.34);
      isolation:isolate;
      overflow:hidden!important;
      cursor:pointer;
      font-family:'Segoe UI',Arial,sans-serif;
      font-size:13px;
      font-weight:800;
      line-height:1;
      position:relative
    }
    .diagnosis-hypothesis-btn::before{
      content:""!important;
      position:absolute!important;
      z-index:0!important;
      inset:1px 5px auto 5px!important;
      height:48%!important;
      border-radius:13px 13px 58% 58%!important;
      background:linear-gradient(180deg,rgba(255,255,255,.48),rgba(255,255,255,.15) 48%,rgba(255,255,255,0) 100%)!important;
      opacity:1!important;
      pointer-events:none!important
    }
    .diagnosis-hypothesis-btn::after{
      content:"";
      position:absolute;
      z-index:0;
      left:8%;
      right:8%;
      bottom:0;
      height:3px;
      border-radius:999px;
      background:linear-gradient(90deg,rgba(var(--lg-accent2-rgb),0),rgba(var(--lg-accent-rgb),.96) 35%,rgba(var(--lg-accent2-rgb),.94) 68%,rgba(var(--lg-accent2-rgb),0));
      opacity:.96;
      pointer-events:none
    }
    .diagnosis-hypothesis-btn>span{position:relative;z-index:1}
    .diagnosis-hypothesis-btn:hover{
      border-color:rgba(var(--lg-accent-rgb),.88)!important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.68),
        inset 0 -1px 0 rgba(var(--lg-accent-rgb),.46),
        0 8px 18px rgba(15,23,42,.27),
        0 0 22px rgba(var(--lg-accent-rgb),.34)!important
    }

    #diagnosisClientHeader{padding:8px 10px}
    body.diagnosis-active #diagnosticsLeft{display:block!important}

    @media (max-width:700px){
      .diagnosis-compact-client{gap:8px}
      .diagnosis-compact-back{padding:7px 9px;font-size:12px}
      .diagnosis-compact-name{font-size:14px}
      .diagnosis-hypothesis-btn{flex-basis:88px;width:88px!important;min-width:88px!important;max-width:88px!important}
    }
  `;
  document.head.appendChild(style);

  function sync(){
    const diag=shell()?.currentMode?.()==='diagnosis';
    document.body.classList.toggle('diagnosis-active',diag);
    if(diagnosticsLeft)diagnosticsLeft.classList.toggle('hidden',!diag);
    const c=currentClient();
    const nameEl=compact.querySelector('.diagnosis-compact-name');
    if(nameEl)nameEl.textContent=c?.name||'Клиент';
  }

  compact.querySelector('.diagnosis-compact-back').addEventListener('click',()=>{
    document.querySelector('#diagnosisLaunchDialog')?.close?.();
    document.querySelector('#requestHistoryDialog')?.close?.();
    shell()?.setMode?.('card');
    shell()?.clearSelection?.();
    shell()?.renderMode?.();
    shell()?.renderSessions?.();
    setTimeout(sync,0);
  });

  document.addEventListener('diagnostika:mode-rendered',sync);
  window.DiagnostikaPlatform?.events?.on?.('client:selected',()=>setTimeout(sync,0));
  sync();
})();
