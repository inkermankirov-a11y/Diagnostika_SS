import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('modules/header/flip-clock.css','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(css.includes('grid-template-columns:68px 16px 68px'),'clock columns are not symmetric');
assert.ok(css.includes('width:68px'),'flip cards are not enlarged');
assert.ok(css.includes('height:48px'),'flip cards are not taller');
assert.ok(css.includes("background:linear-gradient(#5d7188,#405268)"),'clock case does not match header panel theme');
assert.ok(css.includes('border:1px solid #3d4f66'),'clock border does not match header controls');
assert.equal(css.includes('#d2a56e'),false,'wood theme still remains');
assert.ok(index.includes('modules/header/flip-clock.css?v=20261002-symmetric-panel-1'),'clock CSS cache key missing');

console.log('FLIP_CLOCK_SYMMETRY_THEME_AUDIT_OK');
