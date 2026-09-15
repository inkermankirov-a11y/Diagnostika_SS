'use strict';

(() => {
  const headerButtons=document.querySelector('.header-buttons');
  if(!headerButtons || document.querySelector('#settingsMenuBtn')) return;

  const LABELS={
    ru:{settings:'Настройки',close:'Закрыть настройки',clients:'Клиенты',accounts:'Учетные записи',interface:'Настройки интерфейса',coming:'Раздел учетных записей уже заложен и будет подключён позже.'},
    en:{settings:'Settings',close:'Close settings',clients:'Clients',accounts:'Accounts',interface:'Interface settings',coming:'The accounts section is prepared and will be connected later.'},
    fr:{settings:'Paramètres',close:'Fermer les paramètres',clients:'Clients',accounts:'Comptes',interface:"Paramètres d’interface",coming:'La section des comptes est préparée et sera connectée plus tard.'},
    de:{settings:'Einstellungen',close:'Einstellungen schließen',clients:'Kunden',accounts:'Konten',interface:'Oberflächeneinstellungen',coming:'Der Kontobereich ist vorbereitet und wird später angeschlossen.'},
    it:{settings:'Impostazioni',close:'Chiudi impostazioni',clients:'Clienti',accounts:'Account',interface:"Impostazioni interfaccia",coming:'La sezione account è pronta e verrà collegata in seguito.'}
  };

  const style=document.createElement('style');
  style.textContent=`
    .app-header{display:flex;align-items:center;gap:14px}
    .header-title-group{display:flex;align-items:center;gap:14px;min-width:0;flex:1 1 auto}
    .header-title-group h1{margin:0;white-space:nowrap}
    .header-client-btn{height:42px;min-width:112px;padding:0 16px;border:1px solid #31506f;border-radius:10px;background:linear-gradient(#66809a,#47627c);color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 3px 9px rgba(30,41,59,.22);transition:transform .16s ease,filter .16s ease,box-shadow .16s ease}
    .header-client-btn:hover{transform:translateY(-1px);filter:brightness(1.08);box-shadow:0 6px 14px rgba(30,41,59,.24)}
    .header-client-btn:active{transform:translateY(1px)}
    .header-buttons.settings-only{position:relative;display:flex!important;justify-content:flex-end!important;align-items:center!important;flex-wrap:nowrap!important;flex:0 0 auto;margin-left:auto}
    .settings-wrap{position:relative;display:flex;align-items:center}
    .settings-main-btn{height:42px;min-width:132px;padding:0 15px;border:1px solid #3d4f66;border-radius:10px;background:linear-gradient(#5d7188,#405268);color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer;box-shadow:0 3px 9px rgba(30,41,59,.24);transition:transform .16s ease,filter .16s ease,box-shadow .16s ease}
    .settings-main-btn:hover{transform:translateY(-1px);filter:brightness(1.08);box-shadow:0 6px 14px rgba(30,41,59,.25)}
    .settings-main-btn:active{transform:translateY(1px)}
    .settings-gear{display:inline-block;font-size:20px;line-height:1;transform-origin:50% 50%;transition:transform .45s cubic-bezier(.2,.8,.2,1)}
    .settings-main-btn:hover .settings-gear{transform:rotate(90deg)}
    .settings-wrap.open .settings-gear{animation:settingsGearSpin 3.2s linear infinite}
    @keyframes settingsGearSpin{to{transform:rotate(360deg)}}
    .settings-panel{position:absolute;right:0;top:calc(100% + 8px);z-index:6500;width:min(330px,calc(100vw - 18px));padding:9px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;box-shadow:0 18px 45px rgba(15,23,42,.25);display:none}
    .settings-wrap.open .settings-panel{display:grid;gap:7px;animation:settingsPanelIn .14s ease-out}
    @keyframes settingsPanelIn{from{opacity:0;transform:translateY(-5px) scale(.98)}to{opacity:1;transform:none}}
    .settings-section-btn{width:100%;height:44px;border:1px solid #ccd7e2;border-radius:10px;background:#f8fafc;color:#33465a;font-size:13px;font-weight:850;text-align:left;padding:0 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer}
    .settings-section-btn:hover{background:#eef4fa}
    .settings-section-btn.active{background:#eaf3ff;border-color:#a9c6ea;color:#245fae}
    .settings-section-chevron{font-size:12px;transition:transform .18s ease}
    .settings-section-btn.active .settings-section-chevron{transform:rotate(180deg)}
    .settings-interface-content{display:none;padding:3px 0 1px;gap:7px}
    .settings-interface-content.open{display:grid}
    .settings-interface-content .language-switcher{width:100%!important;display:block!important}
    .settings-interface-content .language-btn{width:100%!important;min-width:0!important;height:42px!important;justify-content:center!important}
    .settings-interface-content .language-menu{position:static!important;width:100%!important;margin-top:6px!important;box-shadow:none!important;border-color:#d8e0e9!important}
    .settings-panel>.header-btn,.settings-panel>.storage-btn{width:100%!important;min-width:0!important;height:42px!important;margin:0!important;flex:none!important;text-align:center!important}
    #testFillBtn,#exportTxtBtn{display:none!important}
    .utility-overlay[hidden]{display:none!important}
    @media(max-width:760px){
      .app-header{align-items:center!important;gap:7px!important}
      .header-title-group{gap:7px!important;min-width:0;flex:1 1 auto}
      .header-title-group h1{font-size:18px!important;overflow:hidden;text-overflow:ellipsis}
      .header-client-btn{height:42px;min-width:78px;padding:0 10px;font-size:12px}
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
    <div class="settings-panel" id="settingsPanel">
      <button type="button" class="settings-section-btn settings-accounts-btn"><span>Учетные записи</span><span>›</span></button>
      <button type="button" class="settings-section-btn settings-interface-btn"><span>Настройки интерфейса</span><span class="settings-section-chevron">⌄</span></button>
      <div class="settings-interface-content"></div>
    </div>`;

  const btn=wrap.querySelector('#settingsMenuBtn');
  const panel=wrap.querySelector('#settingsPanel');
  const accountsBtn=wrap.querySelector('.settings-accounts-btn');
  const interfaceBtn=wrap.querySelector('.settings-interface-btn');
  const interfaceContent=wrap.querySelector('.settings-interface-content');

  const saveHistory=document.getElementById('saveHistoryBtn');
  if(saveHistory) saveHistory.remove();

  const appHeader=document.querySelector('.app-header');
  const title=appHeader?.querySelector('h1');
  const clientBase=document.getElementById('clientBaseBtn');
  if(appHeader&&title&&clientBase){
    const titleGroup=document.createElement('div');
    titleGroup.className='header-title-group';
    appHeader.insertBefore(titleGroup,headerButtons);
    titleGroup.appendChild(title);
    clientBase.classList.remove('header-btn','client-base-inline');
    clientBase.classList.add('header-client-btn');
    clientBase.removeAttribute('style');
    titleGroup.appendChild(clientBase);
  }

  const moveIds=['storageBtn','testFillBtn','exportTxtBtn'];
  moveIds.forEach(id=>{
    const el=document.getElementById(id);
    if(el){
      el.classList.remove('client-base-inline');
      panel.appendChild(el);
    }
  });

  const language=document.querySelector('.language-switcher');
  if(language) interfaceContent.appendChild(language);

  headerButtons.innerHTML='';
  headerButtons.classList.add('settings-only');
  headerButtons.appendChild(wrap);

  function currentLang(){
    const l=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'ru';
    return LABELS[l]?l:'ru';
  }
  function updateLabel(){
    const t=LABELS[currentLang()];
    const label=btn.querySelector('.settings-label');
    if(label) label.textContent=t.settings;
    btn.title=t.settings;
    btn.setAttribute('aria-label',wrap.classList.contains('open')?t.close:t.settings);
    if(clientBase){clientBase.textContent=t.clients;clientBase.title=t.clients;}
    accountsBtn.firstElementChild.textContent=t.accounts;
    interfaceBtn.firstElementChild.textContent=t.interface;
  }
  function setOpen(open){
    wrap.classList.toggle('open',open);
    btn.setAttribute('aria-expanded',String(open));
    updateLabel();
  }
  function toggleInterface(){
    const open=!interfaceContent.classList.contains('open');
    interfaceContent.classList.toggle('open',open);
    interfaceBtn.classList.toggle('active',open);
  }

  btn.addEventListener('click',e=>{
    e.stopPropagation();
    setOpen(!wrap.classList.contains('open'));
  });
  accountsBtn.addEventListener('click',async e=>{
    e.stopPropagation();
    const t=LABELS[currentLang()];
    if(window.AppDialog?.alert) await AppDialog.alert(t.coming,t.accounts); else alert(t.coming);
  });
  interfaceBtn.addEventListener('click',e=>{e.stopPropagation();toggleInterface();});

  panel.addEventListener('click',e=>{
    e.stopPropagation();
    if(e.target.closest('.language-option')){
      setTimeout(updateLabel,0);
      return;
    }
    if(e.target.closest('.language-btn,.settings-hints-control,.settings-section-btn')) return;
    if(e.target.closest('button')) setTimeout(()=>setOpen(false),0);
  });

  document.addEventListener('click',e=>{if(!wrap.contains(e.target)) setOpen(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape' && wrap.classList.contains('open')) setOpen(false);});

  const oldSetLanguage=window.DiagnostikaI18n?.setLanguage;
  if(oldSetLanguage){
    window.DiagnostikaI18n.setLanguage=function(lang){
      const result=oldSetLanguage.call(window.DiagnostikaI18n,lang);
      setTimeout(updateLabel,0);
      return result;
    };
  }

  window.DiagnostikaSettingsUI={
    interfaceContent,
    openInterface(){
      interfaceContent.classList.add('open');
      interfaceBtn.classList.add('active');
      setOpen(true);
    }
  };

  updateLabel();
})();

(() => {
  if(document.querySelector('script[data-storage-simple-sync]')) return;
  const s=document.createElement('script');
  s.src='storage-simple-sync.js?v=20260912-27';
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
