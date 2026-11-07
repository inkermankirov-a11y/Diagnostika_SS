import assert from 'node:assert/strict';
import fs from 'node:fs';

const home=fs.readFileSync('home-dashboard.js','utf8');
const css=fs.readFileSync('home-dashboard.css','utf8');
const loader=fs.readFileSync('app-loader.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(home.includes('id="hdClientBaseSlot"'),'client button slot missing');
assert.ok(home.includes("document.getElementById('clientBaseBtn')"),'existing Clients button is not reused');
assert.ok(home.includes("clientBaseSlot.appendChild(clientBaseButton)"),'Clients button is not moved into sidebar');
assert.ok(home.includes("clientBaseButton.textContent='Клиенты'"),'Clients button label is not normalized');
assert.ok(home.includes("window.dispatchEvent(new Event('resize'))"),'clock visibility is not recalculated after moving Clients button');
assert.ok(css.includes('.hd-client-base-btn'),'sidebar Clients button styling missing');
assert.ok(loader.includes('home-dashboard.css?v=20261002-client-button-clock-1'),'dashboard CSS cache key missing');
assert.ok(loader.includes('home-dashboard.js?v=20261002-client-button-clock-1'),'dashboard JS cache key missing');
assert.ok(index.includes('app-loader.js?v=20261002-client-button-clock-1'),'app-loader cache key missing');

console.log('CLIENT_BUTTON_CLOCK_VISIBILITY_AUDIT_OK');
