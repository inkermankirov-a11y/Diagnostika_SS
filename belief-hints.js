'use strict';

(() => {
  // Подсказки по убеждениям 1 отключены.
  const remove = () => {
    document.getElementById('hintBtn')?.remove();
    document.getElementById('beliefInlineHint')?.remove();
    document.querySelectorAll('.belief-hints-dialog').forEach(el => el.remove());
  };

  remove();
  new MutationObserver(remove).observe(document.body,{childList:true,subtree:true});
})();
