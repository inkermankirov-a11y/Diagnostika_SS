'use strict';

(() => {
  if (window.__diagnostikaQuestionnaireCompactLockReady) return;
  window.__diagnostikaQuestionnaireCompactLockReady = true;

  const style = document.createElement('style');
  style.textContent = `
    .cq-dialog{width:min(1180px,98vw)!important;max-height:94vh!important}
    .cq-card{padding:12px!important;border-radius:12px!important}
    .cq-head{padding-bottom:8px!important}
    .cq-title{font-size:17px!important}
    .cq-sub{font-size:12px!important;margin-top:2px!important}
    .cq-head button{font-size:20px!important}
    .cq-notice.show{margin-top:6px!important;padding:6px 8px!important}
    .cq-layout{grid-template-columns:260px minmax(0,1fr)!important;gap:10px!important;min-height:0!important;margin-top:10px!important}
    .cq-list{padding-right:8px!important;gap:6px!important;max-height:78vh!important}
    .cq-editor{max-height:78vh!important;padding-right:2px!important}
    .cq-add-manual{height:36px!important;border-radius:8px!important}
    .cq-item{padding:8px!important;border-radius:8px!important}
    .cq-date,.cq-primary{margin-top:3px!important}
    .cq-meta{margin-bottom:8px!important}
    .cq-grid{gap:8px!important}
    .cq-grid label,.cq-answer{gap:3px!important}
    .cq-grid input,.cq-answer textarea,.cq-question-input{padding:7px 8px!important;border-radius:7px!important;font-size:13px!important}
    .cq-answer{margin-top:7px!important}
    .cq-answer textarea{min-height:50px!important}
    .cq-manual-title{margin-top:10px!important}
    .cq-manual-hint{font-size:10px!important}
    .cq-manual-row{margin-top:6px!important;padding:7px!important;border-radius:8px!important;grid-template-columns:minmax(0,1fr) auto!important;gap:6px!important;align-items:start!important}
    .cq-manual-row.dragging,.cq-manual-row.drag-over{opacity:1!important;border-style:solid!important;box-shadow:none!important}
    .cq-drag,.cq-move-up,.cq-move-down{display:none!important}
    .cq-question-body{gap:5px!important}
    .cq-manual-row textarea{min-height:48px!important;max-height:96px!important;padding:7px 8px!important;border-radius:7px!important;font-size:13px!important;resize:vertical!important}
    .cq-question-input{padding:7px 8px!important;font-size:13px!important}
    .cq-question-controls{gap:0!important}
    .cq-question-controls button{width:28px!important;height:28px!important;border-radius:6px!important}
    .cq-add-question{margin-top:7px!important;height:32px!important}
    .cq-actions{gap:6px!important;margin-top:10px!important}
    .cq-actions button{height:34px!important;padding:0 10px!important}
    @media(max-width:760px){
      .cq-layout{grid-template-columns:1fr!important}
      .cq-list{max-height:180px!important}
      .cq-manual-row{grid-template-columns:minmax(0,1fr) auto!important}
      .cq-question-controls{grid-column:auto!important;flex-direction:column!important}
    }
  `;
  document.head.appendChild(style);

  function applyCompactMode() {
    const dialog = document.getElementById('clientQuestionnairesDialog');
    if (!dialog) return;

    dialog.querySelectorAll('.cq-manual-row').forEach(row => {
      row.draggable = false;
      row.removeAttribute('draggable');
      row.classList.remove('dragging','drag-over');
    });

    const hint = dialog.querySelector('.cq-manual-hint');
    if (hint) hint.textContent = 'Можно редактировать вопросы и ответы';
  }

  // Старые обработчики drag&drop остаются в исходном модуле для совместимости,
  // но перетаскивание блокируем до того, как они успеют сработать.
  document.addEventListener('dragstart', event => {
    const row = event.target?.closest?.('#clientQuestionnairesDialog .cq-manual-row');
    if (!row) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  // Диалог и строки создаются/перерисовываются динамически. Один лёгкий
  // обработчик клика приводит их в компактный режим без MutationObserver.
  document.addEventListener('click', () => setTimeout(applyCompactMode, 0), true);
  document.addEventListener('focusin', event => {
    if (event.target?.closest?.('#clientQuestionnairesDialog')) applyCompactMode();
  }, true);

  setTimeout(applyCompactMode, 0);
  setTimeout(applyCompactMode, 500);
})();
