# FocusFlow & NodeSpy — Planned Tasks

## Task 1: FocusFlow — Splash Fix, Logging System & Full Audit

**Goal:** Fix the app getting stuck on the splash screen due to silent failures during initialisation, and add a persistent structured log system for diagnostics.

**Status:** Complete

### Steps
1. [x] Write this TASKS.md file
2. [x] Create `src/services/startupLogger.ts` — timestamped, levelled log queue (INFO/WARN/ERROR), backed by AsyncStorage, capped at 500 entries with auto-rotation
3. [x] Integrate logger into `AppContext.init()` — wrap every async step with try/catch and log entries; emit `[STARTUP_COMPLETE]` once `SET_DB_READY` dispatches
4. [x] Fix splash screen stuck — ensure `finally` block in `init()` always dispatches `SET_DB_READY` + `SET_LOADING: false`; added logging in `RootLayout.bootstrap()`
5. [x] DB resilience in `database.ts` — on open/schema failure, call `resetDb()`, wait 300ms, retry once; never throw from common read operations
6. [x] Native module isolation — each native module call in its own try/catch so one crash cannot abort the others or block `SET_DB_READY`
7. [x] Enhance `ErrorBoundary.tsx` + `ErrorFallback.tsx` — capture error into startup logger, add "Share Logs" button (using native Share API)
8. [x] Diagnostics UI — add "Diagnostics" entry in Settings opening a modal with last 100 log entries, colour-coded by severity, Share/Clear buttons
9. [x] Full screen & service audit — wrapped all 4 tab screens with per-screen ErrorBoundary HOC; wrapped root layout in ErrorBoundary; improved error handling in AppContext callbacks

---

## Task 2: NodeSpy — Persistent Notification Bar & Selection Accuracy Fix

**Goal:** Fix the persistent notification bar in NodeSpy so it stays visible across app restarts, and fix the node selection accuracy so taps hit the correct element.

**Status:** Planned

### Steps
1. [ ] Investigate the notification bar implementation and identify why it disappears on restart
2. [ ] Fix persistence logic (SharedPreferences or WorkManager-based keep-alive)
3. [ ] Investigate node selection coordinate mapping
4. [ ] Fix selection accuracy (coordinate transform, scroll offset, density scaling)
5. [ ] Test both fixes end-to-end
