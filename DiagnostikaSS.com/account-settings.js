'use strict';

(() => {
  if (window.__diagnostikaAccountSettingsReady) return;
  window.__diagnostikaAccountSettingsReady = true;

  const NAME_KEY = 'diagnostika-specialist-name';
  const AVATAR_KEY = 'diagnostika-specialist-avatar';

  const LABELS = {
    ru:{accounts:'Учетные записи',name:'Имя специалиста',hint:'Данные карточки сохраняются вместе с базой.',save:'Сохранить карточку',saved:'Сохранено',empty:'Имя специалиста',profile:'Карточка специалиста',title:'Специализация / должность',titlePlaceholder:'Например: гипнотерапевт, психолог-консультант',experience:'Опыт работы',experiencePlaceholder:'Например: 8 лет',areas:'Направления работы',areasPlaceholder:'Отношения, деньги, карьера, самореализация',about:'О специалисте',aboutPlaceholder:'Коротко о подходе, опыте и формате работы',reviews:'Отзывы',reviewAuthor:'Автор / подпись',reviewText:'Текст отзыва',reviewAdd:'Добавить отзыв',reviewEmpty:'Отзывов пока нет',reviewDelete:'Удалить',photo:'Фотография',photoEdit:'Изменить миниатюру',photoReplace:'Заменить фото',photoDelete:'Удалить фото',avatarTitle:'Редактор фотографии',avatarHint:'Перетаскивай фотографию, меняй масштаб и положение внутри круга.',zoom:'Масштаб',cancel:'Отмена',avatarSave:'Сохранить миниатюру'},
    en:{accounts:'Accounts',name:'Specialist name',hint:'Profile data is stored with the database.',save:'Save profile',saved:'Saved',empty:'Specialist name',profile:'Specialist profile',title:'Role / specialty',titlePlaceholder:'For example: therapist, counselor',experience:'Experience',experiencePlaceholder:'For example: 8 years',areas:'Areas of work',areasPlaceholder:'Relationships, money, career, self-realization',about:'About specialist',aboutPlaceholder:'Short description of approach and experience',reviews:'Reviews',reviewAuthor:'Author / signature',reviewText:'Review text',reviewAdd:'Add review',reviewEmpty:'No reviews yet',reviewDelete:'Delete',photo:'Photo',photoEdit:'Edit thumbnail',photoReplace:'Replace photo',photoDelete:'Delete photo',avatarTitle:'Photo editor',avatarHint:'Drag the photo, change zoom and position inside the circle.',zoom:'Zoom',cancel:'Cancel',avatarSave:'Save thumbnail'},
    fr:{accounts:'Comptes',name:'Nom du spécialiste',hint:'Indiquez votre nom. Il sera enregistré lors du transfert des clients.',save:'Enregistrer',saved:'Enregistré',empty:'Nom du spécialiste',avatarTitle:'Réglage de l’avatar',avatarHint:'Faites glisser la photo dans le cercle pour la positionner.',cancel:'Annuler',avatarSave:'Enregistrer'},
    de:{accounts:'Konten',name:'Name des Spezialisten',hint:'Gib deinen Namen an. Er wird bei der Übertragung von Klienten gespeichert.',save:'Speichern',saved:'Gespeichert',empty:'Name des Spezialisten',avatarTitle:'Avatar einstellen',avatarHint:'Ziehe das Foto im Kreis an die gewünschte Position.',cancel:'Abbrechen',avatarSave:'Speichern'},
    it:{accounts:'Account',name:'Nome dello specialista',hint:'Inserisci il tuo nome. Verrà registrato durante il trasferimento dei clienti.',save:'Salva',saved:'Salvato',empty:'Nome dello specialista',avatarTitle:'Imposta avatar',avatarHint:'Trascina la foto nel cerchio per posizionarla.',cancel:'Annulla',avatarSave:'Salva'}
  };


  // Text used by the settings created dynamically (not covered by the global i18n observer).
  const ACCOUNT_COPY = {
    ru:{
      surname:'Фамилия специалиста',city:'Город специалиста',currency:'Валюта страны',cityPlaceholder:'Начни вводить город…',
      clearCity:'Очистить город и страну',cityChoose:'Выбери город из списка — определяется страна и источник курса валют',
      currencyHint:'При нескольких официальных валютах можно выбрать нужную',currencyDefault:'Определяется по стране',
      chooseCity:'Выберите город',firstCity:'Сначала выбери город',detectCurrency:'Определяю официальную валюту страны…',
      manyCurrencies:'У страны несколько валют — выбери подходящую',mainCurrency:'Основная валюта: ',
      country:'Страна: ',rateSource:' · источник курса определяется страной',currencyUnavailable:'Валюта страны не определена',
      chooseExactCity:'Выбери точный город из результатов поиска',cityUnavailable:'Список городов временно недоступен',
      cityCleared:'Город и страна очищены. Выбери новый город и сохрани карточку.',
      selectValidCity:'Выбери город из выпадающего списка. Введённое название пока не привязано к стране и валюте.',
      noCity:'Не выбран город',addReviewFirst:'Сначала нажми «Добавить отзыв», чтобы сохранить набранный отзыв.',
      unsavedReview:'Несохранённый отзыв',unsavedChanges:'Есть несохранённые изменения в карточке специалиста. Сохранить перед выходом?',avatar:'Фотография специалиста'
    },
    en:{
      surname:'Specialist surname',city:'Specialist city',currency:'Country currency',cityPlaceholder:'Start typing a city…',
      clearCity:'Clear city and country',cityChoose:'Choose a city from the list to identify the country and exchange-rate source',
      currencyHint:'If a country has several official currencies, choose the appropriate one',currencyDefault:'Determined by country',
      chooseCity:'Choose a city',firstCity:'Choose a city first',detectCurrency:'Detecting the official currency…',
      manyCurrencies:'This country has multiple currencies — choose one',mainCurrency:'Main currency: ',
      country:'Country: ',rateSource:' · exchange-rate source follows the country',currencyUnavailable:'Country currency could not be identified',
      chooseExactCity:'Choose the exact city from the search results',cityUnavailable:'City search is temporarily unavailable',
      cityCleared:'City and country cleared. Select a new city and save the profile.',
      selectValidCity:'Choose a city from the suggestions. The typed name is not linked to a country or currency.',
      noCity:'City not selected',addReviewFirst:'Click “Add review” before saving the profile.',
      unsavedReview:'Unsaved review',unsavedChanges:'There are unsaved changes in the specialist profile. Save before closing?',avatar:'Specialist photo'
    },
    fr:{
      surname:'Nom de famille du spécialiste',city:'Ville du spécialiste',currency:'Devise du pays',cityPlaceholder:'Commencez à saisir une ville…',
      clearCity:'Effacer la ville et le pays',cityChoose:'Choisissez une ville pour identifier le pays et la source du taux de change',
      currencyHint:'Si le pays possède plusieurs devises officielles, sélectionnez celle qui convient',currencyDefault:'Déterminée par le pays',
      chooseCity:'Choisir une ville',firstCity:'Choisissez d’abord une ville',detectCurrency:'Recherche de la devise officielle…',
      manyCurrencies:'Plusieurs devises sont utilisées — sélectionnez-en une',mainCurrency:'Devise principale : ',
      country:'Pays : ',rateSource:' · source du taux selon le pays',currencyUnavailable:'Devise du pays introuvable',
      chooseExactCity:'Choisissez la ville exacte dans les résultats',cityUnavailable:'La recherche des villes est momentanément indisponible',
      cityCleared:'Ville et pays effacés. Choisissez une nouvelle ville et enregistrez la fiche.',
      selectValidCity:'Choisissez une ville dans la liste. Le texte saisi n’est pas associé à un pays ou à une devise.',
      noCity:'Ville non sélectionnée',addReviewFirst:'Cliquez sur « Ajouter un avis » avant d’enregistrer.',
      unsavedReview:'Avis non enregistré',unsavedChanges:'Des modifications ne sont pas enregistrées. Les enregistrer avant de fermer ?',avatar:'Photo du spécialiste'
    },
    de:{
      surname:'Nachname der Fachkraft',city:'Stadt der Fachkraft',currency:'Landeswährung',cityPlaceholder:'Stadt eingeben…',
      clearCity:'Stadt und Land löschen',cityChoose:'Stadt aus der Liste wählen, um Land und Wechselkursquelle zu bestimmen',
      currencyHint:'Bei mehreren offiziellen Währungen die passende auswählen',currencyDefault:'Durch das Land bestimmt',
      chooseCity:'Stadt wählen',firstCity:'Bitte zuerst eine Stadt wählen',detectCurrency:'Landeswährung wird ermittelt…',
      manyCurrencies:'Mehrere Landeswährungen verfügbar — bitte auswählen',mainCurrency:'Hauptwährung: ',
      country:'Land: ',rateSource:' · Wechselkursquelle richtet sich nach dem Land',currencyUnavailable:'Landeswährung konnte nicht ermittelt werden',
      chooseExactCity:'Die passende Stadt aus den Suchergebnissen auswählen',cityUnavailable:'Stadtsuche derzeit nicht verfügbar',
      cityCleared:'Stadt und Land gelöscht. Neue Stadt auswählen und Profil speichern.',
      selectValidCity:'Bitte eine Stadt aus der Liste auswählen. Der eingegebene Name ist keinem Land oder keiner Währung zugeordnet.',
      noCity:'Keine Stadt ausgewählt',addReviewFirst:'Vor dem Speichern bitte auf „Bewertung hinzufügen“ klicken.',
      unsavedReview:'Ungespeicherte Bewertung',unsavedChanges:'Es gibt ungespeicherte Änderungen im Profil. Vor dem Schließen speichern?',avatar:'Foto der Fachkraft'
    },
    it:{
      surname:'Cognome dello specialista',city:'Città dello specialista',currency:'Valuta del paese',cityPlaceholder:'Inizia a digitare una città…',
      clearCity:'Cancella città e paese',cityChoose:'Seleziona una città per identificare paese e fonte del cambio',
      currencyHint:'Se il paese ha più valute ufficiali, scegli quella desiderata',currencyDefault:'Determinata dal paese',
      chooseCity:'Seleziona una città',firstCity:'Seleziona prima una città',detectCurrency:'Ricerca della valuta ufficiale…',
      manyCurrencies:'Sono disponibili più valute — scegline una',mainCurrency:'Valuta principale: ',
      country:'Paese: ',rateSource:' · fonte del cambio in base al paese',currencyUnavailable:'Impossibile identificare la valuta',
      chooseExactCity:'Seleziona la città esatta dai risultati',cityUnavailable:'Ricerca delle città temporaneamente non disponibile',
      cityCleared:'Città e paese cancellati. Seleziona una nuova città e salva la scheda.',
      selectValidCity:'Seleziona una città dall’elenco. Il testo inserito non è associato a paese o valuta.',
      noCity:'Città non selezionata',addReviewFirst:'Premi “Aggiungi recensione” prima di salvare.',
      unsavedReview:'Recensione non salvata',unsavedChanges:'Ci sono modifiche non salvate nel profilo. Salvarle prima di chiudere?',avatar:'Foto dello specialista'
    }
  };
  const PROFILE_TRANSLATIONS = {
    fr:{profile:'Fiche du spécialiste',title:'Fonction / spécialité',experience:'Expérience professionnelle',areas:'Domaines d’activité',about:'À propos du spécialiste',reviews:'Avis',reviewAuthor:'Auteur / signature',reviewText:'Texte de l’avis',reviewAdd:'Ajouter un avis',reviewEmpty:'Aucun avis',reviewDelete:'Supprimer',photo:'Photographie',photoEdit:'Modifier la miniature',photoReplace:'Remplacer la photo',photoDelete:'Supprimer la photo',titlePlaceholder:'Par ex. hypnothérapeute',experiencePlaceholder:'Par ex. 8 ans',areasPlaceholder:'Relations, carrière, confiance',aboutPlaceholder:'Description de l’approche et de l’expérience'},
    de:{profile:'Profil der Fachkraft',title:'Beruf / Spezialisierung',experience:'Berufserfahrung',areas:'Arbeitsbereiche',about:'Über die Fachkraft',reviews:'Bewertungen',reviewAuthor:'Name / Unterschrift',reviewText:'Bewertungstext',reviewAdd:'Bewertung hinzufügen',reviewEmpty:'Noch keine Bewertungen',reviewDelete:'Löschen',photo:'Foto',photoEdit:'Vorschau bearbeiten',photoReplace:'Foto ersetzen',photoDelete:'Foto löschen',titlePlaceholder:'Z. B. Hypnotherapeut',experiencePlaceholder:'Z. B. 8 Jahre',areasPlaceholder:'Beziehungen, Karriere, Selbstvertrauen',aboutPlaceholder:'Ansatz und Erfahrung kurz beschreiben'},
    it:{profile:'Profilo dello specialista',title:'Ruolo / specializzazione',experience:'Esperienza professionale',areas:'Ambiti di lavoro',about:'Informazioni sullo specialista',reviews:'Recensioni',reviewAuthor:'Autore / firma',reviewText:'Testo della recensione',reviewAdd:'Aggiungi recensione',reviewEmpty:'Nessuna recensione',reviewDelete:'Elimina',photo:'Fotografia',photoEdit:'Modifica miniatura',photoReplace:'Sostituisci foto',photoDelete:'Elimina foto',titlePlaceholder:'Ad es. ipnoterapeuta',experiencePlaceholder:'Ad es. 8 anni',areasPlaceholder:'Relazioni, carriera, autostima',aboutPlaceholder:'Descrizione di approccio ed esperienza'}
  };

  const panel = document.getElementById('settingsPanel');
  const accountsBtn = panel?.querySelector('.settings-accounts-btn');
  if (!panel || !accountsBtn) return;

  function lang(){
    const l = window.DiagnostikaI18n?.language || localStorage.getItem('diagnostika-ui-language') || 'ru';
    return LABELS[l] ? l : 'ru';
  }
  function t(){ return {...LABELS.en,...(LABELS[lang()]||LABELS.ru),...(PROFILE_TRANSLATIONS[lang()]||{})}; }
  function copy(){return ACCOUNT_COPY[lang()]||ACCOUNT_COPY.ru;}
  const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));}catch(_){return value&&typeof value==='object'?{...value}:value;}};
  const uid=()=>crypto.randomUUID?crypto.randomUUID():'review_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
  function appState(){try{return typeof state!=='undefined'&&state&&typeof state==='object'?state:null;}catch(_){return null;}}
  function normalizeAreas(value){if(Array.isArray(value))return value.map(x=>String(x||'').trim()).filter(Boolean);return String(value||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);}
  function normalizeReviews(value){return(Array.isArray(value)?value:[]).map(item=>({id:String(item?.id||uid()),author:String(item?.author||'').trim(),text:String(item?.text||'').trim(),createdAt:Number(item?.createdAt)||Date.now()})).filter(item=>item.text);}
  const hostedProfile=location.hostname==='zabvenye.com';
  let syncOwner='',syncRevision=0,syncReady=!hostedProfile,syncSnapshot=null,syncPending=null,syncBusy=false,syncPulling=false,syncConflict=false,syncMessage='loading',legacyCandidate=null;
  function normalizeProfile(value={}){
    return{
      name:String(value?.name||'').trim(),surname:String(value?.surname||'').trim(),title:String(value?.title||'').trim(),experience:String(value?.experience||'').trim(),
      city:String(value?.city||'').trim(),region:String(value?.region||'').trim(),country:String(value?.country||'').trim(),countryCode:String(value?.countryCode||'').toUpperCase().trim(),currencyCode:String(value?.currencyCode||'').toUpperCase().trim(),
      areas:normalizeAreas(value?.areas),about:String(value?.about||'').trim(),reviews:normalizeReviews(value?.reviews),
      avatar:String(value?.avatar||''),avatarSource:String(value?.avatarSource||''),
      avatarCrop:{x:clamp(Number(value?.avatarCrop?.x)||50,0,100),y:clamp(Number(value?.avatarCrop?.y)||50,0,100),zoom:clamp(Number(value?.avatarCrop?.zoom)||1,1,3)},
      updatedAt:Number(value?.updatedAt)||Date.now(),accountOwner:String(value?.accountOwner||''),syncRevision:Number(value?.syncRevision)||0,syncPending:value?.syncPending===true
    };
  }
  function ensureProfile(){
    const st=appState();
    if(st){
      const had=st.specialistProfile&&typeof st.specialistProfile==='object';
      const profile=normalizeProfile(had?st.specialistProfile:{});
      let changed=!had;
      const legacyName=String(localStorage.getItem(NAME_KEY)||'').trim(),legacyAvatar=String(localStorage.getItem(AVATAR_KEY)||'');
      if(!profile.accountOwner&&!profile.name&&legacyName){profile.name=legacyName;changed=true;}
      if(!profile.accountOwner&&!profile.avatar&&legacyAvatar){profile.avatar=legacyAvatar;changed=true;}
      if(!profile.avatarSource&&profile.avatar){profile.avatarSource=profile.avatar;changed=true;}
      st.specialistProfile=profile;
      if(changed&&typeof save==='function'){try{save({source:'specialist-profile-migration'});}catch(_){}}
      return profile;
    }
    return normalizeProfile({name:localStorage.getItem(NAME_KEY)||'',avatar:localStorage.getItem(AVATAR_KEY)||''});
  }
  function getProfile(){if(hostedProfile)return normalizeProfile(syncSnapshot||{});return normalizeProfile(ensureProfile());}
  function getName(){return getProfile().name;}
  function getAvatar(){return getProfile().avatar;}
  function persistLocalProfile(next,source='specialist-profile-save'){
    const profile=normalizeProfile(next),st=appState();
    if(st){
      const before=clone(st.specialistProfile);st.specialistProfile=profile;
      let ok=true;if(typeof save==='function'){try{ok=save({source})!==false;}catch(_){ok=false;}}
      if(!ok){st.specialistProfile=before;return false;}
    }
    try{localStorage.setItem(NAME_KEY,profile.name);if(profile.avatar)localStorage.setItem(AVATAR_KEY,profile.avatar);else localStorage.removeItem(AVATAR_KEY);}catch(_){}
    if(hostedProfile)syncSnapshot=profile;
    window.dispatchEvent(new CustomEvent('diagnostika-specialist-profile-change',{detail:clone(profile)}));
    return true;
  }
  function persistProfile(next,source='specialist-profile-save'){
    if(hostedProfile&&!syncReady){setSyncMessage('loading');return false;}
    const profile=normalizeProfile({...next,updatedAt:Date.now(),...(hostedProfile?{accountOwner:syncOwner,syncRevision,syncPending:true}:{})});
    if(!persistLocalProfile(profile,source))return false;
    if(hostedProfile){syncPending=profile;syncConflict=false;setSyncMessage('pending');void pushWorkspaceProfile();}
    return true;
  }
  const syncTexts={
    ru:{identity:"Данные аккаунта загружены. Сохраните карточку для синхронизации.",loading:'Загрузка карточки из аккаунта…',pending:'Сохранено на устройстве. Синхронизация…',saved:'Карточка сохранена в аккаунте',offline:'Нет синхронизации. Изменения сохранены только на устройстве. Повторим при подключении.',conflict:'Карточка изменена на другом устройстве. Проверьте данные. Повторное сохранение заменит серверную карточку.',invalid:'Не удалось синхронизировать карточку. Проверьте длину полей и сохраните снова.',import:'Перенести локальную карточку в этот аккаунт',confirm:'Перенести карточку, ранее сохранённую на этом устройстве, в текущий аккаунт?'},
    en:{identity:"Account details loaded. Save the profile to sync it.",loading:'Loading profile from account…',pending:'Saved on device. Syncing…',saved:'Profile saved to account',offline:'Not synced. Changes are saved on this device only. Retrying when connected.',conflict:'Profile changed on another device. Review the details. Saving again replaces the server profile.',invalid:'Profile could not sync. Check field lengths and save again.',import:'Import local profile into this account',confirm:'Import the profile previously saved on this device into this account?'},
    fr:{identity:"Identité chargée. Enregistrez le profil pour le synchroniser.",loading:'Chargement du profil…',pending:'Enregistré sur cet appareil. Synchronisation…',saved:'Profil enregistré dans le compte',offline:'Non synchronisé. Modifications enregistrées sur cet appareil uniquement.',conflict:'Profil modifié sur un autre appareil. Vérifiez les données. Un nouvel enregistrement remplacera le profil distant.',invalid:'Synchronisation impossible. Vérifiez les champs et enregistrez à nouveau.',import:'Importer le profil local dans ce compte',confirm:'Importer dans ce compte le profil déjà enregistré sur cet appareil ?'},
    de:{identity:"Kontodaten geladen. Profil zur Synchronisierung speichern.",loading:'Profil wird geladen…',pending:'Auf dem Gerät gespeichert. Synchronisierung…',saved:'Profil im Konto gespeichert',offline:'Nicht synchronisiert. Änderungen nur auf diesem Gerät gespeichert.',conflict:'Profil auf einem anderen Gerät geändert. Daten prüfen. Erneutes Speichern ersetzt das Serverprofil.',invalid:'Synchronisierung fehlgeschlagen. Felder prüfen und erneut speichern.',import:'Lokales Profil in dieses Konto importieren',confirm:'Das auf diesem Gerät gespeicherte Profil in dieses Konto importieren?'},
    it:{identity:"Dati dell’account caricati. Salva il profilo per sincronizzarlo.",loading:'Caricamento profilo…',pending:'Salvato sul dispositivo. Sincronizzazione…',saved:'Profilo salvato nell’account',offline:'Non sincronizzato. Modifiche salvate solo su questo dispositivo.',conflict:'Profilo modificato su un altro dispositivo. Controlla i dati. Un nuovo salvataggio sostituirà il profilo remoto.',invalid:'Sincronizzazione non riuscita. Controlla i campi e salva di nuovo.',import:'Importa profilo locale in questo account',confirm:'Importare in questo account il profilo salvato su questo dispositivo?'}
  };
  const syncCopy=()=>syncTexts[lang()]||syncTexts.ru;
  function setSyncMessage(key){syncMessage=key;if(hostedProfile){for(const selector of ['.account-profile-save','.account-photo-replace','.account-photo-edit','.account-photo-delete','.settings-profile-avatar']){const control=document.querySelector(selector);if(control&&!syncReady)control.disabled=true;else if(control&&syncReady&&(selector==='.account-profile-save'||selector==='.account-photo-replace'||selector==='.settings-profile-avatar'))control.disabled=false;}}const el=document.getElementById('specialistProfileSync');if(el){el.textContent=syncCopy()[key];el.dataset.state=key;}const button=document.getElementById('specialistProfileImport');if(button){button.hidden=!legacyCandidate;button.textContent=syncCopy().import;}}
  function remoteFields(p){
    const keys=['name','surname','title','experience','city','region','country','countryCode','currencyCode','about','areas','avatar'];
    return Object.fromEntries(keys.map(k=>[k,p[k]]));
  }
  async function shrinkAvatar(data){
    if(!data)return '';
    if(data.startsWith('data:image/jpeg;base64,')&&data.length<=87000)return data;
    const img=await loadImage(data),canvas=document.createElement('canvas');
    const scale=Math.min(1,320/Math.max(img.naturalWidth,img.naturalHeight));
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    for(const q of [.8,.65,.5,.35,.2]){const value=canvas.toDataURL('image/jpeg',q);if(value.length<=87000)return value;}
    throw Error('avatar size');
  }
  async function profileRequest(body){
    const options={credentials:'same-origin',cache:'no-store'};
    if(body){options.method='POST';options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(body);}
    const r=await fetch('/account/api/workspace-profile',options);
    if(!r.ok){const err=Error('profile sync');err.status=r.status;throw err;}return r.json();
  }
  function matchesLegacy(p,identity){
    const key=v=>String(v||'').trim().toLocaleLowerCase().replace(/\s+/g,' ');
    const name=key(p.name),surname=key(p.surname),first=key(identity?.name),last=key(identity?.surname);
    return !!first&&((name===first&&(!surname||surname===last))||(!surname&&name===(first+' '+last).trim()));
  }
  function hasLegacy(p){return !!(p.name||p.surname||p.avatar||p.city||p.title||p.experience||p.about||p.areas.length);}
  function hasCustomProfile(p){return !!(p.avatar||p.city||p.title||p.experience||p.about||p.areas.length||p.region||p.currencyCode);}
  function applyRemote(data,local){
    const next=normalizeProfile({...data.identity,...(data.profile||{}),accountOwner:data.account_id,syncRevision:data.revision,syncPending:false});
    if(local&&(local.accountOwner===data.account_id||(!local.accountOwner&&matchesLegacy(local,data.identity)))){
      next.reviews=local.reviews;
      if(next.avatar&&next.avatar===local.avatar){next.avatarSource=local.avatarSource;next.avatarCrop=local.avatarCrop;}
    }
    if(next.avatar&&!next.avatarSource)next.avatarSource=next.avatar;
    // Do not overwrite local client records; replace only the specialist-profile property.
    // Do not persist the identity-only fallback: a new phone must not create a remote profile or destroy unclaimed legacy fields.
    if(!data.profile){syncSnapshot=next;window.dispatchEvent(new CustomEvent('diagnostika-specialist-profile-change',{detail:clone(next)}));}
    else if(!persistLocalProfile(next,'specialist-profile-server-hydrate'))syncSnapshot=next;
    render({preserveDraft:true});
  }
  async function pullWorkspaceProfile(){
    if(!hostedProfile||syncPulling||syncBusy||syncPending||syncConflict)return;
    if(syncReady&&(hasChanges()||dlg.open))return;
    syncPulling=true;
    try{
      const data=await profileRequest();
      if(!data.account_id||!Number.isInteger(data.revision))throw Error('invalid account');
      const local=syncSnapshot||normalizeProfile(ensureProfile());
      if(syncOwner&&syncOwner!==data.account_id){location.reload();return;}
      syncOwner=data.account_id;syncRevision=data.revision;syncReady=true;
      const owned=local.accountOwner===syncOwner;
      // Recover a local save interrupted by closing the browser, but never overwrite a newer remote version.
      if(owned&&local.syncPending){
        syncSnapshot=local;syncPending=local;render({preserveDraft:true});
        if(local.syncRevision!==data.revision){syncConflict=true;setSyncMessage('conflict');}
        else{setSyncMessage('pending');}
      }else if(!data.profile&&hasCustomProfile(local)&&(owned||(!local.accountOwner&&matchesLegacy(local,data.identity)))){
        const combined=matchesLegacy(local,data.identity)&&!local.surname&&local.name.trim().toLocaleLowerCase()===((data.identity.name+' '+data.identity.surname).trim().toLocaleLowerCase());
        const merged=normalizeProfile({...local,name:combined?data.identity.name:(local.name||data.identity.name),surname:local.surname||data.identity.surname,accountOwner:syncOwner,syncRevision:0,syncPending:true});
        if(persistLocalProfile(merged,'specialist-profile-first-sync')){syncPending=merged;render({preserveDraft:true});setSyncMessage('pending');}
        else{applyRemote(data,local);setSyncMessage('offline');}
      }else{
        // An unrecognised legacy card may belong to another account; require explicit import.
        if(!data.profile&&!local.accountOwner&&hasLegacy(local)&&!matchesLegacy(local,data.identity))legacyCandidate=clone(local);
        if(!syncSnapshot||syncSnapshot.syncRevision!==data.revision||syncSnapshot.accountOwner!==syncOwner||(!data.profile&&(syncSnapshot.name!==data.identity.name||syncSnapshot.surname!==data.identity.surname)))applyRemote(data,local);
        setSyncMessage(data.profile?'saved':'identity');
      }
    }catch(e){if(e.status===401){location.replace('/account');return;}setSyncMessage('offline');}
    finally{syncPulling=false;if(syncPending&&!syncConflict)void pushWorkspaceProfile();}
  }
  async function pushWorkspaceProfile(){
    if(!hostedProfile||!syncReady||syncBusy||syncPulling||!syncPending||syncConflict)return;
    syncBusy=true;let again=false;
    const current=syncPending,owner=syncOwner;
    try{
      const value=remoteFields(current);value.avatar=await shrinkAvatar(value.avatar);
      const data=await profileRequest({account_id:owner,revision:syncRevision,profile:value});
      syncRevision=data.revision;
      if(syncPending===current){
        syncPending=null;
        const local=normalizeProfile({...current,avatar:data.profile.avatar,syncPending:false,syncRevision,accountOwner:owner});
        if(!persistLocalProfile(local,'specialist-profile-sync-confirmed'))syncSnapshot=local;
        setSyncMessage('saved');
      }else{again=true;}
    }catch(e){
      if(e.status===409){
        try{const latest=await profileRequest();if(latest.account_id!==owner){location.reload();return;}syncRevision=latest.revision;}catch{}
        syncConflict=true;setSyncMessage('conflict');
      }else if(e.status===400||e.status===413||e.status===403){syncConflict=true;setSyncMessage('invalid');}
      else if(e.status===401){location.replace('/account');}
      else setSyncMessage('offline');
    }finally{syncBusy=false;if(again)void pushWorkspaceProfile();}
  }
  function initials(name){
    const p = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '👤';
    return (p[0][0] + (p[1]?.[0] || '')).toUpperCase();
  }
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

  const style = document.createElement('style');
  style.textContent = `
    #specialistSettings{display:none!important}
    .settings-profile-summary{display:grid;grid-template-columns:72px minmax(0,1fr);gap:14px;align-items:center;padding:12px 8px 14px;border-bottom:1px solid rgba(255,255,255,.24);margin-bottom:2px}
    .settings-profile-avatar{width:72px;height:72px;min-width:72px;min-height:72px;border-radius:50%;border:1px solid rgba(255,255,255,.58);background:rgba(255,255,255,.88);display:flex;align-items:center;justify-content:center;overflow:hidden;color:#405268;font-weight:900;font-size:20px;cursor:pointer;padding:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.94),0 4px 12px rgba(15,23,42,.18)}
    .settings-profile-avatar img{width:100%;height:100%;display:block;object-fit:cover;border-radius:50%}
    .settings-profile-meta{min-width:0}
    .settings-profile-name{font-size:15px;font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px rgba(0,0,0,.35)}
    .settings-profile-title{margin-top:4px;color:rgba(255,255,255,.88);font-size:11.5px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .settings-profile-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}
    .settings-profile-tag{max-width:100%;padding:3px 6px;border-radius:999px;background:rgba(255,255,255,.17);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:9.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .settings-account-content{display:none;border:1px solid rgba(255,255,255,.70);border-radius:13px;background:rgba(255,255,255,.90);padding:10px;gap:10px;max-height:58vh;overflow-y:auto;overflow-x:hidden}
    .settings-account-content.open{display:grid}
    .specialist-card-title{font-size:14px;font-weight:900;color:#173b63;padding-bottom:8px;border-bottom:1px solid #dbe5ef}
    .account-field{display:grid;gap:6px}
    .account-field-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .account-label{font-size:11.5px;font-weight:900;color:#26384b}
    .account-input,.account-textarea{width:100%;box-sizing:border-box;border:1px solid #b9c9d9;border-radius:9px;background:#fff;padding:0 10px;font-size:12.5px;color:#26384b;outline:none}
    .account-city-input-wrap{position:relative;min-width:0}.account-city-input-wrap .account-city{padding-right:38px!important}.account-city-clear{position:absolute;right:6px;top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;width:27px;height:27px;padding:0;border:0;border-radius:7px;background:#e7f0f9;color:#45627b;font-size:21px;line-height:1;font-weight:500;cursor:pointer}.account-city-clear:hover{background:#d6e8fa;color:#193f66}.account-city-clear:focus-visible{outline:2px solid #4e91d7;outline-offset:1px}.account-city-clear[hidden]{display:none!important}
    .account-city-suggestions{position:fixed;z-index:100100;box-sizing:border-box;display:grid;gap:2px;max-height:min(270px,45dvh);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;border:1px solid #8eb8da;border-radius:9px;background:white;box-shadow:0 12px 30px #16375440;padding:4px;min-width:190px}.account-city-suggestions[hidden]{display:none}.account-city-suggestions button{border:0;padding:9px;text-align:left;background:white;color:#244764;cursor:pointer;font-size:12px}.account-city-suggestions button:hover{background:#e8f3ff}.account-city-info{font-size:11px;color:#637a90}.account-input{height:38px}.account-textarea{min-height:72px;padding:9px 10px;resize:vertical;line-height:1.4}
    .account-input:focus,.account-textarea:focus{border-color:#4f8fd8;box-shadow:0 0 0 2px rgba(79,143,216,.13)}
    .account-save{height:38px;border:0;border-radius:9px;background:linear-gradient(#47b47d,#24945f);color:#fff;font-size:13px;font-weight:900;cursor:pointer;box-shadow:0 3px 7px rgba(36,148,95,.22)}
    .account-photo-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}.account-photo-actions button{height:34px;border-radius:8px;font-size:11px;font-weight:850;cursor:pointer}
    .account-photo-edit,.account-photo-replace{border:1px solid #b9c9d9;background:#f7fbff;color:#31506f}.account-photo-delete{grid-column:1/-1;border:1px solid #e1b4b4;background:#fff7f7;color:#a63c3c}
    .account-reviews{display:grid;gap:8px;padding-top:2px}.account-review-editor{display:grid;gap:6px;padding:9px;border:1px solid #d8e2ec;border-radius:10px;background:#f8fbfd}
    .account-review-add{height:34px;border:0;border-radius:8px;background:linear-gradient(#6f98df,#4d78c6);color:#fff;font-size:11.5px;font-weight:900;cursor:pointer}
    .account-review-list{display:grid;gap:6px}.account-review-item{position:relative;padding:9px 32px 9px 10px;border:1px solid #dce5ee;border-radius:10px;background:#fff}
    .account-review-author{font-size:11px;font-weight:900;color:#31506f;margin-bottom:4px}.account-review-text{font-size:11.5px;line-height:1.4;color:#455a70;white-space:pre-wrap;overflow-wrap:anywhere}
    .account-review-delete{position:absolute;right:6px;top:6px;width:24px;height:24px;border:0;border-radius:7px;background:#fff1f1;color:#b33;font-weight:900;cursor:pointer}.account-review-empty{padding:8px;text-align:center;color:#8a9aad;font-size:11px}
    .settings-account-content #formIntegrationsBtn{width:100%!important;min-width:0!important;height:42px!important;margin:2px 0 0!important;box-sizing:border-box!important}
    .avatar-editor-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}.avatar-editor-dialog::backdrop{background:rgba(15,23,42,.44);backdrop-filter:blur(4px)}
    .avatar-editor-card{width:min(390px,calc(100vw - 28px));background:#fff;border:1px solid #d7e0e9;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.34);padding:18px;box-sizing:border-box;color:#26384b}
    .avatar-editor-title{font-size:17px;font-weight:900;text-align:center;margin-bottom:6px}.avatar-editor-hint{font-size:11.5px;line-height:1.4;color:#6e7f92;text-align:center;margin-bottom:14px}
    .avatar-editor-preview{width:230px;height:230px;margin:0 auto;border-radius:50%;overflow:hidden;border:2px solid #bcc9d7;background:#eef3f8;touch-action:none;cursor:grab;box-shadow:0 5px 18px rgba(15,23,42,.16)}
    .avatar-editor-preview.dragging{cursor:grabbing}.avatar-editor-preview img{width:100%;height:100%;object-fit:cover;display:block;user-select:none;-webkit-user-drag:none;pointer-events:none;will-change:transform}
    .avatar-zoom-row{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;margin-top:14px;font-size:11px;font-weight:850;color:#52677e}.avatar-zoom{width:100%}
    .avatar-editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}.avatar-editor-actions button{height:38px;border-radius:9px;font-weight:850;cursor:pointer}
    .avatar-editor-cancel{border:1px solid #c7d2de;background:#f7f9fb;color:#4c6075}.avatar-editor-save{border:0;background:linear-gradient(#47b47d,#24945f);color:#fff}
    @media(max-width:560px){.account-field-grid{grid-template-columns:1fr}.account-photo-actions{grid-template-columns:1fr}.account-photo-delete{grid-column:auto}}
  `;
  document.head.appendChild(style);

  const summary = document.createElement('div');
  summary.className = 'settings-profile-summary';
  summary.innerHTML = '<button type="button" class="settings-profile-avatar" aria-label="Avatar"></button><div class="settings-profile-meta"><div class="settings-profile-name"></div><div class="settings-profile-title"></div><div class="settings-profile-tags"></div></div>';
  panel.insertBefore(summary,panel.firstChild);

  const content = document.createElement('div');
  content.className = 'settings-account-content';
  content.innerHTML = '<div class="specialist-card-title"></div>'
    +'<div class="account-field"><div class="account-label account-name-label"></div><input class="account-input account-name" type="text" autocomplete="name"></div>'
    +'<div class="account-field"><div class="account-label account-surname-label">Фамилия специалиста</div><input class="account-input account-surname" type="text" autocomplete="family-name"></div>'
    +'<div class="account-field"><div class="account-label account-city-label">Город специалиста</div><div class="account-city-input-wrap"><input class="account-input account-city" type="text" autocomplete="off" placeholder="Начни вводить город…"><button class="account-city-clear" type="button" aria-label="Очистить город и страну" title="Очистить город и страну" hidden>×</button></div><div class="account-city-suggestions" hidden></div><div class="account-city-info">Выбери город из списка — определяется страна и источник курса валют</div></div>'
    +'<div class="account-field"><div class="account-label account-currency-label">Валюта страны</div><select class="account-input account-currency" aria-label="Валюта страны"><option value="">Определяется по стране</option></select><div class="account-city-info account-currency-info">При нескольких официальных валютах можно выбрать нужную</div></div>'
    +'<div class="account-field-grid"><div class="account-field"><div class="account-label account-title-label"></div><input class="account-input account-title" type="text"></div><div class="account-field"><div class="account-label account-experience-label"></div><input class="account-input account-experience" type="text"></div></div>'
    +'<div class="account-field"><div class="account-label account-areas-label"></div><textarea class="account-textarea account-areas"></textarea></div>'
    +'<div class="account-field"><div class="account-label account-about-label"></div><textarea class="account-textarea account-about"></textarea></div>'
    +'<div class="account-field"><div class="account-label account-photo-label"></div><div class="account-photo-actions"><button type="button" class="account-photo-edit"></button><button type="button" class="account-photo-replace"></button><button type="button" class="account-photo-delete"></button></div></div>'
    +'<div class="account-field account-reviews"><div class="account-label account-reviews-label"></div><div class="account-review-editor"><input class="account-input account-review-author-input" type="text"><textarea class="account-textarea account-review-text-input"></textarea><button type="button" class="account-review-add"></button></div><div class="account-review-list"></div></div>'
    +'<button type="button" class="account-save account-profile-save">Сохранить карточку</button><input class="account-avatar-input" type="file" accept="image/*" hidden>';
  accountsBtn.insertAdjacentElement('afterend',content);
  // Reviews belong to their own dedicated module; keep stored records intact.
  const reviewsSection=content.querySelector('.account-reviews');
  if(reviewsSection){reviewsSection.hidden=true;reviewsSection.style.setProperty('display','none','important');}

  // Server account is distinct from the local specialist profile.
  if(location.hostname==='zabvenye.com'){
    const box=document.createElement('div');
    box.style.cssText='display:grid;gap:8px;padding:12px;margin:0 0 12px;border:1px solid #8eb8da;border-radius:10px';
    box.style.background='#f5f9fc';box.style.color='#244560';
    const title=document.createElement('strong');title.textContent='Учётная запись ZABVENYE';title.style.color='#244560';
    const identity=document.createElement('div');identity.style.cssText='font-size:12px;overflow-wrap:anywhere;color:#45627b';identity.textContent='Проверка входа…';
    const cabinet=document.createElement('button');cabinet.type='button';cabinet.textContent='Личный кабинет / Админка';cabinet.className='account-save';cabinet.hidden=true;
    const exit=document.createElement('button');exit.type='button';exit.textContent='Выйти из учётной записи';exit.className='account-save';exit.hidden=true;
    const notice=document.createElement('div');notice.style.fontSize='12px';notice.setAttribute('role','status');
    const analyticsPanel=document.createElement('label');analyticsPanel.hidden=true;analyticsPanel.style.cssText='display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.45;border-top:1px solid #d3e1ec;padding-top:9px';
    const analyticsToggle=document.createElement('input');analyticsToggle.type='checkbox';analyticsToggle.disabled=true;
    const analyticsCopy=document.createElement('span');analyticsPanel.append(analyticsToggle,analyticsCopy);
    const analyticsLabels={ru:'Передавать расширенную статистику использования и суммы внесённых оплат администратору (без данных клиентов). Настройку можно отключить в любое время.',en:'Share usage statistics and recorded payment totals with the administrator (without client data). You can turn this off at any time.',fr:'Partager les statistiques d’usage et les totaux des paiements enregistrés avec l’administrateur (sans données clients). Désactivable à tout moment.',de:'Nutzungsstatistiken und erfasste Zahlungssummen mit dem Administrator teilen (ohne Klientendaten). Jederzeit deaktivierbar.',it:'Condividi statistiche di utilizzo e totali dei pagamenti registrati con l’amministratore (senza dati dei clienti). Disattivabile in qualsiasi momento.'};
    function translateAnalytics(){analyticsCopy.textContent=analyticsLabels[window.DiagnostikaI18n?.language||document.documentElement.lang]||analyticsLabels.ru;}
    analyticsCopy.setAttribute('data-i18n-user-content','');translateAnalytics();window.addEventListener('diagnostika:language-changed',translateAnalytics);
    analyticsToggle.onchange=async()=>{const next=analyticsToggle.checked;analyticsToggle.disabled=true;try{const response=await fetch('/account/api/analytics-preference',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:next})});if(!response.ok)throw Error();await window.DiagnostikaLimits?.refresh?.();}catch{analyticsToggle.checked=!next;}finally{analyticsToggle.disabled=false;}};
    box.append(title,identity,cabinet,exit,analyticsPanel,notice);content.prepend(box);
    const reminder=document.createElement('aside');reminder.hidden=true;reminder.setAttribute('aria-label','Заполнение профиля');
    reminder.style.cssText='position:fixed;right:20px;bottom:20px;z-index:9990;max-width:calc(100vw - 40px);padding:12px 15px;background:#fff8e8;color:#604519;border:1px solid #d9b66f;border-radius:10px;box-shadow:0 4px 15px #18304730;display:none;font:13px system-ui;gap:8px;align-items:center;flex-wrap:wrap';
    const reminderText=document.createElement('span');reminderText.textContent='Вы ввели не все данные профиля';
    const complete=document.createElement('button');complete.type='button';complete.textContent='Заполнить';complete.style.cssText='border:0;background:#285481;color:white;padding:7px 12px;border-radius:6px;cursor:pointer';
    complete.onclick=()=>window.open('/account#profile','_blank','noopener,noreferrer');
    reminder.append(reminderText,complete);document.body.append(reminder);
    let request=0,accountRole=null;
    async function refreshAccount(){
      const current=++request;
      try{
        const response=await fetch('/account/api/me',{credentials:'same-origin',cache:'no-store'});
        if(current!==request)return;
        if(response.status===401){location.replace('/account');return;}
        if(!response.ok)throw Error();
        const u=await response.json();if(current!==request)return;
        if(u.onboarding_required){location.replace('/account');return;}
        const incomplete=['first_name','last_name','birth_date','gender','country','city','timezone'].some(k=>!u[k]);reminder.hidden=!incomplete;reminder.style.display=incomplete?'flex':'none';
        identity.textContent=u.email+(u.role==='admin'?' · Администратор':' · Специалист')+(u.trial?' · FREE · '+new Date(u.trial.expires*1000).toLocaleDateString()+' · AI '+u.trial.remaining_ai+'/20':u.role==='specialist'?' · STANDARD':'');
        accountRole=u.role;cabinet.hidden=accountRole!=='admin';exit.hidden=false;analyticsPanel.hidden=accountRole!=='specialist';analyticsPanel.style.display=analyticsPanel.hidden?'none':'flex';if(!analyticsToggle.disabled||!analyticsPanel.hidden){analyticsToggle.checked=u.metrics?.analytics_enabled===true;analyticsToggle.disabled=false;}
      }catch{if(current===request){identity.textContent='Сервис аккаунтов недоступен';accountRole=null;cabinet.hidden=true;exit.hidden=false;analyticsPanel.hidden=true;analyticsPanel.style.display='none';analyticsToggle.disabled=true;}}
    }
    async function canNavigate(){
      if(typeof prepareLeave==='function' && await prepareLeave()===false)return false;
      return window.confirm('Перейти из рабочего пространства? Убедитесь, что изменения в клиентских карточках сохранены. Локальная база и настройки синхронизации не удаляются.');
    }
    cabinet.addEventListener('click',()=>{if(accountRole==='admin')window.open('/account','_blank','noopener,noreferrer');});
    exit.addEventListener('click',async()=>{
      if(!await canNavigate())return;
      exit.disabled=true;cabinet.disabled=true;notice.textContent='Завершение сеанса…';
      try{
        const response=await fetch('/account/api/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
        if(!response.ok&&response.status!==401)throw Error();
        location.replace('/account');
      }catch{notice.textContent='Не удалось завершить сеанс. Проверьте соединение и повторите.';exit.disabled=false;cabinet.disabled=false;}
    });
    accountsBtn.addEventListener('click',refreshAccount,true);
    refreshAccount();
    window.addEventListener('focus',refreshAccount);
    setInterval(()=>{if(document.visibilityState==="visible")refreshAccount();},60000);
  }


  const avatarBtn=summary.querySelector('.settings-profile-avatar');
  const nameEl=summary.querySelector('.settings-profile-name');
  const titleEl=summary.querySelector('.settings-profile-title');
  const tagsEl=summary.querySelector('.settings-profile-tags');
  const nameInput=content.querySelector('.account-name');
  const titleInput=content.querySelector('.account-title');
  const surnameInput=content.querySelector('.account-surname');
  const cityInput=content.querySelector('.account-city');
  const cityClear=content.querySelector('.account-city-clear');
  const updateCityClear=()=>{cityClear.hidden=!cityInput.value.trim();};
  const citySuggestions=content.querySelector('.account-city-suggestions');
  const cityInfo=content.querySelector('.account-city-info');
  const currencyInput=content.querySelector('.account-currency');
  const currencyInfo=content.querySelector('.account-currency-info');
  let currencyOptions=[],currencyRequest=0,currencyTouched=false;
  async function updateCountryCurrencies(code,preferred=''){
    const request=++currencyRequest;
    const api=window.DiagnostikaCountryCurrency;
    currencyOptions=[];
    currencyInput.replaceChildren();
    if(!api||!code){const option=document.createElement('option');option.value='';option.textContent=copy().chooseCity;currencyInput.appendChild(option);currencyInput.disabled=true;currencyInfo.textContent=copy().firstCity;return;}
    const requested=code;
    currencyInfo.textContent=copy().detectCurrency;
    try{
      const info=await api.currencyForCountry(code);
      if(request!==currencyRequest||String(chosenCity?.country_code||'')!==requested)return;
      currencyOptions=info.options;
      for(const currency of info.options){const option=document.createElement('option');option.value=currency;option.textContent=currency;currencyInput.appendChild(option);}
      currencyInput.value=info.options.includes(preferred)?preferred:info.currency;
      currencyInput.disabled=info.options.length<=1;
      currencyInfo.textContent=info.options.length>1?copy().manyCurrencies:copy().mainCurrency+currencyInput.value;
    }catch(error){if(request===currencyRequest){currencyInput.disabled=true;currencyInfo.textContent=error?.message||copy().currencyUnavailable;}}
  }
  let chosenCity=null,cityTimer=null,cityRequest=0;
  currencyInput.addEventListener('change',()=>{currencyTouched=true;});
  const settingsWrap=panel.closest('.settings-wrap');
  const accountVisible=()=>Boolean(settingsWrap?.classList.contains('open')&&content.classList.contains('open'));
  // Render city suggestions outside the scrolling settings pane to avoid clipping.
  document.body.appendChild(citySuggestions);
  // Picker is portaled to body; clicks must not dismiss the settings panel.
  citySuggestions.addEventListener('click',event=>event.stopPropagation());
  function placeCitySuggestions(){
    if(citySuggestions.hidden)return;
    if(!accountVisible()){hideCitySuggestions();return;}
    const rect=cityInput.getBoundingClientRect();
    const viewportH=window.innerHeight||document.documentElement.clientHeight;
    const below=viewportH-rect.bottom,above=rect.top;
    const openAbove=below<190&&above>below;
    const available=Math.max(100,Math.min(280,(openAbove?above:below)-12));
    citySuggestions.style.width=Math.max(190,Math.round(rect.width))+'px';
    citySuggestions.style.left=Math.max(6,Math.min(rect.left,window.innerWidth-rect.width-6))+'px';
    citySuggestions.style.maxHeight=Math.round(available)+'px';
    citySuggestions.style.top=openAbove?'auto':Math.round(rect.bottom+4)+'px';
    citySuggestions.style.bottom=openAbove?Math.round(viewportH-rect.top+4)+'px':'auto';
  }
  function hideCitySuggestions(){citySuggestions.hidden=true;}
  function stopCitySearch(){
    clearTimeout(cityTimer);cityRequest+=1;hideCitySuggestions();
    citySuggestions.replaceChildren();
  }
  window.addEventListener('diagnostika:settings-visibility',event=>{
    if(event.detail?.open===false)stopCitySearch();
  });
  window.addEventListener('resize',placeCitySuggestions,{passive:true});
  document.addEventListener('scroll',placeCitySuggestions,true);
  document.addEventListener('pointerdown',event=>{
    if(!citySuggestions.contains(event.target)&&event.target!==cityInput)hideCitySuggestions();
  },true);
  const experienceInput=content.querySelector('.account-experience');
  const areasInput=content.querySelector('.account-areas');
  const aboutInput=content.querySelector('.account-about');
  const saveBtn=content.querySelector('.account-profile-save');
  const fileInput=content.querySelector('.account-avatar-input');
  const photoEditBtn=content.querySelector('.account-photo-edit');
  const photoReplaceBtn=content.querySelector('.account-photo-replace');
  const photoDeleteBtn=content.querySelector('.account-photo-delete');
  const reviewAuthorInput=content.querySelector('.account-review-author-input');
  const reviewTextInput=content.querySelector('.account-review-text-input');
  const reviewAddBtn=content.querySelector('.account-review-add');
  const reviewList=content.querySelector('.account-review-list');

  function paintAvatar(profile=getProfile()){
    avatarBtn.innerHTML='';
    if(profile.avatar){
      const img=document.createElement('img');img.src=profile.avatar;img.alt='';avatarBtn.appendChild(img);
    }else avatarBtn.textContent=initials(profile.name);
  }
  function paintSummary(profile=getProfile()){
    const tr=t();
    nameEl.textContent=[profile.name,profile.surname].filter(Boolean).join(' ')||tr.empty;
    const years=String(profile.experience||'').trim();
    const expLabel=years?(years.match(/(?:опыт|стаж|experience|expérience|erfahrung|esperienza)/i)?years:
      (/^\d+(?:[.,]\d+)?\s*(?:лет|года|год)$/i.test(years)?years+' опыта':'Опыт: '+years)):'';
    titleEl.textContent=[profile.title,expLabel].filter(Boolean).join(' • ');
    tagsEl.innerHTML='';
    profile.areas.slice(0,4).forEach(area=>{
      const tag=document.createElement('span');tag.className='settings-profile-tag';tag.textContent=area;tagsEl.appendChild(tag);
    });
    paintAvatar(profile);
  }
  function renderReviews(profile=getProfile()){
    const tr=t();reviewList.innerHTML='';
    if(!profile.reviews.length){reviewList.innerHTML='<div class="account-review-empty">'+tr.reviewEmpty+'</div>';return;}
    profile.reviews.forEach(review=>{
      const item=document.createElement('div');item.className='account-review-item';
      const author=document.createElement('div');author.className='account-review-author';author.textContent=review.author||'Отзыв';
      const text=document.createElement('div');text.className='account-review-text';text.textContent=review.text;
      const del=document.createElement('button');del.type='button';del.className='account-review-delete';del.textContent='×';del.title=tr.reviewDelete;
      del.onclick=e=>{e.stopPropagation();const next=getProfile();next.reviews=next.reviews.filter(x=>x.id!==review.id);if(persistProfile(next,'specialist-profile-review-delete'))render();};
      item.append(author,text,del);reviewList.appendChild(item);
    });
  }
  if(hostedProfile){
    const status=document.createElement('div');status.id='specialistProfileSync';status.setAttribute('role','status');status.setAttribute('data-i18n-user-content','');status.style.cssText='font:600 11px/1.4 system-ui;color:#45627b;overflow-wrap:anywhere';saveBtn.after(status);
    const importBtn=document.createElement('button');importBtn.type='button';importBtn.id='specialistProfileImport';importBtn.className='account-save';importBtn.setAttribute('data-i18n-user-content','');importBtn.hidden=true;status.after(importBtn);
    importBtn.onclick=()=>{if(!legacyCandidate||!syncReady||!window.confirm(syncCopy().confirm))return;const candidate=legacyCandidate;legacyCandidate=null;if(persistProfile(candidate,'specialist-profile-legacy-import'))render();else legacyCandidate=candidate;setSyncMessage(syncMessage);};
    setSyncMessage('loading');
  }
  let committedForm=null;
  function formSignature(){
    return JSON.stringify({
      name:nameInput.value.trim(),surname:surnameInput.value.trim(),
      title:titleInput.value.trim(),experience:experienceInput.value.trim(),
      areas:normalizeAreas(areasInput.value),about:aboutInput.value.trim(),
      city:cityInput.value.trim(),countryCode:chosenCity?.country_code||'',
      currency:currencyTouched?currencyInput.value:null,
      reviewAuthor:reviewAuthorInput.value.trim(),reviewText:reviewTextInput.value.trim()
    });
  }
  const hasChanges=()=>committedForm!==null&&formSignature()!==committedForm;
  function render({preserveDraft=false}={}){
    const keepDraft=preserveDraft&&hasChanges();
    const tr=t(),profile=getProfile();
    paintSummary(profile);
    content.querySelector('.specialist-card-title').textContent=tr.profile;
    content.querySelector('.account-name-label').textContent=tr.name;
    const strings=copy();
    content.querySelector('.account-surname-label').textContent=strings.surname;
    content.querySelector('.account-city-label').textContent=strings.city;
    content.querySelector('.account-currency-label').textContent=strings.currency;
    cityInput.placeholder=strings.cityPlaceholder;
    cityClear.title=strings.clearCity;cityClear.setAttribute('aria-label',strings.clearCity);
    currencyInput.setAttribute('aria-label',strings.currency);
    content.querySelector('.account-title-label').textContent=tr.title;
    content.querySelector('.account-experience-label').textContent=tr.experience;
    content.querySelector('.account-areas-label').textContent=tr.areas;
    content.querySelector('.account-about-label').textContent=tr.about;
    content.querySelector('.account-photo-label').textContent=tr.photo;
    content.querySelector('.account-reviews-label').textContent=tr.reviews;
    nameInput.placeholder=tr.name;titleInput.placeholder=tr.titlePlaceholder;experienceInput.placeholder=tr.experiencePlaceholder;areasInput.placeholder=tr.areasPlaceholder;aboutInput.placeholder=tr.aboutPlaceholder;
    reviewAuthorInput.placeholder=tr.reviewAuthor;reviewTextInput.placeholder=tr.reviewText;
    photoEditBtn.textContent=tr.photoEdit;photoReplaceBtn.textContent=tr.photoReplace;photoDeleteBtn.textContent=tr.photoDelete;reviewAddBtn.textContent=tr.reviewAdd;saveBtn.textContent=tr.save;
    if(!keepDraft){
    if(document.activeElement!==nameInput)nameInput.value=profile.name;
    if(document.activeElement!==surnameInput)surnameInput.value=profile.surname;
    if(document.activeElement!==cityInput)cityInput.value=[profile.city,profile.region,profile.country].filter(Boolean).join(', ');
    updateCityClear();
    if(document.activeElement!==cityInput){
      chosenCity=profile.countryCode?{name:profile.city,admin1:profile.region,country:profile.country,country_code:profile.countryCode}:null;
      updateCountryCurrencies(profile.countryCode,profile.currencyCode);
    }
    cityInfo.textContent=profile.countryCode?(strings.country+profile.country+' ('+profile.countryCode+')'+strings.rateSource):strings.cityChoose;
    if(document.activeElement!==titleInput)titleInput.value=profile.title;
    if(document.activeElement!==experienceInput)experienceInput.value=profile.experience;
    if(document.activeElement!==areasInput)areasInput.value=profile.areas.join(', ');
    if(document.activeElement!==aboutInput)aboutInput.value=profile.about;
      currencyTouched=false;
      committedForm=formSignature();
    }
    photoEditBtn.disabled=!syncReady||!profile.avatar;photoDeleteBtn.disabled=!syncReady||!profile.avatar;
    renderReviews(profile);
  }
  function profileFromForm(){
    const profile=getProfile();
    profile.name=nameInput.value.trim();profile.surname=surnameInput.value.trim();
    if(chosenCity&&cityInput.value.trim()===[chosenCity.name,chosenCity.admin1,chosenCity.country].filter(Boolean).join(', ')){
      profile.city=chosenCity.name;profile.region=chosenCity.admin1||'';profile.country=chosenCity.country||'';profile.countryCode=chosenCity.country_code||'';
      profile.currencyCode=currencyOptions.includes(currencyInput.value)?currencyInput.value:
        (chosenCity.country_code===profile.countryCode?profile.currencyCode:'');
    }else if(cityInput.value.trim()!==[profile.city,profile.region,profile.country].filter(Boolean).join(', ')){
      // Never infer a central bank from free-form text.
      profile.city='';profile.region='';profile.country='';profile.countryCode='';profile.currencyCode='';
    }
    profile.title=titleInput.value.trim();profile.experience=experienceInput.value.trim();profile.areas=normalizeAreas(areasInput.value);profile.about=aboutInput.value.trim();
    return profile;
  }

  function renderCityOptions(items){
    if(!accountVisible()||document.activeElement!==cityInput){hideCitySuggestions();return;}
    citySuggestions.replaceChildren();
    for(const item of items){
      if(!item.name||!item.country_code)continue;
      const b=document.createElement('button');b.type='button';
      b.textContent=[item.name,item.admin1,item.country].filter(Boolean).join(', ');
      b.onclick=()=>{
        chosenCity={name:item.name,admin1:item.admin1||'',country:item.country||'',country_code:item.country_code};
        stopCitySearch();
        currencyTouched=false;
        cityInput.value=b.textContent;updateCityClear();cityInfo.textContent=copy().country+item.country+' ('+item.country_code+')';
        citySuggestions.hidden=true;
        updateCountryCurrencies(chosenCity.country_code);
      };
      citySuggestions.appendChild(b);
    }
    citySuggestions.hidden=!citySuggestions.childElementCount;
    placeCitySuggestions();
  }
  cityInput.addEventListener('input',()=>{
    chosenCity=null;updateCityClear();updateCountryCurrencies('');cityInfo.textContent=copy().chooseExactCity;
    const value=cityInput.value.trim();clearTimeout(cityTimer);
    cityRequest+=1;const request=cityRequest;
    if(value.length<2){citySuggestions.hidden=true;return;}
    cityTimer=setTimeout(async()=>{
      try{
        const u='https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(value)+'&count=10&language=ru&format=json';
        const response=await fetch(u);
        if(!response.ok)throw Error('Ошибка сервиса городов');
        const data=await response.json();
        if(request===cityRequest)renderCityOptions(data.results||[]);
      }catch(_){if(request===cityRequest){citySuggestions.hidden=true;cityInfo.textContent=copy().cityUnavailable;}}
    },350);
  });
  cityClear.addEventListener('click',event=>{
    event.preventDefault();event.stopPropagation();
    stopCitySearch();
    chosenCity=null;currencyTouched=false;
    cityInput.value='';
    citySuggestions.replaceChildren();
    hideCitySuggestions();
    updateCountryCurrencies('');
    updateCityClear();
    cityInput.dispatchEvent(new Event('input',{bubbles:true}));
    cityInfo.textContent=copy().cityCleared;
    cityInput.focus();
  });
  cityInput.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!citySuggestions.hidden){e.preventDefault();e.stopPropagation();hideCitySuggestions();return;}
    if(e.key==='Enter'&&!citySuggestions.hidden){
      const option=citySuggestions.querySelector('button');
      if(option){e.preventDefault();option.click();}
    }
  });

  function collapse(){
    stopCitySearch();
    content.classList.remove('open');
    accountsBtn.classList.remove('active');
  }
  function clearAccountDrafts(){
    const recovery=window.DiagnostikaEditDrafts;
    if(!recovery?.clearField)return;
    for(const field of content.querySelectorAll('input:not([type="file"]),textarea'))
      recovery.clearField(field);
  }
  function saveCard(){
    // Never silently erase a typed city that was not selected from the
    // verified location list, and never change its country by guessing.
    const typedCity=cityInput.value.trim();
    const selectedCity=chosenCity?[chosenCity.name,chosenCity.admin1,chosenCity.country].filter(Boolean).join(', '):'';
    if(typedCity&&typedCity!==selectedCity){
      window.AppDialog?.alert?.(copy().selectValidCity,copy().noCity);
      cityInput.focus();
      return false;
    }
    // Review editor is a separate draft until its Add action is pressed.
    if(reviewTextInput.value.trim()||reviewAuthorInput.value.trim()){
      window.AppDialog?.alert?.(copy().addReviewFirst,copy().unsavedReview);
      return false;
    }
    if(!persistProfile(profileFromForm(),'specialist-profile-card-save'))return false;
    clearAccountDrafts();
    stopCitySearch();
    render();
    saveBtn.textContent=t().saved;
    setTimeout(()=>{saveBtn.textContent=t().save;},900);
    return true;
  }
  let leaving=false;
  async function prepareLeave(){
    if(leaving)return false;
    if(!hasChanges()){stopCitySearch();return true;}
    leaving=true;
    try{
      const choice=window.AppDialog?.savePrompt
        ?await window.AppDialog.savePrompt(copy().unsavedChanges)
        :'cancel';
      if(choice==='save')return saveCard();
      if(choice==='discard'){
        clearAccountDrafts();
        stopCitySearch();
        if(content.contains(document.activeElement))document.activeElement.blur();
        reviewAuthorInput.value='';reviewTextInput.value='';
        render();
        return true;
      }
      return false;
    }finally{leaving=false;}
  }
  window.DiagnostikaAccountSettings=Object.freeze({
    isOpen:()=>content.classList.contains('open'),
    hasChanges,prepareLeave,collapse
  });
  accountsBtn.addEventListener('click',async e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    if(content.classList.contains('open')){
      if(await prepareLeave()===false)return;
      collapse();return;
    }
    content.classList.add('open');
    accountsBtn.classList.add('active');
    const interfaceContent=panel.querySelector('.settings-interface-content');
    const interfaceBtn=panel.querySelector('.settings-interface-btn');
    interfaceContent?.classList.remove('open');
    interfaceBtn?.classList.remove('active');
    render({preserveDraft:true});
  },true);

  saveBtn.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    saveCard();
  });

  reviewAddBtn.addEventListener('click',e=>{
    e.stopPropagation();
    const text=reviewTextInput.value.trim();
    if(!text)return;
    const profile=profileFromForm();
    profile.reviews.push({id:uid(),author:reviewAuthorInput.value.trim(),text,createdAt:Date.now()});
    if(!persistProfile(profile,'specialist-profile-review-add'))return;
    reviewAuthorInput.value='';reviewTextInput.value='';clearAccountDrafts();render();
  });

  const dlg=document.createElement('dialog');
  dlg.className='avatar-editor-dialog';
  dlg.innerHTML='<div class="avatar-editor-card"><div class="avatar-editor-title"></div><div class="avatar-editor-hint"></div><div class="avatar-editor-preview"><img alt=""></div><div class="avatar-zoom-row"><span class="avatar-zoom-label"></span><input class="avatar-zoom" type="range" min="1" max="3" step="0.05" value="1"><span class="avatar-zoom-value">100%</span></div><div class="avatar-editor-actions"><button type="button" class="avatar-editor-cancel"></button><button type="button" class="avatar-editor-save"></button></div></div>';
  document.body.appendChild(dlg);

  const preview=dlg.querySelector('.avatar-editor-preview');
  const previewImg=preview.querySelector('img');
  const zoomInput=dlg.querySelector('.avatar-zoom');
  const zoomValue=dlg.querySelector('.avatar-zoom-value');
  let sourceImage=null,sourceData='';
  let pos={x:50,y:50,zoom:1};
  let dragging=false,startX=0,startY=0,startPosX=50,startPosY=50;

  function paintEditorText(){
    const tr=t();
    dlg.querySelector('.avatar-editor-title').textContent=tr.avatarTitle;
    dlg.querySelector('.avatar-editor-hint').textContent=tr.avatarHint;
    dlg.querySelector('.avatar-zoom-label').textContent=tr.zoom;
    dlg.querySelector('.avatar-editor-cancel').textContent=tr.cancel;
    dlg.querySelector('.avatar-editor-save').textContent=tr.avatarSave;
  }
  function paintPreview(){
    previewImg.style.objectPosition=pos.x+'% '+pos.y+'%';
    previewImg.style.transform='scale('+pos.zoom+')';
    previewImg.style.transformOrigin=pos.x+'% '+pos.y+'%';
    zoomInput.value=String(pos.zoom);
    zoomValue.textContent=Math.round(pos.zoom*100)+'%';
  }
  function loadImage(data){
    return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=data;});
  }
  function compressSource(img){
    const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,max=1600,scale=Math.min(1,max/Math.max(w,h));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',0.90);
  }
  async function openEditor(data,crop={x:50,y:50,zoom:1}){
    if(!data)return false;
    try{
      sourceImage=await loadImage(data);sourceData=data;
      pos={x:clamp(Number(crop?.x)||50,0,100),y:clamp(Number(crop?.y)||50,0,100),zoom:clamp(Number(crop?.zoom)||1,1,3)};
      previewImg.src=data;paintEditorText();paintPreview();dlg.showModal();return true;
    }catch(_){return false;}
  }

  preview.addEventListener('pointerdown',e=>{
    if(!sourceImage)return;
    dragging=true;preview.classList.add('dragging');preview.setPointerCapture?.(e.pointerId);
    startX=e.clientX;startY=e.clientY;startPosX=pos.x;startPosY=pos.y;e.preventDefault();
  });
  preview.addEventListener('pointermove',e=>{
    if(!dragging)return;
    const r=preview.getBoundingClientRect(),sensitivity=100/Math.max(1,pos.zoom);
    pos.x=clamp(startPosX-(e.clientX-startX)/Math.max(1,r.width)*sensitivity,0,100);
    pos.y=clamp(startPosY-(e.clientY-startY)/Math.max(1,r.height)*sensitivity,0,100);
    paintPreview();e.preventDefault();
  });
  function stopDrag(){dragging=false;preview.classList.remove('dragging');}
  preview.addEventListener('pointerup',stopDrag);preview.addEventListener('pointercancel',stopDrag);
  zoomInput.addEventListener('input',()=>{pos.zoom=clamp(Number(zoomInput.value)||1,1,3);paintPreview();});

  function cropAvatar(img,p){
    const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,base=Math.min(w,h);
    const side=base/clamp(Number(p.zoom)||1,1,3);
    const sx=(w-side)*(clamp(Number(p.x)||50,0,100)/100),sy=(h-side)*(clamp(Number(p.y)||50,0,100)/100);
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;
    canvas.getContext('2d').drawImage(img,sx,sy,side,side,0,0,320,320);
    return canvas.toDataURL('image/jpeg',0.90);
  }

  avatarBtn.addEventListener('click',e=>{e.stopPropagation();const profile=getProfile();if(profile.avatar)photoEditBtn.click();else fileInput.click();});
  photoEditBtn.addEventListener('click',async e=>{e.stopPropagation();const profile=getProfile();await openEditor(profile.avatarSource||profile.avatar,profile.avatarCrop);});
  photoReplaceBtn.addEventListener('click',e=>{e.stopPropagation();fileInput.click();});
  photoDeleteBtn.addEventListener('click',e=>{
    e.stopPropagation();const profile=getProfile();profile.avatar='';profile.avatarSource='';profile.avatarCrop={x:50,y:50,zoom:1};
    if(persistProfile(profile,'specialist-profile-avatar-delete'))render({preserveDraft:true});
  });

  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];fileInput.value='';
    if(!file||!file.type.startsWith('image/'))return;
    const reader=new FileReader();
    reader.onload=async()=>{try{const original=await loadImage(String(reader.result||''));const compressed=compressSource(original);await openEditor(compressed,{x:50,y:50,zoom:1});}catch(err){console.warn('Avatar load failed',err);}};
    reader.readAsDataURL(file);
  });

  dlg.querySelector('.avatar-editor-cancel').addEventListener('click',()=>{sourceImage=null;sourceData='';dlg.close();});
  dlg.querySelector('.avatar-editor-save').addEventListener('click',()=>{
    if(!sourceImage){dlg.close();return;}
    try{
      const profile=profileFromForm();
      profile.avatar=cropAvatar(sourceImage,pos);
      profile.avatarSource=sourceData||profile.avatarSource||profile.avatar;
      profile.avatarCrop={x:pos.x,y:pos.y,zoom:pos.zoom};
      if(persistProfile(profile,'specialist-profile-avatar-save')){clearAccountDrafts();render();}
    }catch(err){console.warn('Avatar save failed',err);}
    sourceImage=null;sourceData='';dlg.close();
  });

  function moveFormsButton(){
    const b=document.getElementById('formIntegrationsBtn');
    if(!b) return false;
    if(b.parentElement!==content) content.appendChild(b);
    return true;
  }
  function retryMoveFormsButton(){
    let attempts=0;
    const tick=()=>{
      if(moveFormsButton()) return;
      attempts+=1;
      if(attempts<30) setTimeout(tick,300);
    };
    tick();
  }
  if(document.readyState==='complete') retryMoveFormsButton();
  else window.addEventListener('load',()=>setTimeout(retryMoveFormsButton,0),{once:true});

  window.addEventListener('diagnostika-language-changed',()=>setTimeout(()=>render({preserveDraft:true}),0));
  window.addEventListener('diagnostika:language-changed',()=>{if(hostedProfile)setSyncMessage(syncMessage);});
  window.DiagnostikaSpecialistProfile={getName,getAvatar,getProfile:()=>clone(getProfile()),saveProfile:profile=>persistProfile(profile,'specialist-profile-api-save'),nameKey:NAME_KEY,avatarKey:AVATAR_KEY};
  render();
  if(hostedProfile){
    const sync=()=>syncPending&&!syncConflict?pushWorkspaceProfile():pullWorkspaceProfile();
    void sync();window.addEventListener('focus',sync);window.addEventListener('online',sync);accountsBtn.addEventListener('click',sync);setInterval(()=>{if(document.visibilityState==='visible')void sync();},45000);
  }
  // Deferred scripts run in order; the country/currency provider loads after this module.
  // Retry after all deferred scripts are ready without resetting a draft being edited.
  if(document.readyState==='loading'||document.readyState==='interactive')
    document.addEventListener('DOMContentLoaded',()=>render({preserveDraft:true}),{once:true});
  else setTimeout(()=>render({preserveDraft:true}),0);
})();
