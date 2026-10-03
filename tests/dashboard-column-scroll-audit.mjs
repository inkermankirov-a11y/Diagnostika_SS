import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('home-dashboard.css','utf8');
const loader=fs.readFileSync('app-loader.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(css.includes('body:has(.home-dashboard:not([hidden])){overflow:hidden!important}'),'page scroll is not locked while dashboard is visible');
assert.ok(css.includes('body:has(.home-dashboard:not([hidden])) .desktop-app{height:100dvh;min-height:0!important;padding-bottom:0!important;overflow:hidden}'),'desktop app is not viewport-bounded');
assert.ok(css.includes('.home-dashboard:not([hidden]){height:calc(100dvh - 84px);min-height:0!important;overflow:hidden}'),'dashboard height does not match fixed header');
assert.ok(css.includes('.home-dashboard:not([hidden]) > .hd-main{overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;scrollbar-gutter:stable}'),'middle column independent scrolling is not enforced');
assert.ok(css.includes('.home-dashboard:not([hidden]) > .hd-main > .hd-main-inner{flex:0 0 auto;min-height:100%}'),'middle column content can still be clipped/compressed');
assert.ok(css.includes('.home-dashboard:not([hidden]) > .hd-right{overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;scrollbar-gutter:stable;padding-right:3px}'),'base right column independent scrolling is not enforced');
assert.ok(css.includes('.home-dashboard:not([hidden]) > .hd-right{\n    direction:rtl;'),'desktop right-column left scrollbar override missing');
assert.ok(css.includes('.home-dashboard > .hd-right{\n    grid-column:auto!important;'),'narrow desktop right column no longer remains a third column');
assert.ok(css.includes('@media(min-width:821px) and (max-width:1180px)'),'responsive third-column range is missing');
assert.ok(css.includes('@media(max-height:650px) and (min-width:821px)'),'short-window AI viewport adjustment is missing');
assert.ok(css.includes('height:calc(100dvh - 104px)!important'),'right rail is not hard-bounded to the browser viewport');
assert.ok(css.includes('height:calc(100dvh - 108px)!important'),'stacked/narrow right rail is not viewport-bounded');
assert.ok(css.includes('overflow-y:scroll!important'),'right rail does not expose a guaranteed scrollbar');
assert.ok(css.includes('.home-dashboard:not([hidden]) .hd-client-list{overflow-y:auto!important;overscroll-behavior:contain;scrollbar-gutter:stable}'),'left column independent scrolling is not enforced');
assert.ok(css.includes('.hd-hero-icon{width:150px;height:118px;position:relative;margin-bottom:24px;display:grid;place-items:center;flex:0 0 auto}'),'client avatar shrink protection missing');
assert.ok(css.includes('height:84px!important;min-height:84px!important;padding:12px 24px!important;align-items:center!important'),'header vertical spacing is not enforced');
assert.ok(loader.includes('home-dashboard.css?v=20261003-right-scroll-8'),'dashboard CSS cache key not bumped');
assert.ok(index.includes('aicolumn=20261003-8'),'app-loader AI-column cache key not bumped');

const baseMain=css.indexOf('.hd-main{min-height:calc(100vh - 108px);display:flex;flex-direction:column;overflow:hidden}');
const desktopMain=css.lastIndexOf('.home-dashboard:not([hidden]) > .hd-main{overflow-y:auto!important');
assert.ok(baseMain>=0&&desktopMain>baseMain,'desktop middle-column scroll rule must come after the base overflow:hidden rule');

console.log('DASHBOARD_COLUMN_SCROLL_AUDIT_OK');
