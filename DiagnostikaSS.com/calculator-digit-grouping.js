'use strict';

(() => {
  if (window.DiagnostikaCalculatorDigitGrouping) return;

  const MAX_DIGITS=12;
  const stripSpaces=value=>String(value??'').replace(/[\s\u00A0\u202F]/g,'');
  let freshResult=false;

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

  function fitScreen(screen){
    if(!screen)return;
    const len=String(screen.value||'').length;
    let size=38;
    if(len>15)size=30;
    if(len>22)size=24;
    if(len>30)size=18;
    screen.style.fontSize=size+'px';
  }

  function syncScreen(){
    const screen=document.querySelector('.currency-calculator-direct .ccd-screen');
    if(!screen) return false;
    const formatted=formatExpression(screen.value);
    if(screen.value!==formatted) screen.value=formatted;
    fitScreen(screen);
    return true;
  }

  function currentTokenDigitCount(value){
    const raw=stripSpaces(value);
    const match=raw.match(/(\d+(?:[.,]\d*)?)$/);
    if(!match)return 0;
    return (match[1].match(/\d/g)||[]).length;
  }

  // Run before the calculator's own bubbling click handler, so an extra digit
  // never reaches the screen once the current number already has 12 digits.
  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('.currency-calculator-direct button');
    if(!btn)return;
    const screen=document.querySelector('.currency-calculator-direct .ccd-screen');
    if(!screen)return;

    const action=btn.dataset.action||'';
    const key=btn.dataset.k||'';

    if(action==='equals'||action==='mr'||['sign','sqrt','square','inverse'].includes(action)){
      setTimeout(()=>{freshResult=true;syncScreen();},0);
      return;
    }

    if(action==='clear'){
      freshResult=false;
      return;
    }

    if(/^\d$/.test(key)){
      // The base calculator clears a finished result when a new number starts.
      if(freshResult){freshResult=false;return;}
      if(currentTokenDigitCount(screen.value)>=MAX_DIGITS){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      freshResult=false;
      return;
    }

    if(key===','){
      if(freshResult)freshResult=false;
      return;
    }

    if(key)freshResult=false;
  },true);

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

  window.addEventListener('resize',()=>syncScreen());
  setTimeout(syncScreen,0);
  window.DiagnostikaCalculatorDigitGrouping={refresh:syncScreen,format:formatExpression,maxDigits:MAX_DIGITS};
})();
