'use strict';

/* Public informational notice. No storage, network, or personal data access. */
(() => {
  if (/^(www\.)?zabvenye\.com$/i.test(location.hostname)) return;
  if (window.__diagnostikaRelocationNoticeReady) return;
  window.__diagnostikaRelocationNoticeReady = true;

  const style = document.createElement('style');
  style.id = 'diagnostika-relocation-notice-style';
  style.textContent = `
    .home-dashboard #hdHomeView .hws-transfer-notice{
      box-sizing:border-box!important;
      display:flex!important;
      flex-direction:column;
      gap:5px;
      margin:0;
      min-width:0;
      padding:18px 20px;
      border:1px solid #dc9696!important;
      border-left:4px solid #bb4545!important;
      border-radius:11px;
      background:#fff7f7!important;
      box-shadow:0 2px 10px rgba(126,45,45,.06);
      color:#653636!important;
      font-family:'Segoe UI',Arial,sans-serif;
      visibility:visible!important;
      opacity:1!important;
    }
    .home-dashboard #hdHomeView .hws-transfer-title{
      color:#a53737!important;
      font-size:20px!important;
      font-weight:850!important;
      line-height:1.4!important;
    }
    .home-dashboard #hdHomeView .hws-transfer-notice p{
      margin:0!important;
      font-size:15px!important;
      line-height:1.5!important;
      color:#653636!important;
      overflow-wrap:anywhere;
    }
    .home-dashboard #hdHomeView .hws-transfer-notice strong{
      color:#952b2b!important;
      font-weight:850!important;
    }
    @media(max-width:530px){
      .home-dashboard #hdHomeView .hws-transfer-notice{padding:10px 12px}
    }
  `;
  document.head.appendChild(style);

  function makeNotice() {
    const notice = document.createElement('aside');
    notice.className = 'hws-transfer-notice';
    notice.dataset.migrationVersion='39';
    notice.setAttribute('role','note');
    notice.setAttribute('aria-label','Уведомление о смене адреса сайта');
    const title = document.createElement('span');
    title.className = 'hws-transfer-title';
    title.textContent = 'ВАЖНО: С 1 ДЕКАБРЯ — НОВЫЙ САЙТ';
    const message = document.createElement('p');
    message.innerHTML = 'До <strong>1 декабря 2026 года</strong> обязательно сохраните клиентскую базу на компьютере. Создайте отдельную папку <strong>Diagnostika</strong>, откройте «Хранилище», подключите папку и нажмите «Синхронизировать». Дождитесь успешного завершения. На новом сайте подключите эту же папку и проверьте данные. <strong>Google Drive на новой платформе временно недоступен. Переносите базу только через локальную папку.</strong> Для доступа запросите код приглашения у администратора.';
    const link=document.createElement('a');link.href='https://zabvenye.com/';link.target='_blank';link.rel='noopener noreferrer';link.textContent='ПЕРЕЙТИ НА ZABVENYE.COM';link.style.cssText='display:inline-block;align-self:flex-start;background:#a53737;color:white;padding:10px 16px;border-radius:8px;font-weight:800;text-decoration:none;margin-top:6px';
    notice.append(title,message,link);
    return notice;
  }

  function ensureNotice() {
    const home = document.querySelector('.home-dashboard #hdHomeView');
    if (!home) return;
    // If the home workspace already rendered the notice, avoid duplicates.
    const existing=home.querySelector('.hws-transfer-notice');
    if(existing?.dataset.migrationVersion==='39')return;
    if(existing)existing.remove();
    const workspace = home.querySelector('.hws-workspace') || home;
    const notice = makeNotice();
    const schedule = workspace.querySelector('.hws-schedule');
    const metrics = workspace.querySelector('.hws-metrics');
    if (schedule) workspace.insertBefore(notice,schedule);
    else if (metrics) metrics.insertAdjacentElement('afterend',notice);
    else workspace.prepend(notice);
  }

  let attached = false;
  function attach() {
    const home = document.querySelector('.home-dashboard #hdHomeView');
    if (!home || attached) return Boolean(home);
    attached = true;
    ensureNotice();
    // Recreate the message if another module redraws its home-workspace HTML.
    const observer = new MutationObserver(() => ensureNotice());
    observer.observe(home,{childList:true,subtree:true});
    document.addEventListener('diagnostika:dashboard-home-opened',ensureNotice);
    return true;
  }
  if (!attach()) {
    const observer = new MutationObserver(() => {
      if (attach()) observer.disconnect();
    });
    observer.observe(document.documentElement,{subtree:true,childList:true});
    document.addEventListener('DOMContentLoaded',attach,{once:true});
  }
})();
