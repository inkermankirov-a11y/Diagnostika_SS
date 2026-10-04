'use strict';

(() => {
  const SECONDARY_BELIEFS=[
  "Я не заслуживаю любви",
  "Я плохой человек",
  "Я ужасен",
  "Я не заслуживаю уважения",
  "Я неадекватен",
  "Я опозорен",
  "Я не способен любить",
  "Я недостаточно хорош",
  "Я достоин лишь плохих событий",
  "Я не могу быть надежным",
  "Я не могу доверять самому себе",
  "Я не могу доверять моей оценке",
  "Я не могу достичь успеха",
  "Я не контролирую себя",
  "Я бессилен",
  "Я беспомощен",
  "Я слаб",
  "Я не могу защитить себя",
  "Я тупой",
  "Я недостаточно остроумен",
  "Я не имею никакого значения",
  "Я разочарован",
  "Я заслуживаю лишь смерти",
  "Я заслуживаю того, чтобы быть жалким и несчастным человеком",
  "Я не могу получить то, что хочу",
  "Я неудачник (и у меня будут одни неудачи)",
  "Я должен быть безупречным",
  "Я должен всем уделять внимание",
  "Я постоянно болен",
  "Я уродлив (мое тело отвратительно)",
  "Я должен сделать что-то",
  "Я делал что-то плохое",
  "Я в опасности",
  "Я не могу выдержать всё это",
  "Я никому не могу доверять",
  "Я не могу высказать всего этого",
  "Я не заслуживаю...",
  "Я не должен проявлять свои эмоции",
  "Я не могу быть опорой для самого себя",
  "Я не такой, как все",
  "Я должен узнать, как сделать лучше",
  "Я ничего не умею (у меня ничего не получается)"
];

  const selection=()=>window.DiagnostikaPlatform?.shell?.currentSelection?.()||null;

  const style=document.createElement('style');
  style.textContent=`
    .deep-belief-hint-inline{display:flex;align-items:center;gap:7px;margin:-2px 0 8px;color:#64748b;font-size:12px}
    .deep-belief-hint-inline button{border:1px solid #d7a9ae;background:linear-gradient(#fff9f9,#f5e0e2);color:#8d3740;border-radius:7px;padding:5px 9px;cursor:pointer;font-weight:700;box-shadow:0 1px 2px rgba(120,30,40,.10)}
    .deep-belief-hint-inline button:hover{background:linear-gradient(#fff,#f2d3d7);box-shadow:0 3px 8px rgba(120,30,40,.16)}
    .deep-belief-hints-dialog{width:min(900px,96vw);height:min(760px,90vh);border:0;border-radius:14px;padding:0;background:#f7f4f5;box-shadow:0 22px 60px rgba(15,23,42,.34)}
    .deep-belief-hints-dialog::backdrop{background:rgba(15,23,42,.38);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
    .deep-belief-hints-shell{height:100%;box-sizing:border-box;padding:18px;display:flex;flex-direction:column;min-height:0}
    .deep-belief-hints-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
    .deep-belief-hints-title{font-size:20px;font-weight:800;color:#3f2830}
    .deep-belief-hints-sub{font-size:12px;color:#7b6b70;margin-top:3px}
    .deep-belief-hints-close{border:0;background:#eee6e8;border-radius:7px;width:34px;height:34px;cursor:pointer;font-size:20px}
    .deep-belief-hints-search{width:100%;height:40px;border:1px solid #cbbbc0;border-radius:8px;padding:0 11px;background:#fff;margin-bottom:12px;box-sizing:border-box}
    .deep-belief-hints-list{min-height:0;flex:1;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:4px 6px 8px 2px}
    .deep-belief-hint-item{display:flex;gap:8px;align-items:flex-start;min-height:54px;border:1px solid #eadcdf;background:#fff;border-radius:9px;padding:10px 12px;text-align:left;cursor:pointer;color:#3e2930;line-height:1.35;box-shadow:0 1px 2px rgba(15,23,42,.05);transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease}
    .deep-belief-hint-item:hover{transform:translateY(-2px);border-color:#d78993;box-shadow:0 6px 14px rgba(130,45,55,.16);background:#fffafb}
    .deep-belief-hint-num{color:#a05a64;font-weight:800;min-width:24px}
    .deep-belief-hints-empty{grid-column:1/-1;color:#8d7f84;padding:18px;text-align:center}
    @media(max-width:760px){.deep-belief-hints-list{grid-template-columns:1fr}.deep-belief-hints-dialog{height:min(760px,94vh)}}
  `;
  document.head.appendChild(style);

  const dialog=document.createElement('dialog');
  dialog.className='deep-belief-hints-dialog';
  dialog.innerHTML=`
    <div class="deep-belief-hints-shell">
      <div class="deep-belief-hints-head">
        <div>
          <div class="deep-belief-hints-title">Вторичные убеждения</div>
          <div class="deep-belief-hints-sub">Выбери подходящую формулировку — она вставится в редактор.</div>
        </div>
        <button class="deep-belief-hints-close" type="button" title="Закрыть">×</button>
      </div>
      <input class="deep-belief-hints-search" type="search" placeholder="Поиск по вторичным убеждениям…">
      <div class="deep-belief-hints-list"></div>
    </div>`;
  document.body.appendChild(dialog);

  const list=dialog.querySelector('.deep-belief-hints-list');
  const search=dialog.querySelector('.deep-belief-hints-search');

  function renderList(query=''){
    const q=String(query||'').trim().toLowerCase();
    list.innerHTML='';
    const matches=SECONDARY_BELIEFS.map((text,index)=>({text,index})).filter(x=>!q||x.text.toLowerCase().includes(q));
    if(!matches.length){
      list.innerHTML='<div class="deep-belief-hints-empty">Ничего не найдено</div>';
      return;
    }
    matches.forEach(({text,index})=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='deep-belief-hint-item';
      btn.dataset.hintIndex=String(index);
      btn.innerHTML=`<span class="deep-belief-hint-num">${index+1}</span><span></span>`;
      btn.lastElementChild.textContent=text;
      btn.onclick=()=>{
        const editor=document.querySelector('#editorText');
        if(editor){
          editor.value=text;
          editor.focus();
          editor.setSelectionRange(text.length,text.length);
        }
        dialog.close();
      };
      list.appendChild(btn);
    });
  }

  function openHints(){
    if(selection()?.type!=='deep'){
      alert('Сначала выбери вторичное убеждение.');
      return;
    }
    search.value='';
    renderList();
    dialog.showModal();
    setTimeout(()=>search.focus(),0);
  }

  function updateInlineHint(){
    const editorType=document.querySelector('#editorType');
    if(!editorType)return;
    let box=document.querySelector('#deepBeliefInlineHint');
    const show=selection()?.type==='deep';
    if(!show){
      box?.remove();
      return;
    }
    if(!box){
      box=document.createElement('div');
      box.id='deepBeliefInlineHint';
      box.className='deep-belief-hint-inline';
      box.innerHTML='<span>💡 Примеры вторичных убеждений</span><button type="button">Подсказки</button>';
      box.querySelector('button').onclick=openHints;
      editorType.insertAdjacentElement('afterend',box);
    }
  }

  search.addEventListener('input',()=>renderList(search.value));
  dialog.querySelector('.deep-belief-hints-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  document.addEventListener('diagnostika:diagnosis-editor-rendered',updateInlineHint);
  document.addEventListener('diagnostika:diagnosis-tree-rendered',updateInlineHint);

  const addDeepBtn=document.querySelector('#addDeepBtn');
  if(addDeepBtn){
    addDeepBtn.title='Добавить вторичное убеждение';
    addDeepBtn.setAttribute('aria-label','Добавить вторичное убеждение');
  }

  renderList();
  updateInlineHint();
})();
