'use strict';

(() => {
  const style=document.createElement('style');
  style.id='sessionPaymentMotionLock';
  style.textContent=`
    .session-pay-status.unpaid,
    .session-editor-payment-state.unpaid,
    .hd-session-pay.unpaid,
    #clientPaymentBox.payment-attention{
      animation:none!important;
    }
    .session-pay-status,
    .session-editor-payment-state,
    .hd-session-pay,
    #clientPaymentBox.payment-attention{
      transform:none!important;
      transition:background-color .12s ease,border-color .12s ease,color .12s ease,filter .12s ease!important;
    }
  `;
  document.head.appendChild(style);
})();
