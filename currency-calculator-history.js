'use strict';

// Legacy module retained for compatibility with older cached pages.
// The active currency calculator is implemented by currency-tools-fix.js.
// This file intentionally performs no DOM observation or periodic polling.
(() => {
  if (window.__diagnostikaLegacyCurrencyCalculatorHistoryReady) return;
  window.__diagnostikaLegacyCurrencyCalculatorHistoryReady = true;
})();
