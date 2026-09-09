'use strict';

(() => {
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

  function addFieldHelp(dialog){
    if(!dialog || dialog.dataset.helpReady==='1') return;
    dialog.dataset.helpReady='1';

    const grid=dialog.querySelector('.session-edit-grid');
    const select=grid?.querySelector('select');
    if(select && !select.parentElement?.classList.contains('session-request-field')){
      const field=document.createElement('div');
      field.className='session-request-field';
      const label=document.createElement('div');
      label.className='session-field-label';
      label.append('Связать с запросом',makeHelp('Привязывает сессию к конкретному запросу клиента из раздела «Диагностика». Если сессия общая или вводная — оставь «Без связи».'));
      select.replaceWith(field);
      field.append(label,select);
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
})();
