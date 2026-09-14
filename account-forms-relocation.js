'use strict';

(() => {
  if (window.__diagnostikaAccountFormsRelocationReady) return;
  window.__diagnostikaAccountFormsRelocationReady = true;

  let moving = false;

  function findFormsButton(panel) {
    return [...panel.querySelectorAll('button')].find(btn => {
      if (btn.closest('.settings-account-content')) return false;
      return (btn.textContent || '').trim() === 'Анкеты / формы';
    }) || null;
  }

  function relocate() {
    if (moving) return;
    const panel = document.getElementById('settingsPanel');
    const account = panel?.querySelector('.settings-account-content');
    if (!panel || !account) return;

    const button = findFormsButton(panel);
    if (!button) return;

    moving = true;
    try {
      button.classList.add('account-forms-button');
      account.appendChild(button);
    } finally {
      moving = false;
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .settings-account-content .account-forms-button{
      width:100%!important;
      min-width:0!important;
      height:42px!important;
      margin:2px 0 0!important;
      box-sizing:border-box!important;
    }
  `;
  document.head.appendChild(style);

  function start() {
    relocate();
    const panel = document.getElementById('settingsPanel');
    if (!panel) {
      setTimeout(start, 100);
      return;
    }
    new MutationObserver(relocate).observe(panel, { childList: true, subtree: true });
  }

  start();
})();
