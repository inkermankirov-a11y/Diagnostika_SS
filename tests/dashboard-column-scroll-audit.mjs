import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('home-dashboard.css','utf8');
const loader=fs.readFileSync('app-loader.js','utf8');

assert.ok(css.includes('body:has(.home-dashboard:not([hidden])){overflow:hidden}'),'page scroll is not locked while dashboard is visible');
assert.ok(css.includes('.home-dashboard:not([hidden]){height:calc(100dvh - 76px);min-height:0;overflow:hidden}'),'dashboard is not viewport-bounded');
assert.ok(css.includes('.hd-main{overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}'),'middle column has no independent scroll');
assert.ok(css.includes('.hd-right{overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;padding-right:3px}'),'right column has no independent scroll');
assert.ok(css.includes('.hd-client-list{overscroll-behavior:contain;scrollbar-gutter:stable}'),'left client list scroll containment missing');
assert.ok(css.includes('.hd-hero-icon{width:150px;height:118px;position:relative;margin-bottom:24px;display:grid;place-items:center;flex:0 0 auto}'),'client hero/avatar can shrink inside the scroll column');
assert.ok(loader.includes('home-dashboard.css?v=20261002-avatar-fix-1'),'dashboard CSS cache key not bumped');

console.log('DASHBOARD_COLUMN_SCROLL_AUDIT_OK');
