# FocusFlow — Architectural Issues

> Generated: August 2026  
> Covers: JS/TS layer (`artifacts/focusflow/src/`) and Android native layer (`artifacts/focusflow/android-native/`)

Severity tiers: **Critical** (data integrity / enforcement gap), **High** (maintainability / scalability), **Medium** (correctness / reliability), **Low** (polish / nice-to-have).

---

## Critical

### C1 — Raw SP key strings still scattered inside `AppBlockerAccessibilityService.kt`

**What:** Fix #1 (handoff) converted 6 key literals to `PREF_*` constants for the standalone-block and launcher paths. However, a second set of raw string literals remains inline in `onAccessibilityEvent`, `onServiceConnected`, and `checkAndHealVpn`, not covered by any constant:

| Raw literal | Where used |
|---|---|
| `"timed_session_pkg"` | `onServiceConnected` (line ~480), `onAccessibilityEvent` |
| `"timed_session_open_at_ms"` | `onServiceConnected` |
| `"block_cooldown_reset"` | `onAccessibilityEvent` |
| `"overlay_awaiting_pkg"` | `onAccessibilityEvent` |
| `"net_block_self_heal"` | `checkAndHealVpn` |
| `"net_block_vpn"` | `checkAndHealVpn` |
| `"task_end_ms"` | `onAccessibilityEvent`, `checkAndHealVpn` |

These keys are written from the JS side (or from `ForegroundTaskService`) using their own raw literals. A rename on either side silently diverges the read/write path — the exact class of bug Fix #1 was meant to eliminate.

**Fix:** Add `PREF_*` constants to the `companion object` for every remaining raw string literal in the service, then use them throughout. Cross-check with the JS `SP_KEYS` and `getAllEnforcementSettings()` to ensure full coverage.

---

### C2 — No single source of truth for SP keys across the Kotlin / JS boundary

**What:** Group A enforcement keys are defined in two independent places:
- Kotlin: `PREF_*` constants in `AppBlockerAccessibilityService`'s `companion object`
- JS: `SP_KEYS` in `SharedPrefsModule.ts`

There is no automated check that both sides agree. A key added to Kotlin but omitted from `SP_KEYS` (or vice versa) is silently untracked. The `getAllEnforcementSettings()` bridge call in `SharedPrefsModule.kt` is a third partial list that can drift from both.

**Fix (options):**
- **Option A (code-gen):** A build-time script reads the Kotlin constants and generates `SP_KEYS` automatically — single source of truth in Kotlin.
- **Option B (test):** A Kotlin unit test asserts that every `PREF_*` value that the service reads is present in the JSON output of `getAllEnforcementSettings()`. A JS test (or lint rule) asserts that `SP_KEYS` covers every key the JS bridge writes.
- **Option C (manual convention):** Maintain a comment block at the top of both files listing all shared keys, reviewed on every PR that touches either file. Low-tech but sufficient for a small team.

---

## High

### H1 — `AppContext.tsx` is a god object (1 855 lines)

**What:** A single React context holds all app state and all business logic:
- DB orchestration (`init`, `refreshTasks`, 31 DB function imports)
- 8+ `useEffect` hooks wired together via a `stateRef` workaround to avoid re-render loops
- Focus mode lifecycle (`startFocusMode`, `stopFocusMode`, `tryAutoStartFocus`)
- Task CRUD (`addTask`, `updateTask`, `deleteTask`, `completeTask`, `extendTask`, `skipTask`)
- All settings sync (`updateSettings` + 7 specialised setters + 8 `_sync*` helpers)
- Native event subscriptions (`EventBridge`, 10 event types)
- Widget sync, WAL checkpoint, DB health probe on resume, 30 s tick, standalone block expiry timer, focus auto-start one-shot timer, unresolved-task alert

The `eslint-disable-next-line react-hooks/exhaustive-deps` annotation appears on multiple effects — each one is a suppressed warning hiding real dependency coupling that cannot be expressed cleanly in the current design.

**Impact:** Any change to one concern (e.g. focus mode) risks unintended interactions with another (e.g. task list reload or SP sync). Testing individual pieces in isolation is impossible.

**Fix:** Extract into focused providers or services:
- `TaskProvider` — task CRUD, scheduler, unresolved-task prompt
- `SettingsProvider` — settings load/save, SP sync sweep, migration
- `FocusProvider` — focus session lifecycle, focus auto-start, violation dispatch
- `AppContext` becomes a thin composition root that wires the three providers together

