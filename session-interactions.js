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

  function confirmClientTrash(name) {
    if (!confirm(`Удалить клиента «${name}»?`)) return false;
    if (!confirm(`Подтверди ещё раз: клиента «${name}» действительно нужно удалить?`)) return false;
    return confirm(`ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ\n\nКлиент «${name}» будет перемещён в «Удалённые клиенты». Его можно будет восстановить.\n\nПереместить в корзину?`);
  }

  function clientsApi() {
    return window.DiagnostikaClients
      || window.DiagnostikaPlatform?.clients
      || window.DiagnostikaPlatform?.services?.clients
      || null;
  }

  // Тройная защита удаления клиента сохраняется, бизнес-логика живёт в ClientService.
  deleteCurrentClient = function() {
    const api = clientsApi();
    const c = api?.current?.() || (typeof client === 'function' ? client() : null);
    if (!c?.id) return false;
    const name = c.name || 'Без имени';
    if (!confirmClientTrash(name)) return false;
    return !!api?.remove?.(c.id, { source: 'session-interactions-client-delete' });
  };
  window.deleteCurrentClient = deleteCurrentClient;

  const deleteClientButton = document.querySelector('#deleteClientBtn');
  if (deleteClientButton) deleteClientButton.onclick = deleteCurrentClient;

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
