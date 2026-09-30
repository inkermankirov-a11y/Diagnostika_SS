'use strict';

(() => {
  function snapshot(dlg){
    return [...dlg.querySelectorAll('input,select,textarea')]
      .filter(el=>el.type!=='file')
      .map(el=>`${el.type}|${el.checked?'1':'0'}|${el.value}`)
      .join('\u241e');
  }

  async function askSave(dlg,saveBtn,closeWithoutSave){
    const yes=window.AppDialog?.confirm
      ? await window.AppDialog.confirm('Сохранить изменения?','Несохранённые изменения','Да','Нет')
      : confirm('Сохранить изменения?');
    if(yes){
      saveBtn?.click();
    }else{
      closeWithoutSave();
    }
  }

  function guardSessionDialog(dlg){
    if(!dlg||dlg.dataset.unsavedGuard==='1')return;
    dlg.dataset.unsavedGuard='1';
    const initial=snapshot(dlg);
    let bypass=false;
    const saveBtn=dlg.querySelector('.session-edit-actions .primary');
    const deleteBtn=dlg.querySelector('.session-delete-btn');
    const cancelBtn=[...dlg.querySelectorAll('.session-edit-actions button')].find(b=>b!==saveBtn&&b!==deleteBtn);
    const dirty=()=>snapshot(dlg)!==initial;
    const discard=()=>{bypass=true;try{dlg.close();}catch(_){}};

    saveBtn?.addEventListener('click',()=>{bypass=true;},{capture:true});
    deleteBtn?.addEventListener('click',()=>{bypass=true;},{capture:true});

    if(cancelBtn){
      cancelBtn.addEventListener('click',e=>{
        if(bypass||!dirty())return;
        e.preventDefault();
        e.stopImmediatePropagation();
        askSave(dlg,saveBtn,discard);
      },true);
    }

    dlg.addEventListener('click',e=>{
      if(e.target!==dlg||bypass)return;
      if(!dirty()){discard();return;}
      e.preventDefault();
      e.stopImmediatePropagation();
      askSave(dlg,saveBtn,discard);
    },true);

    dlg.addEventListener('cancel',e=>{
      if(bypass||!dirty())return;
      e.preventDefault();
      askSave(dlg,saveBtn,discard);
    });
  }

  const oldOpenSessionEditor=window.openSessionEditor;
  if(typeof oldOpenSessionEditor==='function'&&!oldOpenSessionEditor.__unsavedGuardPatched){
    const wrapped=function(){
      const result=oldOpenSessionEditor.apply(this,arguments);
      const dialogs=[...document.querySelectorAll('dialog.session-edit-dialog')];
      guardSessionDialog(dialogs[dialogs.length-1]);
      return result;
    };
    wrapped.__unsavedGuardPatched=true;
    window.openSessionEditor=wrapped;
  }
})();
