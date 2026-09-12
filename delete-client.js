'use strict';

function moveClientToTrashById(id) {
  if (!id) return false;
  if (!Array.isArray(state.clients)) state.clients = [];
  if (!Array.isArray(state.deletedClients)) state.deletedClients = [];
  if (!Array.isArray(state.deletedClientTombstones)) state.deletedClientTombstones = [];

  const index = state.clients.findIndex(x => x && x.id === id);
  if (index < 0) return false;

  const c = state.clients[index];
  const archived = JSON.parse(JSON.stringify(c));
  archived.deletedAt = new Date().toISOString();

  state.deletedClients = state.deletedClients.filter(x => x && x.id !== id);
  state.deletedClients.push(archived);
  state.deletedClientTombstones = state.deletedClientTombstones.filter(x => x !== id);

  state.clients.splice(index, 1);

  if (!state.clients.length) {
    const replacement = newClient();
    state.clients.push(replacement);
    clientId = replacement.id;
  } else if (clientId === id || !state.clients.some(x => x.id === clientId)) {
    clientId = state.clients[Math.min(index, state.clients.length - 1)].id;
  }

  requestId = null;
  situationId = null;
  selected = null;
  mode = 'card';
  save();
  renderClient();
  return true;
}

window.moveClientToTrashById = moveClientToTrashById;

function deleteCurrentClient() {
  const c = client();
  if (!c) return false;
  return moveClientToTrashById(c.id);
}
window.deleteCurrentClient = deleteCurrentClient;

const deleteClientBtn = document.querySelector('#deleteClientBtn');
if (deleteClientBtn) deleteClientBtn.onclick = deleteCurrentClient;

// Базовый вариант окна базы. Позже client-db-enhancements.js заменяет его
// расширенной таблицей, но обе версии используют одну функцию удаления по ID.
const originalOpenDatabase = openDatabase;
openDatabase = function() {
  const dlg = document.querySelector('#clientDialog');
  const root = document.querySelector('#clientDatabaseList');
  root.innerHTML = '';

  state.clients.forEach(c => {
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
      clientId = c.id;
      requestId = null;
      situationId = null;
      selected = null;
      dlg.close();
      renderClient();
    };

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'tk-btn';
    delBtn.textContent = 'Удалить';
    delBtn.onclick = () => {
      moveClientToTrashById(c.id);
      if (dlg.open) openDatabase();
    };

    row.append(name, city, openBtn, delBtn);
    root.appendChild(row);
  });

  dlg.showModal();
};

const clientBaseBtn = document.querySelector('#clientBaseBtn');
if (clientBaseBtn) clientBaseBtn.onclick = openDatabase;
