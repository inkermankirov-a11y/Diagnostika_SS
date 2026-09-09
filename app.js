'use strict';

const STORAGE_KEY = 'diagnostika-web-v1';
const PRIMARY_BELIEF_HINTS = [
  'Я недостаточно хорошая / хороший','Я недостаточно компетентная / компетентный','Я ничего не умею',
  'Я не справляюсь','Я не способна / не способен','Я слабая / слабый','Я глупая / глупый',
  'Я неудачница / неудачник','Я хуже других','Я недостойна / недостоин','Я не заслуживаю',
  'Я никому не нужна / не нужен','Меня не любят','Меня отвергнут','Со мной что-то не так',
  'Я всё делаю неправильно','Я не имею права ошибаться','Я не имею права проявляться',
  'Я должна / должен всё контролировать','Я один / одна','Я беспомощная / беспомощный'
];
const FEELINGS = ['Боль','Обида','Страх','Стыд','Вина','Грусть','Злость','Разочарование','Одиночество','Беспомощность','Тревога','Унижение','Зависть','Ревность'];
const INSTINCTS = ['Бей / атаковать','Беги / убежать','Замри / спрятаться'];

let state = loadState();
let currentClientId = state.clients[0]?.id || null;
let currentRequestId = null;
let saveTimer = null;

function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function level(v) { return Math.max(1, Math.min(10, Number(v) || 1)); }
function today() { return new Date().toISOString().slice(0,10); }

function newRequest(title='Новый запрос') { return { id:uid(), title, situations:[] }; }
function newSession() { return { id:uid(), date:today(), requestId:'', requestText:'', diagnosis:'', work:'', result:'', notes:'' }; }
function newClient() {
  return { id:uid(), name:'Новый клиент', phone:'', email:'', gender:'', birth:'', city:'', country:'', vk:'', telegram:'', max:'', cameWith:'', mainRequest:'', tried:'', didntHelp:'', desired:'', source:'', notes:'', sessions:[], requests:[] };
}
function newSituation() { return { id:uid(), name:'', level:5, comment:'', beliefs:[], result:'' }; }
function newBelief() { return { id:uid(), text:'', level:5, comment:'', feelings:[] }; }
function newFeeling() { return { id:uid(), text:'', level:5, comment:'', deep:[] }; }
function newDeep() { return { id:uid(), text:'', level:5, comment:'', instincts:[{ id:uid(), name:'', level:5, comment:'' }] }; }
function newInstinct() { return { id:uid(), name:'', level:5, comment:'' }; }

function migrateClient(c) {
  if (!Array.isArray(c.sessions)) c.sessions = [];
  if (!Array.isArray(c.requests)) c.requests = [];
  if (c.diagnosis && (c.diagnosis.request || c.diagnosis.situations?.length)) {
    const exists = c.requests.some(r => r._migratedLegacy);
    if (!exists) {
      c.requests.push({
        id: uid(),
        title: c.diagnosis.request || 'Старый диагностический запрос',
        situations: Array.isArray(c.diagnosis.situations) ? c.diagnosis.situations : [],
        _migratedLegacy: true
      });
    }
    delete c.diagnosis;
  }
  c.sessions = c.sessions.map(s => ({ id:s.id || uid(), date:s.date || today(), requestId:s.requestId || '', requestText:s.requestText || s.request || '', diagnosis:s.diagnosis || '', work:s.work || s.done || '', result:s.result || '', notes:s.notes || '' }));
  c.requests = c.requests.map(r => ({ id:r.id || uid(), title:r.title || r.request || 'Без названия', situations:Array.isArray(r.situations)?r.situations:[], _migratedLegacy:r._migratedLegacy || false }));
  return c;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.clients)) {
        parsed.clients = parsed.clients.map(migrateClient);
        parsed.version = 2;
        return parsed;
      }
    }
  } catch(e) { console.warn(e); }
  return { version:2, clients:[] };
}

