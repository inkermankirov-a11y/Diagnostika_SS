# Stage 6 — background work

First conservative batch: the minute-only flip clock schedules one timeout aligned to the minute boundary instead of a 1-second interval (60 wakeups/minute to roughly 1 while visible); cancel while the tab is hidden, resync on visibility/focus/pageshow, cancel stale animation timers. This is a reduction in clock wakeups, not a claim about whole-app CPU or battery usage.

Calculator: limit the direct observer to the utility overlay and remove the duplicate all-document observer for digit formatting; explicit mount refresh and existing input/click handlers remain, with keyboard Enter/Escape handling and per-screen reset. Skip identical font size writes. This prevents unrelated work in the client interface triggering calculator DOM scans.

Storage, save/backup, profile sync, payment, currency and weather fetching, scheduled reminders, access checks, diagnosis and localization remain untouched. Do not pause safety-critical or persistence tasks based on visibility. Verify clock with simulated minutes and tab lifecycle in three engines, calculator first-use/reopen and 12-digit guard on desktop and mobile, startup benchmark. Stage 4 passed its browser tests; stage 5 separate optimized artifact is not yet approved. No main or VPS deployment.
