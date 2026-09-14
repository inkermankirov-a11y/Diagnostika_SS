'use strict';

(() => {
  if(window.__diagnostikaHelpTooltipsReady) return;
  window.__diagnostikaHelpTooltipsReady=true;

  const LANGUAGE_KEY='diagnostika-ui-language';
  if(!localStorage.getItem(LANGUAGE_KEY)) localStorage.setItem(LANGUAGE_KEY,'ru');

  if(!document.querySelector('script[data-hints-settings]')){
    const s=document.createElement('script');
    s.src='hints-settings.js?v=20260914-2';
    s.setAttribute('data-hints-settings','1');
    document.body.appendChild(s);
  }

  const KEY='diagnostika-help-tooltips-enabled';

  function hintsEnabled(){
    if(window.DiagnostikaHelpHints?.enabled) return !!window.DiagnostikaHelpHints.enabled();
    return localStorage.getItem(KEY)==='1';
  }

  function makeHelp(text){
    const wrap=document.createElement('span');
    wrap.className='help-tip';
    wrap.tabIndex=0;
    wrap.setAttribute('role','button');
    wrap.setAttribute('aria-label','Подсказка');

    const icon=document.createElement('span');
    icon.className='help-tip-icon';
    icon.textContent='?';

    const bubble=document.createElement('span');
    bubble.className='help-tip-bubble';
    bubble.textContent=text;

    wrap.append(icon,bubble);
    return wrap;
  }

  function removeFieldHelp(dialog){
    if(!dialog) return;
    dialog.querySelectorAll('.help-tip').forEach(x=>x.remove());
  }

  function addFieldHelp(dialog){
    if(!dialog) return;
    if(!hintsEnabled()){
      removeFieldHelp(dialog);
      return;
    }

    const grid=dialog.querySelector('.session-edit-grid');
    const select=grid?.querySelector('select');
    if(select){
      let field=select.closest('.session-request-field');
      if(!field){
        field=document.createElement('div');
        field.className='session-request-field';
        const label=document.createElement('div');
        label.className='session-field-label';
        select.replaceWith(field);
        field.append(label,select);
      }
      let label=field.querySelector('.session-field-label');
      if(!label){
        label=document.createElement('div');
        label.className='session-field-label';
        field.insertBefore(label,select);
      }
      if(!label.childNodes.length) label.append('Связать с запросом');
      if(!label.querySelector('.help-tip')){
        label.appendChild(makeHelp('Привязывает сессию к конкретному запросу клиента из раздела «Диагностика». Если сессия общая или вводная — оставь «Без связи».'));
      }
    }

    const yt=dialog.querySelector('.session-youtube-editor label');
    if(yt && !yt.querySelector('.help-tip')){
      yt.appendChild(makeHelp('Сюда можно вставить ссылку на запись сессии на YouTube. После сохранения в карточке появится кнопка для открытия видео.'));
    }

    const mediaTitle=dialog.querySelector('.session-media-head strong');
    if(mediaTitle && !mediaTitle.parentElement.querySelector('.help-tip')){
      mediaTitle.parentElement.insertBefore(makeHelp('Здесь можно хранить аудио, видео, изображения, транскрипты и документы, относящиеся к этой сессии.'),mediaTitle.nextSibling);
    }
  }

  function applyAll(){
    document.querySelectorAll('.session-edit-dialog').forEach(addFieldHelp);
    if(!hintsEnabled()) document.querySelectorAll('.help-tip').forEach(x=>x.remove());
  }

  const observer=new MutationObserver(records=>{
    for(const rec of records){
      for(const node of rec.addedNodes){
        if(!(node instanceof Element)) continue;
        if(node.matches?.('.session-edit-dialog')) addFieldHelp(node);
        node.querySelectorAll?.('.session-edit-dialog').forEach(addFieldHelp);
      }
    }
  });

  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('diagnostika-help-hints-change',applyAll);
  setTimeout(applyAll,0);
})();
