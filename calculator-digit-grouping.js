'use strict';

(() => {
  if (window.DiagnostikaCalculatorDigitGrouping) return;

  const stripSpaces=value=>String(value??'').replace(/[\s\u00A0\u202F]/g,'');

  function groupNumberToken(token){
    const match=String(token).match(/^(\d+)([.,]\d*)?$/);
    if(!match) return token;
    const integer=match[1];
    const decimal=match[2]||'';
    const grouped=integer.replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    return grouped+decimal;
  }

  function formatExpression(value){
    const text=String(value??'');
    if(!text||/ошибка|error|erreur|fehler|errore/i.test(text)) return text;
    const raw=stripSpaces(text);
    return raw.replace(/\d+(?:[.,]\d*)?/g,groupNumberToken);
  }

  function syncScreen(){
    const screen=document.querySelector('.currency-calculator-direct .ccd-screen');
    if(!screen) return false;
    const formatted=formatExpression(screen.value);
    if(screen.value!==formatted) screen.value=formatted;
    return true;
  }

  document.addEventListener('click',e=>{
    if(!e.target?.closest?.('.currency-calculator-direct button')) return;
    queueMicrotask(syncScreen);
    setTimeout(syncScreen,0);
  });

  document.addEventListener('input',e=>{
    if(e.target?.matches?.('.currency-calculator-direct .ccd-screen')) syncScreen();
  },true);

  const observer=new MutationObserver(()=>syncScreen());
  observer.observe(document.body,{childList:true,subtree:true});

  setTimeout(syncScreen,0);
  window.DiagnostikaCalculatorDigitGrouping={refresh:syncScreen,format:formatExpression};
})();
