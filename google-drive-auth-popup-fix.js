'use strict';

(() => {
  if (window.__diagnostikaGoogleDrivePopupFixReady) return;
  window.__diagnostikaGoogleDrivePopupFixReady = true;

  const CLIENT_ID = String(window.DIAGNOSTIKA_GOOGLE_CLIENT_ID || '').trim();
  const DRIVE_SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.file';
  const TOKEN_KEY = 'diagnostika-google-drive-token-v2';
  const FOLDER_KEY = 'diagnostika-google-drive-folder-v2';
  const USER_KEY = 'diagnostika-google-drive-user-v2';
  const CONNECTED_KEY = 'diagnostika-google-drive-connected-v1';

  let googlePromise = null;
  let ensurePromise = null;

  function parse(raw) {
    try { return JSON.parse(raw || 'null'); }
    catch { return null; }
  }

  function getTokenRecord() {
    let raw = null;
    try { raw = sessionStorage.getItem(TOKEN_KEY); } catch {}
    if (!raw) {
      try {
        const legacy = localStorage.getItem(TOKEN_KEY);
        if (legacy) {
          raw = legacy;
          sessionStorage.setItem(TOKEN_KEY, legacy);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.setItem(CONNECTED_KEY, '1');
        }
      } catch {}
    }
    return parse(raw);
  }

  function setTokenRecord(value) {
    const raw = JSON.stringify(value);
    try { sessionStorage.setItem(TOKEN_KEY, raw); } catch {}
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  }

  function clearTokenRecord() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  }

  function getStored(key) {
    try {
      return parse(localStorage.getItem(key) || sessionStorage.getItem(key));
    } catch { return null; }
  }

  function setStored(key, value) {
    const raw = JSON.stringify(value);
    try { localStorage.setItem(key, raw); } catch {}
    try { sessionStorage.setItem(key, raw); } catch {}
  }

  function delStored(key) {
    try { localStorage.removeItem(key); } catch {}
    try { sessionStorage.removeItem(key); } catch {}
  }

  function rememberConnection() {
    try { localStorage.setItem(CONNECTED_KEY, '1'); } catch {}
  }

  function forgetConnection() {
    clearTokenRecord();
    delStored(FOLDER_KEY);
    delStored(USER_KEY);
    try { localStorage.removeItem(CONNECTED_KEY); } catch {}
  }

  function rememberedConnection() {
    try {
      if (localStorage.getItem(CONNECTED_KEY) === '1') return true;
      return Boolean(getStored(USER_KEY)?.email);
    } catch { return false; }
  }

  function token() {
    const value = getTokenRecord();
    return value?.access_token && Date.now() < Number(value.expires_at || 0) - 30000 ? value : null;
  }

  function validToken() {
    return Boolean(token());
  }

  function loadGoogle() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (googlePromise) return googlePromise;

    googlePromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) {
        const started = Date.now();
        const wait = () => {
          if (window.google?.accounts?.oauth2) return resolve();
          if (Date.now() - started > 10000) return reject(new Error('Google Identity Services не загрузился.'));
          setTimeout(wait, 50);
        };
        wait();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Не удалось загрузить авторизацию Google.'));
      document.head.appendChild(script);
    });

    return googlePromise;
  }

  async function loadUser(accessToken) {
    try {
      const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) return getStored(USER_KEY);
      const user = await response.json();
      setStored(USER_KEY, user);
      return user;
    } catch {
      return getStored(USER_KEY);
    }
  }

  function setCardConnected(user, statusText = '') {
    const card = document.querySelector('.gdrive-card');
    const connect = card?.querySelector('.gdrive-connect');
    const status = card?.querySelector('.gdrive-status');
    if (!card || !connect || !status) return;

    card.classList.add('connected');
    connect.classList.add('connected');
    connect.disabled = false;
    connect.textContent = 'Google Drive подключён';
    status.textContent = statusText || (user?.email ? `Подключён: ${user.email}` : 'Google Drive подключён');
  }

  function setCardNeedsAuth(message = 'Нужно восстановить доступ Google Drive') {
    const card = document.querySelector('.gdrive-card');
    const connect = card?.querySelector('.gdrive-connect');
    const status = card?.querySelector('.gdrive-status');
    if (!card || !connect || !status) return;

    if (rememberedConnection()) {
      card.classList.add('connected');
      connect.classList.add('connected');
      connect.textContent = 'Восстановить Google Drive';
    } else {
      card.classList.remove('connected');
      connect.classList.remove('connected');
      connect.textContent = 'Подключить Google Drive';
    }
    connect.disabled = false;
    status.textContent = message;
  }

  async function ensureToken(options = {}) {
    const interactive = options.interactive === true;
    const force = options.force === true;

    if (!force) {
      const current = token();
      if (current) return current;
    }
    if (!CLIENT_ID) throw new Error('Google OAuth ещё не настроен');
    // Google Identity Services may still flash an OAuth window even with prompt:''.
    // Background/silent calls must never start OAuth UI. Reauthorization is
    // allowed only from the explicit Google Drive connect/restore button.
    if (!interactive) {
      throw new Error('Доступ Google Drive нужно восстановить вручную.');
    }
    if (ensurePromise) return ensurePromise;

    ensurePromise = (async () => {
      await loadGoogle();

      return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (error, value) => {
          if (settled) return;
          settled = true;
          if (error) reject(error);
          else resolve(value);
        };

        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: DRIVE_SCOPE,
            callback: async response => {
              if (response?.error) {
                finish(new Error(response.error_description || response.error));
                return;
              }

              const accessToken = response?.access_token;
              if (!accessToken) {
                finish(new Error('Google не вернул токен доступа.'));
                return;
              }

              const record = {
                access_token: accessToken,
                expires_at: Date.now() + (Number(response.expires_in) || 3600) * 1000
              };
              setTokenRecord(record);
              rememberConnection();

              if (interactive) {
                delStored(FOLDER_KEY);
                delStored(USER_KEY);
              }

              const user = await loadUser(accessToken);
              setCardConnected(user);
              finish(null, record);
            },
            error_callback: error => {
              const type = String(error?.type || '');
              if (type === 'popup_failed_to_open') {
                finish(new Error(interactive
                  ? 'Браузер заблокировал окно Google. Разреши всплывающие окна и повтори подключение.'
                  : 'Тихое восстановление Google недоступно в этом браузере.'));
                return;
              }
              if (type === 'popup_closed') {
                finish(new Error(interactive ? 'Вход Google отменён.' : 'Тихое восстановление Google не выполнено.'));
                return;
              }
              finish(new Error('Не удалось получить доступ Google Drive.'));
            }
          });

          client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
        } catch (error) {
          finish(error);
        }
      });
    })();

    try {
      return await ensurePromise;
    } finally {
      ensurePromise = null;
    }
  }

  window.DiagnostikaGoogleDriveAuth = Object.freeze({
    ensureToken,
    validToken,
    rememberedConnection,
    forgetConnection
  });

  function install() {
    const card = document.querySelector('.gdrive-card');
    const connect = card?.querySelector('.gdrive-connect');
    const status = card?.querySelector('.gdrive-status');
    if (!card || !connect || !status) return false;
    if (connect.dataset.popupSafe === '1') return true;
    connect.dataset.popupSafe = '1';

    loadGoogle().catch(() => {});

    if (validToken()) {
      setCardConnected(getStored(USER_KEY));
    } else if (rememberedConnection()) {
      setCardNeedsAuth('Доступ Google Drive истёк. Нажмите «Восстановить Google Drive».');
    }

    connect.onclick = async () => {
      if (validToken()) return;
      connect.disabled = true;
      status.textContent = rememberedConnection() ? 'Восстанавливаю Google Drive…' : 'Открываю Google…';

      try {
        await ensureToken({ interactive: true, force: true });
      } catch (error) {
        setCardNeedsAuth(error?.message || 'Не удалось подключить Google Drive.');
      }
    };

    return true;
  }

  if (!install()) {
    let attempts = 0;
    const retry = () => {
      attempts += 1;
      if (install() || attempts >= 40) return;
      setTimeout(retry, 100);
    };
    setTimeout(retry, 0);
  }
})();
