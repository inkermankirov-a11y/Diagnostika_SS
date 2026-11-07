'use strict';

(() => {
  if(window.DiagnostikaCurrencyDefaultPair)return;
  const KEY='diagnostika-currency-default-pair-v1';
  const FALLBACK=Object.freeze({from:'USD',to:'RUB'});

  const isCode=value=>typeof value==='string'&&/^[A-Z]{3}$/.test(value);
  function read(){
    try{
      const entry=JSON.parse(localStorage.getItem(KEY)||'null');
      if(!entry||!isCode(entry.from)||!isCode(entry.to))return null;
      return {from:entry.from,to:entry.to};
    }catch(_){return null;}
  }

  function resolve(available){
    const codes=Array.isArray(available)?available.filter(isCode):[];
    const saved=read();
    if(saved&&codes.includes(saved.from)&&codes.includes(saved.to))return saved;
    const from=codes.includes(FALLBACK.from)?FALLBACK.from:codes[0]||FALLBACK.from;
    const to=codes.includes(FALLBACK.to)?FALLBACK.to:codes.find(code=>code!==from)||from;
    return {from,to};
  }

  function save(from,to,available){
    const codes=Array.isArray(available)?available.filter(isCode):[];
    if(!isCode(from)||!isCode(to)||!codes.includes(from)||!codes.includes(to))return false;
    try{
      localStorage.setItem(KEY,JSON.stringify({from,to}));
      return true;
    }catch(_){return false;}
  }

  window.DiagnostikaCurrencyDefaultPair=Object.freeze({
    read,resolve,save,
    fallback:FALLBACK
  });
})();
