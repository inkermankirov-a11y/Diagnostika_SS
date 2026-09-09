'use strict';

(() => {
  const btn=document.querySelector('#addSituationBtn');
  if(!btn) return;

  btn.onclick=()=>{
    const r=typeof request==='function'?request():null;
    if(!r) return alert('Сначала выбери или создай запрос клиента.');

    const dlg=document.createElement('dialog');
    dlg.className='situation-create-dialog';
    dlg.innerHTML=`
      <form method="dialog" class="situation-create-card">
        <div class="situation-create-title">Новая ситуация</div>
        <label>Ситуация
          <input id="newSituationName" type="text" autocomplete="off" placeholder="Например: Нужно попросить о помощи">
        </label>
        <label>Дискомфорт, 1–10
          <input id="newSituationLevel" type="number" min="1" max="10" value="5">
        </label>
        <div class="situation-create-actions">
          <button type="button" class="cancel">Отмена</button>
          <button type="submit" class="save">Добавить</button>
        </div>
      </form>`;

    const style=document.createElement('style');
    style.textContent=`
      .situation-create-dialog{border:0;padding:0;background:transparent}
      .situation-create-dialog::backdrop{background:rgba(15,23,42,.38);backdrop-filter:blur(5px)}
      .situation-create-card{width:min(460px,92vw);background:#f7f9fc;border:1px solid #c8d2df;border-radius:14px;padding:18px;box-shadow:0 18px 50px rgba(15,23,42,.24);display:grid;gap:14px}
      .situation-create-title{font-size:20px;font-weight:800;color:#1f2937}
      .situation-create-card label{display:grid;gap:6px;font-weight:700;color:#334155}
      .situation-create-card input{height:38px;border:1px solid #b9c5d3;border-radius:8px;padding:6px 10px;background:#fff;color:#111;outline:none}
      .situation-create-card input:focus{border-color:#4169e1;box-shadow:0 0 0 3px rgba(65,105,225,.12)}
      .situation-create-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:2px}
      .situation-create-actions button{border:0;border-radius:8px;padding:9px 16px;cursor:pointer;font-weight:700;transition:transform .12s ease,box-shadow .12s ease,filter .12s ease}
      .situation-create-actions button:hover{transform:translateY(-1px)}
      .situation-create-actions button:active{transform:translateY(1px)}
      .situation-create-actions .cancel{background:linear-gradient(#eef2f6,#dfe6ee);color:#334155;box-shadow:0 2px 5px rgba(15,23,42,.12)}
      .situation-create-actions .save{background:linear-gradient(#5d7df0,#4169e1);color:#fff;box-shadow:0 3px 7px rgba(65,105,225,.28)}
    `;
    document.head.appendChild(style);
    document.body.appendChild(dlg);

    const nameInput=dlg.querySelector('#newSituationName');
    const levelInput=dlg.querySelector('#newSituationLevel');
    const cancel=dlg.querySelector('.cancel');
    const form=dlg.querySelector('form');

    cancel.onclick=()=>dlg.close();
    form.onsubmit=e=>{
      e.preventDefault();
      const name=nameInput.value.trim();
      if(!name){
        nameInput.focus();
        nameInput.style.borderColor='#dc2626';
        return;
      }
      const s=typeof newSituation==='function'?newSituation():{id:typeof uid==='function'?uid():String(Date.now()),beliefs:[]};
      s.name=name;
      s.level=typeof lvl==='function'?lvl(levelInput.value):Math.max(1,Math.min(10,Number(levelInput.value)||5));
      r.situations.push(s);
      situationId=s.id;
      selected=null;
      if(typeof save==='function') save();
      if(typeof renderSituationList==='function') renderSituationList();
      dlg.close();
    };

    dlg.addEventListener('close',()=>{style.remove();dlg.remove();},{once:true});
    dlg.addEventListener('click',e=>{if(e.target===dlg) dlg.close();});
    dlg.showModal();
    requestAnimationFrame(()=>nameInput.focus());
  };
})();
