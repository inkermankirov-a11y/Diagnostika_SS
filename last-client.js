'use strict';

(() => {
  const LAST_CLIENT_KEY = 'diagnostika-last-client-id';

  const rememberClient = () => {
    if (clientId) localStorage.setItem(LAST_CLIENT_KEY, clientId);
  };

  const originalRenderClient = renderClient;
  renderClient = function(){
    rememberClient();
    return originalRenderClient();
  };

  const savedId = localStorage.getItem(LAST_CLIENT_KEY);
  if (savedId && state.clients.some(c => c.id === savedId)) {
    clientId = savedId;
    requestId = null;
    situationId = null;
    selected = null;
    renderClient();
  } else if (clientId) {
    rememberClient();
  }
})();
