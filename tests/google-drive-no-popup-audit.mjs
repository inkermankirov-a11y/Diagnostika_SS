import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth=fs.readFileSync('google-drive-auth-popup-fix.js','utf8');
const safe=fs.readFileSync('google-drive-sync-safe.js','utf8');
const lazy=fs.readFileSync('google-drive-lazy-loader.js','utf8');
const worker=fs.readFileSync('google-drive-merge-worker.js','utf8');

assert(auth.includes("if (!interactive) {"),'Non-interactive Google auth is not blocked unconditionally');
assert(auth.includes("Откройте «Хранилище» и нажмите «Восстановить Google Drive»"),'Expired Google access does not direct the user to explicit restore');
assert(auth.includes("client.requestAccessToken({ prompt: '' })"),'Explicit Google reconnect still forces a new consent screen');
assert.equal(auth.includes("navigator.userActivation"),false,'Google auth can still be triggered from generic user activation');
assert.equal(auth.includes("installPassiveRestore"),false,'Passive Google OAuth restore is still installed');
assert.equal(auth.includes("restoreFromGesture"),false,'Generic click/key OAuth restore handler still exists');
assert.equal(auth.includes("document.addEventListener('pointerdown'"),false,'Pointer events can still trigger Google OAuth');
assert.equal(auth.includes("document.addEventListener('keydown'"),false,'Keyboard events can still trigger Google OAuth');
assert(auth.includes("diagnostika:google-drive-auth-restored"),'Google auth restore event is missing');

assert(safe.includes('const AUTO_SYNC_DEBOUNCE=5000;'),'Cross-device sync debounce is still too slow');
assert(safe.includes('const AUTO_SYNC_MIN_INTERVAL=15000;'),'Cross-device sync minimum interval is still too slow');
assert(safe.includes('const AUTO_SYNC_POLL_INTERVAL=60000;'),'Cross-device poll interval is still too slow');
assert(safe.includes("window.addEventListener('diagnostika:google-drive-auth-restored'"),'Auto sync does not resume immediately after Google access is restored');
assert(safe.includes('if(rememberedConnection())autoSyncPending=true;'),'Remembered Google connections are dropped when an access token expires');
assert(safe.includes("new Worker('google-drive-merge-worker.js?v=20261005-client-archive-1')"),'Google merge worker cache marker is stale');

assert(lazy.includes("google-drive-auth-popup-fix.js?v=20261007-explicit-oauth-only-1"),'Explicit-only auth cache marker missing');
assert(lazy.includes("google-drive-sync-safe.js?v=20261006-multidevice-2&db=14d"),'Multidevice safe sync cache marker missing');

assert(safe.includes('async function listFoldersByName(parentId,name){'),'Google sync does not enumerate duplicate Diagnostika folders');
assert(safe.includes("const files=await listNamedFiles(folder.id,'database.json');"),'Google sync does not enumerate every database.json');
assert(safe.includes('for(let index=1;index<copies.length;index++){'),'Google sync does not merge multiple cloud database copies');
assert(safe.includes('async function convergeRemoteCopies(remote,data){'),'Google sync does not converge duplicate cloud copies after merge');
assert(safe.includes('const accountEmail=await googleAccountEmail();'),'Google sync result does not identify the connected Google account');
assert(safe.includes('DiagnostikaRequestAI?.migrateLegacyKey?.()'),'Google sync does not migrate the legacy AI key before cloud merge');

assert(worker.includes('merged.archivedClients=(merged.archivedClients||[]).filter'),'Permanent deletion is not applied to archived cloud clients');

console.log('GOOGLE_DRIVE_EXPLICIT_OAUTH_ONLY_AUDIT_OK');
