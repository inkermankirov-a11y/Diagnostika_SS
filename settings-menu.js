'use strict';

(() => {
  const headerButtons=document.querySelector('.header-buttons');
  if(!headerButtons || document.querySelector('#settingsMenuBtn')) return;

  const LABELS={
    ru:{settings:'Настройки',close:'Закрыть настройки'},
    en:{settings:'Settings',close:'Close settings'},
    fr:{settings:'Paramètres',close:'Fermer les paramètres'},
    de:{settings:'Einstellungen',close:'Einstellungen schließen'},
    it:{settings:'Impostazioni',close:'Chiudi impostazioni'}
  };

  const style=document.createElement('style');
  style.textContent=`
    .header-buttons.settings-only{position:relative;display:flex!important;justify-content:flex-end!important;align-items:center!important;flex-wrap:nowrap!important}
    .settings-wrap{position:relative;display:flex;align-items:center}
    .settings-main-btn{height:42px;min-width:132px;padding:0 15px;border:1px solid #3d4f66;border-radius:10px;background:linear-gradient(#5d7188,#405268);color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer;box-shadow:0 3px 9px rgba(30,41,59,.24);transition:transform .16s ease,filter .16s ease,box-shadow .16s ease}
    .settings-main-btn:hover{transform:translateY(-1px);filter:brightness(1.08);box-shadow:0 6px 14px rgba(30,41,59,.25)}
    .settings-main-btn:active{transform:translateY(1px)}
    .settings-gear{display:inline-block;font-size:20px;line-height:1;transform-origin:50% 50%;transition:transform .45s cubic-bezier(.2,.8,.2,1)}
    .settings-main-btn:hover .settings-gear{transform:rotate(90deg)}
    .settings-wrap.open .settings-gear{animation:settingsGearSpin 3.2s linear infinite}
    @keyframes settingsGearSpin{to{transform:rotate(360deg)}}
    .settings-panel{position:absolute;right:0;top:calc(100% + 8px);z-index:6500;width:min(310px,calc(100vw - 18px));padding:9px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;box-shadow:0 18px 45px rgba(15,23,42,.25);display:none}
    .settings-wrap.open .settings-panel{display:grid;gap:7px;animation:settingsPanelIn .14s ease-out}
    @keyframes settingsPanelIn{from{opacity:0;transform:translateY(-5px) scale(.98)}to{opacity:1;transform:none}}
    .settings-panel>.header-btn,.settings-panel>.storage-btn{width:100%!important;min-width:0!important;height:42px!important;margin:0!important;flex:none!important;text-align:center!important}
    .settings-panel .language-switcher{width:100%!important;display:block!important}
    .settings-panel .language-btn{width:100%!important;min-width:0!important;height:42px!important;justify-content:center!important}
    .settings-panel .language-menu{position:static!important;width:100%!important;margin-top:6px!important;box-shadow:none!important;border-color:#d8e0e9!important}
    .utility-overlay[hidden]{display:none!important}
    @media(max-width:760px){
      .app-header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important}
      .app-header h1{margin:0!important;min-width:0!important}
      .header-buttons.settings-only{flex:0 0 auto!important}
      .settings-main-btn{min-width:46px!important;width:46px!important;height:42px!important;padding:0!important}
      .settings-main-btn .settings-label{display:none}
      .settings-panel{position:fixed!important;right:8px!important;top:62px!important;bottom:auto!important;width:calc(100vw - 16px)!important;max-height:calc(100dvh - 72px)!important;overflow:auto!important}
    }
  `;
  document.head.appendChild(style);

  const wrap=document.createElement('div');
  wrap.className='settings-wrap';
  wrap.innerHTML=`
    <button id="settingsMenuBtn" class="settings-main-btn" type="button" aria-expanded="false">
      <span class="settings-gear" aria-hidden="true">⚙</span>
      <span class="settings-label">Настройки</span>
    </button>
    <div class="settings-panel" id="settingsPanel"></div>`;

  const btn=wrap.querySelector('#settingsMenuBtn');
  const panel=wrap.querySelector('#settingsPanel');

  const saveHistory=document.getElementById('saveHistoryBtn');
  if(saveHistory) saveHistory.remove();

  const moveIds=['clientBaseBtn','storageBtn','testFillBtn','exportTxtBtn'];
  moveIds.forEach(id=>{
    const el=document.getElementById(id);
    if(el){
      el.classList.remove('client-base-inline');
      panel.appendChild(el);
    }
  });

  const language=document.querySelector('.language-switcher');
  if(language) panel.appendChild(language);

  headerButtons.innerHTML='';
  headerButtons.classList.add('settings-only');
  headerButtons.appendChild(wrap);

  function currentLang(){
    const l=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'en';
    return LABELS[l]?l:'en';
  }
  function updateLabel(){
    const t=LABELS[currentLang()];
    const label=btn.querySelector('.settings-label');
    if(label) label.textContent=t.settings;
    btn.title=t.settings;
    btn.setAttribute('aria-label',wrap.classList.contains('open')?t.close:t.settings);
  }
  function setOpen(open){
    wrap.classList.toggle('open',open);
    btn.setAttribute('aria-expanded',String(open));
    updateLabel();
  }

  btn.addEventListener('click',e=>{
    e.stopPropagation();
    setOpen(!wrap.classList.contains('open'));
  });

  panel.addEventListener('click',e=>{
    e.stopPropagation();
    if(e.target.closest('.language-option')){
      setTimeout(updateLabel,0);
      return;
    }
    if(e.target.closest('.language-btn')) return;
    if(e.target.closest('button')) setTimeout(()=>setOpen(false),0);
  });

  document.addEventListener('click',e=>{
    if(!wrap.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && wrap.classList.contains('open')) setOpen(false);
  });

  const oldSetLanguage=window.DiagnostikaI18n?.setLanguage;
  if(oldSetLanguage){
    window.DiagnostikaI18n.setLanguage=function(lang){
      const result=oldSetLanguage.call(window.DiagnostikaI18n,lang);
      setTimeout(updateLabel,0);
      return result;
    };
  }

  updateLabel();
})();

(() => {
  if(document.querySelector('script[data-storage-simple-sync]')) return;
  const s=document.createElement('script');
  s.src='storage-simple-sync.js';
  s.dataset.storageSimpleSync='1';
  s.onload=()=>{
    if(document.querySelector('script[data-storage-folder-controls]')) return;
    const f=document.createElement('script');
    f.src='storage-folder-controls.js';
    f.dataset.storageFolderControls='1';
    document.body.appendChild(f);
  };
  document.body.appendChild(s);
})();

(() => {
  if(document.querySelector('script[data-header-utilities]')) return;
  const s=document.createElement('script');
  s.src='header-utilities.js';
  s.dataset.headerUtilities='1';
  document.body.appendChild(s);
})();
