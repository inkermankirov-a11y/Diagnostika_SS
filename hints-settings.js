'use strict';

(() => {
  if(window.__diagnostikaHintsSettingsReady) return;
  window.__diagnostikaHintsSettingsReady=true;

  const KEY='diagnostika-help-tooltips-enabled';
  const LABELS={
    ru:{title:'💡 Подсказки',on:'Включить',off:'Отключить',stateOn:'Включены',stateOff:'Отключены'},
    en:{title:'💡 Hints',on:'Enable',off:'Disable',stateOn:'Enabled',stateOff:'Disabled'},
    fr:{title:'💡 Astuces',on:'Activer',off:'Désactiver',stateOn:'Activées',stateOff:'Désactivées'},
    de:{title:'💡 Hinweise',on:'Einschalten',off:'Ausschalten',stateOn:'Ein',stateOff:'Aus'},
    it:{title:'💡 Suggerimenti',on:'Attiva',off:'Disattiva',stateOn:'Attivi',stateOff:'Disattivi'}
  };

  function currentLang(){
    const lang=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'ru';
    return LABELS[lang]?lang:'ru';
  }

  function enabled(){
    return localStorage.getItem(KEY)==='1';
  }

  function setEnabled(value){
    const next=!!value;
    localStorage.setItem(KEY,next?'1':'0');
    window.dispatchEvent(new CustomEvent('diagnostika-help-hints-change',{detail:{enabled:next}}));
    render();
    return next;
  }

  window.DiagnostikaHelpHints={enabled,setEnabled,key:KEY};

  const style=document.createElement('style');
  style.textContent=`
    .settings-hints-control{width:100%;box-sizing:border-box;border:1px solid #d8e0e9;border-radius:10px;background:#f8fafc;padding:9px 10px;display:grid;gap:8px}
    .settings-hints-head{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;font-weight:800;color:#34465a}
    .settings-hints-state{font-size:11px;font-weight:800;padding:3px 7px;border-radius:999px;background:#e8edf3;color:#65758a;white-space:nowrap}
    .settings-hints-control.is-on .settings-hints-state{background:#e8f7ee;color:#277449}
    .settings-hints-options{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .settings-hints-choice{height:34px;border:1px solid #c8d4e1;border-radius:8px;background:#fff;color:#43566d;font-size:12px;font-weight:800;cursor:pointer}
    .settings-hints-choice:hover{background:#f1f6fb}
    .settings-hints-choice.active{border-color:#3f7fd6;background:#eaf3ff;color:#245fae;box-shadow:0 0 0 1px rgba(63,127,214,.08)}
    .settings-hints-choice[data-value="off"].active{border-color:#9aa8b7;background:#eef1f4;color:#526171}
  `;
  document.head.appendChild(style);

  let root=null;

  function render(){
    if(!root) return;
    const t=LABELS[currentLang()];
    const on=enabled();
    root.classList.toggle('is-on',on);
    root.querySelector('.settings-hints-title').textContent=t.title;
    root.querySelector('.settings-hints-state').textContent=on?t.stateOn:t.stateOff;
    const onBtn=root.querySelector('[data-value="on"]');
    const offBtn=root.querySelector('[data-value="off"]');
    onBtn.textContent=t.on;
    offBtn.textContent=t.off;
    onBtn.classList.toggle('active',on);
    offBtn.classList.toggle('active',!on);
    onBtn.setAttribute('aria-pressed',String(on));
    offBtn.setAttribute('aria-pressed',String(!on));
  }

  function attach(){
    const panel=document.getElementById('settingsPanel');
    if(!panel) return;
    if(panel.querySelector('.settings-hints-control')){
      root=panel.querySelector('.settings-hints-control');
      render();
      return;
    }

    root=document.createElement('div');
    root.className='settings-hints-control';
    root.innerHTML=`
      <div class="settings-hints-head"><span class="settings-hints-title">💡 Подсказки</span><span class="settings-hints-state">Отключены</span></div>
      <div class="settings-hints-options">
        <button type="button" class="settings-hints-choice" data-value="on">Включить</button>
        <button type="button" class="settings-hints-choice" data-value="off">Отключить</button>
      </div>`;

    root.addEventListener('click',e=>e.stopPropagation());
    root.querySelector('[data-value="on"]').onclick=e=>{e.stopPropagation();setEnabled(true);};
    root.querySelector('[data-value="off"]').onclick=e=>{e.stopPropagation();setEnabled(false);};

    const language=panel.querySelector('.language-switcher');
    if(language) panel.insertBefore(root,language);
    else panel.appendChild(root);
    render();
  }

  attach();
  new MutationObserver(()=>{attach();render();}).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('diagnostika-language-changed',()=>setTimeout(render,0));
})();
