'use strict';
(() => {
  const status = document.getElementById('appStartupStatus');
  const retry = document.getElementById('appReloadBtn');
  retry?.addEventListener('click', () => location.reload());

  function coreReady() {
    const requestSelect = document.getElementById('requestSelect');
    const hintBtn = document.getElementById('hintBtn');
    return typeof window.client === 'function'
      && typeof window.save === 'function'
      && typeof window.renderClient === 'function'
      && typeof window.renderMode === 'function'
      && typeof requestSelect?.onchange === 'function'
      && typeof hintBtn?.onclick === 'function';
  }

  function ready() {
    return !!(coreReady() && window.DiagnostikaHomeDashboard && window.DiagnostikaDashboardSessions);
  }

  function update() {
    if (!status || !ready()) return false;
    status.hidden = true;
    document.documentElement.classList.add('diagnostika-dashboard-ready');
    window.dispatchEvent(new Event('diagnostika:ready'));
    return true;
  }

  window.addEventListener('diagnostika:dashboard-loaded', update);
  if (update()) return;
  setTimeout(() => {
    if (update() || !status) return;
    status.querySelector('h2').textContent = 'Приложение не загрузилось полностью';
    status.querySelector('p').textContent = 'Проверьте соединение и повторите загрузку. Не очищайте данные сайта: в браузере могут храниться ваши клиенты и вложения.';
    if (retry) retry.hidden = false;
  }, 8000);
})();
