'use strict';

(() => {
  if (window.__diagnostikaCurrencyToolsFixReady) return;
  window.__diagnostikaCurrencyToolsFixReady = true;

  const style=document.createElement('style');
  style.textContent=`
    .utility-overlay .currency-field{font-size:14px!important;font-weight:800!important;color:#42556d!important;gap:7px!important}
    .utility-overlay .currency-field select,.utility-overlay .currency-field input{height:48px!important;font-size:16px!important;font-weight:700!important;padding:0 12px!important}
    .utility-overlay .currency-amount-wrap{margin-top:14px!important}
    .utility-overlay .currency-result{margin-top:14px!important;padding:18px!important}
    .utility-overlay .currency-result-main{font-size:30px!important;line-height:1.1!important;font-weight:900!important}
    .utility-overlay .currency-rate{margin-top:8px!important;font-size:15px!important;line-height:1.35!important;color:#51657d!important;font-weight:600!important}
    .utility-overlay .utility-source{margin-top:14px!important;font-size:13px!important;line-height:1.35!important;color:#64748b!important;font-weight:700!important}
    @media(max-width:560px){.utility-overlay .currency-result-main{font-size:26px!important}}
  `;
  document.head.appendChild(style);
})();
