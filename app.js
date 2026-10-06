'use strict';
const $=s=>document.querySelector(s);
const INSTINCTS=['Бей / атаковать','Беги / убежать','Замри / спрятаться'];
let state=loadState();
let clientId=state.clients[0]?.id||null;
let requestId=null;
let situationId=null;
let selected=null;
let mode='card';
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2)}
function lvl(v){return Math.max(1,Math.min(10,Number(v)||1))}
function today(){return new Date().toISOString().slice(0,10)}
function newClient(){return{id:uid(),name:'Новый клиент',city:'',age:'',ageAuto:false,birth:'',birthTime:'',photoData:'',photoSourceData:'',photoCrop:{x:50,y:50,zoom:1},vk:'',telegram:'',max:'',sessions:[],requests:[]}}
function newRequest(){return{id:uid(),title:'Новый запрос',situations:[]}}
function newSituation(){return{id:uid(),name:'Новая ситуация',level:5,comment:'',result:'',beliefs:[]}}
function newBelief(){return{id:uid(),text:'',level:5,comment:'',feelings:[]}}
function newFeeling(){return{id:uid(),text:'',level:5,comment:'',deep:[]}}
function newDeep(){return{id:uid(),text:'',level:5,comment:'',instincts:[newInstinct()]}}
function newInstinct(){return{id:uid(),name:'',level:5,comment:''}}
function migrate(c){
 if(!Array.isArray(c.sessions))c.sessions=[];
 if(!Array.isArray(c.requests))c.requests=[];
 if(c.diagnosis&&(c.diagnosis.request||c.diagnosis.situations?.length)){c.requests.push({id:uid(),title:c.diagnosis.request||'Запрос',situations:c.diagnosis.situations||[]});delete c.diagnosis}
 c.photoData=c.photoData||''; c.photoSourceData=c.photoSourceData||c.photoData||''; c.photoCrop=c.photoCrop||{x:50,y:50,zoom:1}; c.birthTime=c.birthTime||''; if(c.ageAuto===undefined)c.ageAuto=Boolean(c.birth); c.age=c.age||'';
 return c;
}
function loadState(){const db=window.DiagnostikaDB||window.DiagnostikaPlatform?.db;if(!db?.readState)throw new Error('DiagnostikaDB is required before app state initialization');const x=db.readState({source:'app-load'});if(x?.clients){x.clients=x.clients.map(migrate);return x}return{version:4,clients:[]}}
function save(options={}){state.version=4;try{const db=window.DiagnostikaDB||window.DiagnostikaPlatform?.db;if(!db?.writeState){console.error('[Diagnostika] database save unavailable');return false}return db.writeState(state,{source:options.source||'app-save'})===true}catch(e){console.error('[Diagnostika] database save failed',e);return false}}
function client(){return state.clients.find(x=>x.id===clientId)||null}
function request(){return client()?.requests.find(x=>x.id===requestId)||null}
function situation(){return request()?.situations.find(x=>x.id===situationId)||null}
function diagnosisUiContext(source){const c=client(),r=request(),api=window.DiagnostikaDiagnosis;return c&&r&&api?.moduleAware?{c,r,api,options:{client:c,requestId:r.id,source,render:false}}:null}
function diagnosisEditorDraftState(){
 if(mode!=='diagnosis'||!selected)return{dirty:false,mainDirty:false,instinctDirty:false};
 const textEl=$('#editorText'),levelEl=$('#editorLevel'),commentEl=$('#editorComment');
 if(!textEl||!levelEl||!commentEl)return{dirty:false,mainDirty:false,instinctDirty:false};
 const savedText=String(selected.type==='instinct'?(selected.obj.name||''):(selected.obj.text||''));
 const savedLevel=lvl(selected.obj.level);
 const savedComment=String(selected.obj.comment||'');
 const mainDirty=String(textEl.value)!==savedText||lvl(levelEl.value)!==savedLevel||String(commentEl.value)!==savedComment;
 let instinctDirty=false;
 if(selected.type==='deep'){
   const first=Array.isArray(selected.obj.instincts)?selected.obj.instincts[0]:null;
   const savedInstinct={name:String(first?.name||''),level:lvl(first?.level??5),comment:String(first?.comment||'')};
   const currentInstinct={name:String($('#instinctCombo')?.value||''),level:lvl($('#instinctLevel')?.value??5),comment:String($('#instinctComment')?.value||'')};
   instinctDirty=currentInstinct.name!==savedInstinct.name||currentInstinct.level!==savedInstinct.level||currentInstinct.comment!==savedInstinct.comment;
 }
 return{dirty:mainDirty||instinctDirty,mainDirty,instinctDirty};
}
function saveDiagnosisEditorDraft({render=true}={}){
 if(!selected)return true;
 const draft=diagnosisEditorDraftState();
 if(!draft.dirty)return true;
 const ctx=diagnosisUiContext('diagnosis-ui-unsaved-guard-save');
 if(!ctx)return false;
 const type=selected.type,id=selected.obj.id;
 if(draft.mainDirty){
   const changes={level:lvl($('#editorLevel').value),comment:$('#editorComment').value};
   if(type==='instinct')changes.name=$('#editorText').value;else changes.text=$('#editorText').value;
   if(!ctx.api.updateElement(type,id,changes,ctx.options))return false;
 }
 if(type==='deep'&&draft.instinctDirty){
   selectDiagnosisElementById('deep',id);
   const deep=selected?.obj;
   const first=Array.isArray(deep?.instincts)?deep.instincts[0]:null;
   const changes={name:$('#instinctCombo').value,level:lvl($('#instinctLevel').value),comment:$('#instinctComment').value};
   const saved=first?ctx.api.updateElement('instinct',first.id,changes,ctx.options):ctx.api.addInstinct(id,changes,ctx.options);
   if(!saved)return false;
 }
 selectDiagnosisElementById(type,id);
 if(render)renderTree();
 return true;
}
let diagnosisEditorGuardBusy=false;
async function guardDiagnosisEditorLeave(action){
 if(diagnosisEditorGuardBusy)return false;
 if(!diagnosisEditorDraftState().dirty){if(typeof action==='function')action();return true;}
 diagnosisEditorGuardBusy=true;
 let decision='cancel';
 try{
   if(window.AppDialog?.savePrompt){
     decision=await window.AppDialog.savePrompt('В редакторе есть несохранённые изменения. Сохранить их перед переходом?','Сохранить изменения?');
   }else{
     decision=window.confirm('В редакторе есть несохранённые изменения. Сохранить их перед переходом?')?'save':'cancel';
   }
 }finally{diagnosisEditorGuardBusy=false;}
 if(decision==='save'){
   if(!saveDiagnosisEditorDraft({render:false}))return false;
   if(typeof action==='function')action();
   return true;
 }
 if(decision==='discard'){
   if(typeof action==='function')action();
   return true;
 }
 return false;
}
window.DiagnostikaEditorGuard=Object.freeze({
 hasUnsaved:()=>diagnosisEditorDraftState().dirty,
 beforeLeave:guardDiagnosisEditorLeave,
 save:options=>saveDiagnosisEditorDraft(options)
});
window.addEventListener('beforeunload',e=>{
 if(!diagnosisEditorDraftState().dirty)return;
 e.preventDefault();
 e.returnValue='';
});

