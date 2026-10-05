import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth=fs.readFileSync('google-drive-auth-popup-fix.js','utf8');
const safe=fs.readFileSync('google-drive-sync-safe.js','utf8');
const lazy=fs.readFileSync('google-drive-lazy-loader.js','utf8');
const worker=fs.readFileSync('google-drive-merge-worker.js','utf8');

assert(auth.includes("if (!interactive) {"),'Background Google auth guard is missing');
assert(auth.includes("Доступ Google Drive нужно восстановить вручную."),'Background Google auth does not stop silently');
assert.equal(auth.includes("ensureToken({ interactive: false })"),false,'Startup still tries silent OAuth');
assert(auth.includes("client.requestAccessToken({ prompt: interactive ? 'consent' : '' })"),'Explicit Google auth flow disappeared');

assert(safe.includes('async function ensureAuthToken(){'),'Safe sync auth helper missing');
assert.equal(safe.includes('auth.ensureToken({interactive:false'),false,'Auto sync can still launch OAuth');
assert.equal(safe.includes('if(!token()&&!rememberedConnection())return;'),false,'Auto sync still treats remembered connection as authorization');
assert.equal(safe.includes('if(token()||rememberedConnection())scheduleAutoSync'),false,'Auto sync still schedules without a valid token');
assert(safe.includes("new Worker('google-drive-merge-worker.js?v=20261005-client-archive-1')"),'Google merge worker cache marker is stale');

assert(lazy.includes("google-drive-auth-popup-fix.js?v=20261005-no-auto-oauth-1"),'Auth popup fix cache marker missing');
assert(lazy.includes("google-drive-sync-safe.js?v=20261005-no-auto-oauth-1&db=14d"),'Safe sync cache marker missing');

assert(worker.includes('merged.archivedClients=(merged.archivedClients||[]).filter'),'Permanent deletion is not applied to archived cloud clients');

console.log('GOOGLE_DRIVE_NO_POPUP_AUDIT_OK');
