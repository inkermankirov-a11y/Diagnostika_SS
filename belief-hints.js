'use strict';

(() => {
  const PRIMARY_BELIEFS = [
    'Я недостаточно хорош',
    'Я ничего не стою',
    'Я не творческий человек',
    'Я не могу ничего просить, так как буду отвергнут',
    'Я недостаточно умен',
    'Меня нельзя любить',
    'У меня нет способностей',
    'Я стеснительный человек',
    'Я никому не интересен',
    'Я не идеален',
    'Я слишком стар',
    'Я слишком молод',
    'Я ниже этих людей',
    'Я ленивая/ленив',
    'Я не могу иметь хобби',
    'Я не заслуживаю ничего хорошего',
    'Люди будут судить меня',
    'Я неудачник',
    'Я глупый/глупая',
    'Люди сразу отвергнут меня, как только узнают поближе',
    'Я не красив/красивая',
    'Я слишком толстый/толстая',
    'Я неуклюжий/неуклюжая',
    'Я слишком худой/худая',
    'Я слишком стеснителен/стеснительная',
    'Мое тело не совершенно',
    'Я не привлекательный/привлекательная',
    'Я бессилен/бессильная',
    'Я не важен/важна',
    'Вокруг недобрые люди',
    'Мои желания не имеют никакого значения',
    'Потребности других людей важнее моих',
    'У меня нет силы воли',
    'Если я ослаблю контроль, все плохое выйдет наружу',
    'Люди всегда будут причинять мне боль',
    'Я не доверяю себе',
    'Я не современен/современна',
    'Я никогда не буду соответствовать',
    'Если я буду доверять людям, они сделают мне больно',
    'Никто меня не поддержит и не подбодрит',
    'Я странный/странная',
    'Я примитивный человек',
    'Я плохой/плохая',
    'Я не сексуальный/не сексуальная',
    'Я ущербный/ущербная',
    'Я никогда не повзрослею',
    'Я не имею право быть стройной и красивой',
    'Мои желания и мечты не сбудутся',
    'У меня кризис',
    'Я никто',
    'Мою фигуру не исправить',
    'Я не влияю на свою жизнь',
    'День Рождения лучше не праздновать',
    'Мир мне должен',
    'Легкой жизни не бывает',
    'Учебу не каждый освоит',
    'Мои страхи реальны',
    'Просто так не любят и не дружат',
    'Я не фотогеничен/не фотогенична',
    'Секс не для меня',
    'Я мнительный/мнительная'
  ];

  const style=document.createElement('style');
  style.textContent=`
    .belief-hint-inline{display:flex;align-items:center;gap:7px;margin:-2px 0 8px;color:#64748b;font-size:12px}
    .belief-hint-inline button{border:1px solid #b7c7df;background:linear-gradient(#f8fbff,#e6eef9);color:#315c9b;border-radius:7px;padding:5px 9px;cursor:pointer;font-weight:600;box-shadow:0 1px 2px rgba(30,64,110,.12);transition:transform .12s ease,box-shadow .12s ease,background .12s ease}
    .belief-hint-inline button:hover{transform:translateY(-1px);background:linear-gradient(#fff,#dce9fa);box-shadow:0 3px 8px rgba(30,64,110,.18)}
    .belief-hint-inline button:active{transform:translateY(1px);box-shadow:0 1px 2px rgba(30,64,110,.12)}
    .belief-hints-dialog{width:min(780px,94vw);max-height:84vh;border:0;border-radius:12px;padding:0;background:#f4f7fb;box-shadow:0 18px 50px rgba(15,23,42,.32)}
    .belief-hints-dialog::backdrop{background:rgba(15,23,42,.35);backdrop-filter:blur(5px)}
    .belief-hints-shell{padding:18px;display:flex;flex-direction:column;max-height:84vh}
    .belief-hints-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
    .belief-hints-title{font-size:20px;font-weight:800;color:#26364a}
    .belief-hints-sub{font-size:12px;color:#718096;margin-top:3px}
    .belief-hints-close{border:0;background:#e9eef5;border-radius:7px;width:34px;height:34px;cursor:pointer;font-size:20px}
    .belief-hints-search{width:100%;height:38px;border:1px solid #b9c5d4;border-radius:8px;padding:0 11px;background:#fff;margin-bottom:12px}
    .belief-hints-list{overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:2px}
    .belief-hint-item{display:flex;gap:8px;align-items:flex-start;border:1px solid #d7e0eb;background:#fff;border-radius:8px;padding:9px 10px;text-align:left;cursor:pointer;color:#243447;box-shadow:0 1px 2px rgba(15,23,42,.05);transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease}
    .belief-hint-item:hover{transform:translateY(-1px);border-color:#7aa2df;box-shadow:0 4px 10px rgba(45,85,145,.12)}
    .belief-hint-num{color:#6b87ad;font-weight:700;min-width:22px}
    .belief-hints-empty{grid-column:1/-1;color:#8793a3;padding:18px;text-align:center}
    @media(max-width:700px){.belief-hints-list{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const addBeliefBtn=document.querySelector('#addBeliefBtn');
  if(addBeliefBtn){
    addBeliefBtn.title='Первичные ограничивающие убеждения';
    addBeliefBtn.setAttribute('aria-label','Добавить убеждение 1. Первичные ограничивающие убеждения');
  }

  const dialog=document.createElement('dialog');
  dialog.className='belief-hints-dialog';
  dialog.innerHTML=`
    <div class="belief-hints-shell">
      <div class="belief-hints-head">
        <div><div class="belief-hints-title">Первичные ограничивающие убеждения</div><div class="belief-hints-sub">Подсказки из загруженного документа. Нажми на формулировку, чтобы вставить её в редактор.</div></div>
        <button class="belief-hints-close" type="button" title="Закрыть">×</button>
      </div>
      <input class="belief-hints-search" type="search" placeholder="Поиск по убеждениям…">
      <div class="belief-hints-list"></div>
    </div>`;
  document.body.appendChild(dialog);

  const list=dialog.querySelector('.belief-hints-list');
  const search=dialog.querySelector('.belief-hints-search');

  function renderList(query=''){
    const q=String(query||'').trim().toLowerCase();
    list.innerHTML='';
    const matches=PRIMARY_BELIEFS.map((text,index)=>({text,index})).filter(x=>!q||x.text.toLowerCase().includes(q));
    if(!matches.length){list.innerHTML='<div class="belief-hints-empty">Ничего не найдено</div>';return;}
    matches.forEach(({text,index})=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='belief-hint-item';
      btn.innerHTML=`<span class="belief-hint-num">${index+1}</span><span></span>`;
      btn.lastElementChild.textContent=text;
      btn.onclick=()=>{
        const editor=document.querySelector('#editorText');
        if(editor){editor.value=text;editor.focus();editor.setSelectionRange(editor.value.length,editor.value.length);}
        dialog.close();
      };
      list.appendChild(btn);
    });
  }

  search.oninput=()=>renderList(search.value);
  dialog.querySelector('.belief-hints-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});

  function openHints(){search.value='';renderList();dialog.showModal();setTimeout(()=>search.focus(),0);}

  function updateInlineHint(){
    const editorType=document.querySelector('#editorType');
    if(!editorType) return;
    let box=document.querySelector('#beliefInlineHint');
    const show=typeof selected!=='undefined' && selected?.type==='belief';
    if(!show){if(box)box.remove();return;}
    if(!box){
      box=document.createElement('div');
      box.id='beliefInlineHint';
      box.className='belief-hint-inline';
      box.innerHTML='<span>💡 Первичные ограничивающие убеждения</span><button type="button">Подсказки</button>';
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
