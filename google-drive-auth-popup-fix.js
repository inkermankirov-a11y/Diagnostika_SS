'use strict';

(() => {
  if (window.__diagnostikaGoogleDrivePopupFixReady) return;
  window.__diagnostikaGoogleDrivePopupFixReady = true;

  const CLIENT_ID = String(window.DIAGNOSTIKA_GOOGLE_CLIENT_ID || '').trim();
  const DRIVE_SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.file';
  const TOKEN_KEY = 'diagnostika-google-drive-token-v2';
  const FOLDER_KEY = 'diagnostika-google-drive-folder-v2';
  const USER_KEY = 'diagnostika-google-drive-user-v2';

  let googlePromise = null;
  let tokenClient = null;

  function getSession(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); }
    catch { return null; }
  }

  function setSession(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify(value)); }
    catch {}
  }

  function delSession(key) {
    try { sessionStorage.removeItem(key); }
    catch {}
  }

  function validToken() {
    const value = getSession(TOKEN_KEY);
    return Boolean(value?.access_token && Date.now() < Number(value.expires_at || 0) - 30000);
  }

  function loadGoogle() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (googlePromise) return googlePromise;

    googlePromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) {
        const wait = () => {
          if (window.google?.accounts?.oauth2) return resolve();
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
      if (!response.ok) return null;
      const user = await response.json();
      setSession(USER_KEY, user);
      return user;
    } catch {
      return null;
    }
  }

  function install() {
    const card = document.querySelector('.gdrive-card');
    const connect = card?.querySelector('.gdrive-connect');
    const status = card?.querySelector('.gdrive-status');
    if (!card || !connect || !status) return false;
    if (connect.dataset.popupSafe === '1') return true;
    connect.dataset.popupSafe = '1';

    // Preload Google Identity Services before the user presses Connect.
    // This preserves the browser's user gesture for the popup request.
    loadGoogle().catch(() => {});

    connect.onclick = () => {
      if (validToken()) return;
      if (!CLIENT_ID) {
        status.textContent = 'Google OAuth ещё не настроен';
        return;
      }

      // Never wait for a script and then open OAuth in the same click: browsers
      // may classify that popup as unsolicited and block it.
      if (!window.google?.accounts?.oauth2) {
        status.textContent = 'Подготавливаю вход Google… Нажмите «Подключить Google Drive» ещё раз через секунду.';
        loadGoogle()
          .then(() => { status.textContent = 'Google готов. Нажмите «Подключить Google Drive» ещё раз.'; })
          .catch(error => { status.textContent = error.message || 'Не удалось загрузить Google.'; });
        return;
      }

      connect.disabled = true;
      status.textContent = 'Открываю Google…';

      try {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: DRIVE_SCOPE,
          callback: async response => {
            connect.disabled = false;
            if (response?.error) {
              status.textContent = `Google: ${response.error}`;
              return;
            }

            const accessToken = response?.access_token;
            if (!accessToken) {
              status.textContent = 'Google не вернул токен доступа.';
              return;
            }

            setSession(TOKEN_KEY, {
              access_token: accessToken,
              expires_at: Date.now() + (Number(response.expires_in) || 3600) * 1000
            });
            delSession(FOLDER_KEY);
            delSession(USER_KEY);

            const user = await loadUser(accessToken);
            card.classList.add('connected');
            connect.classList.add('connected');
            connect.textContent = 'Google Drive подключён';
            status.textContent = user?.email ? `Подключён: ${user.email}` : 'Google Drive подключён';
          },
          error_callback: error => {
            connect.disabled = false;
            const type = String(error?.type || '');
            if (type === 'popup_failed_to_open') {
              status.textContent = 'Браузер заблокировал окно Google. Разрешите всплывающие окна для этого сайта и нажмите «Подключить Google Drive» ещё раз.';
              return;
            }
            if (type === 'popup_closed') {
              status.textContent = 'Вход Google отменён. Нажмите «Подключить Google Drive», чтобы попробовать снова.';
              return;
            }
            status.textContent = 'Не удалось открыть вход Google. Попробуйте ещё раз.';
          }
        });

        // Important: requestAccessToken is called synchronously from the user's click.
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (error) {
        connect.disabled = false;
        status.textContent = error?.message || 'Не удалось открыть вход Google.';
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
