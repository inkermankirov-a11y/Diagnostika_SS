'use strict';

/* Public informational notice. No storage, network, or personal data access. */
(() => {
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
      padding:12px 15px;
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
      font-size:12px!important;
      font-weight:850!important;
      line-height:1.4!important;
    }
    .home-dashboard #hdHomeView .hws-transfer-notice p{
      margin:0!important;
      font-size:12px!important;
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
    notice.setAttribute('role','note');
    notice.setAttribute('aria-label','Уведомление о смене адреса сайта');
    const title = document.createElement('span');
    title.className = 'hws-transfer-title';
    title.textContent = 'Важное уведомление';
    const message = document.createElement('p');
    message.innerHTML = 'В ближайшее время этот сайт будет перенесён на <strong>новый адрес</strong>. Новая ссылка появится здесь заранее. После переноса текущий адрес станет неактуальным. Следите за обновлениями, чтобы не потерять доступ.';
    notice.append(title,message);
    return notice;
  }

  function ensureNotice() {
    const home = document.querySelector('.home-dashboard #hdHomeView');
    if (!home) return;
    // If the home workspace already rendered the notice, avoid duplicates.
    if (home.querySelector('.hws-transfer-notice')) return;
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