Each provider has its own reducer, its own effects, and its own test surface.

---

### H2 — `AppBlockerAccessibilityService.kt` is a 3 553-line monolith

**What:** One class handles every enforcement concern:
- Focus mode overlay blocking
- Always-On 24/7 blocking with daily allowance enforcement (count / time-budget / interval)
- Standalone timed-block with expiry
- Blocked keywords (URL / content)
- System guard (Settings app, Play Store)
- Install-action blocking
- YouTube Shorts / Instagram Reels sub-screen blocking
- VPN self-heal watchdog
- Launcher lock during standalone block
- Nuclear mode bypass flag
- Greyout schedule windows
- Uninstall protection (4 separate guard paths)

`onAccessibilityEvent` is the single choke point through which every event passes — hundreds of lines of nested conditionals gate on combinations of SP flags read fresh on every event. On low-end devices with high event frequency (e.g. scrolling in a blocked app) this runs on the main accessibility thread.

**Impact:** Adding a new enforcement mode requires understanding the full conditional tree. A bug in one path can mask or activate another.

**Fix:** Extract each enforcement concern into its own `BlockingStrategy` class (or Kotlin `object`) with a single `shouldBlock(event, prefs): BlockDecision` method. `onAccessibilityEvent` becomes a dispatch loop over a registered list of strategies. Each strategy can be tested independently.

---

### H3 — `database.ts` mixes connection management, schema, migrations, and all queries (1 047 lines)

**What:** One file contains:
- SQLite singleton + dead-handle detection + retry logic (`runWithDb`, `runWithDbOr`, `probeDbHealth`, `resetDb`)
- Full schema DDL + index creation (`initSchema`)
- `migrateSettings()` migration runner
- 30+ exported query functions spanning tasks, settings, focus sessions, streaks, day completions, diagnostics, and pruning

**Impact:** A change to connection retry logic requires navigating past every query function. Finding where `focus_sessions` schema is defined means searching a 1 047-line file.

**Fix:** Split into:
- `db/connection.ts` — singleton, `runWithDb`, health probe, reset
- `db/schema.ts` — `initSchema`, `migrateSettings`
- `db/taskQueries.ts`
- `db/settingsQueries.ts`
- `db/focusSessionQueries.ts`
- `db/statsQueries.ts`

---

## Medium

### M1 — `AppSettings` is one unbounded JSON blob; any field change triggers a full 8-way SP sync

**What:** All settings — enforcement config (Group A), user preferences (Group C), and everything in between — are serialised into a single JSON blob and stored in one SQLite row. `updateSettings` always writes the full blob and then fans out to 8 concurrent SP sync calls (`_syncDailyAllowance`, `_syncAlwaysBlock`, `_syncBlockedWords`, `_syncAversions`, `_syncGreyoutSchedule`, `_syncSystemGuard`, `_syncStandaloneBlock`, and conditionally `setAllowedPackages`).

Toggling dark mode triggers the same SP sync sweep as changing the standalone block package list — even though the AccessibilityService doesn't care about dark mode.

**Impact:** Every settings write is heavier than it needs to be. As more features are added, the blob and the sync sweep grow together.

**Fix (incremental):** Add a `dirtyGroups` parameter to `updateSettings` (e.g. `updateSettings(next, { groups: ['enforcement'] })`) so the sync sweep only runs the relevant `_sync*` helpers. Group A and Group C writes stay in a single DB transaction but the native bridge calls are selective.

---

### M2 — `updateSettings` stale closure on `state.focusSession`

**What:** `updateSettings` is a `useCallback` that lists `state.focusSession` in its dependency array (line 1623). Every time a focus session starts or ends, a new `updateSettings` function is created. Components that call `updateSettings` immediately after `startFocusMode` may transiently hold the old version and miss the `setAllowedPackages` sync.

**Fix:** Replace the `state.focusSession` read with `stateRef.current.focusSession` (the pattern already used everywhere else in the file) and remove it from the deps array.

---

### M3 — `setStandaloneBlockAndAllowance` is a workaround for the stale-closure pattern

