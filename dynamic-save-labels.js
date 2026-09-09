'use strict';

(() => {
  const LABELS = {
    belief: 'Сохранить убеждение 1',
    feeling: 'Сохранить вторичное чувство',
    deep: 'Сохранить убеждение 2',
    instinct: 'Сохранить инстинкт'
  };

  function updateSaveLabels(){
    const mainBtn=document.querySelector('#saveElementBtn');
    const instinctBtn=document.querySelector('#saveInstinctBtn');

    if(mainBtn){
      mainBtn.textContent = (typeof selected!=='undefined' && selected)
        ? (LABELS[selected.type] || 'Сохранить')
        : 'Сохранить';
    }

    if(instinctBtn) instinctBtn.textContent='Сохранить инстинкт';
  }

  if(typeof renderEditor==='function'){
    const previousRenderEditor=renderEditor;
    renderEditor=function(){
      const result=previousRenderEditor.apply(this,arguments);
      updateSaveLabels();
      return result;
    };
  }

  updateSaveLabels();
})();
