'use strict';

(() => {
  const style=document.createElement('style');
  style.textContent=`
    .belief-hints-dialog{
      width:min(820px,94vw)!important;
      height:min(720px,88vh)!important;
      max-height:none!important;
      overflow:hidden!important;
    }
    .belief-hints-shell{
      height:100%!important;
      max-height:none!important;
      min-height:0!important;
      box-sizing:border-box!important;
    }
    .belief-hints-head{flex:0 0 auto!important}
    .belief-hints-search{flex:0 0 auto!important}
    .belief-hints-list{
      min-height:0!important;
      flex:1 1 auto!important;
      overflow:auto!important;
      align-content:start!important;
      gap:10px!important;
      padding:3px 5px 8px!important;
    }
    .belief-hint-item{
      min-height:54px!important;
      height:auto!important;
      align-items:flex-start!important;
      padding:11px 12px!important;
      line-height:1.35!important;
      white-space:normal!important;
      overflow:visible!important;
      text-overflow:clip!important;
      border-radius:10px!important;
    }
    .belief-hint-item > span:last-child{
      white-space:normal!important;
      overflow:visible!important;
      text-overflow:clip!important;
      word-break:normal!important;
      overflow-wrap:anywhere!important;
    }
    .belief-hint-num{
      padding-top:1px!important;
      flex:0 0 24px!important;
    }
    .belief-hint-item:hover{
      transform:translateY(-2px)!important;
      border-color:#6f9bd8!important;
      box-shadow:0 6px 16px rgba(45,85,145,.16)!important;
      background:#f8fbff!important;
    }
    @media(max-width:700px){
      .belief-hints-dialog{width:96vw!important;height:88vh!important}
      .belief-hints-list{grid-template-columns:1fr!important}
    }
  `;
  document.head.appendChild(style);
})();
