'use strict';

(() => {
  if(window.__diagnostikaClientTransferReady) return;
  window.__diagnostikaClientTransferReady=true;

  const SPECIALIST_KEY='diagnostika-specialist-name';
  const TRANSFER_FORMAT='diagnostika-client-transfer-v1';

  const TEXT={
    ru:{import:'Импорт клиента',export:'Экспорт',needName:'Сначала укажи имя специалиста в Настройках.',needTitle:'Имя специалиста не указано',badFile:'Это не файл экспорта клиента Diagnostika.',badTitle:'Неверный файл',duplicateTitle:'Клиент уже есть в базе',duplicateText:'Клиент с таким ID уже существует. Что сделать?',update:'Обновить',copy:'Создать копию',imported:'Клиент импортирован',from:'Передан от',current:'Текущий специалист',historyTitle:'История специалистов',currentBadge:'Текущий',period:'Период',requests:'Запросы',noRequests:'Запросы не зафиксированы',present:'по настоящее время',unknownStart:'начало не зафиксировано',close:'Закрыть'},
    en:{import:'Import client',export:'Export',needName:'First enter the specialist name in Settings.',needTitle:'Specialist name is missing',badFile:'This is not a Diagnostika client export file.',badTitle:'Invalid file',duplicateTitle:'Client already exists',duplicateText:'A client with this ID already exists. What should be done?',update:'Update',copy:'Create copy',imported:'Client imported',from:'Transferred from',current:'Current specialist',historyTitle:'Specialist history',currentBadge:'Current',period:'Period',requests:'Requests',noRequests:'No requests recorded',present:'present',unknownStart:'start not recorded',close:'Close'},
    fr:{import:'Importer un client',export:'Exporter',needName:'Indiquez d’abord le nom du spécialiste dans les Paramètres.',needTitle:'Nom du spécialiste manquant',badFile:'Ce fichier n’est pas un export client Diagnostika.',badTitle:'Fichier invalide',duplicateTitle:'Le client existe déjà',duplicateText:'Un client avec cet identifiant existe déjà. Que faire ?',update:'Mettre à jour',copy:'Créer une copie',imported:'Client importé',from:'Transféré par',current:'Spécialiste actuel',historyTitle:'Historique des spécialistes',currentBadge:'Actuel',period:'Période',requests:'Demandes',noRequests:'Aucune demande enregistrée',present:'à ce jour',unknownStart:'début non enregistré',close:'Fermer'},
    de:{import:'Klient importieren',export:'Export',needName:'Bitte zuerst den Namen des Spezialisten in den Einstellungen angeben.',needTitle:'Name des Spezialisten fehlt',badFile:'Dies ist keine Diagnostika-Klientenexportdatei.',badTitle:'Ungültige Datei',duplicateTitle:'Klient bereits vorhanden',duplicateText:'Ein Klient mit dieser ID existiert bereits. Was soll geschehen?',update:'Aktualisieren',copy:'Kopie erstellen',imported:'Klient importiert',from:'Übergeben von',current:'Aktueller Spezialist',historyTitle:'Verlauf der Spezialisten',currentBadge:'Aktuell',period:'Zeitraum',requests:'Anliegen',noRequests:'Keine Anliegen erfasst',present:'bis heute',unknownStart:'Beginn nicht erfasst',close:'Schließen'},
    it:{import:'Importa cliente',export:'Esporta',needName:'Prima inserisci il nome dello specialista nelle Impostazioni.',needTitle:'Nome dello specialista mancante',badFile:'Questo non è un file di esportazione cliente Diagnostika.',badTitle:'File non valido',duplicateTitle:'Cliente già presente',duplicateText:'Esiste già un cliente con questo ID. Cosa fare?',update:'Aggiorna',copy:'Crea copia',imported:'Cliente importato',from:'Trasferito da',current:'Specialista attuale',historyTitle:'Storico degli specialisti',currentBadge:'Attuale',period:'Periodo',requests:'Richieste',noRequests:'Nessuna richiesta registrata',present:'ad oggi',unknownStart:'inizio non registrato',close:'Chiudi'}
  };

  function lang(){
    const l=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'ru';
    return TEXT[l]?l:'ru';
  }
  function t(k){return TEXT[lang()][k]||TEXT.ru[k]||k;}
  function specialistName(){return (localStorage.getItem(SPECIALIST_KEY)||'').trim();}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function uidLocal(){return crypto.randomUUID?crypto.randomUUID():'id_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
  function safeFileName(v){return String(v||'client').trim().replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').replace(/[. ]+$/g,'').slice(0,80)||'client';}
  const clientsApi=()=>window.DiagnostikaClients
    || window.DiagnostikaPlatform?.clients
    || window.DiagnostikaPlatform?.services?.clients
    || null;

  const style=document.createElement('style');
  style.textContent=`
    .db-import-btn{margin-left:8px;background:linear-gradient(#3fa56f,#218955)!important;color:#fff!important;border:0!important;border-radius:7px!important;padding:9px 13px!important;font-weight:700!important;box-shadow:0 3px 8px rgba(15,23,42,.16)}
    .client-specialist-info{width:min(435px,100%);margin:24px auto 2px;padding:0;font-size:14px;color:#64748b;display:flex;align-items:center;justify-content:center;min-height:36px}
    .client-specialist-current{width:100%;display:grid;grid-template-columns:170px minmax(0,1fr);align-items:center;column-gap:12px;line-height:1}
    .client-specialist-history-btn{height:34px;border:1px solid #c9d5e6;border-radius:8px;background:#fff;color:#3568b8;padding:0 14px;min-width:0;font:700 13px/1 "Segoe UI",Arial,sans-serif;cursor:pointer;box-shadow:0 1px 3px rgba(15,23,42,.08);transition:background .15s,border-color .15s,box-shadow .15s;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap}
    .client-specialist-history-btn:hover{background:#f4f8ff;border-color:#9db7df;box-shadow:0 3px 8px rgba(15,23,42,.10)}
    .client-specialist-name{min-width:0;color:#334155;font-size:14px;font-weight:700;line-height:34px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .client-specialist-history-dialog{border:0;padding:0;width:min(660px,calc(100vw - 24px));max-height:min(78vh,760px);border-radius:16px;background:#fff;box-shadow:0 22px 70px rgba(15,23,42,.28);color:#17233a}
    .client-specialist-history-dialog::backdrop{background:rgba(15,23,42,.38)}
    .csh-shell{display:flex;flex-direction:column;max-height:min(78vh,760px)}
    .csh-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:20px 22px 14px;border-bottom:1px solid #e4eaf2}
    .csh-title{font-size:20px;font-weight:800;color:#122b57}
    .csh-client{margin-top:4px;font-size:13px;color:#7b8da8}
    .csh-x{width:34px;height:34px;border:0;border-radius:9px;background:#f2f5f9;color:#607089;font-size:22px;line-height:1;cursor:pointer}
    .csh-list{padding:18px 22px;overflow:auto;display:grid;gap:12px}
    .csh-period{position:relative;border:1px solid #dce5f0;border-radius:12px;padding:14px 15px 14px 18px;background:#fff}
    .csh-period.current{border-color:#a9c4ee;background:#f7faff}
    .csh-period:before{content:"";position:absolute;left:-1px;top:12px;bottom:12px;width:4px;border-radius:4px;background:#cbd8e8}
    .csh-period.current:before{background:#3f7ee8}
    .csh-name-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .csh-name{font-size:15px;font-weight:800;color:#173765}
    .csh-badge{border-radius:999px;background:#e3efff;color:#2464c4;padding:3px 8px;font-size:11px;font-weight:800}
    .csh-meta{margin-top:7px;font-size:12px;color:#70829d}
    .csh-requests-title{margin-top:10px;font-size:12px;font-weight:800;color:#40536f;text-transform:uppercase;letter-spacing:.03em}
    .csh-requests{margin:7px 0 0;padding-left:18px;display:grid;gap:5px;color:#243b5e;font-size:13px}
    .csh-empty{margin-top:7px;color:#93a0b2;font-size:13px}
    .csh-foot{display:flex;justify-content:flex-end;padding:12px 22px 18px;border-top:1px solid #eef2f6}
    .csh-close{border:0;border-radius:9px;background:#2f6fde;color:#fff;padding:9px 18px;font-weight:800;cursor:pointer}
    @media(max-width:600px){.client-specialist-info{width:100%;margin-top:18px;padding:0 6px}.client-specialist-current{grid-template-columns:minmax(145px,170px) minmax(0,1fr);column-gap:8px}.csh-head,.csh-list,.csh-foot{padding-left:14px;padding-right:14px}}
  `;
  document.head.appendChild(style);

  function timestamp(value){
    const n=Date.parse(value||'');
    return Number.isFinite(n)?n:null;
  }

  function earliestClientActivity(c){
    const values=[];
    (c?.requests||[]).forEach(r=>{
      const n=timestamp(r?.createdAt);
      if(n!==null)values.push(n);
    });
    (c?.sessions||[]).forEach(row=>{
      const n=timestamp(row?.createdAt||row?.date);
      if(n!==null)values.push(n);
    });
    return values.length?new Date(Math.min(...values)).toISOString():'';
  }

  function ensureSpecialistMeta(c,name){
    if(!c.specialistMeta || typeof c.specialistMeta!=='object') c.specialistMeta={};
    if(!Array.isArray(c.specialistMeta.transferHistory)) c.specialistMeta.transferHistory=[];
    if(!c.specialistMeta.originalSpecialist && name) c.specialistMeta.originalSpecialist=name;
    if(!c.specialistMeta.currentSpecialist && name) c.specialistMeta.currentSpecialist=name;
    if(!c.specialistMeta.firstAssignedAt && name){
      c.specialistMeta.firstAssignedAt=earliestClientActivity(c)||new Date().toISOString();
    }
    return c.specialistMeta;
  }

  function requestRef(r){
    return {id:String(r?.id||''),title:String(r?.title||'Без названия')};
  }

  function requestsForPeriod(c,start,end){
    const startMs=timestamp(start);
    const endMs=timestamp(end);
    const currentId=String(c?.currentRequestId||'');
    return (c?.requests||[]).filter(r=>{
      const created=timestamp(r?.createdAt);
      const completed=timestamp(r?.completedAt);
      if(created!==null){
        const left=startMs===null||completed===null||completed>=startMs;
        const right=endMs===null||created<=endMs;
        return left&&right;
      }
      return endMs===null&&currentId&&String(r?.id||'')===currentId;
    }).map(requestRef);
  }

  function previousPeriodStart(meta,previous){
    const rows=(meta?.transferHistory||[]).filter(x=>x&&x.at).slice().sort((a,b)=>String(a.at).localeCompare(String(b.at)));
    const last=rows.filter(x=>String(x.to||'')===String(previous||'')).slice(-1)[0];
    return last?.at||meta?.firstAssignedAt||'';
  }

  function buildSpecialistPeriods(c){
    const meta=c?.specialistMeta&&typeof c.specialistMeta==='object'?c.specialistMeta:{};
    const transfers=(Array.isArray(meta.transferHistory)?meta.transferHistory:[])
      .filter(x=>x&&(x.from||x.to))
      .slice()
      .sort((a,b)=>String(a.at||'').localeCompare(String(b.at||'')));
    const fallbackCurrent=meta.currentSpecialist||specialistName()||'';
    const periods=[];
    let activeName=meta.originalSpecialist||transfers[0]?.from||fallbackCurrent;
    let startedAt=meta.firstAssignedAt||earliestClientActivity(c)||'';

    for(const transfer of transfers){
      const from=transfer.from||activeName;
      if(from){
        const saved=Array.isArray(transfer.requests)
          ?transfer.requests.map(x=>({id:String(x?.id||''),title:String(x?.title||'Без названия')}))
          :[];
        periods.push({
          specialist:from,
          startedAt,
          endedAt:transfer.at||'',
          requests:saved.length?saved:requestsForPeriod(c,startedAt,transfer.at||''),
          current:false
        });
      }
      activeName=transfer.to||activeName;
      startedAt=transfer.at||startedAt;
    }

    const current=fallbackCurrent||activeName;
    if(current){
      periods.push({
        specialist:current,
        startedAt,
        endedAt:'',
        requests:requestsForPeriod(c,startedAt,''),
        current:true
      });
    }

    const compact=[];
    for(const period of periods){
      const prev=compact[compact.length-1];
      if(prev&&prev.specialist===period.specialist&&prev.endedAt===period.startedAt){
        prev.endedAt=period.endedAt;
        prev.current=period.current;
        const seen=new Set(prev.requests.map(x=>x.id||x.title));
        for(const req of period.requests){
          if(!seen.has(req.id||req.title)){prev.requests.push(req);seen.add(req.id||req.title);}
        }
      }else compact.push(period);
    }
    return compact;
  }

  function locale(){
    return ({ru:'ru-RU',en:'en-GB',fr:'fr-FR',de:'de-DE',it:'it-IT'})[lang()]||'ru-RU';
  }

  function formatDate(value){
    const n=timestamp(value);
    if(n===null)return '';
    return new Intl.DateTimeFormat(locale(),{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(n));
  }

  function periodLabel(row){
    const start=formatDate(row.startedAt)||t('unknownStart');
    const end=row.endedAt?(formatDate(row.endedAt)||row.endedAt):t('present');
    return start+' — '+end;
  }

  function openAccountSettings(){
    const wrap=document.querySelector('.settings-wrap');
    if(!wrap?.classList.contains('open')) document.querySelector('#settingsMenuBtn')?.click();
    const content=document.querySelector('.settings-account-content');
    if(content && !content.classList.contains('open')) document.querySelector('.settings-accounts-btn')?.click();
    setTimeout(()=>document.querySelector('.settings-account-content .account-input')?.focus(),80);
  }

  async function requireSpecialist(){
    const name=specialistName();
    if(name) return name;
    if(window.AppDialog?.alert) await AppDialog.alert(t('needName'),t('needTitle'));
    else alert(t('needName'));
    openAccountSettings();
    return '';
  }

  async function exportClient(c){
    const name=await requireSpecialist();
    if(!name) return;
    const copy=clone(c);
    const meta=ensureSpecialistMeta(copy,name);
    meta.currentSpecialist=name;
    if(!meta.originalSpecialist) meta.originalSpecialist=name;
    const pkg={format:TRANSFER_FORMAT,version:1,exportedAt:new Date().toISOString(),exportedBy:name,client:copy};
    const blob=new Blob([JSON.stringify(pkg,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`Diagnostika_${safeFileName(copy.name)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    const live=clientsApi()?.findById?.(c.id)||null;
    if(live){
      const liveMeta=clone(meta);
      liveMeta.currentSpecialist=name;
      clientsApi()?.update?.(live.id,{specialistMeta:liveMeta},{source:'client-transfer-export',render:false});
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
      if(window.AppDialog?.alert) await AppDialog.alert(t('badFile'),t('badTitle')); else alert(t('badFile'));
      return;
    }
    const current=await requireSpecialist();
    if(!current) return;
    let incoming=clone(pkg.client);
    const meta=ensureSpecialistMeta(incoming,pkg.exportedBy||'');
    const previous=meta.currentSpecialist||pkg.exportedBy||meta.originalSpecialist||'';
    if(!meta.originalSpecialist) meta.originalSpecialist=previous||current;
    const transferredAt=new Date().toISOString();
    if(previous && previous!==current){
      const start=previousPeriodStart(meta,previous);
      meta.transferHistory.push({
        from:previous,
        to:current,
        at:transferredAt,
        requests:requestsForPeriod(incoming,start,transferredAt)
      });
    }
    meta.currentSpecialist=current;
    meta.lastImportedAt=transferredAt;
    meta.lastImportedFrom=previous||'';

    const api=clientsApi();
    if(!api?.create||!api?.update||!api?.select){
      throw new Error('ClientService недоступен.');
    }

    const existing=api.findById?.(incoming.id)||null;
    if(existing){
      const update=window.AppDialog?.confirm
        ? await AppDialog.confirm(t('duplicateText'),t('duplicateTitle'),t('update'),t('copy'))
        : confirm(t('duplicateText'));
      if(update){
        const updated=api.update(existing.id,incoming,{source:'client-transfer-import-update',render:false});
        if(!updated) throw new Error('Не удалось обновить импортируемого клиента.');
      }else{
        incoming=makeCopyIds(incoming);
        const created=api.create(incoming,{source:'client-transfer-import-copy',select:false,render:false});
        if(!created) throw new Error('Не удалось создать копию импортируемого клиента.');
      }
    }else{
      const created=api.create(incoming,{source:'client-transfer-import',select:false,render:false});
      if(!created) throw new Error('Не удалось импортировать клиента.');
    }

    if(!api.select(incoming.id,{source:'client-transfer-import-select'})){
      throw new Error('Не удалось выбрать импортированного клиента.');
    }
    window.DiagnostikaClientUIContext?.refreshDatabase?.();
    updateClientSpecialistInfo();
    const message=`${incoming.name||''}\n${t('from')}: ${previous||'—'}\n${t('current')}: ${current}`;
    if(window.AppDialog?.alert) await AppDialog.alert(message,t('imported')); else alert(message);
  }

  function setupImport(){
    const dlg=document.querySelector('#clientDialog');
    const add=document.querySelector('#dialogAddClientBtn');
    if(!dlg || !add || document.querySelector('#clientImportBtn')) return Boolean(document.querySelector('#clientImportBtn'));
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
    input.dataset.clientTransferImport='1';
    document.body.appendChild(input);
    btn.onclick=()=>input.click();
    input.onchange=async()=>{
      const file=input.files?.[0];
      input.value='';
      if(!file) return;
      try{await importPackage(JSON.parse(await file.text()));}
      catch(e){console.error(e);if(window.AppDialog?.alert) await AppDialog.alert(t('badFile'),t('badTitle'));else alert(t('badFile'));}
    };
    return true;
  }

  function refreshLabels(){
    const imp=document.querySelector('#clientImportBtn');
    if(imp) imp.textContent=t('import');
    document.querySelectorAll('.db-export-btn').forEach(b=>{
      b.textContent='⇩';
      b.title=t('export');
      b.setAttribute('aria-label',t('export'));
    });
    updateClientSpecialistInfo();
  }

  function decorateDatabaseRows(){
    const rows=document.querySelectorAll('#clientDatabaseList tbody tr');
    const clients=clientsApi()?.list?.()||[];
    rows.forEach((tr,index)=>{
      const c=clients[index];
      const group=tr.querySelector('.db-action-group');
      if(!c||!group) return;

      let exportBtn=group.querySelector('.db-export-btn');
      if(!exportBtn){
        exportBtn=document.createElement('button');
        exportBtn.type='button';
        exportBtn.className='db-export-btn db-icon-action-btn';
        const deleteBtn=group.querySelector('.db-delete-btn');
        if(deleteBtn) group.insertBefore(exportBtn,deleteBtn); else group.appendChild(exportBtn);
      }
      exportBtn.textContent='⇩';
      exportBtn.title=t('export');
      exportBtn.setAttribute('aria-label',t('export'));
      exportBtn.onclick=e=>{e.stopPropagation();exportClient(c);};

      const deleteBtn=group.querySelector('.db-delete-btn');
      if(deleteBtn){
        deleteBtn.classList.add('db-delete-btn-compact','db-icon-action-btn');
        deleteBtn.textContent='×';
        deleteBtn.title='Удалить клиента';
        deleteBtn.setAttribute('aria-label','Удалить клиента');
      }
    });
    setupImport();
    refreshLabels();
    return true;
  }

  let specialistHistoryDialog=null;

  function ensureSpecialistHistoryDialog(){
    if(specialistHistoryDialog?.isConnected)return specialistHistoryDialog;
    const dlg=document.createElement('dialog');
    dlg.id='clientSpecialistHistoryDialog';
    dlg.className='client-specialist-history-dialog';
    dlg.innerHTML=`
      <div class="csh-shell">
        <div class="csh-head">
          <div><div class="csh-title"></div><div class="csh-client"></div></div>
          <button type="button" class="csh-x" aria-label="Закрыть">×</button>
        </div>
        <div class="csh-list"></div>
        <div class="csh-foot"><button type="button" class="csh-close"></button></div>
      </div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('.csh-x').onclick=()=>dlg.close();
    dlg.querySelector('.csh-close').onclick=()=>dlg.close();
    dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
    specialistHistoryDialog=dlg;
    return dlg;
  }

  function renderSpecialistHistory(c){
    const dlg=ensureSpecialistHistoryDialog();
    dlg.querySelector('.csh-title').textContent=t('historyTitle');
    dlg.querySelector('.csh-client').textContent=c?.name||'';
    dlg.querySelector('.csh-close').textContent=t('close');
    const list=dlg.querySelector('.csh-list');
    list.innerHTML='';
    buildSpecialistPeriods(c).forEach(row=>{
      const card=document.createElement('section');
      card.className='csh-period'+(row.current?' current':'');
      const head=document.createElement('div');
      head.className='csh-name-row';
      const name=document.createElement('div');
      name.className='csh-name';
      name.textContent=row.specialist||'—';
      head.appendChild(name);
      if(row.current){
        const badge=document.createElement('span');
        badge.className='csh-badge';
        badge.textContent=t('currentBadge');
        head.appendChild(badge);
      }
      const meta=document.createElement('div');
      meta.className='csh-meta';
      meta.textContent=t('period')+': '+periodLabel(row);
      const reqTitle=document.createElement('div');
      reqTitle.className='csh-requests-title';
      reqTitle.textContent=t('requests');
      card.append(head,meta,reqTitle);
      if(row.requests.length){
        const ul=document.createElement('ul');
        ul.className='csh-requests';
        row.requests.forEach(req=>{
          const li=document.createElement('li');
          li.textContent=req.title||'Без названия';
          ul.appendChild(li);
        });
        card.appendChild(ul);
      }else{
        const empty=document.createElement('div');
        empty.className='csh-empty';
        empty.textContent=t('noRequests');
        card.appendChild(empty);
      }
      list.appendChild(card);
    });
    return dlg;
  }

  function openSpecialistHistory(){
    const c=clientsApi()?.current?.()||null;
    if(!c)return;
    const dlg=renderSpecialistHistory(c);
    if(!dlg.open)dlg.showModal();
  }

  function updateClientSpecialistInfo(){
    const home=document.querySelector('.hd-main-inner');
    if(!home) return;
    let info=home.querySelector('#clientSpecialistInfo');
    if(!info){
      info=document.createElement('div');
      info.id='clientSpecialistInfo';
      info.className='client-specialist-info';
      const anchor=document.querySelector('#hdHeroSub');
      if(anchor) anchor.insertAdjacentElement('afterend',info); else home.prepend(info);
    }
    const c=clientsApi()?.current?.()||null;
    const current=c?.specialistMeta?.currentSpecialist||specialistName()||'';
    if(!c || !current){
      info.textContent='';
      info.style.display='none';
      return;
    }
    info.style.display='flex';
    info.innerHTML='';
    const row=document.createElement('div');
    row.className='client-specialist-current';
    const button=document.createElement('button');
    button.type='button';
    button.className='client-specialist-history-btn';
    button.textContent=t('current');
    button.title=t('historyTitle');
    button.onclick=openSpecialistHistory;
    const name=document.createElement('span');
    name.className='client-specialist-name';
    name.textContent=current;
    row.append(button,name);
    info.appendChild(row);
    info.title=t('historyTitle');
  }

  let clientEventsBound=false;
  function bindClientEvents(){
    if(clientEventsBound) return true;
    const events=window.DiagnostikaPlatform?.events;
    if(!events?.on) return false;
    ['client:selected','client:created','client:updated','client:restored'].forEach(name=>{
      events.on(name,()=>setTimeout(updateClientSpecialistInfo,0));
    });
    clientEventsBound=true;
    return true;
  }

  function initialize(){
    setupImport();
    decorateDatabaseRows();
    bindClientEvents();
    updateClientSpecialistInfo();
  }
  initialize();
  document.addEventListener('diagnostika:client-export-request',e=>{
    const id=e?.detail?.clientId;
    if(!id)return;
    const client=clientsApi()?.findById?.(id)||clientsApi()?.list?.().find?.(x=>String(x?.id)===String(id))||null;
    if(client)exportClient(client);
  });
  window.addEventListener('diagnostika:dashboard-loaded',updateClientSpecialistInfo);
  window.addEventListener('diagnostika:client-database-rendered',decorateDatabaseRows);
  window.addEventListener('diagnostika:platform-core-ready',()=>{bindClientEvents();updateClientSpecialistInfo();},{once:true});
  [100,300,800,1600].forEach(ms=>setTimeout(initialize,ms));

  window.addEventListener('diagnostika-language-changed',()=>{
    setTimeout(()=>{
      refreshLabels();
      if(specialistHistoryDialog?.open){
        const c=clientsApi()?.current?.()||null;
        if(c)renderSpecialistHistory(c);
      }
    },0);
  });
  window.addEventListener('diagnostika-specialist-profile-change',()=>setTimeout(updateClientSpecialistInfo,0));

  window.DiagnostikaClientTransfer=Object.freeze({
    exportClient,
    openSpecialistHistory,
    buildSpecialistPeriods:client=>clone(buildSpecialistPeriods(client||clientsApi()?.current?.()||null))
  });
})();
