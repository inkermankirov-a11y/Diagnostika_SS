'use strict';

(() => {
  function tripleConfirm(kind, name) {
    if (!confirm(`Удалить ${kind} «${name}»?`)) return false;
    if (!confirm(`Подтверди ещё раз: ${kind} «${name}» действительно нужно удалить?`)) return false;
    return confirm(`ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ\n\n${kind} «${name}» будет удалён без возможности восстановления.\n\nУдалить окончательно?`);
  }

  async function deleteSessionMedia(sessionId) {
    if (!sessionId || typeof mediaDbList !== 'function' || typeof mediaDbDelete !== 'function') return;
    try {
      const files = await mediaDbList(sessionId);
      for (const file of files) await mediaDbDelete(file.id);
    } catch (e) {
      console.warn('Не удалось удалить все вложения сессии', e);
    }
  }

  // Тройная защита удаления клиента.
  deleteCurrentClient = function() {
    const c = client();
    if (!c) return;
    const name = c.name || 'Без имени';
    if (!tripleConfirm('клиента', name)) return;

    const index = state.clients.findIndex(x => x.id === c.id);
    if (index < 0) return;

    state.clients.splice(index, 1);
    if (!state.clients.length) {
      const replacement = newClient();
      state.clients.push(replacement);
      clientId = replacement.id;
    } else {
      clientId = state.clients[Math.min(index, state.clients.length - 1)].id;
    }

    requestId = null;
    situationId = null;
    selected = null;
    mode = 'card';
    save();
    renderClient();
  };

  // Добавляем удаление внутрь редактора сессии.
  const previousOpenSessionEditor = openSessionEditor;
  openSessionEditor = function(c, s, number) {
    previousOpenSessionEditor(c, s, number);

    const dialogs = [...document.querySelectorAll('dialog.session-edit-dialog')];
    const dlg = dialogs[dialogs.length - 1];
    if (!dlg) return;
    const actions = dlg.querySelector('.session-edit-actions');
    if (!actions || actions.querySelector('.session-delete-btn')) return;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'session-delete-btn';
    deleteBtn.textContent = 'Удалить сессию';
    deleteBtn.onclick = async () => {
      if (!tripleConfirm('сессию', `№${number}`)) return;

      await deleteSessionMedia(s.id);
      const index = c.sessions.indexOf(s);
      if (index >= 0) c.sessions.splice(index, 1);
      if (typeof selectedSessionId !== 'undefined' && selectedSessionId === s.id) selectedSessionId = null;
      save();
      dlg.close();
      renderSessions();
    };

    actions.insertBefore(deleteBtn, actions.firstChild);
  };

})();
