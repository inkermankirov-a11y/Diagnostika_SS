'use strict';

(() => {
  if (window.__diagnostikaGoogleDriveLazyLoaderReady) return;
  window.__diagnostikaGoogleDriveLazyLoaderReady = true;

  let loading = false;
  let loaded = false;
  let retryTimer = null;
  let attempts = 0;
  const TOKEN_KEY='diagnostika-google-drive-token-v2';
  const CONNECTED_KEY='diagnostika-google-drive-connected-v1';
  const USER_KEY='diagnostika-google-drive-user-v2';

  function hasGoogleSession() {
    try {
      if(localStorage.getItem(CONNECTED_KEY)==='1'||localStorage.getItem(USER_KEY))return true;
      const raw=sessionStorage.getItem(TOKEN_KEY)||localStorage.getItem(TOKEN_KEY);
      if(!raw)return false;
      const value=JSON.parse(raw);
      return Boolean(value?.access_token);
    } catch (_) {
      return false;
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-gdrive-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => { existing.remove(); reject(new Error(`Не удалось загрузить ${src}`)); }, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.gdriveSrc = src;
      script.onload = () => {
        script.dataset.loaded = '1';
        resolve();
      };
      script.onerror = () => { script.remove(); reject(new Error(`Не удалось загрузить ${src}`)); };
      document.head.appendChild(script);
    });
  }

  function storageDialogReady() {
    return Boolean(document.querySelector('.storage-dialog .storage-shell .storage-footer'));
  }

  async function loadGoogleDriveModule() {
    if (loaded || loading) return;
    loading = true;
    try {
      for (let i = 0; i < 100 && !storageDialogReady(); i += 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!storageDialogReady()) throw new Error('Окно хранилища ещё не готово. Подключение будет повторено.');

      await loadScript('google-oauth-config.js?v=20260914-2');
      await loadScript('google-drive-storage.js?v=20261005-no-auto-oauth-1&db=14d');
      await loadScript('google-drive-auth-popup-fix.js?v=20261111-auto-beacon-1');
      await loadScript('google-drive-sync-safe.js?v=20261111-gear-indicator-1');
      loaded = true;
      clearTimeout(retryTimer);
      retryTimer = null;
      attempts = 0;
    } catch (error) {
      console.warn('[Google Drive lazy loader]', error?.message || error);
      if (hasGoogleSession() && attempts < 12 && !retryTimer) {
        attempts += 1;
        retryTimer = setTimeout(() => {
          retryTimer = null;
          loadGoogleDriveModule();
        }, Math.min(30000, 1500 * attempts));
      }
    } finally {
      loading = false;
    }
  }

  function bind() {
    const button = document.getElementById('storageBtn');
    if (!button || button.dataset.googleDriveLazyBound === '1') return;
    button.dataset.googleDriveLazyBound = '1';
    button.addEventListener('click', () => setTimeout(loadGoogleDriveModule, 0));
  }

  function start(){
    bind();
    if(hasGoogleSession()) {
      // Load on every remembered connection, even when the storage dialog
      // is created later by another module. Retry instead of giving up.
      setTimeout(loadGoogleDriveModule,250);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
