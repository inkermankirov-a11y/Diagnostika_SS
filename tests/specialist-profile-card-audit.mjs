import fs from 'node:fs';
import assert from 'node:assert/strict';

const account=fs.readFileSync('account-settings.js','utf8');
const transfer=fs.readFileSync('modules/clients/ui/transfer.js','utf8');
const index=fs.readFileSync('index.html','utf8');

new Function(account);
new Function(transfer);

assert(index.includes('account-settings.js?v=20261003-specialist-card-1'),'Specialist profile cache marker missing');
assert(index.includes('modules/clients/ui/transfer.js?v=20261003-specialist-profile-1'),'Specialist transfer cache marker missing');
assert(account.includes('st.specialistProfile=profile'),'Specialist profile is not stored in application state');
assert(account.includes("save({source:'specialist-profile-migration'})"),'Legacy specialist profile migration is missing');
assert(account.includes("specialist-profile-card-save"),'Specialist profile save path missing');
assert(account.includes("account-title"),'Specialist title field missing');
assert(account.includes("account-experience"),'Specialist experience field missing');
assert(account.includes("account-areas"),'Specialist work areas field missing');
assert(account.includes("account-about"),'Specialist about field missing');
assert(account.includes("account-review-add"),'Specialist review editor missing');
assert(account.includes("account-photo-edit"),'Avatar thumbnail edit action missing');
assert(account.includes("avatar-zoom"),'Avatar zoom control missing');
assert(account.includes("profile.avatarSource||profile.avatar"),'Existing avatar cannot be reopened for editing');
assert(account.includes("profile.avatarCrop={x:pos.x,y:pos.y,zoom:pos.zoom}"),'Avatar crop state is not persisted');
assert(account.includes("getProfile:()=>clone(getProfile())"),'Full specialist profile API missing');
assert(transfer.includes("DiagnostikaSpecialistProfile?.getName?.()"),'Client transfer does not read the specialist profile API');

console.log('SPECIALIST_PROFILE_CARD_AUDIT_SUCCESS');