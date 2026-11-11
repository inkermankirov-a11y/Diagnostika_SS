'use strict';

(() => {
  if(window.DiagnostikaSessionShortSummary)return;

  const HEADING='Краткие итоги сессии (ИИ):';
  const MAX_LENGTH=520;
  const MAX_LINES=3;
  function cleanLine(line){
    return String(line||'')
      .replace(/\*\*|__/g,'')
      .replace(/^\s*(?:#{1,6}\s*|[-•*]\s+|\d+[.)]\s*)/u,'')
      .replace(/\s+/g,' ')
      .trim();
  }
  function shorten(text,limit){
    if(text.length<=limit)return text;
    const piece=text.slice(0,limit+1);
    const space=piece.lastIndexOf(' ');
    return (space>limit*.65?piece.slice(0,space):piece.slice(0,limit)).trimEnd()+'…';
  }
  function normalize(raw){
    const lines=String(raw||'').replace(/\r/g,'').split(/\n+/)
      .map(cleanLine).filter(Boolean);
    if(!lines.length)return '';
    // Preferred response: "Обсудили: ...", "Проведено: ...",
    // "Результат: ...". Keep those facts, not generated headings.
    const known=/^(?:что обсуждали|обсуждали|обсудили|проведено|сделано|выполнено|результат|зафиксировано)\s*[:—–-]\s*(.*)$/iu;
    const selected=lines.filter(line=>known.test(line));
    if(selected.length){
      return shorten(selected.slice(0,MAX_LINES)
        .map(line=>shorten(line,165)).join('\n'),MAX_LENGTH);
    }
    // Model may return a paragraph instead of the requested format.
    // Keep at most three complete sentences with no markdown markup.
    const meaningful=lines.filter(line=>!/^итоги(?: сессии)?[:.]?$/iu.test(line));
    const prose=meaningful.join(' ').replace(/\s+/g,' ').trim();
    if(!prose)return '';
    const sentences=prose.match(/[^.!?]+(?:[.!?]+|$)/gu)||[];
    return shorten(sentences.slice(0,MAX_LINES).map(x=>x.trim()).filter(Boolean).join(' '),MAX_LENGTH);
  }
  function merge(existingNotes,previousSummary,newSummary){
    const notes=String(existingNotes||'');
    const previous=String(previousSummary||'').trim();
    const next=String(newSummary||'').trim();
    if(!next)return notes;
    const block=HEADING+'\n'+next;
    if(notes.includes(block))return notes;
    if(previous){
      const previousBlock=HEADING+'\n'+previous;
      if(notes.includes(previousBlock))return notes.replace(previousBlock,block);
    }
    return (notes.trim()?notes.replace(/\s+$/,'')+'\n\n':'')+block;
  }
  window.DiagnostikaSessionShortSummary=Object.freeze({
    normalize,merge,heading:HEADING,maxLength:MAX_LENGTH
  });
})();
