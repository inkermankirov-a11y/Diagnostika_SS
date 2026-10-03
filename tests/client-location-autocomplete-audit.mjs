import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('modules/clients/ui/card.js','utf8');
const css=fs.readFileSync('modules/clients/ui/card.css','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(js.includes('id="ccCountrySuggestions"'),'country suggestions box missing');
assert.ok(js.includes('id="ccCitySuggestions"'),'city suggestions box missing');
assert.ok(js.includes('function levenshtein(a,b)'),'fuzzy typo matching missing');
assert.ok(js.includes('function cityMatches(rows,query,country)'),'city autocomplete logic missing');
assert.ok(js.includes('function countryMatches(rows,query)'),'country autocomplete logic missing');
assert.ok(js.includes('function correctionCandidate(kind,rows,value,country=\'\')'),'automatic correction logic missing');
assert.ok(js.includes("renderLocationSuggestions('country')"),'country suggestions are not rendered while typing');
assert.ok(js.includes("renderLocationSuggestions('city')"),'city suggestions are not rendered while typing');
assert.ok(js.includes("autocorrectLocation('country')"),'country typo correction on blur missing');
assert.ok(js.includes("autocorrectLocation('city')"),'city typo correction on blur missing');
assert.ok(css.includes('.cc-place-suggestions'),'location suggestion dropdown style missing');
assert.ok(css.includes('.cc-place-suggestion.correction'),'correction highlight style missing');
assert.ok(index.includes('modules/clients/ui/card.css?v=20261003-work-actions-2'),'client card CSS cache key missing');
assert.ok(index.includes('modules/clients/ui/card.js?v=20261003-work-actions-2'),'client card JS cache key missing');

console.log('CLIENT_LOCATION_AUTOCOMPLETE_AUDIT_OK');
