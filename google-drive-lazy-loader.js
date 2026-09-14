'use strict';

(() => {
  if (window.__diagnostikaGoogleDriveLazyLoaderReady) return;
  window.__diagnostikaGoogleDriveLazyLoaderReady = true;

  let loading = false;
  let loaded = false;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-gdrive-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
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
      script.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
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
      for (let i = 0; i < 20 && !storageDialogReady(); i += 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      if (!storageDialogReady()) return;

      await loadScript('google-oauth-config.js?v=20260914-2');
      await loadScript('google-drive-storage.js?v=20260914-5');
      await loadScript('google-drive-sync-safe.js?v=20260914-1');
      loaded = true;
    } catch (error) {
      console.error('[Google Drive lazy loader]', error);
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
