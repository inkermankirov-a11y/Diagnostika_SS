'use strict';

(() => {
  function tripleConfirm(kind,name){
    if(!confirm(`Удалить ${kind} «${name}»?`))return false;
    if(!confirm(`Подтверди ещё раз: ${kind} «${name}» действительно нужно удалить?`))return false;
    return confirm(`ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ\n\n${kind} «${name}» будет удалён без возможности восстановления.\n\nУдалить окончательно?`);
  }

  function filesApi(){
    return window.DiagnostikaFiles?.moduleAware===true?window.DiagnostikaFiles:null;
  }

  async function deleteSessionMedia(sessionId){
    if(!sessionId)return;
    const api=filesApi();
    if(!api?.list||!api?.remove)return;
    try{
      const files=await api.list({sessionId});
      for(const file of files)await api.remove(file.id,{source:'session-editor-delete-media'});
    }catch(error){
      console.warn('Не удалось удалить все вложения сессии',error);
    }
  }

  function confirmClientTrash(name){
    if(!confirm(`Удалить клиента «${name}»?`))return false;
    if(!confirm(`Подтверди ещё раз: клиента «${name}» действительно нужно удалить?`))return false;
    return confirm(`ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ\n\nКлиент «${name}» будет перемещён в «Удалённые клиенты». Его можно будет восстановить.\n\nПереместить в корзину?`);
  }

  function clientsApi(){
    return window.DiagnostikaClients?.moduleAware===true?window.DiagnostikaClients:null;
  }

  function sessionsApi(){
    return window.DiagnostikaSessions?.moduleAware===true?window.DiagnostikaSessions:null;
  }

  function deleteCurrentClient(){
    const api=clientsApi();
    const c=api?.current?.()||null;
    if(!c?.id)return false;
    const name=c.name||'Без имени';
    if(!confirmClientTrash(name))return false;
    return !!api?.remove?.(c.id,{source:'session-interactions-client-delete'});
  }

  window.deleteCurrentClient=deleteCurrentClient;
  const deleteClientButton=document.querySelector('#deleteClientBtn');
  if(deleteClientButton)deleteClientButton.onclick=deleteCurrentClient;

  function enhanceSessionEditor(event){
    const {client:c,session:s,number,dialog:dlg}=event.detail||{};
    if(!c||!s||!dlg)return;
    const actions=dlg.querySelector('.session-edit-actions');
    if(!actions||actions.querySelector('.session-delete-btn'))return;

    const deleteBtn=document.createElement('button');
    deleteBtn.type='button';
    deleteBtn.className='session-delete-btn';
    const recordType=String(s?.appointmentType||s?.calendarTitle||'Сессия').trim()||'Сессия';
    deleteBtn.textContent=`Удалить: ${recordType}`;
    deleteBtn.onclick=async()=>{
      if(!tripleConfirm(recordType.toLowerCase(),`№${number}`))return;
      await deleteSessionMedia(s.id);
      const api=sessionsApi();
      if(!api?.remove)return alert('Модуль сессий ещё загружается.');
      if(s.calendarEventId){try{calendarApi()?.remove?.(s.calendarEventId,{source:'session-editor-delete'});}catch(_){}}
      const removed=api.remove(s.id,{client:c,source: 'session-editor-delete'});
      if(!removed)return alert(`Не удалось удалить: ${recordType.toLowerCase()}.`);
      try{window.DiagnostikaCalendarSessionPlanning?.refresh?.();}catch(_){}
      try{
        if(typeof selectedSessionId!=='undefined'&&selectedSessionId===s.id)selectedSessionId=null;
      }catch(_){}
      dlg.close();
    };

    actions.insertBefore(deleteBtn,actions.firstChild);
  }

  document.addEventListener('diagnostika:session-editor-opened',enhanceSessionEditor);
})();
