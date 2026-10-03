'use strict';

(() => {
  if (window.DiagnostikaDate) return;

  const pad2=value=>String(Number(value)||0).padStart(2,'0');
  const ISO_DATE=/^(\d{4})-(\d{2})-(\d{2})$/;

  function parse(value){
    if(value===null||value===undefined||value==='')return null;
    if(value instanceof Date){
      const copy=new Date(value.getTime());
      return Number.isNaN(copy.getTime())?null:copy;
    }
    if(typeof value==='number'){
      const d=new Date(value);
      return Number.isNaN(d.getTime())?null:d;
    }
    const raw=String(value).trim();
    const m=raw.match(ISO_DATE);
    if(m){
      const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0,0);
      return Number.isNaN(d.getTime())?null:d;
    }
    const d=new Date(raw);
    return Number.isNaN(d.getTime())?null:d;
  }

  function date(value,fallback='—'){
    const d=parse(value);
    if(!d)return fallback;
    return new Intl.DateTimeFormat('ru-RU',{
      day:'2-digit',month:'2-digit',year:'numeric'
    }).format(d);
  }

  function dateTime(value,fallback='—'){
    const d=parse(value);
    if(!d)return fallback;
    return new Intl.DateTimeFormat('ru-RU',{
      day:'2-digit',month:'2-digit',year:'numeric',
      hour:'2-digit',minute:'2-digit'
    }).format(d).replace(',','');
  }

  function longDate(value,fallback='—'){
    const d=parse(value);
    if(!d)return fallback;
    return new Intl.DateTimeFormat('ru-RU',{
      day:'numeric',month:'long',year:'numeric'
    }).format(d);
  }

  function dateWithTime(dateValue,timeValue,fallback='—'){
    const d=date(dateValue,fallback);
    if(d===fallback)return fallback;
    const raw=String(timeValue||'').trim();
    const m=raw.match(/^(\d{1,2}):(\d{2})/);
    return m?`${d} • ${pad2(m[1])}:${pad2(m[2])}`:d;
  }

  function isoInput(value){
    if(value===null||value===undefined||value==='')return '';
    const raw=String(value).trim();
    if(ISO_DATE.test(raw))return raw;
    const d=parse(value);
    if(!d)return '';
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }

  window.DiagnostikaDate=Object.freeze({
    version:'RU1',
    parse,
    date,
    dateTime,
    longDate,
    dateWithTime,
    isoInput
  });
})();
