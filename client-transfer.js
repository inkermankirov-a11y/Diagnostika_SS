'use strict';

(() => {
  const SPECIALIST_KEY='diagnostika-specialist-name';
  const TRANSFER_FORMAT='diagnostika-client-transfer-v1';

  const TEXT={
    ru:{specialist:'Имя специалиста',specialistHint:'Укажи своё имя. Оно будет записываться при передаче клиентов.',save:'Сохранить',import:'Импорт клиента',export:'Экспорт',needName:'Сначала укажи имя специалиста в Настройках.',needTitle:'Имя специалиста не указано',badFile:'Это не файл экспорта клиента Diagnostika.',badTitle:'Неверный файл',duplicateTitle:'Клиент уже есть в базе',duplicateText:'Клиент с таким ID уже существует. Что сделать?',update:'Обновить',copy:'Создать копию',imported:'Клиент импортирован',from:'Передан от',current:'Текущий специалист',original:'Первичный специалист',history:'История передачи',exported:'Экспорт клиента создан.'},
    en:{specialist:'Specialist name',specialistHint:'Enter your name. It will be recorded when clients are transferred.',save:'Save',import:'Import client',export:'Export',needName:'First enter the specialist name in Settings.',needTitle:'Specialist name is missing',badFile:'This is not a Diagnostika client export file.',badTitle:'Invalid file',duplicateTitle:'Client already exists',duplicateText:'A client with this ID already exists. What should be done?',update:'Update',copy:'Create copy',imported:'Client imported',from:'Transferred from',current:'Current specialist',original:'Original specialist',history:'Transfer history',exported:'Client export created.'},
    fr:{specialist:'Nom du spécialiste',specialistHint:'Indiquez votre nom. Il sera enregistré lors du transfert des clients.',save:'Enregistrer',import:'Importer un client',export:'Exporter',needName:'Indiquez d’abord le nom du spécialiste dans les Paramètres.',needTitle:'Nom du spécialiste manquant',badFile:'Ce fichier n’est pas un export client Diagnostika.',badTitle:'Fichier invalide',duplicateTitle:'Le client existe déjà',duplicateText:'Un client avec cet identifiant existe déjà. Que faire ?',update:'Mettre à jour',copy:'Créer une copie',imported:'Client importé',from:'Transféré par',current:'Spécialiste actuel',original:'Spécialiste initial',history:'Historique des transferts',exported:'Export du client créé.'},
    de:{specialist:'Name des Spezialisten',specialistHint:'Gib deinen Namen an. Er wird bei der Übergabe von Klienten gespeichert.',save:'Speichern',import:'Klient importieren',export:'Export',needName:'Bitte zuerst den Namen des Spezialisten in den Einstellungen angeben.',needTitle:'Name des Spezialisten fehlt',badFile:'Dies ist keine Diagnostika-Klientenexportdatei.',badTitle:'Ungültige Datei',duplicateTitle:'Klient bereits vorhanden',duplicateText:'Ein Klient mit dieser ID existiert bereits. Was soll geschehen?',update:'Aktualisieren',copy:'Kopie erstellen',imported:'Klient importiert',from:'Übergeben von',current:'Aktueller Spezialist',original:'Erster Spezialist',history:'Übergabeverlauf',exported:'Klientenexport erstellt.'},
    it:{specialist:'Nome dello specialista',specialistHint:'Inserisci il tuo nome. Verrà registrato quando trasferisci i clienti.',save:'Salva',import:'Importa cliente',export:'Esporta',needName:'Prima inserisci il nome dello specialista nelle Impostazioni.',needTitle:'Nome dello specialista mancante',badFile:'Questo non è un file di esportazione cliente Diagnostika.',badTitle:'File non valido',duplicateTitle:'Cliente già presente',duplicateText:'Esiste già un cliente con questo ID. Cosa fare?',update:'Aggiorna',copy:'Crea copia',imported:'Cliente importato',from:'Trasferito da',current:'Specialista attuale',original:'Specialista iniziale',history:'Cronologia trasferimenti',exported:'Esportazione cliente creata.'}
  };

  function lang(){
    const l=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'en';
    return TEXT[l]?l:'en';
  }
  function t(k){return TEXT[lang()][k]||TEXT.en[k]||k;}
  function specialistName(){return (localStorage.getItem(SPECIALIST_KEY)||'').trim();}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function uidLocal(){return typeof uid==='function'?uid():'id_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
  function safeFileName(v){return String(v||'client').trim().replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').replace(/[. ]+$/g,'').slice(0,80)||'client';}

  function ensureSpecialistMeta(c,name){
    if(!c.specialistMeta || typeof c.specialistMeta!=='object') c.specialistMeta={};
    if(!Array.isArray(c.specialistMeta.transferHistory)) c.specialistMeta.transferHistory=[];
    if(!c.specialistMeta.originalSpecialist && name) c.specialistMeta.originalSpecialist=name;
    if(!c.specialistMeta.currentSpecialist && name) c.specialistMeta.currentSpecialist=name;
    return c.specialistMeta;
  }

  function addSettingsField(){
    const panel=document.querySelector('#settingsPanel');
    if(!panel || panel.querySelector('#specialistSettings')) return;
    const box=document.createElement('div');
    box.id='specialistSettings';
    box.innerHTML=`
      <label class="specialist-settings-label" for="specialistNameInput"></label>
      <input id="specialistNameInput" type="text" autocomplete="name">
      <div class="specialist-settings-hint"></div>
      <button id="specialistSaveBtn" type="button"></button>`;
    const style=document.createElement('style');
    style.textContent=`
      #specialistSettings{padding:10px;border:1px solid #d5dee8;border-radius:9px;background:#f8fafc;display:grid;gap:6px}
      .specialist-settings-label{font-size:12px;font-weight:800;color:#334155}
      #specialistNameInput{width:100%;box-sizing:border-box;height:36px;border:1px solid #b8c5d3;border-radius:7px;padding:0 9px;background:#fff;color:#1f2937}
      .specialist-settings-hint{font-size:11px;line-height:1.35;color:#64748b}
      #specialistSaveBtn{height:34px!important;border-radius:7px!important;background:linear-gradient(#3fa56f,#218955)!important;color:#fff!important;border:0!important;font-weight:700!important}
      .db-export-btn{background:linear-gradient(#7b8ea5,#5a6f87)!important;color:#fff!important;border:1px solid #52657a!important;border-radius:6px!important;padding:7px 10px!important;font-weight:700!important}
      .db-import-btn{margin-left:8px;background:linear-gradient(#3fa56f,#218955)!important;color:#fff!important;border:0!important;border-radius:7px!important;padding:9px 13px!important;font-weight:700!important;box-shadow:0 3px 8px rgba(15,23,42,.16)}
      .client-specialist-info{margin-top:5px;font-size:12px;color:#64748b;display:flex;flex-wrap:wrap;gap:5px 14px}
      .client-specialist-info strong{color:#334155}
    `;
    document.head.appendChild(style);
    panel.prepend(box);
    const input=box.querySelector('#specialistNameInput');
    input.value=specialistName();
    box.querySelector('#specialistSaveBtn').onclick=()=>{
      localStorage.setItem(SPECIALIST_KEY,input.value.trim());
      refreshLabels();
      updateClientSpecialistInfo();
    };
    refreshLabels();
  }

  function refreshLabels(){
    const box=document.querySelector('#specialistSettings');
    if(box){
      box.querySelector('.specialist-settings-label').textContent=t('specialist');
      box.querySelector('.specialist-settings-hint').textContent=t('specialistHint');
      box.querySelector('#specialistSaveBtn').textContent=t('save');
    }
    const imp=document.querySelector('#clientImportBtn');
    if(imp) imp.textContent=t('import');
    document.querySelectorAll('.db-export-btn').forEach(b=>b.textContent=t('export'));
    updateClientSpecialistInfo();
  }

  async function requireSpecialist(){
    const name=specialistName();
    if(name) return name;
    await AppDialog.alert(t('needName'),t('needTitle'));
    document.querySelector('#settingsMenuBtn')?.click();
    setTimeout(()=>document.querySelector('#specialistNameInput')?.focus(),100);
    return '';
  }

  async function exportClient(c){
    const name=await requireSpecialist();
    if(!name) return;
    const copy=clone(c);
    const meta=ensureSpecialistMeta(copy,name);
    meta.currentSpecialist=name;
    if(!meta.originalSpecialist) meta.originalSpecialist=name;

    const pkg={
      format:TRANSFER_FORMAT,
      version:1,
      exportedAt:new Date().toISOString(),
      exportedBy:name,
      client:copy
    };
    const blob=new Blob([JSON.stringify(pkg,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`Diagnostika_${safeFileName(copy.name)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);

    // Сохраняем происхождение и в локальной карточке клиента.
    const live=(state.clients||[]).find(x=>x.id===c.id);
    if(live){
      const liveMeta=ensureSpecialistMeta(live,name);
      liveMeta.currentSpecialist=name;
      save();
    }
    updateClientSpecialistInfo();
  }

  function makeCopyIds(client){
    const c=clone(client);
    c.id=uidLocal();
    const resetDeep=deep=>{
      deep.id=uidLocal();
      (deep.instincts||[]).forEach(i=>i.id=uidLocal());
    };
    (c.requests||[]).forEach(r=>{
      r.id=uidLocal();
      (r.situations||[]).forEach(s=>{
        s.id=uidLocal();
        (s.beliefs||[]).forEach(b=>{
          b.id=uidLocal();
          (b.feelings||[]).forEach(f=>{
            f.id=uidLocal();
            (f.deep||[]).forEach(resetDeep);
          });
        });
      });
    });
    (c.sessions||[]).forEach(s=>s.id=uidLocal());
    return c;
  }

  async function importPackage(pkg){
    if(!pkg || pkg.format!==TRANSFER_FORMAT || !pkg.client || typeof pkg.client!=='object'){
      await AppDialog.alert(t('badFile'),t('badTitle'));
      return;
    }
    const current=await requireSpecialist();
    if(!current) return;

    let incoming=clone(pkg.client);
    const meta=ensureSpecialistMeta(incoming,pkg.exportedBy||'');
    const previous=meta.currentSpecialist||pkg.exportedBy||meta.originalSpecialist||'';
    if(!meta.originalSpecialist) meta.originalSpecialist=previous||current;
    if(previous && previous!==current){
      meta.transferHistory.push({from:previous,to:current,at:new Date().toISOString()});
    }
    meta.currentSpecialist=current;
    meta.lastImportedAt=new Date().toISOString();
    meta.lastImportedFrom=previous||'';

    const existingIndex=(state.clients||[]).findIndex(c=>c.id===incoming.id);
    if(existingIndex>=0){
      const update=await AppDialog.confirm(t('duplicateText'),t('duplicateTitle'),t('update'),t('copy'));
      if(update){
        state.clients[existingIndex]=incoming;
      }else{
        incoming=makeCopyIds(incoming);
        state.clients.push(incoming);
      }
    }else{
      state.clients.push(incoming);
    }

    clientId=incoming.id;
    requestId=null;
    situationId=null;
    selected=null;
    save();
    if(typeof renderClient==='function') renderClient();
    if(typeof window.renderClientDatabaseTable==='function') window.renderClientDatabaseTable();
    updateClientSpecialistInfo();
    await AppDialog.alert(`${incoming.name||''}\n${t('from')}: ${previous||'—'}\n${t('current')}: ${current}`,t('imported'));
  }

  function setupImport(){
    const dlg=document.querySelector('#clientDialog');
    const add=document.querySelector('#dialogAddClientBtn');
    if(!dlg || !add || document.querySelector('#clientImportBtn')) return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.id='clientImportBtn';
    btn.className='db-import-btn';
    btn.textContent=t('import');
    add.insertAdjacentElement('afterend',btn);

    const input=document.createElement('input');
    input.type='file';
    input.accept='.json,application/json';
    input.hidden=true;
    document.body.appendChild(input);
    btn.onclick=()=>input.click();
    input.onchange=async()=>{
      const file=input.files?.[0];
      input.value='';
      if(!file) return;
      try{
        const pkg=JSON.parse(await file.text());
        await importPackage(pkg);
      }catch(e){
        console.error(e);
        await AppDialog.alert(t('badFile'),t('badTitle'));
      }
    };
  }

  function patchDatabaseRender(){
    if(typeof window.renderClientDatabaseTable!=='function' || window.renderClientDatabaseTable.__transferPatched) return;
    const original=window.renderClientDatabaseTable;
    const wrapped=function(){
      original.apply(this,arguments);
      const rows=document.querySelectorAll('#clientDatabaseList tbody tr');
      rows.forEach((tr,index)=>{
        const c=state.clients[index];
        const group=tr.querySelector('.db-action-group');
        if(!c || !group || group.querySelector('.db-export-btn')) return;
        const exportBtn=document.createElement('button');
        exportBtn.type='button';
        exportBtn.className='db-export-btn';
        exportBtn.textContent=t('export');
        exportBtn.onclick=e=>{e.stopPropagation();exportClient(c);};
        const deleteBtn=group.querySelector('.db-delete-btn');
        if(deleteBtn) group.insertBefore(exportBtn,deleteBtn); else group.appendChild(exportBtn);
      });
      setupImport();
      refreshLabels();
    };
    wrapped.__transferPatched=true;
    window.renderClientDatabaseTable=wrapped;
  }

  function updateClientSpecialistInfo(){
    const home=document.querySelector('#clientHome');
    if(!home) return;
    let info=home.querySelector('#clientSpecialistInfo');
    if(!info){
      info=document.createElement('div');
      info.id='clientSpecialistInfo';
      info.className='client-specialist-info';
      const anchor=document.querySelector('#clientLastSession');
      if(anchor) anchor.insertAdjacentElement('afterend',info); else home.prepend(info);
    }
    const c=(state.clients||[]).find(x=>x.id===clientId);
    const meta=c?.specialistMeta;
    if(!meta || (!meta.originalSpecialist && !meta.currentSpecialist)){
      info.textContent='';
      info.style.display='none';
      return;
    }
    info.style.display='flex';
    info.innerHTML='';
    const a=document.createElement('span');
    a.innerHTML=`<strong>${t('original')}:</strong> `;
    a.append(document.createTextNode(meta.originalSpecialist||'—'));
    const b=document.createElement('span');
    b.innerHTML=`<strong>${t('current')}:</strong> `;
    b.append(document.createTextNode(meta.currentSpecialist||'—'));
    info.append(a,b);
    if(Array.isArray(meta.transferHistory) && meta.transferHistory.length){
      info.title=meta.transferHistory.map(x=>`${x.from||'—'} → ${x.to||'—'}${x.at?' · '+new Date(x.at).toLocaleString():''}`).join('\n');
    }else info.title='';
  }

  const oldRenderClient=window.renderClient;
  if(typeof oldRenderClient==='function'){
    window.renderClient=function(){
      const r=oldRenderClient.apply(this,arguments);
      setTimeout(updateClientSpecialistInfo,0);
      return r;
    };
  }

  addSettingsField();
  setupImport();
  patchDatabaseRender();
  updateClientSpecialistInfo();

  const observer=new MutationObserver(()=>{
    addSettingsField();
    setupImport();
    patchDatabaseRender();
  });
  observer.observe(document.body,{childList:true,subtree:true});

  const oldSetLanguage=window.DiagnostikaI18n?.setLanguage;
  if(oldSetLanguage && !oldSetLanguage.__transferPatched){
    const wrapped=function(l){
      const r=oldSetLanguage.call(this,l);
      setTimeout(refreshLabels,0);
      return r;
    };
    wrapped.__transferPatched=true;
    window.DiagnostikaI18n.setLanguage=wrapped;
  }
})();
