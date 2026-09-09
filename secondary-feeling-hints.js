'use strict';

(() => {
  const PRESETS = [
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
    {name:'Боль', question:'Каким вы себя чувствуете, когда испытываете боль?'}
  ];

  const style=document.createElement('style');
  style.textContent=`
    .feeling-builder-dialog{width:min(900px,96vw);height:min(720px,90vh);border:0;border-radius:14px;padding:0;background:#f4f7fb;box-shadow:0 22px 60px rgba(15,23,42,.34)}
    .feeling-builder-dialog::backdrop{background:rgba(15,23,42,.38);backdrop-filter:blur(6px)}
    .feeling-builder-shell{height:100%;padding:18px;display:flex;flex-direction:column;min-height:0}
    .feeling-builder-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:13px}
    .feeling-builder-title{font-size:21px;font-weight:800;color:#1f2f43;text-transform:uppercase}
    .feeling-builder-sub{font-size:12px;color:#718096;margin-top:5px;line-height:1.4}
    .feeling-builder-close{width:34px;height:34px;border:0;border-radius:8px;background:#e8edf3;cursor:pointer;font-size:20px;color:#475569}
    .feeling-list-frame{min-height:0;flex:1;border:1px solid #d3dce7;background:#fff;border-radius:10px;padding:8px;overflow:auto;box-shadow:inset 0 1px 2px rgba(15,23,42,.04)}
    .feeling-list-head{position:sticky;top:-8px;z-index:2;display:grid;grid-template-columns:42px minmax(180px,1fr) 84px minmax(260px,2fr) 38px;gap:8px;align-items:center;background:#eaf0f7;border-bottom:1px solid #cfd9e5;padding:9px 10px;margin:-8px -8px 8px;color:#526174;font-size:11px;font-weight:800;text-transform:uppercase}
    .feeling-list-head>div:nth-child(1),.feeling-list-head>div:nth-child(3){text-align:center}
    .feeling-select-row{display:grid;grid-template-columns:42px minmax(180px,1fr) 84px minmax(260px,2fr) 38px;gap:8px;align-items:center;min-height:54px;padding:7px 10px;margin-bottom:6px;border:1px solid #dce4ed;border-left:4px solid #d5dde8;border-radius:9px;background:#fbfcfe;transition:background .13s ease,border-color .13s ease,box-shadow .13s ease,transform .13s ease}
    .feeling-select-row:hover{background:#f4f8fe;border-color:#b9cce4;box-shadow:0 3px 10px rgba(43,75,115,.09);transform:translateY(-1px)}
    .feeling-select-row.is-selected{background:#eef6ff;border-color:#9bbce3;border-left-color:#4f82c4;box-shadow:0 2px 8px rgba(58,105,165,.10)}
    .feeling-check-wrap{display:grid;place-items:center}
    .feeling-check{width:18px;height:18px;accent-color:#4169e1;cursor:pointer}
    .feeling-name-wrap{min-width:0;display:flex;align-items:center;gap:7px}
    .feeling-name{font-weight:700;color:#26364a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:help}
    .feeling-custom-name{width:100%;height:34px;border:1px solid #b9c7d7;border-radius:7px;padding:0 8px;background:#fff}
    .feeling-question-edit{width:27px;height:27px;border:1px solid #c7d2df!important;border-radius:50%!important;background:#fff!important;color:#56708f!important;padding:0!important;box-shadow:none!important;font-size:12px;display:grid;place-items:center;flex:0 0 27px}
    .feeling-question-edit:hover{background:#eef5fd!important;transform:none!important;box-shadow:none!important}
    .feeling-level{width:72px;height:34px;border:1px solid #b9c7d7;border-radius:7px;padding:0 6px;background:#fff;text-align:center}
    .feeling-answer{width:100%;height:34px;border:1px solid #b9c7d7;border-radius:7px;padding:0 9px;background:#fff;color:#26364a}
    .feeling-answer::placeholder{color:#a1acb9}
    .feeling-delete-custom{width:30px;height:30px;border:1px solid #efb2b2!important;border-radius:7px!important;background:#fff4f4!important;color:#b52828!important;padding:0!important;box-shadow:none!important;font-weight:800}
    .feeling-delete-custom:hover{background:#ffe4e4!important;transform:none!important;box-shadow:none!important}
    .feeling-question-row{grid-column:2/5;display:none;grid-template-columns:130px 1fr;gap:8px;align-items:center;padding:2px 0 3px;font-size:11px;color:#6b7788}
    .feeling-select-row.question-open .feeling-question-row{display:grid}
    .feeling-question-input{height:32px;border:1px solid #b9c7d7;border-radius:7px;padding:0 8px;background:#fff;color:#334155;width:100%}
    .feeling-builder-footer{display:flex;align-items:center;gap:9px;margin-top:14px;padding-top:13px;border-top:1px solid #d8e0e8}
    .feeling-add-custom{border:1px solid #7fa4d6;background:linear-gradient(#6495df,#4777c5);color:#fff;border-radius:8px;padding:9px 13px;cursor:pointer;font-weight:700}
    .feeling-builder-cancel{margin-left:auto;border:1px solid #cbd5e1;background:#edf1f5;color:#334155;border-radius:8px;padding:9px 14px;cursor:pointer}
    .feeling-builder-save{border:1px solid #197149;background:linear-gradient(#35a56d,#238b57);color:#fff;border-radius:8px;padding:9px 16px;cursor:pointer;font-weight:700;box-shadow:0 3px 7px rgba(26,110,70,.2)}
    .feeling-editor-inline{display:flex;align-items:center;gap:8px;margin:-2px 0 8px;color:#64748b;font-size:12px}
    .feeling-editor-inline button{border:1px solid #d9aa3c;background:linear-gradient(#fff9e8,#f3e0aa);color:#79540c;border-radius:7px;padding:5px 9px;cursor:pointer;font-weight:700}
    @media(max-width:760px){
      .feeling-list-head{display:none}
      .feeling-select-row{grid-template-columns:38px 1fr 74px;grid-template-rows:auto auto;gap:6px}
      .feeling-answer{grid-column:2/4}
      .feeling-question-edit{display:none}
      .feeling-question-row{grid-column:2/4;display:grid;grid-template-columns:1fr}
    }
  `;
  document.head.appendChild(style);

  const addFeelingBtn=document.querySelector('#addFeelingBtn');
  if(addFeelingBtn){
    addFeelingBtn.title='Выбрать вторичные чувства';
    addFeelingBtn.setAttribute('aria-label','Выбрать вторичные чувства');
  }

  const dialog=document.createElement('dialog');
  dialog.className='feeling-builder-dialog';
  dialog.innerHTML=`
    <div class="feeling-builder-shell">
      <div class="feeling-builder-head">
        <div>
          <div class="feeling-builder-title">Вторичные чувства</div>
          <div class="feeling-builder-sub">Отметь подходящие чувства. Для каждого можно указать уровень и ответ клиента. Наведи на название — увидишь диагностический вопрос; кнопка ✎ позволяет его изменить.</div>
        </div>
        <button class="feeling-builder-close" type="button" title="Закрыть">×</button>
      </div>
      <div class="feeling-list-frame">
        <div class="feeling-list-head"><div>Выбор</div><div>Чувство</div><div>Уровень</div><div>Ответ / уточнение клиента</div><div></div></div>
        <div class="feeling-builder-list"></div>
      </div>
      <div class="feeling-builder-footer">
        <button class="feeling-add-custom" type="button">+ Своё чувство</button>
        <button class="feeling-builder-cancel" type="button">Отмена</button>
        <button class="feeling-builder-save" type="button">Сохранить выбранные</button>
      </div>
    </div>`;
  document.body.appendChild(dialog);

  const list=dialog.querySelector('.feeling-builder-list');
  let editingBelief=null;
  let rows=[];

  function presetQuestion(name){return PRESETS.find(x=>x.name===name)?.question||'';}

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

  function normalizeExisting(f){
    let name=f.feelingType||'';
    let answer=f.feelingAnswer||'';
    if(!name){
      const raw=(f.text||'').trim();
      const known=PRESETS.find(x=>raw===x.name||raw.startsWith(x.name+':'));
      if(known){name=known.name;if(raw.startsWith(known.name+':'))answer=raw.slice(known.name.length+1).trim();}
      else {name=raw||'Своё чувство';answer='';}
    }
    return {source:f,id:f.id||uid(),name,checked:true,question:f.feelingQuestion!=null?f.feelingQuestion:presetQuestion(name),answer,level:Number(f.level)||5,comment:f.comment||'',deep:Array.isArray(f.deep)?f.deep:[],custom:!PRESETS.some(x=>x.name===name),questionOpen:false};
  }

  function buildRows(belief){
    const existing=(belief.feelings||[]).map(normalizeExisting);
    const result=[];
    PRESETS.forEach(p=>{
      const old=existing.find(x=>!x.custom&&x.name===p.name);
      result.push(old||{source:null,id:uid(),name:p.name,checked:false,question:p.question,answer:'',level:5,comment:'',deep:[],custom:false,questionOpen:false});
    });
    existing.filter(x=>x.custom).forEach(x=>result.push(x));
    return result;
  }

  function renderRows(){
    list.innerHTML='';
    rows.forEach((item,index)=>{
      const row=document.createElement('div');
      row.className='feeling-select-row'+(item.checked?' is-selected':'')+(item.questionOpen?' question-open':'');
      row.innerHTML=`
        <div class="feeling-check-wrap"><input class="feeling-check" type="checkbox"></div>
        <div class="feeling-name-wrap"></div>
        <input class="feeling-level" type="number" min="1" max="10">
        <input class="feeling-answer" type="text" placeholder="Введите ответ / уточнение клиента">
        <div class="feeling-row-action"></div>
        <div class="feeling-question-row"><span>Диагностический вопрос</span><input class="feeling-question-input" type="text"></div>`;

      const check=row.querySelector('.feeling-check');
      const nameWrap=row.querySelector('.feeling-name-wrap');
      const level=row.querySelector('.feeling-level');
      const answer=row.querySelector('.feeling-answer');
      const action=row.querySelector('.feeling-row-action');
      const qInput=row.querySelector('.feeling-question-input');

      check.checked=item.checked;
      level.value=item.level||5;
      answer.value=item.answer||'';
      qInput.value=item.question||'';

      if(item.custom){
        const name=document.createElement('input');
        name.className='feeling-custom-name';
        name.value=item.name||'';
        name.placeholder='Название чувства';
        name.oninput=()=>item.name=name.value;
        nameWrap.appendChild(name);
        const del=document.createElement('button');
        del.type='button';del.className='feeling-delete-custom';del.textContent='×';del.title='Удалить своё чувство';
        del.onclick=()=>{rows.splice(index,1);renderRows();};
        action.appendChild(del);
      }else{
        const name=document.createElement('span');
        name.className='feeling-name';
        name.textContent=item.name;
        name.title=item.question||'Диагностический вопрос не задан';
        const edit=document.createElement('button');
        edit.type='button';edit.className='feeling-question-edit';edit.textContent='✎';edit.title='Изменить диагностический вопрос';
        edit.onclick=()=>{item.questionOpen=!item.questionOpen;renderRows();setTimeout(()=>{if(item.questionOpen){const inputs=list.querySelectorAll('.feeling-question-input');inputs[index]?.focus();}},0);};
        nameWrap.append(name,edit);
      }

      check.onchange=()=>{item.checked=check.checked;row.classList.toggle('is-selected',item.checked);};
      level.oninput=()=>item.level=Math.max(1,Math.min(10,Number(level.value)||1));
      answer.oninput=()=>item.answer=answer.value;
      qInput.oninput=()=>{item.question=qInput.value;const title=row.querySelector('.feeling-name');if(title)title.title=item.question||'Диагностический вопрос не задан';};

      list.appendChild(row);
    });
  }

  function openBuilder(belief){
    if(!belief) return alert('Сначала выбери «Убеждение 1», к которому относятся чувства.');
    editingBelief=belief;
    rows=buildRows(belief);
    renderRows();
    dialog.showModal();
  }

  function saveBuilder(){
    if(!editingBelief)return;
    const selectedRows=rows.filter(x=>x.checked && String(x.name||'').trim());
    editingBelief.feelings=selectedRows.map(item=>{
      const f=item.source||{id:item.id,deep:item.deep||[]};
      f.id=f.id||item.id||uid();
      f.feelingType=String(item.name||'').trim();
      f.feelingQuestion=item.question||'';
      f.feelingAnswer=item.answer||'';
      f.level=Math.max(1,Math.min(10,Number(item.level)||1));
      f.comment=item.comment||f.comment||'';
      if(!Array.isArray(f.deep))f.deep=item.deep||[];
      const detail=(item.answer||'').trim();
      f.text=f.feelingType+(detail?': '+detail:'');
      return f;
    });
    if(typeof save==='function')save();
    selected=null;
    if(typeof renderTree==='function')renderTree();
    dialog.close();
  }

  if(addFeelingBtn){
    addFeelingBtn.onclick=()=>{
      const belief=(typeof selected!=='undefined'&&selected?.type==='belief')?selected.obj:findBeliefForObject(selected?.obj);
      openBuilder(belief);
    };
  }

  dialog.querySelector('.feeling-add-custom').onclick=()=>{
    rows.push({source:null,id:uid(),name:'',checked:true,question:'',answer:'',level:5,comment:'',deep:[],custom:true,questionOpen:true});
    renderRows();
    setTimeout(()=>{const frame=dialog.querySelector('.feeling-list-frame');frame.scrollTo({top:frame.scrollHeight,behavior:'smooth'});const names=list.querySelectorAll('.feeling-custom-name');names[names.length-1]?.focus();},0);
  };
  dialog.querySelector('.feeling-builder-save').onclick=saveBuilder;
  dialog.querySelector('.feeling-builder-cancel').onclick=()=>dialog.close();
  dialog.querySelector('.feeling-builder-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});

  function updateInlineEditor(){
    const editorType=document.querySelector('#editorType');
    if(!editorType)return;
    let box=document.querySelector('#feelingEditorInline');
    const show=typeof selected!=='undefined'&&selected?.type==='feeling';
    if(!show){if(box)box.remove();return;}
    if(!box){
      box=document.createElement('div');
      box.id='feelingEditorInline';box.className='feeling-editor-inline';
      box.innerHTML='<span>Вторичные чувства этого убеждения</span><button type="button">Редактировать список</button>';
      box.querySelector('button').onclick=()=>openBuilder(findBeliefForObject(selected?.obj));
      editorType.insertAdjacentElement('afterend',box);
    }
  }

  if(typeof renderEditor==='function'){
    const originalRenderEditor=renderEditor;
    renderEditor=function(){const result=originalRenderEditor.apply(this,arguments);updateInlineEditor();return result;};
    updateInlineEditor();
  }
})();
