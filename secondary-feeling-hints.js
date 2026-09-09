'use strict';

(() => {
  const FEELINGS = [
    {name:'Обида', question:'К кому? Какой вы, когда это происходит? Есть ли вина или стыд?'},
    {name:'Злость', question:'На кого? Какой вы, когда это происходит? Есть ли вина или стыд?'},
    {name:'Страх', question:'Чего боитесь? Представьте, что это произошло. Какой вы себя чувствуете?'},
    {name:'Стыд', question:'Страх осуждения. Кто осуждает? Какой вы себя чувствуете?'},
    {name:'Вина', question:'Перед кем? Какой вы себя чувствуете, когда вас обвиняют? Обида на себя?'},
    {name:'Жалость к кому-либо', question:'Каков этот человек в данный момент?'},
    {name:'Жалость к себе', question:'Какой вы себя чувствуете, когда жалеете себя? Почему жалко себя?'},
    {name:'Чувство долга', question:'Что будет, если не сделаете того, что должны?'},
    {name:'Несправедливость', question:'Какой вы себя чувствуете, когда жизнь или люди несправедливы?'},
    {name:'Разочарование', question:'В ком? Какой вы себя чувствуете?'},
    {name:'Грусть', question:'Каким вы себя чувствуете, когда грустите?'},
    {name:'Боль', question:'Каким вы себя чувствуете, когда испытываете боль?'},
    {name:'Другое', question:''}
  ];

  const style=document.createElement('style');
  style.textContent=`
    .feeling-builder-dialog{width:min(940px,96vw);max-height:90vh;border:0;border-radius:14px;padding:0;background:#f5f7fa;box-shadow:0 22px 60px rgba(15,23,42,.34)}
    .feeling-builder-dialog::backdrop{background:rgba(15,23,42,.38);backdrop-filter:blur(6px)}
    .feeling-builder-shell{padding:18px;display:flex;flex-direction:column;max-height:90vh}
    .feeling-builder-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px}
    .feeling-builder-title{font-size:21px;font-weight:800;color:#26364a}
    .feeling-builder-sub{font-size:12px;color:#718096;margin-top:4px;max-width:700px;line-height:1.4}
    .feeling-builder-close{width:34px;height:34px;border:0;border-radius:8px;background:#e8edf3;cursor:pointer;font-size:20px;color:#475569}
    .feeling-builder-list{overflow:auto;display:grid;gap:10px;padding:2px 3px 4px}
    .feeling-builder-empty{padding:24px;text-align:center;color:#8a96a6;border:1px dashed #cbd5e1;border-radius:10px;background:#fff}
    .feeling-builder-row{background:#fff;border:1px solid #d9e1eb;border-left:4px solid #d9aa3c;border-radius:10px;padding:11px;box-shadow:0 2px 7px rgba(15,23,42,.06)}
    .feeling-row-top{display:grid;grid-template-columns:210px minmax(260px,1fr) 82px 38px;gap:8px;align-items:end}
    .feeling-field{display:grid;gap:4px;font-size:11px;color:#64748b}
    .feeling-field select,.feeling-field input,.feeling-field textarea{width:100%;border:1px solid #b8c4d2;border-radius:7px;background:#fff;color:#1f2937;padding:7px 8px;font:inherit}
    .feeling-field select,.feeling-field input{height:35px}
    .feeling-field textarea{min-height:60px;resize:vertical;line-height:1.35}
    .feeling-answer{margin-top:8px}
    .feeling-delete-row{width:38px;height:35px;border:1px solid #efb1b1!important;border-radius:7px!important;background:linear-gradient(#fff5f5,#f7d7d7)!important;color:#a52626!important;font-weight:800;cursor:pointer;box-shadow:0 2px 4px rgba(130,30,30,.10)!important}
    .feeling-delete-row:hover{background:linear-gradient(#fff0f0,#efc1c1)!important;transform:translateY(-1px)}
    .feeling-builder-footer{display:flex;align-items:center;gap:9px;margin-top:14px;padding-top:13px;border-top:1px solid #d8e0e8}
    .feeling-add-row{border:1px solid #8fb2e8;background:linear-gradient(#6291eb,#3f6ed4);color:#fff;border-radius:8px;padding:9px 13px;cursor:pointer;font-weight:700;box-shadow:0 3px 7px rgba(45,83,160,.2)}
    .feeling-builder-cancel{margin-left:auto;border:1px solid #cbd5e1;background:#edf1f5;color:#334155;border-radius:8px;padding:9px 14px;cursor:pointer}
    .feeling-builder-save{border:1px solid #197149;background:linear-gradient(#35a56d,#238b57);color:#fff;border-radius:8px;padding:9px 16px;cursor:pointer;font-weight:700;box-shadow:0 3px 7px rgba(26,110,70,.2)}
    .feeling-editor-inline{display:flex;align-items:center;gap:8px;margin:-2px 0 8px;color:#64748b;font-size:12px}
    .feeling-editor-inline button{border:1px solid #d9aa3c;background:linear-gradient(#fff9e8,#f3e0aa);color:#79540c;border-radius:7px;padding:5px 9px;cursor:pointer;font-weight:700}
    @media(max-width:760px){.feeling-row-top{grid-template-columns:1fr 76px 38px}.feeling-row-top .feeling-question-field{grid-column:1/-1;grid-row:2}.feeling-type-field{grid-column:1/2}}
  `;
  document.head.appendChild(style);

  const addFeelingBtn=document.querySelector('#addFeelingBtn');
  if(addFeelingBtn){
    addFeelingBtn.title='Добавить и настроить вторичные чувства';
    addFeelingBtn.setAttribute('aria-label','Добавить и настроить вторичные чувства');
  }

  const dialog=document.createElement('dialog');
  dialog.className='feeling-builder-dialog';
  dialog.innerHTML=`
    <div class="feeling-builder-shell">
      <div class="feeling-builder-head">
        <div>
          <div class="feeling-builder-title">Вторичные чувства</div>
          <div class="feeling-builder-sub">Добавь одно или несколько чувств. Тип, уточняющий вопрос и ответ клиента можно полностью редактировать. Каждое чувство остаётся отдельной веткой диагностики.</div>
        </div>
        <button class="feeling-builder-close" type="button" title="Закрыть">×</button>
      </div>
      <div class="feeling-builder-list"></div>
      <div class="feeling-builder-footer">
        <button class="feeling-add-row" type="button">+ Добавить чувство</button>
        <button class="feeling-builder-cancel" type="button">Отмена</button>
        <button class="feeling-builder-save" type="button">Сохранить чувства</button>
      </div>
    </div>`;
  document.body.appendChild(dialog);

  const list=dialog.querySelector('.feeling-builder-list');
  let editingBelief=null;
  let draft=[];

  function defaultQuestion(type){
    return FEELINGS.find(x=>x.name===type)?.question||'';
  }

  function findBeliefForObject(obj){
    const s=typeof situation==='function'?situation():null;
    if(!s) return null;
    for(const b of s.beliefs||[]){
      if(b===obj) return b;
      for(const f of b.feelings||[]){
        if(f===obj) return b;
        for(const d of f.deep||[]){
          if(d===obj) return b;
          if((d.instincts||[]).includes(obj)) return b;
        }
      }
    }
    return null;
  }

  function copyFeeling(f){
    let type=f.feelingType||'';
    let answer=f.feelingAnswer||'';
    if(!type){
      const raw=(f.text||'').trim();
      const known=FEELINGS.find(x=>raw===x.name||raw.startsWith(x.name+':'));
      if(known){
        type=known.name;
        if(raw.startsWith(known.name+':')) answer=raw.slice(known.name.length+1).trim();
      }else if(raw){
        type='Другое';
        answer=raw;
      }else type='Страх';
    }
    return {
      source:f,
      id:f.id||uid(),
      type,
      question:f.feelingQuestion!=null?f.feelingQuestion:defaultQuestion(type),
      answer,
      level:Number(f.level)||5,
      comment:f.comment||'',
      deep:Array.isArray(f.deep)?f.deep:[]
    };
  }

  function newDraft(type='Страх'){
    return {source:null,id:uid(),type,question:defaultQuestion(type),answer:'',level:5,comment:'',deep:[]};
  }

  function renderDraft(){
    list.innerHTML='';
    if(!draft.length){
      list.innerHTML='<div class="feeling-builder-empty">Чувств пока нет. Нажми «+ Добавить чувство».</div>';
      return;
    }
    draft.forEach((item,index)=>{
      const row=document.createElement('div');
      row.className='feeling-builder-row';
      row.innerHTML=`
        <div class="feeling-row-top">
          <label class="feeling-field feeling-type-field">Чувство<select></select></label>
          <label class="feeling-field feeling-question-field">Уточняющий вопрос<input type="text"></label>
          <label class="feeling-field">Уровень<input type="number" min="1" max="10"></label>
          <button class="feeling-delete-row" type="button" title="Удалить это чувство">×</button>
        </div>
        <label class="feeling-field feeling-answer">Ответ / уточнение клиента<textarea placeholder="Например: боится, что его осудят на сцене"></textarea></label>`;
      const sel=row.querySelector('select');
      FEELINGS.forEach(x=>{const o=document.createElement('option');o.value=x.name;o.textContent=x.name;sel.appendChild(o);});
      sel.value=item.type;
      const q=row.querySelector('input[type="text"]');
      const level=row.querySelector('input[type="number"]');
      const answer=row.querySelector('textarea');
      q.value=item.question||'';
      level.value=item.level||5;
      answer.value=item.answer||'';
      sel.onchange=()=>{
        const oldDefault=defaultQuestion(item.type);
        item.type=sel.value;
        if(!item.question || item.question===oldDefault){item.question=defaultQuestion(item.type);q.value=item.question;}
      };
      q.oninput=()=>item.question=q.value;
      level.oninput=()=>item.level=Math.max(1,Math.min(10,Number(level.value)||1));
      answer.oninput=()=>item.answer=answer.value;
      row.querySelector('.feeling-delete-row').onclick=()=>{draft.splice(index,1);renderDraft();};
      list.appendChild(row);
    });
  }

  function openBuilder(belief){
    if(!belief) return alert('Сначала выбери «Убеждение 1», к которому относятся чувства.');
    editingBelief=belief;
    const arr=Array.isArray(belief.feelings)?belief.feelings:[];
    draft=arr.map(copyFeeling);
    if(!draft.length) draft=[newDraft('Страх')];
    renderDraft();
    dialog.showModal();
  }

  function saveBuilder(){
    if(!editingBelief) return;
    editingBelief.feelings=draft.map(item=>{
      const f=item.source||{id:item.id,deep:item.deep||[]};
      f.id=f.id||item.id||uid();
      f.feelingType=item.type;
      f.feelingQuestion=item.question||'';
      f.feelingAnswer=item.answer||'';
      f.level=Math.max(1,Math.min(10,Number(item.level)||1));
      f.comment=item.comment||f.comment||'';
      if(!Array.isArray(f.deep)) f.deep=item.deep||[];
      const detail=(item.answer||'').trim();
      f.text=item.type+(detail?': '+detail:'');
      return f;
    });
    if(typeof save==='function') save();
    selected=null;
    if(typeof renderTree==='function') renderTree();
    dialog.close();
  }

  if(addFeelingBtn){
    addFeelingBtn.onclick=()=>{
      const belief=(typeof selected!=='undefined' && selected?.type==='belief')?selected.obj:findBeliefForObject(selected?.obj);
      openBuilder(belief);
    };
  }

  dialog.querySelector('.feeling-add-row').onclick=()=>{draft.push(newDraft('Страх'));renderDraft();setTimeout(()=>list.scrollTo({top:list.scrollHeight,behavior:'smooth'}),0);};
  dialog.querySelector('.feeling-builder-save').onclick=saveBuilder;
  dialog.querySelector('.feeling-builder-cancel').onclick=()=>dialog.close();
  dialog.querySelector('.feeling-builder-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});

  function updateInlineEditor(){
    const editorType=document.querySelector('#editorType');
    if(!editorType) return;
    let box=document.querySelector('#feelingEditorInline');
    const show=typeof selected!=='undefined' && selected?.type==='feeling';
    if(!show){if(box)box.remove();return;}
    if(!box){
      box=document.createElement('div');
      box.id='feelingEditorInline';
      box.className='feeling-editor-inline';
      box.innerHTML='<span>Вторичные чувства этого убеждения</span><button type="button">Редактировать список</button>';
      box.querySelector('button').onclick=()=>openBuilder(findBeliefForObject(selected?.obj));
      editorType.insertAdjacentElement('afterend',box);
    }
  }

  if(typeof renderEditor==='function'){
    const originalRenderEditor=renderEditor;
    renderEditor=function(){
      const result=originalRenderEditor.apply(this,arguments);
      updateInlineEditor();
      return result;
    };
    updateInlineEditor();
  }
})();