function selectDiagnosisElementById(type,id){const s=situation();if(!s||id===undefined||id===null){selected=null;return null}for(let bi=0;bi<(s.beliefs||[]).length;bi++){const b=s.beliefs[bi];if(type==='belief'&&String(b.id)===String(id))return selected={type:'belief',obj:b,parent:s,index:bi};for(let fi=0;fi<(b.feelings||[]).length;fi++){const f=b.feelings[fi];if(type==='feeling'&&String(f.id)===String(id))return selected={type:'feeling',obj:f,parent:b,index:fi};for(let di=0;di<(f.deep||[]).length;di++){const d=f.deep[di];if(type==='deep'&&String(d.id)===String(id))return selected={type:'deep',obj:d,parent:f,index:di};for(let ii=0;ii<(d.instincts||[]).length;ii++){const x=d.instincts[ii];if(type==='instinct'&&String(x.id)===String(id))return selected={type:'instinct',obj:x,parent:d,index:ii}}}}}selected=null;return null}
function calcAge(c){if(c.age)return c.age;if(!c.birth)return'';const d=new Date(c.birth);if(Number.isNaN(d.getTime()))return'';const n=new Date();let a=n.getFullYear()-d.getFullYear();if(n<new Date(n.getFullYear(),d.getMonth(),d.getDate()))a--;return a}
function normalizeUrl(v){v=(v||'').trim();if(!v)return'';return /^[a-z]+:\/\//i.test(v)?v:'https://'+v}
function renderClient(){const c=client();if(!c){requestId=null;situationId=null;selected=null;renderRequests();renderMode();return;}if(!requestId||!c.requests.some(r=>r.id===requestId)){const service=window.DiagnostikaPlatform?.services?.requests;const activeId=service?.activeId?.(c)??c.currentRequestId??null;requestId=c.requests.some(r=>String(r.id)===String(activeId))?activeId:(c.requests[0]?.id||null);situationId=null;selected=null;}renderRequests();renderSessions();renderMode()}
function renderRequests(){const c=client(),sel=$('#requestSelect');sel.innerHTML='';if(!c)return;c.requests.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent='Запрос '+(c.requests.indexOf(r)+1)+': '+(r.title||'Без названия');sel.appendChild(o)});if(requestId)sel.value=requestId;const r=request();$('#requestTitle').value=r?.title||'';if(!situationId||!r?.situations?.some(s=>s.id===situationId))situationId=r?.situations?.[0]?.id||null;renderSituationList()}
function situationColor(i){return ['#5B4BA3','#2F6F9F','#287A55','#A85A2A','#A34A68','#347477','#9A6A16','#4E5C8A'][i%8]}
function situationBg(i){return ['#E8E1FF','#DDF0FF','#DDF6EA','#FFE8D8','#FCE0EA','#E2F1F1','#FFF0C9','#E7EAF7'][i%8]}
function renderSituationList(){const root=$('#situationList');root.innerHTML='';const r=request();if(!r){renderTree();return}r.situations.forEach((s,i)=>{const d=document.createElement('div');d.className='situation-item'+(s.id===situationId?' active':'');if(s.id!==situationId){d.style.borderLeft='5px solid '+situationColor(i)}d.textContent=`${s.name||'Без названия'}   [${lvl(s.level)}/10]`;d.onclick=async()=>{if(String(s.id)===String(situationId))return;await guardDiagnosisEditorLeave(()=>{situationId=s.id;selected=null;renderSituationList()})};root.appendChild(d)});renderTree()}
function addTreeRow(root,cls,text,meta){const d=document.createElement('div');d.className='tree-row '+cls+(selected?.obj===meta.obj?' active-selection':'');const label=document.createElement('span');label.className='tree-row-label';label.textContent=text;d.appendChild(label);d.onclick=async()=>{if(selected?.type===meta.type&&String(selected?.obj?.id)===String(meta.obj?.id))return;await guardDiagnosisEditorLeave(()=>{selected=meta;renderTree()})};root.appendChild(d)}
function renderTree(){const s=situation(),root=$('#tree');root.innerHTML='';const r=request();if(s&&r){const i=r.situations.indexOf(s);$('#situationTitle').textContent=s.name||'Без названия';$('#situationTitle').style.background=situationBg(i);$('#situationTitle').style.color=situationColor(i);$('#situationInfo').textContent=`Дискомфорт: ${lvl(s.level)}/10`;$('#situationResult').value=s.result||'';$('#resultBlock').classList.remove('hidden')}else{$('#situationTitle').textContent='Выберите ситуацию';$('#situationTitle').style.background='transparent';$('#situationTitle').style.color='#202124';$('#situationInfo').textContent='';$('#resultBlock').classList.add('hidden');root.innerHTML='<div style="padding:16px;color:#888">Добавьте или выберите ситуацию.</div>';renderEditor();document.dispatchEvent(new CustomEvent('diagnostika:diagnosis-tree-rendered'));return}
(s.beliefs||[]).forEach((b,bi)=>{addTreeRow(root,'primary',`⌄ Первичное убеждение: ${b.text||'Не заполнено'} (${lvl(b.level)}/10)`,{type:'belief',obj:b,parent:s,index:bi});(b.feelings||[]).forEach((f,fi)=>{addTreeRow(root,'feeling',`⌄ ☑ ${f.text||'Вторичное чувство'} (${lvl(f.level)}/10)`,{type:'feeling',obj:f,parent:b,index:fi});(f.deep||[]).forEach((d,di)=>{addTreeRow(root,'deep',`⌄ Вторичное убеждение: ${d.text||'Не заполнено'} (${lvl(d.level)}/10)`,{type:'deep',obj:d,parent:f,index:di});(d.instincts||[]).forEach((x,ii)=>addTreeRow(root,'instinct',`Инстинкт ${ii+1}: ${x.name||'Не выбран'} (${lvl(x.level)}/10)`,{type:'instinct',obj:x,parent:d,index:ii}))})})});renderEditor();document.dispatchEvent(new CustomEvent('diagnostika:diagnosis-tree-rendered'))}
function renderEditor(){const map={belief:'Первичное убеждение',feeling:'Вторичное чувство',deep:'Вторичное убеждение',instinct:'Инстинкт'};$('#editorType').textContent=selected?map[selected.type]:'Элемент не выбран';$('#editorText').value=selected?(selected.obj.text??selected.obj.name??''):'';$('#editorLevel').value=selected?lvl(selected.obj.level):5;$('#editorComment').value=selected?(selected.obj.comment||''):'';$('#instinctFrame').classList.toggle('hidden',selected?.type!=='deep');if(selected?.type==='deep'){const arr=Array.isArray(selected.obj.instincts)?selected.obj.instincts:[];const x=arr[0]||{name:'',level:5,comment:''};$('#instinctSelectedLabel').textContent='Инстинкт 1';$('#instinctCombo').innerHTML='';INSTINCTS.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;$('#instinctCombo').appendChild(o)});$('#instinctCombo').value=x.name||'';$('#instinctLevel').value=lvl(x.level);$('#instinctComment').value=x.comment||''}document.dispatchEvent(new CustomEvent('diagnostika:diagnosis-editor-rendered'))}
function renderSessions(){document.dispatchEvent(new Event('diagnostika:sessions-changed'))}
function renderMode(){const diag=mode==='diagnosis';$('#diagnosisWorkspace').hidden=!diag;document.querySelector('.home-dashboard')?.toggleAttribute('hidden',diag);$('#centerPanel').classList.toggle('hidden',!diag);$('#rightPanel').classList.toggle('hidden',!diag);$('#diagnosticsLeft').classList.toggle('hidden',!diag);if(diag)renderTree();document.dispatchEvent(new CustomEvent('diagnostika:mode-rendered',{detail:{mode}}))}
function openDatabase(){const dlg=$('#clientDialog'),root=$('#clientDatabaseList');root.innerHTML='';state.clients.forEach(c=>{const r=document.createElement('div');r.className='db-row';const n=document.createElement('div');n.textContent=c.name||'Без имени';const city=document.createElement('div');city.textContent=c.city||'';const b=document.createElement('button');b.type='button';b.className='tk-btn';b.textContent='Открыть';b.onclick=()=>{clientId=c.id;requestId=null;situationId=null;selected=null;dlg.close();renderClient()};r.append(n,city,b);root.appendChild(r)});dlg.showModal()}
function download(name,text,type){const blob=new Blob([text],{type:type||'text/plain;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}

$('#dialogAddClientBtn').onclick=()=>{const c=newClient();state.clients.push(c);clientId=c.id;requestId=null;save();renderClient();if($('#clientDialog').open)$('#clientDialog').close()};
$('#clientBaseBtn').onclick=openDatabase;
$('#requestSelect').onchange=async e=>{const next=e.target.value;if(String(next)===String(requestId))return;const previous=requestId;const moved=await guardDiagnosisEditorLeave(()=>{requestId=next;situationId=null;selected=null;renderRequests()});if(!moved)e.target.value=previous||''};
$('#addRequestBtn').onclick=async()=>{await guardDiagnosisEditorLeave(()=>{const c=client();if(!c)return;const r=newRequest();c.requests.push(r);requestId=r.id;situationId=null;selected=null;save();renderRequests()})};
$('#deleteRequestBtn').onclick=async()=>{await guardDiagnosisEditorLeave(()=>{const c=client(),r=request();if(!c||!r)return;if(confirm('Удалить запрос?')){c.requests=c.requests.filter(x=>x.id!==r.id);requestId=c.requests[0]?.id||null;situationId=null;selected=null;save();renderRequests()}})};
$('#requestTitle').oninput=e=>{const r=request();if(!r)return;r.title=e.target.value;save();renderRequests()};
$('#editSituationBtn').onclick=async()=>{await guardDiagnosisEditorLeave(()=>{const c=client(),r=request(),s=situation(),api=window.DiagnostikaDiagnosis;if(!c||!r||!s||!api?.moduleAware)return;const changes={};const n=prompt('Название ситуации',s.name||'');if(n!==null)changes.name=n;const l=prompt('Дискомфорт 1–10',s.level);if(l!==null)changes.level=lvl(l);if(!Object.keys(changes).length)return;if(!api.updateSituation(s.id,changes,{client:c,requestId:r.id,source:'diagnosis-ui-situation-edit',render:false}))return;selected=null;renderSituationList()})};
$('#deleteSituationBtn').onclick=async()=>{await guardDiagnosisEditorLeave(()=>{const c=client(),r=request(),s=situation(),api=window.DiagnostikaDiagnosis;if(!c||!r||!s||!api?.moduleAware)return;if(confirm('Удалить ситуацию?')){if(!api.removeSituation(s.id,{client:c,requestId:r.id,source:'diagnosis-ui-situation-delete',render:false}))return;const live=request();situationId=live?.situations?.[0]?.id||null;selected=null;renderSituationList()}})};
$('#deleteElementBtn').onclick=async()=>{await guardDiagnosisEditorLeave(()=>{if(!selected)return;const ctx=diagnosisUiContext('diagnosis-ui-element-delete');if(!ctx)return;if(!ctx.api.removeElement(selected.type,selected.obj.id,ctx.options))return;selected=null;renderTree()})};
$('#saveElementBtn').onclick=()=>{saveDiagnosisEditorDraft({render:true})};
$('#saveInstinctBtn').onclick=()=>{saveDiagnosisEditorDraft({render:true})};
$('#addInstinctBtn').onclick=async()=>{await guardDiagnosisEditorLeave(()=>{if(selected?.type!=='deep')return;const ctx=diagnosisUiContext('diagnosis-ui-instinct-add');if(!ctx)return;const deepId=selected.obj.id,created=ctx.api.addInstinct(deepId,{},ctx.options);if(!created)return;selectDiagnosisElementById('deep',deepId);renderTree()})};
$('#saveResultBtn').onclick=()=>{const c=client(),r=request(),s=situation(),api=window.DiagnostikaDiagnosis;if(!c||!r||!s||!api?.moduleAware)return;api.updateSituation(s.id,{result:$('#situationResult').value},{client:c,requestId:r.id,source:'diagnosis-ui-situation-result',render:false})};
$('#exportTxtBtn').onclick=()=>{const c=client(),r=request(),api=window.DiagnostikaExport;if(!c||!r||api?.moduleAware!==true)return;const payload=api.diagnosisTxt(c,r,{source:'export-txt-app-fallback'});if(payload)api.download(payload,{source:'export-txt-app-fallback-download'});};
$('#hintBtn').onclick=()=>alert('Подсказки первичных убеждений: «Я недостаточно хорош(а)», «Я не справляюсь», «Со мной что-то не так», «Я недостоин(а)», «Меня отвергнут», «Я беспомощен/беспомощна».');
if(!state.clients.length){const c=newClient();state.clients.push(c);clientId=c.id;save()}
renderClient();renderMode();
