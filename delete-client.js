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
  const current = api?.current?.() || null;
  if (!current?.id) return false;
  return moveClientToTrashById(current.id);
}
window.deleteCurrentClient = deleteCurrentClient;

const deleteClientBtn = document.querySelector('#deleteClientBtn');
if (deleteClientBtn) deleteClientBtn.onclick = deleteCurrentClient;
