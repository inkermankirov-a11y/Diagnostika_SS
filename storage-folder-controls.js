'use strict';

(() => {
  const HANDLE_DB='diagnostika-storage-handles-v1';
  const HANDLE_STORE='handles';
  const HANDLE_KEY='data-root';

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(HANDLE_DB,1);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE);
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }

  async function saveHandle(handle){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(HANDLE_STORE,'readwrite');
      tx.objectStore(HANDLE_STORE).put(handle,HANDLE_KEY);
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();reject(tx.error);};
    });
  }

  async function chooseFolder(){
    if(!('showDirectoryPicker' in window)){
      await AppDialog.alert('Этот браузер не поддерживает выбор папки. Используй Chrome или Edge.','Недоступно');
      return;
    }
    try{
      const handle=await window.showDirectoryPicker({mode:'readwrite'});
      let p=await handle.queryPermission({mode:'readwrite'});
      if(p!=='granted') p=await handle.requestPermission({mode:'readwrite'});
      if(p!=='granted'){
        await AppDialog.alert('Доступ к выбранной папке не разрешён.','Нет доступа');
        return;
      }
      await saveHandle(handle);
      await AppDialog.alert(
        `Выбрана папка: ${handle.name}.\nТеперь нажми «Синхронизировать», чтобы объединить базу браузера и этой папки.`,
        'Папка подключена'
      );
    }catch(e){
      if(e?.name!=='AbortError'){
        console.error(e);
        await AppDialog.alert('Не удалось выбрать папку.','Ошибка');
      }
    }
  }

  function install(){
    const actions=document.querySelector('.storage-dialog .storage-actions-main');
    const sync=actions?.querySelector('#storageSync');
    if(!actions || !sync || actions.querySelector('#storageChangeFolder')) return;

    const choose=document.createElement('button');
    choose.id='storageChangeFolder';
    choose.type='button';
    choose.textContent='Подключить / сменить папку';
    choose.onclick=chooseFolder;
    actions.insertBefore(choose,sync);
  }

  install();
  const observer=new MutationObserver(install);
  observer.observe(document.body,{childList:true,subtree:true});
})();
