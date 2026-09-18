'use strict';

(() => {
  const card = document.getElementById('diagnosisClientHeader');
  const diagnosticsLeft = document.querySelector('#diagnosticsLeft');
  if (!card) return;

  const compact = document.createElement('div');
  compact.id = 'diagnosisCompactClient';
  compact.className = 'diagnosis-compact-client';
  compact.innerHTML = `
    <button type="button" class="diagnosis-compact-back">← Назад к клиенту</button>
    <div class="diagnosis-compact-name"></div>
  `;
  card.prepend(compact);

  const style = document.createElement('style');
  style.textContent = `
    .diagnosis-compact-client{display:flex;align-items:center;gap:12px;padding:4px 2px 8px}
    .diagnosis-compact-back{border:1px solid #b8c5d6;border-radius:7px;background:linear-gradient(#fff,#e7edf4);color:#24364b;font-weight:700;padding:8px 12px;cursor:pointer;box-shadow:0 2px 3px rgba(15,23,42,.14);white-space:nowrap}
    .diagnosis-compact-back:hover{background:linear-gradient(#fff,#dce6f0)}
    .diagnosis-compact-name{font-size:16px;font-weight:800;color:#203047;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
    #diagnosisClientHeader{padding:8px 10px}
    body.diagnosis-active #diagnosticsLeft{display:block!important}
    @media (max-width:700px){
      .diagnosis-compact-client{gap:8px}
      .diagnosis-compact-back{padding:7px 9px;font-size:12px}
      .diagnosis-compact-name{font-size:14px}
    }
  `;
  document.head.appendChild(style);

  function sync(){
    const diag = typeof mode !== 'undefined' ? mode === 'diagnosis' : !document.querySelector('#centerPanel')?.classList.contains('hidden');
    document.body.classList.toggle('diagnosis-active', diag);
    if (diagnosticsLeft) diagnosticsLeft.classList.toggle('hidden', !diag);
    const c = typeof client === 'function' ? client() : null;
    const name = c?.name || 'Клиент';
    const nameEl = compact.querySelector('.diagnosis-compact-name');
    if (nameEl) nameEl.textContent = name;
  }

  compact.querySelector('.diagnosis-compact-back').addEventListener('click', () => {
    if (typeof mode !== 'undefined' && typeof renderMode === 'function') {
      if(typeof closeDiagnosisDialogs==='function')closeDiagnosisDialogs();
      mode = 'card';
      selected = null;
      renderMode();
      renderSessions();
    }
    setTimeout(sync, 0);
  });

  const observer = new MutationObserver(sync);
  const center = document.querySelector('#centerPanel');
  if (center) observer.observe(center, {attributes:true, attributeFilter:['class']});

  sync();
})();
