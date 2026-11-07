'use strict';

(() => {
  const status = document.getElementById('appStartupStatus');
  const retry = document.getElementById('appReloadBtn');
  let failed = false;

  retry?.addEventListener('click', () => location.reload());

  function ready() {
    return !!(window.DiagnostikaCoreReady && window.DiagnostikaHomeDashboard && window.DiagnostikaDashboardSessions);
  }

  function showFailure(message) {
    failed = true;
    document.documentElement.classList.remove('diagnostika-dashboard-ready');
    if (!status) return;
    status.hidden = false;
    const title = status.querySelector('h2');
    const text = status.querySelector('p');
    if (title) title.textContent = 'Безопасный запуск остановлен';
    if (text) text.textContent = message || 'Часть приложения не прошла внутреннюю проверку. Данные сайта не очищайте; повторите загрузку.';
    if (retry) retry.hidden = false;
  }

  function update() {
    if (failed || !status || !ready()) return false;
    status.hidden = true;
    document.documentElement.classList.add('diagnostika-dashboard-ready');
    window.dispatchEvent(new Event('diagnostika:ready'));
    return true;
  }

  window.addEventListener('diagnostika:runtime-unhealthy', event => {
    const issues = Array.isArray(event.detail?.issues) ? event.detail.issues.filter(Boolean) : [];
    const suffix = issues.length ? ` Код проверки: ${issues.slice(0, 4).join(', ')}.` : '';
    showFailure('Внутренняя проверка приложения не пройдена.' + suffix + ' Данные сайта не очищайте; повторите загрузку.');
  });

  window.addEventListener('diagnostika:runtime-error', () => {
    showFailure('Не удалось загрузить системную проверку приложения. Данные сайта не очищайте; повторите загрузку.');
  });

  window.addEventListener('diagnostika:core-ready', update);
  window.addEventListener('diagnostika:dashboard-loaded', update);

  if (update()) return;

  setTimeout(() => {
    if (failed || update() || !status) return;
    const title = status.querySelector('h2');
    const text = status.querySelector('p');
    if (title) title.textContent = 'Приложение не загрузилось полностью';
    if (text) text.textContent = 'Проверьте соединение и повторите загрузку. Не очищайте данные сайта: в браузере могут храниться ваши клиенты и вложения.';
    if (retry) retry.hidden = false;
  }, 8000);
})();
