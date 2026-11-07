'use strict';

(() => {
  const platform = window.DiagnostikaPlatform;
  if (!platform) return;

  const MODULE_ID = 'clients';

  async function install() {
    await platform.ready;
    const service = platform.services?.clients;
    if (!platform.modules || !service) throw new Error('Clients module dependencies are unavailable.');

    if (!platform.modules.get(MODULE_ID)) {
      platform.modules.register({
        id: MODULE_ID,
        roles: ['specialist', 'admin'],
        async init() {
          platform.clients = service;
          platform.events?.emit('clients:ready', {
            moduleId: MODULE_ID,
            role: platform.access?.currentRole?.() || null
          });
          return service;
        },
        async destroy() {
          if (platform.clients === service) platform.clients = null;
        }
      });
    }

    await platform.modules.start(MODULE_ID);
  }

  install().catch(error => {
    console.error('[DiagnostikaPlatform] clients module failed to initialize', error);
  });
})();
