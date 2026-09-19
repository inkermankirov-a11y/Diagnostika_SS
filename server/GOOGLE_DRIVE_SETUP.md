# Google Drive OAuth for Diagnostika_SS

This folder contains the server-side part of Google Drive connection. End users do not enter Client ID or Client Secret in the interface.

## 1. Google Cloud

1. Create or select a Google Cloud project.
2. Enable **Google Drive API**.
3. Configure **OAuth consent screen**.
4. Create OAuth credentials of type **Web application**.
5. Add the production redirect URI exactly as:

   `https://YOUR_DOMAIN/auth/google/callback`

6. Copy the Client ID and Client Secret to the VPS `.env` file only.

The app requests these scopes:

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/drive.file`

`drive.file` is intentionally used instead of full Drive access.

## 2. VPS environment

From `server/`:

```bash
cp .env.example .env
npm install
```

Fill `.env`:

```env
PORT=3000
PUBLIC_BASE_URL=https://YOUR_DOMAIN
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
TOKEN_ENCRYPTION_KEY=...
NODE_ENV=production
```

Generate secrets:

```bash
openssl rand -hex 32
```

Use one generated value for `TOKEN_ENCRYPTION_KEY`. Use another long random value for `SESSION_SECRET`.

Never commit `.env` or the `server/data/` directory. `npm start` automatically reads `server/.env`; real environment variables take precedence.

## 3. Run

```bash
npm start
```

Health endpoint:

`GET /api/health`

Google OAuth routes:

- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /api/google-drive/status`
- `POST /api/google-drive/disconnect`
- `POST /api/google-drive/backup`
- `GET /api/google-drive/restore`

## 4. Reverse proxy

The public HTTPS domain should proxy `/auth/` and `/api/` to the Node process. The frontend can be served by the same Node process or by Nginx from the repository root.

Do not expose the `server/` directory as a public static directory. Server 12D blocks `/server`, `/.git`, `/.github`, `/tests`, `/n8n` and dot-prefixed paths even when Node serves the frontend itself. In production, still bind Node behind Nginx/firewall and route only the required endpoints.

## 5. Current behavior

After connection the server creates or reuses the `Diagnostika` folder in the user's Google Drive. The current implementation can store and restore `database.json` there. Refresh tokens are encrypted at rest using AES-256-GCM with `TOKEN_ENCRYPTION_KEY`.

Session attachments are not yet mirrored to Google Drive; this is a separate storage layer to add after the OAuth/backend is running.


## 6. Server 12D hardening

- backend/internal repository paths are not served as public static files;
- unknown `/api/*` and `/auth/*` routes do not fall through to the SPA;
- browser mutation requests are checked against `PUBLIC_BASE_URL` when an `Origin` header is present;
- the Google connection store is created with restrictive filesystem permissions where supported;
- a corrupted connection store is never silently replaced with an empty store;
- security headers and graceful SIGTERM/SIGINT shutdown are enabled;
- `PUBLIC_BASE_URL`, `PORT`, encryption-key format and OAuth session-secret length are validated before use.