**What:** The compound setter exists because calling `setStandaloneBlock` then `setDailyAllowanceEntries` back-to-back overwrites the first write — each setter captures `state.settings` from its creation-time closure, so the second call operates on stale state. The fix was to add a new combined setter.

This is a symptom, not a solution: every time two setters need to be called together a new compound setter must be added.

**Fix:** Move setter logic out of `useCallback` closures that capture `state` and into pure functions that receive `currentSettings` as a parameter, reading from `stateRef.current` at call time. This eliminates stale-closure bugs at the root.

---

### M4 — `scheduled` tasks are never pruned

**What:** `dbPruneOldData` removes `completed`/`skipped` tasks older than 90 days but has no pruning path for `scheduled` tasks. A user who creates many future tasks and never completes them (or re-schedules repeatedly) accumulates an unbounded `scheduled` set. `dbGetAllTasks` (backup) and any full-table scan will grow proportionally.

**Fix:** Add a pruning rule for `scheduled` tasks whose `end_time` is older than N days (e.g. 180 days) — they are past-due and will never be acted on. Alternatively, add an explicit `archived` status and let users manually archive stale scheduled tasks.

---

### M5 — No React Error Boundary around `AppProvider`

**What:** If any code inside `AppProvider`'s render path throws synchronously (unlikely today but possible with future additions), React unmounts the entire tree and shows a blank screen with no user-visible error.

**Fix:** Wrap `AppProvider` in an `<ErrorBoundary>` that renders a "Something went wrong — restart the app" fallback. Expo Router supports error boundaries natively via `app/_layout.tsx`.

---

## Low

### L1 — Multiple overlapping timer systems with no coordination layer

**What:** Three separate timer mechanisms coexist:
1. The 30 s `setInterval` tick in `AppContext` (standalone block expiry, widget sync, focus auto-start safety net)
2. One-shot `setTimeout` in `AppContext` for precise standalone block expiry and focus auto-start
3. `usePomodoro.ts` with its own interval for the Pomodoro cycle
4. `useTimer.ts` with a separate countdown interval

These run independently. A long-backgrounded app that returns to foreground may fire multiple timers nearly simultaneously, causing several DB reads and SP writes to race.

**Mitigation:** Consolidate the 30 s tick and the one-shot timers into a single `TimerCoordinator` service that pauses all timers while the app is backgrounded and resumes them on foreground — currently each effect independently subscribes to `AppState`.

---

### L2 — Suppressed `react-hooks/exhaustive-deps` warnings mask real coupling

**What:** Multiple `useEffect` hooks in `AppContext` carry `// eslint-disable-next-line react-hooks/exhaustive-deps`. Each suppression is a place where the dependency array could not be expressed correctly within the current design.

**Impact:** ESLint can no longer catch regressions where a dependency is accidentally omitted. The suppressions are load-bearing — removing them would require restructuring the affected effects.

**Fix:** Address alongside H1 (god-object split). When each concern lives in its own provider with a tighter scope, the dependency arrays become expressible without suppression.

---

## Summary Table

| ID | Severity | Area | One-line description |
|---|---|---|---|
| C1 | Critical | Kotlin / SP | Raw SP key literals not yet covered by `PREF_*` constants in `AppBlockerAccessibilityService` |
| C2 | Critical | Kotlin / JS | No single source of truth for SP keys across the Kotlin/JS boundary |
| H1 | High | JS | `AppContext.tsx` god object — 1 855 lines, all state + all business logic in one context |
| H2 | High | Kotlin | `AppBlockerAccessibilityService.kt` monolith — 3 553 lines, all enforcement in one class |
| H3 | High | JS | `database.ts` mixes connection, schema, migration, and all queries in one 1 047-line file |
| M1 | Medium | JS | `AppSettings` blob + 8-way SP sync on every field change, regardless of which group changed |
| M2 | Medium | JS | `updateSettings` stale closure on `state.focusSession` — should use `stateRef` |
| M3 | Medium | JS | Compound setters are workarounds for the stale-closure pattern, not a real fix |
| M4 | Medium | JS/DB | `scheduled` tasks never pruned — unbounded growth on long-running installs |
| M5 | Medium | JS | No React Error Boundary around `AppProvider` |
| L1 | Low | JS | Multiple independent timer systems with no coordination — race risk on foreground resume |
| L2 | Low | JS | `react-hooks/exhaustive-deps` suppressions are load-bearing, masking real dep coupling |
