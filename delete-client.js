'use strict';

function clientLifecycleApi() {
  return window.DiagnostikaClients
    || window.DiagnostikaPlatform?.clients
    || window.DiagnostikaPlatform?.services?.clients
    || null;
}

function moveClientToTrashById(id) {
  if (!id) return false;
  const api = clientLifecycleApi();
  if (!api?.remove) {
    console.error('[Diagnostika] ClientService.remove is unavailable.');
    return false;
  }
  return !!api.remove(id, { source: 'delete-client' });
}
window.moveClientToTrashById = moveClientToTrashById;

function deleteCurrentClient() {
  const api = clientLifecycleApi();
  const current = api?.current?.() || (typeof client === 'function' ? client() : null);
  if (!current?.id) return false;
  return moveClientToTrashById(current.id);
}
window.deleteCurrentClient = deleteCurrentClient;

const deleteClientBtn = document.querySelector('#deleteClientBtn');
if (deleteClientBtn) deleteClientBtn.onclick = deleteCurrentClient;

// Базовый вариант окна базы. client-db-enhancements.js позже заменяет его
// расширенной таблицей. Бизнес-логика выбора/удаления уже остаётся в ClientService.
openDatabase = function() {
  const dlg = document.querySelector('#clientDialog');
  const root = document.querySelector('#clientDatabaseList');
  if (!dlg || !root) return;

  const api = clientLifecycleApi();
  const clients = api?.list?.() || [];
  root.innerHTML = '';

  clients.forEach(c => {
    const row = document.createElement('div');
    row.className = 'db-row';

    const name = document.createElement('div');
    name.textContent = c.name || 'Без имени';

    const city = document.createElement('div');
    city.textContent = c.city || '';

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'tk-btn';
    openBtn.textContent = 'Открыть';
    openBtn.onclick = () => {
      if (api?.select?.(c.id, { source: 'client-database-open' })) {
        dlg.close();
      }
    };

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'tk-btn';
    delBtn.textContent = 'Удалить';
    delBtn.onclick = () => {
      const removed = moveClientToTrashById(c.id);
      if (removed && dlg.open) openDatabase();
    };

    row.append(name, city, openBtn, delBtn);
    root.appendChild(row);
  });

  dlg.showModal();
};

const clientBaseBtn = document.querySelector('#clientBaseBtn');
if (clientBaseBtn) clientBaseBtn.onclick = openDatabase;
