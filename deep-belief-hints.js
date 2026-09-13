'use strict';

(() => {
  // Подсказки по убеждениям 2 отключены.
  const remove = () => {
    document.getElementById('deepBeliefInlineHint')?.remove();
    document.querySelectorAll('.deep-belief-hints-dialog').forEach(el => el.remove());
  };

  remove();
  new MutationObserver(remove).observe(document.body,{childList:true,subtree:true});
})();
