'use strict';

(() => {
  const DEEP_BELIEFS = [
    'Я не заслуживаю любви',
    'Я плохой человек',
    'Я ужасен',
    'Я не заслуживаю уважения',
    'Я неадекватен',
    'Я опозорен',
    'Я не способен любить',
    'Я недостаточно хорош',
    'Я достоин лишь плохих событий',
    'Я не могу быть надежным',
    'Я не могу доверять самому себе',
    'Я не могу доверять моей оценке',
    'Я не могу достичь успеха',
    'Я не контролирую себя',
    'Я бессилен',
    'Я беспомощен',
    'Я слаб',
    'Я не могу защитить себя',
    'Я тупой',
    'Я недостаточно остроумен',
    'Я не имею никакого значения',
    'Я разочарован',
    'Я заслуживаю лишь смерти',
    'Я заслуживаю того, чтобы быть жалким и несчастным человеком',
    'Я не могу получить то, что хочу',
    'Я неудачник (и у меня будут одни неудачи)',
    'Я должен быть безупречным',
    'Я должен всем уделять внимание',
    'Я постоянно болен',
    'Я уродлив (мое тело отвратительно)',
    'Я должен сделать что-то',
    'Я делал что-то плохое',
    'Я в опасности',
    'Я не могу выдержать всё это',
    'Я никому не могу доверять',
    'Я не могу высказать всего этого',
    'Я не заслуживаю...',
    'Я не должен проявлять свои эмоции',
    'Я не могу быть опорой для самого себя',
    'Я не такой, как все',
    'Я должен узнать, как сделать лучше',
    'Я ничего не умею (у меня ничего не получается)'
  ];

  const style=document.createElement('style');
  style.textContent=`
    .deep-belief-hint-inline{display:flex;align-items:center;gap:7px;margin:-2px 0 8px;color:#64748b;font-size:12px}
    .deep-belief-hint-inline button{border:1px solid #e1a8ad;background:linear-gradient(#fff8f8,#f6dfe1);color:#9b3943;border-radius:7px;padding:5px 9px;cursor:pointer;font-weight:700;box-shadow:0 1px 2px rgba(120,30,40,.10);transition:transform .12s ease,box-shadow .12s ease,background .12s ease}
    .deep-belief-hint-inline button:hover{transform:translateY(-1px);background:linear-gradient(#fff,#f2d3d7);box-shadow:0 3px 8px rgba(120,30,40,.16)}
    .deep-belief-hint-inline button:active{transform:translateY(1px);box-shadow:0 1px 2px rgba(120,30,40,.10)}
    .deep-belief-hints-dialog{width:min(780px,94vw);max-height:84vh;border:0;border-radius:12px;padding:0;background:#f7f4f5;box-shadow:0 18px 50px rgba(15,23,42,.32)}
    .deep-belief-hints-dialog::backdrop{background:rgba(15,23,42,.35);backdrop-filter:blur(5px)}
    .deep-belief-hints-shell{padding:18px;display:flex;flex-direction:column;max-height:84vh}
    .deep-belief-hints-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
    .deep-belief-hints-title{font-size:20px;font-weight:800;color:#3f2830}
    .deep-belief-hints-sub{font-size:12px;color:#7b6b70;margin-top:3px}
    .deep-belief-hints-close{border:0;background:#eee6e8;border-radius:7px;width:34px;height:34px;cursor:pointer;font-size:20px}
    .deep-belief-hints-search{width:100%;height:38px;border:1px solid #cbbbc0;border-radius:8px;padding:0 11px;background:#fff;margin-bottom:12px}
    .deep-belief-hints-list{overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:2px}
    .deep-belief-hint-item{display:flex;gap:8px;align-items:flex-start;border:1px solid #eadcdf;background:#fff;border-radius:8px;padding:9px 10px;text-align:left;cursor:pointer;color:#3e2930;box-shadow:0 1px 2px rgba(15,23,42,.05);transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease}
    .deep-belief-hint-item:hover{transform:translateY(-1px);border-color:#d78993;box-shadow:0 4px 10px rgba(130,45,55,.12)}
    .deep-belief-hint-num{color:#a05a64;font-weight:700;min-width:22px}
    .deep-belief-hints-empty{grid-column:1/-1;color:#8d7f84;padding:18px;text-align:center}
    @media(max-width:700px){.deep-belief-hints-list{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const addDeepBtn=document.querySelector('#addDeepBtn');
  if(addDeepBtn){
    addDeepBtn.title='Глубинные / негативные убеждения';
    addDeepBtn.setAttribute('aria-label','Добавить убеждение 2. Глубинные / негативные убеждения');
  }

  const dialog=document.createElement('dialog');
  dialog.className='deep-belief-hints-dialog';
  dialog.innerHTML=`
    <div class="deep-belief-hints-shell">
      <div class="deep-belief-hints-head">
        <div>
          <div class="deep-belief-hints-title">Убеждение 2 — глубинные убеждения</div>
          <div class="deep-belief-hints-sub">Нажми на формулировку, чтобы вставить её в редактор.</div>
        </div>
        <button class="deep-belief-hints-close" type="button" title="Закрыть">×</button>
      </div>
      <input class="deep-belief-hints-search" type="search" placeholder="Поиск по убеждениям…">
      <div class="deep-belief-hints-list"></div>
    </div>`;
  document.body.appendChild(dialog);

  const list=dialog.querySelector('.deep-belief-hints-list');
  const search=dialog.querySelector('.deep-belief-hints-search');

  function renderList(query=''){
    const q=String(query||'').trim().toLowerCase();
    list.innerHTML='';
    const matches=DEEP_BELIEFS.map((text,index)=>({text,index})).filter(x=>!q||x.text.toLowerCase().includes(q));
    if(!matches.length){list.innerHTML='<div class="deep-belief-hints-empty">Ничего не найдено</div>';return;}
    matches.forEach(({text,index})=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='deep-belief-hint-item';
      btn.innerHTML=`<span class="deep-belief-hint-num">${index+1}</span><span></span>`;
      btn.lastElementChild.textContent=text;
      btn.onclick=()=>{
        const editor=document.querySelector('#editorText');
        if(editor){
          editor.value=text;
          editor.focus();
          editor.setSelectionRange(editor.value.length,editor.value.length);
        }
        dialog.close();
      };
      list.appendChild(btn);
    });
  }

  search.oninput=()=>renderList(search.value);
  dialog.querySelector('.deep-belief-hints-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});

  function openHints(){search.value='';renderList();dialog.showModal();setTimeout(()=>search.focus(),0);}

  function updateInlineHint(){
    const editorType=document.querySelector('#editorType');
    if(!editorType)return;
    let box=document.querySelector('#deepBeliefInlineHint');
    const show=typeof selected!=='undefined' && selected?.type==='deep';
    if(!show){if(box)box.remove();return;}
    if(!box){
      box=document.createElement('div');
      box.id='deepBeliefInlineHint';
      box.className='deep-belief-hint-inline';
      box.innerHTML='<span>💡 Глубинные / негативные убеждения</span><button type="button">Подсказки</button>';
      box.querySelector('button').onclick=openHints;
      editorType.insertAdjacentElement('afterend',box);
    }
  }

  if(typeof renderEditor==='function'){
    const originalRenderEditor=renderEditor;
    renderEditor=function(){
      const result=originalRenderEditor.apply(this,arguments);
      updateInlineHint();
      return result;
    };
    updateInlineHint();
  }
})();
