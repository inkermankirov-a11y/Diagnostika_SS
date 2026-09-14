'use strict';

(() => {
  if(window.__diagnostikaAccountSettingsLayoutFixReady) return;
  window.__diagnostikaAccountSettingsLayoutFixReady=true;

  const style=document.createElement('style');
  style.textContent=`
    #specialistSettings{display:none!important}
    .settings-profile-summary{padding:12px 8px 14px!important;gap:14px!important}
    .settings-profile-summary .settings-profile-avatar{
      width:68px!important;
      height:68px!important;
      min-width:68px!important;
      min-height:68px!important;
      border-radius:50%!important;
      overflow:hidden!important;
      font-size:20px!important;
      padding:0!important;
    }
    .settings-profile-summary .settings-profile-avatar img,
    .account-avatar-large .settings-profile-avatar img{
      width:100%!important;
      height:100%!important;
      object-fit:cover!important;
      border-radius:50%!important;
      display:block!important;
    }
    .settings-profile-name{font-size:14px!important}
    .settings-profile-sub{font-size:11px!important}
    .account-avatar-large .settings-profile-avatar{
      width:96px!important;
      height:96px!important;
      min-width:96px!important;
      min-height:96px!important;
      border-radius:50%!important;
      overflow:hidden!important;
      font-size:28px!important;
      padding:0!important;
    }
  `;
  document.head.appendChild(style);
})();