function saveState() {
  state.version = 2;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const el = document.getElementById('saveStatus');
  if (el) el.textContent = `Сохранено ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`;
}
function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveState, 250); }
function currentClient() { return state.clients.find(c => c.id === currentClientId) || null; }
function currentRequest() {
  const c = currentClient();
  if (!c) return null;
  return c.requests.find(r => r.id === currentRequestId) || null;
}

const $ = s => document.querySelector(s);
const clientList = $('#clientList');

function renderClients() {
  const q = ($('#clientSearch').value || '').trim().toLowerCase();
  clientList.innerHTML = '';
  state.clients.filter(c => `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q)).forEach(c => {
    const b = document.createElement('button');
    b.className = 'client-item' + (c.id === currentClientId ? ' active' : '');
    b.innerHTML = '<span class="client-name"></span><span class="client-sub"></span>';
    b.querySelector('.client-name').textContent = c.name || 'Без имени';
    b.querySelector('.client-sub').textContent = c.phone || c.city || 'Нет контактов';
    b.onclick = () => {
      currentClientId = c.id;
      currentRequestId = c.requests[0]?.id || null;
      renderAll();
    };
    clientList.appendChild(b);
  });
}

const profileFields = {
  clientName:'name', clientPhone:'phone', clientEmail:'email', clientGender:'gender', clientBirth:'birth', clientCity:'city', clientCountry:'country', clientVk:'vk', clientTelegram:'telegram', clientMax:'max', clientCameWith:'cameWith', clientMainRequest:'mainRequest', clientTried:'tried', clientDidntHelp:'didntHelp', clientDesired:'desired', clientSource:'source', clientNotes:'notes'
};
for (const [id,key] of Object.entries(profileFields)) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => { const c=currentClient(); if(!c)return; c[key]=el.value; renderClients(); queueSave(); });
}

function renderProfile() {
  const c = currentClient(); if (!c) return;
  for (const [id,key] of Object.entries(profileFields)) document.getElementById(id).value = c[key] || '';
}

function renderSessions() {
  const c = currentClient();
  const root = $('#sessions');
  root.innerHTML = '';
  if (!c) return;
  if (!c.sessions.length) {
    root.innerHTML = '<div class="empty-inline">У клиента пока нет сессий.</div>';
    return;
  }
  c.sessions.forEach((s, index) => {
    const node = document.getElementById('sessionTemplate').content.firstElementChild.cloneNode(true);
    node.querySelector('.session-date').value = s.date || '';
    node.querySelector('.session-date').oninput = e => { s.date=e.target.value; queueSave(); };

    const link = node.querySelector('.session-request-link');
    link.innerHTML = '<option value="">— Без связи —</option>';
    c.requests.forEach(r => {
      const o=document.createElement('option'); o.value=r.id; o.textContent=r.title || 'Без названия'; link.appendChild(o);
    });
    link.value = s.requestId || '';
    link.onchange = e => { s.requestId=e.target.value; queueSave(); };

    const bindings = [
      ['.session-request-text','requestText'],['.session-diagnosis','diagnosis'],['.session-work','work'],['.session-result','result'],['.session-notes','notes']
    ];
    bindings.forEach(([sel,key])=>{ const el=node.querySelector(sel); el.value=s[key]||''; el.oninput=e=>{s[key]=e.target.value;queueSave();}; });
    node.querySelector('.delete-session').onclick = () => {
      if (confirm('Удалить эту сессию?')) { c.sessions.splice(index,1); saveState(); renderSessions(); }
    };
    root.appendChild(node);
  });
}

function renderRequestManager() {
  const c = currentClient(); if (!c) return;
  if (!currentRequestId || !c.requests.some(r=>r.id===currentRequestId)) currentRequestId = c.requests[0]?.id || null;
  const select = $('#requestSelect');
  select.innerHTML='';
  c.requests.forEach(r=>{ const o=document.createElement('option');o.value=r.id;o.textContent=r.title||'Без названия';select.appendChild(o); });
  if (currentRequestId) select.value=currentRequestId;
  $('#requestEmpty').classList.toggle('hidden', c.requests.length>0);
  $('#requestEditor').classList.toggle('hidden', c.requests.length===0);
  $('#deleteRequestBtn').disabled = c.requests.length===0;
  renderRequest();
}

function renderRequest() {
  const r=currentRequest();
  if(!r){ $('#situations').innerHTML=''; return; }
  $('#requestTitle').value=r.title||'';
  const root=$('#situations'); root.innerHTML='';
  r.situations.forEach((s,si)=>root.appendChild(renderSituation(r,s,si)));
}

function makeInput(value, placeholder, onInput, listValues=null) {
  const wrap=document.createElement('div');
  const input=document.createElement('input'); input.className='input'; input.value=value||''; input.placeholder=placeholder||'';
  if(listValues){ const list=document.createElement('datalist');const listId=`list-${uid()}`;list.id=listId;listValues.forEach(v=>{const o=document.createElement('option');o.value=v;list.appendChild(o);});input.setAttribute('list',listId);wrap.append(input,list);} else wrap.appendChild(input);
  input.addEventListener('input',()=>{onInput(input.value);queueSave();}); return wrap;
}
function makeLevel(value,onInput){const i=document.createElement('input');i.className='level-input';i.type='number';i.min='1';i.max='10';i.value=level(value);i.addEventListener('input',()=>{onInput(level(i.value));queueSave();});return i;}
function makeDelete(onClick){const b=document.createElement('button');b.className='icon-button danger-text';b.textContent='×';b.title='Удалить';b.onclick=onClick;return b;}
function makeComment(value,onInput){const t=document.createElement('textarea');t.className='textarea';t.placeholder='Комментарий';t.value=value||'';t.addEventListener('input',()=>{onInput(t.value);queueSave();});return t;}
function smallButton(text,onClick){const b=document.createElement('button');b.className='button ghost small';b.textContent=text;b.onclick=onClick;return b;}

function renderSituation(request,s,si){
  const node=document.getElementById('situationTemplate').content.firstElementChild.cloneNode(true);
  const name=node.querySelector('.situation-name');name.value=s.name||'';name.oninput=()=>{s.name=name.value;queueSave();};
  const lv=node.querySelector('.situation-level');lv.value=level(s.level);lv.oninput=()=>{s.level=level(lv.value);queueSave();};
  const com=node.querySelector('.situation-comment');com.value=s.comment||'';com.oninput=()=>{s.comment=com.value;queueSave();};
  const res=node.querySelector('.situation-result');res.value=s.result||'';res.oninput=()=>{s.result=res.value;queueSave();};
  node.querySelector('.delete-situation').onclick=()=>{if(confirm('Удалить ситуацию со всеми вложенными элементами?')){request.situations.splice(si,1);saveState();renderRequest();}};
  const beliefs=node.querySelector('.beliefs');s.beliefs.forEach((b,bi)=>beliefs.appendChild(renderBelief(s,b,bi)));
  node.querySelector('.add-belief').onclick=()=>{s.beliefs.push(newBelief());saveState();renderRequest();};
  return node;
}
function renderBelief(parent,b,bi){
  const card=document.createElement('div');card.className='belief-card';const row=document.createElement('div');row.className='row-editor';
  row.appendChild(makeInput(b.text,'Убеждение',v=>b.text=v,PRIMARY_BELIEF_HINTS));row.appendChild(makeLevel(b.level,v=>b.level=v));row.appendChild(makeDelete(()=>{parent.beliefs.splice(bi,1);saveState();renderRequest();}));row.appendChild(makeComment(b.comment,v=>b.comment=v));card.appendChild(row);
  const feelings=document.createElement('div');(b.feelings||[]).forEach((f,fi)=>feelings.appendChild(renderFeeling(b,f,fi)));card.appendChild(feelings);
  const actions=document.createElement('div');actions.className='nested-actions';actions.appendChild(smallButton('+ Вторичное чувство',()=>{if(!Array.isArray(b.feelings))b.feelings=[];b.feelings.push(newFeeling());saveState();renderRequest();}));card.appendChild(actions);return card;
}
function renderFeeling(parent,f,fi){
  const card=document.createElement('div');card.className='feeling-card';const row=document.createElement('div');row.className='row-editor';
  row.appendChild(makeInput(f.text,'Вторичное чувство',v=>f.text=v,FEELINGS));row.appendChild(makeLevel(f.level,v=>f.level=v));row.appendChild(makeDelete(()=>{parent.feelings.splice(fi,1);saveState();renderRequest();}));row.appendChild(makeComment(f.comment,v=>f.comment=v));card.appendChild(row);
  const deep=document.createElement('div');(f.deep||[]).forEach((d,di)=>deep.appendChild(renderDeep(f,d,di)));card.appendChild(deep);
  const a=document.createElement('div');a.className='nested-actions';a.appendChild(smallButton('+ Глубинное убеждение',()=>{if(!Array.isArray(f.deep))f.deep=[];f.deep.push(newDeep());saveState();renderRequest();}));card.appendChild(a);return card;
}
function renderDeep(parent,d,di){
  if(!Array.isArray(d.instincts))d.instincts=[];
  const card=document.createElement('div');card.className='deep-card';const row=document.createElement('div');row.className='row-editor';
  row.appendChild(makeInput(d.text,'Глубинное убеждение',v=>d.text=v,PRIMARY_BELIEF_HINTS));row.appendChild(makeLevel(d.level,v=>d.level=v));row.appendChild(makeDelete(()=>{parent.deep.splice(di,1);saveState();renderRequest();}));row.appendChild(makeComment(d.comment,v=>d.comment=v));card.appendChild(row);
  const ins=document.createElement('div');d.instincts.forEach((x,ii)=>ins.appendChild(renderInstinct(d,x,ii)));card.appendChild(ins);
  const a=document.createElement('div');a.className='nested-actions';a.appendChild(smallButton('+ Инстинкт',()=>{d.instincts.push(newInstinct());saveState();renderRequest();}));card.appendChild(a);return card;
}
function renderInstinct(parent,x,ii){
  const card=document.createElement('div');card.className='instinct-card';const row=document.createElement('div');row.className='row-editor';
  row.appendChild(makeInput(x.name,'Инстинкт',v=>x.name=v,INSTINCTS));row.appendChild(makeLevel(x.level,v=>x.level=v));row.appendChild(makeDelete(()=>{parent.instincts.splice(ii,1);saveState();renderRequest();}));row.appendChild(makeComment(x.comment,v=>x.comment=v));card.appendChild(row);return card;
}

function renderAll(){
  const c=currentClient();
  $('#emptyState').classList.toggle('hidden',!!c); $('#workspaceContent').classList.toggle('hidden',!c);
  renderClients();
  if(c){
    migrateClient(c);
    if(!currentRequestId) currentRequestId=c.requests[0]?.id||null;
    renderProfile(); renderSessions(); renderRequestManager();
  }
}

$('#addClientBtn').onclick=()=>{const c=newClient();state.clients.push(c);currentClientId=c.id;currentRequestId=null;saveState();renderAll();$('#clientName').focus();$('#clientName').select();};
$('#deleteClientBtn').onclick=()=>{const c=currentClient();if(!c)return;if(confirm(`Удалить клиента «${c.name||'Без имени'}» вместе со всеми сессиями и запросами?`)){state.clients=state.clients.filter(x=>x.id!==c.id);currentClientId=state.clients[0]?.id||null;currentRequestId=currentClient()?.requests[0]?.id||null;saveState();renderAll();}};
$('#clientSearch').addEventListener('input',renderClients);

$('#addSessionBtn').onclick=()=>{const c=currentClient();if(!c)return;c.sessions.unshift(newSession());saveState();renderSessions();};

$('#addRequestBtn').onclick=()=>{const c=currentClient();if(!c)return;const r=newRequest();c.requests.push(r);currentRequestId=r.id;saveState();renderRequestManager();$('#requestTitle').focus();$('#requestTitle').select();};
$('#deleteRequestBtn').onclick=()=>{const c=currentClient();const r=currentRequest();if(!c||!r)return;if(confirm(`Удалить запрос «${r.title||'Без названия'}» со всей диагностикой?`)){c.requests=c.requests.filter(x=>x.id!==r.id);c.sessions.forEach(s=>{if(s.requestId===r.id)s.requestId='';});currentRequestId=c.requests[0]?.id||null;saveState();renderSessions();renderRequestManager();}};
$('#requestSelect').onchange=e=>{currentRequestId=e.target.value;renderRequest();};
$('#requestTitle').oninput=e=>{const r=currentRequest();if(!r)return;r.title=e.target.value;queueSave();renderRequestManagerTitleOnly();renderSessions();};
function renderRequestManagerTitleOnly(){const r=currentRequest();const opt=[...$('#requestSelect').options].find(o=>o.value===currentRequestId);if(opt&&r)opt.textContent=r.title||'Без названия';}
$('#addSituationBtn').onclick=()=>{const r=currentRequest();if(!r)return;r.situations.push(newSituation());saveState();renderRequest();};

document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));document.querySelectorAll('.tab-page').forEach(p=>p.classList.remove('active'));document.getElementById(`${t.dataset.tab}Tab`).classList.add('active');});

function download(name,text,type='text/plain;charset=utf-8'){const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
$('#exportDbBtn').onclick=()=>download(`diagnostika-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(state,null,2),'application/json');
$('#importDbInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const parsed=JSON.parse(await f.text());if(!parsed||!Array.isArray(parsed.clients))throw new Error('Неверный формат');if(confirm('Импорт заменит текущую локальную базу. Продолжить?')){parsed.clients=parsed.clients.map(migrateClient);state=parsed;currentClientId=state.clients[0]?.id||null;currentRequestId=currentClient()?.requests[0]?.id||null;saveState();renderAll();}}catch(err){alert(`Не удалось импортировать: ${err.message}`);}finally{e.target.value='';}});

$('#exportTxtBtn').onclick=()=>{
  const c=currentClient(); if(!c)return alert('Сначала выберите клиента.');
  const r=currentRequest(); if(!r)return alert('Сначала выберите или создайте запрос.');
  let out=`ПСИХОЛОГИЧЕСКАЯ ДИАГНОСТИКА\n\nКлиент: ${c.name||''}\nЗапрос: ${r.title||''}\n\n`;
  r.situations.forEach((s,i)=>{
    out+=`СИТУАЦИЯ ${i+1}: ${s.name||''}\nУровень: ${level(s.level)}/10\n${s.comment?`Комментарий: ${s.comment}\n`:''}`;
    (s.beliefs||[]).forEach((b,bi)=>{out+=`\n  УБЕЖДЕНИЕ ${bi+1}: ${b.text||''} (${level(b.level)}/10)\n`;(b.feelings||[]).forEach((f,fi)=>{out+=`    ВТОРИЧНОЕ ЧУВСТВО ${fi+1}: ${f.text||''} (${level(f.level)}/10)\n`;(f.deep||[]).forEach((d,di)=>{out+=`      ГЛУБИННОЕ УБЕЖДЕНИЕ ${di+1}: ${d.text||''} (${level(d.level)}/10)\n`;(d.instincts||[]).forEach((x,ii)=>{out+=`        ИНСТИНКТ ${ii+1}: ${x.name||''} (${level(x.level)}/10)\n`;});});});});
    out+=`\nЖЕЛАЕМЫЙ РЕЗУЛЬТАТ\n${s.result||''}\n\n${'-'.repeat(60)}\n\n`;
  });
  download(`${(c.name||'client').replace(/[\\/:*?"<>|]/g,'_')}-${(r.title||'request').replace(/[\\/:*?"<>|]/g,'_')}.txt`,out);
};

window.addEventListener('beforeunload',saveState);
renderAll();
