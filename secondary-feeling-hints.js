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
    {name:'Боль', question:'Каким вы себя чувствуете, когда испытываете боль?'}
  ];

  const style=document.createElement('style');
  style.textContent=`
    .feeling-hint-inline{display:flex;align-items:center;gap:7px;margin:-2px 0 8px;color:#64748b;font-size:12px}
    .feeling-hint-inline button{border:1px solid #e1b669;background:linear-gradient(#fffaf0,#f6e8ca);color:#8a5b09;border-radius:7px;padding:5px 9px;cursor:pointer;font-weight:600;box-shadow:0 1px 2px rgba(110,75,20,.12);transition:transform .12s ease,box-shadow .12s ease,background .12s ease}
    .feeling-hint-inline button:hover{transform:translateY(-1px);background:linear-gradient(#fffdf7,#f1dfb8);box-shadow:0 3px 8px rgba(110,75,20,.18)}
    .feeling-hint-inline button:active{transform:translateY(1px);box-shadow:0 1px 2px rgba(110,75,20,.12)}
    .feeling-hints-dialog{width:min(760px,94vw);max-height:84vh;border:0;border-radius:12px;padding:0;background:#f8f7f2;box-shadow:0 18px 50px rgba(15,23,42,.32)}
    .feeling-hints-dialog::backdrop{background:rgba(15,23,42,.35);backdrop-filter:blur(5px)}
    .feeling-hints-shell{padding:18px;display:flex;flex-direction:column;max-height:84vh}
    .feeling-hints-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
    .feeling-hints-title{font-size:20px;font-weight:800;color:#3d3526}
    .feeling-hints-sub{font-size:12px;color:#7b7469;margin-top:3px}
    .feeling-hints-close{border:0;background:#ece9df;border-radius:7px;width:34px;height:34px;cursor:pointer;font-size:20px}
    .feeling-hints-list{overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:2px}
    .feeling-hint-item{display:block;border:1px solid #e2dccb;background:#fff;border-radius:9px;padding:10px 11px;text-align:left;cursor:pointer;color:#342f27;box-shadow:0 1px 2px rgba(15,23,42,.05);transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease}
    .feeling-hint-item:hover{transform:translateY(-1px);border-color:#d5a84f;box-shadow:0 4px 10px rgba(120,85,20,.12)}
    .feeling-hint-name{display:block;font-weight:800;color:#8a5b09;margin-bottom:5px}
    .feeling-hint-question{display:block;font-size:12px;line-height:1.35;color:#667085}
    @media(max-width:700px){.feeling-hints-list{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const addFeelingBtn=document.querySelector('#addFeelingBtn');
  if(addFeelingBtn){
    addFeelingBtn.title='Вторичные чувства и вопросы для уточнения';
    addFeelingBtn.setAttribute('aria-label','Добавить вторичное чувство. Вторичные чувства и вопросы для уточнения');
  }

  const dialog=document.createElement('dialog');
  dialog.className='feeling-hints-dialog';
  dialog.innerHTML=`
    <div class="feeling-hints-shell">
      <div class="feeling-hints-head">
        <div>
          <div class="feeling-hints-title">Вторичные чувства</div>
          <div class="feeling-hints-sub">Нажми на чувство, чтобы вставить его в редактор. Под ним — вопрос для уточнения.</div>
        </div>
        <button class="feeling-hints-close" type="button" title="Закрыть">×</button>
      </div>
      <div class="feeling-hints-list"></div>
    </div>`;
  document.body.appendChild(dialog);

  const list=dialog.querySelector('.feeling-hints-list');

  function renderList(){
    list.innerHTML='';
    FEELINGS.forEach(item=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='feeling-hint-item';
      btn.innerHTML='<span class="feeling-hint-name"></span><span class="feeling-hint-question"></span>';
      btn.querySelector('.feeling-hint-name').textContent=item.name;
      btn.querySelector('.feeling-hint-question').textContent=item.question;
      btn.onclick=()=>{
        const editor=document.querySelector('#editorText');
        if(editor){
          editor.value=item.name;
          editor.focus();
          editor.setSelectionRange(editor.value.length,editor.value.length);
        }
        dialog.close();
      };
      list.appendChild(btn);
    });
  }

  function openHints(){renderList();dialog.showModal();}
  dialog.querySelector('.feeling-hints-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});

  function updateInlineHint(){
    const editorType=document.querySelector('#editorType');
    if(!editorType) return;
    let box=document.querySelector('#feelingInlineHint');
    const show=typeof selected!=='undefined' && selected?.type==='feeling';
    if(!show){if(box)box.remove();return;}
    if(!box){
      box=document.createElement('div');
      box.id='feelingInlineHint';
      box.className='feeling-hint-inline';
      box.innerHTML='<span>💡 Вторичные чувства</span><button type="button">Подсказки</button>';
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
