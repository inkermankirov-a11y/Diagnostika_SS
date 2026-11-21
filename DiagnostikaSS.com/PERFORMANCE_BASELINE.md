# Performance baseline — stage 1

Original commit: `cefc70123ae7bab00455c61d1b04bb4ce18b83ed`
Rollback branch: `backup/pre-performance-20261121`

Scope: DiagnostikaSS.com only. No changes to runtime code, local storage, accounts, permissions, client records, attachments or appearance.

## Static inventory

109 JavaScript tags, 24 CSS stylesheets, 3 preload tags; 1,611,185 bytes of directly linked local assets before compression (preloads excluded from the sum). Dynamic assets are additional. This is not a measurement of network transfer or startup time.

## Baseline CI

49 checks: 16 successful, 33 failed at the original commit. Existing failures must be investigated before optimization is merged; do not weaken assertions merely to pass. Examples: database audit expects older exact cache markers, browser tests expect a diagnosis button or mobile client actions that are not visible. A failed test alone does not prove loss of data.

- report-build-status: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930256679/job/136925289331
- deploy: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930256679/job/136925289311
- build: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930256679/job/136925118661
- request-selection: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257203/job/136925117331
- specialist-history: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257187/job/136925117288
- client-ui-boundary: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257303/job/136925117264
- core-events: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257489/job/136925117157
- db-foundation: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257415/job/136925117060
- client-api: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257226/job/136925116875
- client-module: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257350/job/136925116788
- production-smoke: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257380/job/136925116734
- service-boundary: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257379/job/136925116685
- ai-ui-boundary: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257270/job/136925116682
- session-module: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257307/job/136925116623
- core-crm: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257306/job/136925116534
- localization: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257317/job/136925116525
- request-ui-boundary: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257216/job/136925116505
- overdue-actions: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257276/job/136925116483
- calendar-number: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257269/job/136925116420
- notes: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257242/job/136925116389
- belief-hints: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257250/job/136925116379
- boundary: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257245/job/136925116354
- audit: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257284/job/136925116238
- audit: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257159/job/136925116206
- debug-client-flow: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257249/job/136925116198
- domain-ui-boundary: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257144/job/136925116122
- hierarchy-strong-vu: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257177/job/136925116112
- request-api: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257220/job/136925116085
- numbered-events: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257139/job/136925115968
- api-contract: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257184/job/136925115942
- verify: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257123/job/136925115910
- payment-api: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257137/job/136925115898
- ai-api: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257077/job/136925115843
- files-api: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257008/job/136925115770
- payment-ui-boundary: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257091/job/136925115760
- roles-access: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257068/job/136925115756
- weather: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257049/job/136925115733
- urgent-beacon: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257071/job/136925115722
- audit: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930256994/job/136925115654
- audit: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930257020/job/136925115620
- session-delete: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930256927/job/136925115435
- calendar-api: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930256886/job/136925115371
- hardening: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930256883/job/136925115338
- final-architecture: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930256889/job/136925115121
- unsaved-editor: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930256827/job/136925115075
- diagnosis-api: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930256881/job/136925115051
- export-api: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930256864/job/136925115050
- mobile: success — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930256831/job/136925115017
- new-ui: failure — https://github.com/inkermankirov-a11y/Diagnostika_SS/actions/runs/44930256820/job/136925114949

## Measurement protocol

Benchmark fresh and repeated navigation, 3 rounds per configuration, with isolated synthetic empty or 100-client datasets. Desktop Chromium/Firefox/WebKit; mobile Chromium/WebKit. WebKit is not the same as testing actual Safari on macOS/iOS. Use the same local server, runner/browser versions, fixtures and settings for comparisons. Capture dashboard-ready, first paint where available, resource sizes and failures. No real accounts or customer data. Local benchmark excludes real production authentication and server network latency; production measurements remain a separate task.

## Release gate

Before runtime optimization reaches main: reproduce and triage baseline browser failures, fix or update outdated tests with equivalent behavioral checks, run benchmark comparison, verify real user flows (clients, diagnosis, sessions, files, backup, permissions, localization, mobile) and preserve rollback. Do not change storage schema as a side effect of startup optimization.
